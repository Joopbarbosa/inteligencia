import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createServer} from 'node:http';
import {sql} from 'kysely';
import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {conectar} from '../src/db/conexao.js';
import {migrar} from '../src/db/migrar.js';
import {Alertas,type Alerta} from '../src/alertas/repositorio.js';
import {WorkerAlertas} from '../src/alertas/worker.js';
import {OpenProject,tituloAlerta} from '../src/alertas/openproject.js';
import {Orquestrador} from '../src/leitura/orquestrador.js';
import {CacheMemoria} from '../src/cache/notas.js';
import {lerSp} from '../src/leitores/sp/leitor.js';
const env={...parseEnv(readFileSync('.pocket.env','utf8')),...process.env};const url=new URL(env.DATABASE_URL??'');
if(env.POCKET_TEST_DB!=='1'||!env.DB_NAME?.startsWith('test_')||!env.DB_CONTAINER?.startsWith('test_')||url.hostname!=='localhost'||url.pathname!=='/'+env.DB_NAME||url.port!==env.DB_PORT)throw new Error('Alvo não confirmado');
const db=conectar(url.href);const repo=new Alertas(db);const prefixo='SP-'+randomUUID();
const html=readFileSync(new URL('./fixtures/sp-controlado.html',import.meta.url),'utf8');
const pagina=(n='')=>({uf:'SP',leiaute:prefixo+n,html});
const linhas=async()=> (await sql<Alerta>`select * from alerta where leiaute like ${prefixo+'%'}`.execute(db)).rows;
const limpar=async()=>{await sql`delete from amostra where alerta_id in(select id from alerta where leiaute like ${prefixo+'%'})`.execute(db);await sql`delete from alerta where leiaute like ${prefixo+'%'}`.execute(db);};
beforeAll(async()=>{await migrar(db);});afterEach(limpar);afterAll(async()=>db.destroy());
it('CEN2/3/53: grava local antes do envio, deduplica conteúdo e alerta aberto sob concorrência',async()=>{
 const ids=await Promise.all(Array.from({length:6},()=>repo.registrar(pagina(),'LEITOR_FALHOU')));
 expect(new Set(ids).size).toBe(1);expect((await linhas())[0]?.contador).toBe(6);
 const amostras=await repo.amostras('SP',prefixo);expect(amostras).toHaveLength(1);
 const texto=amostras[0]!.conteudo;expect(texto).toContain('Papelaria Aurora');expect(texto).not.toContain('123.456.789-09');expect(texto).not.toContain('www.nfce');expect(texto).not.toContain('CONSUMIDOR');
 await repo.registrar({...pagina(),html:html.replace('Folha A4 premium','Folha A3 premium')},'LEITOR_FALHOU');expect(await repo.amostras('SP',prefixo)).toHaveLength(2);
 await repo.registrar(pagina('-novo'),'UF_SEM_LEITOR');expect(await linhas()).toHaveLength(2);
});
it('retém12meses, limpeza remove só antigas, resolve por UF/leiaute',async()=>{
 const id=await repo.registrar(pagina(),'UF_SEM_LEITOR');await repo.registrar(pagina('-outro'),'LEITOR_FALHOU');
 await sql`update amostra set criada_em=${new Date('2024-12-31T00:00:00Z')} where alerta_id=${id}`.execute(db);
 await repo.limpar(new Date('2026-01-01T00:00:00Z'));expect(await repo.amostras('SP',prefixo)).toHaveLength(0);expect(await repo.amostras('SP',prefixo+'-outro')).toHaveLength(1);
 await repo.resolver('SP',prefixo);expect((await repo.pendentes(new Date())).filter(a=>a.leiaute.startsWith(prefixo))).toHaveLength(1);
});
it('CEN54: OpenProject cai/volta, backoff persiste e execução simultânea não duplica',async()=>{
 await repo.registrar(pagina(),'UF_SEM_LEITOR');let agora=new Date();let falhar=true;
 const criar=vi.fn(async()=>{if(falhar)throw new Error('indisponível');return 321;});const comentar=vi.fn(async()=>false);
 const worker=new WorkerAlertas(repo,{obterOuCriar:criar,comentar},()=>agora);
 await Promise.all([worker.executar(),worker.executar()]);expect(criar).toHaveBeenCalledOnce();expect((await linhas())[0]?.tarefa_id).toBeNull();
 await worker.executar();expect(criar).toHaveBeenCalledOnce();agora=new Date(agora.getTime()+60_001);falhar=false;await worker.executar();expect((await linhas())[0]?.tarefa_id).toBe(321);
 agora=new Date(agora.getTime()+86_400_001);await worker.executar();expect(comentar).toHaveBeenCalledOnce();expect(criar).toHaveBeenCalledTimes(2);
});
it('comentário suportado no máximo1por24h; sem suporte mantém contador local',async()=>{
 await repo.registrar(pagina(),'LEITOR_FALHOU');let agora=new Date();const comentar=vi.fn(async()=>true);
 const worker=new WorkerAlertas(repo,{obterOuCriar:async()=>321,comentar},()=>agora);await worker.executar();
 agora=new Date(agora.getTime()+86_400_001);await worker.executar();await worker.executar();expect(comentar).toHaveBeenCalledOnce();expect((await linhas())[0]?.ultimo_comentario).toEqual(agora);
});
it('HTTP real simulado: tarefa criada com resposta perdida é adotada na repetição sem duplicar',async()=>{
 await repo.registrar(pagina(),'LEITOR_FALHOU');const alerta=(await linhas())[0]!;let tarefa: {id:number;subject:string}|undefined;let criacoes=0;const corpos:unknown[]=[];
 const servidor=createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({_embedded:{elements:tarefa?[tarefa]:[]},total:tarefa?1:0}));return;}
  const partes:Buffer[]=[];for await(const parte of req)partes.push(Buffer.from(parte));const body=JSON.parse(Buffer.concat(partes).toString());corpos.push(body);criacoes++;tarefa={id:987,subject:body.subject};req.socket.destroy();
 });await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r));
 try{const endereco=servidor.address();if(!endereco||typeof endereco==='string')throw new Error('Porta ausente');const op=new OpenProject(`http://127.0.0.1:${endereco.port}`,'ficticia',1,8);
  await expect(op.obterOuCriar(alerta)).rejects.toThrow();expect(await op.obterOuCriar(alerta)).toBe(987);expect(criacoes).toBe(1);
  const enviado=JSON.stringify(corpos);expect(enviado).toContain(tituloAlerta(alerta));expect(enviado).not.toContain('123.456.789-09');expect(enviado).not.toContain('Folha A4');expect(enviado).not.toContain('chaveAcesso');expect(enviado).not.toContain('www.nfce');
 }finally{await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));}
});
it('link de comentário externo não recebe credencial; API sem addComment é opcional',async()=>{
 const enviar=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({id:1,subject:'teste',_links:{addComment:{href:'https://outro.invalid/api/v3/activities',method:'POST'}}}),{status:200}));
 const op=new OpenProject('https://openproject.example','ficticia',1,8,enviar);await expect(op.comentar(1,3)).rejects.toThrow('Link OpenProject inválido');expect(enviar).toHaveBeenCalledOnce();
 const sem=new OpenProject('https://openproject.example','ficticia',1,8,async()=>new Response(JSON.stringify({id:1,subject:'teste'})));expect(await sem.comentar(1,3)).toBe(false);
});
it('só fallback do portal gera amostra; cache/leitorUF/XML/foto não geram alerta',async()=>{
 const nota=lerSp(html)!;const registrar=vi.fn(async()=>{});const cache=new CacheMemoria();const ctx={chaveClienteId:randomUUID(),contaId:randomUUID(),signal:new AbortController().signal};
 const qrUrl='https://www.nfce.fazenda.sp.gov.br/qrcode?p='+nota.chaveAcesso+'|2|1|1|HASH';
 const orq=new Orquestrador({cache,buscarPortal:async()=>html,ia:async()=>nota,registrarFallback:registrar},true);
 await orq.ler({modelo:'NFCE',qrUrl},ctx);await orq.ler({modelo:'NFCE',qrUrl},ctx);expect(registrar).toHaveBeenCalledOnce();
 await new Orquestrador({buscarPortal:async()=>html,leitorUf:async()=>nota,registrarFallback:registrar},true).ler({modelo:'NFCE',qrUrl},ctx);
 await orq.ler({modelo:'NFE',arquivo:{dados:readFileSync(new URL('./fixtures/nfe.xml',import.meta.url)),mime:'application/xml'}},ctx);
 await orq.ler({modelo:'NFE',confirmouEnvioIa:true,arquivo:{dados:Buffer.from('imagem'),mime:'image/png'}},ctx);expect(registrar).toHaveBeenCalledOnce();
});
it('comentário com resposta perdida não se repete no mesmo dia; backoff chega a1h',async()=>{
 await repo.registrar(pagina(),'LEITOR_FALHOU');let agora=new Date();const comentar=vi.fn(async()=>{throw new Error('resposta perdida');});
 const worker=new WorkerAlertas(repo,{obterOuCriar:async()=>987,comentar},()=>agora);await worker.executar();agora=new Date(agora.getTime()+86_400_001);await worker.executar();
 agora=new Date(agora.getTime()+3600_001);await worker.executar();expect(comentar).toHaveBeenCalledOnce();
 const id=(await linhas())[0]!.id;await repo.falhou(id,10,agora);const r=await sql<{proxima_tentativa:Date}>`select proxima_tentativa from alerta where id=${id}`.execute(db);expect(r.rows[0]!.proxima_tentativa.getTime()-agora.getTime()).toBe(3600_000);
});
it('HAL addComment lowercase post é aceito e comentário não contém documento',async()=>{
 const enviar=vi.fn<typeof fetch>(async(_u,options)=>new Response(JSON.stringify(options?.method==='POST'?{id:3}:{id:1,subject:'teste',_links:{addComment:{href:'/api/v3/work_packages/1/activities',method:'post'}}})));
 expect(await new OpenProject('https://openproject.example','ficticia',1,8,enviar).comentar(1,7)).toBe(true);
 expect(enviar.mock.calls[1]?.[1]?.method).toBe('POST');expect(JSON.parse(enviar.mock.calls[1]![1]!.body as string).comment.raw).toContain('7');
});
