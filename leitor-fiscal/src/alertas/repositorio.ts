import {randomUUID,createHash} from 'node:crypto';
import {sql,type Kysely} from 'kysely';
import type {Banco} from '../db/conexao.js';
import {load} from 'cheerio';
import {recortarPagina} from '../seguranca/removerCpf.js';
import {ErroLeitura} from '../shared/erro.js';
export type MotivoAlerta='UF_SEM_LEITOR'|'LEITOR_FALHOU';
export interface Alerta {id:string;uf:string;leiaute:string;motivo:MotivoAlerta;contador:number;tentativas:number;tarefa_id:number|null;criada_em:Date;ultimo_comentario:Date|null}
/** Recorte mínimo quando o leiaute mudou tanto que emitente, CNPJ ou tabela sumiram: só UF, leiaute e a estrutura (tags, ids e classes, números trocados por N), nunca texto da página. */
function recorteMinimo(pagina:{html:string;uf:string;leiaute:string}){
 const $=load(pagina.html);const estrutura=new Set<string>();
 $('body, body *').each((_i,el)=>{
  if(estrutura.size>=300)return;
  const t=el as {tagName?:string};
  const id=($(el).attr('id')??'').replace(/\d+/g,'N').replace(/[^\w +-]/g,'');
  const classes=($(el).attr('class')??'').split(/\s+/).filter(Boolean).map(c=>c.replace(/\d+/g,'N').replace(/[^\w-]/g,'')).join('.');
  estrutura.add((t.tagName??'?')+(id?'#'+id:'')+(classes?'.'+classes:''));
 });
 return `Recorte mínimo: a página perdeu emitente, CNPJ ou tabela de itens.\nUF: ${pagina.uf}\nLeiaute: ${pagina.leiaute}\nTamanho do HTML: ${pagina.html.length}\nEstrutura:\n${[...estrutura].sort().join('\n')}`;
}
function recortarParaAmostra(pagina:{html:string;uf:string;leiaute:string}){
 try{return recortarPagina(pagina.html);}
 catch(erro){if(erro instanceof ErroLeitura)return recorteMinimo(pagina);throw erro;}
}
export class Alertas {
 constructor(private readonly db:Kysely<Banco>){}
 async registrar(pagina:{html:string;uf:string;leiaute:string},motivo:MotivoAlerta){
  if(!/^[A-Z]{2}$/.test(pagina.uf)||!new RegExp('^'+pagina.uf+'-[a-zA-Z0-9-]{1,80}$').test(pagina.leiaute))throw new Error('Identificador de leiaute inválido');
  const texto=recortarParaAmostra(pagina).replace(/https?:\/\/\S+/gi,'[endereço removido]');
  const conteudo='<pre>'+texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>';
  const resumo=createHash('sha256').update(conteudo).digest('hex');
  return this.db.transaction().execute(async tx=>{
   const r=await sql<{id:string}>`insert into alerta(id,uf,leiaute,motivo) values(${randomUUID()},${pagina.uf},${pagina.leiaute},${motivo})
    on conflict(uf,leiaute) where estado='ABERTO' do update set contador=alerta.contador+1 returning id`.execute(tx);
   const id=r.rows[0]!.id;
   await sql`insert into amostra(id,alerta_id,resumo,conteudo) values(${randomUUID()},${id},${resumo},${conteudo}) on conflict(alerta_id,resumo) do nothing`.execute(tx);
   return id;
  });
 }
 async limpar(agora=new Date()){
  const corte=new Date(agora);corte.setUTCFullYear(corte.getUTCFullYear()-1);
  await sql`delete from amostra where criada_em < ${corte}`.execute(this.db);
 }
 async pendentes(agora:Date){return (await sql<Alerta>`select * from alerta where estado='ABERTO' and proxima_tentativa <= ${agora} order by criada_em limit 50`.execute(this.db)).rows;}
 async tentativa(id:string,agora:Date){await sql`update alerta set ultima_tentativa=${agora}, tentativas=tentativas+1, proxima_tentativa=${new Date(agora.getTime()+60_000)} where id=${id}`.execute(this.db);}
 async enviado(id:string,tarefa:number,agora:Date){await sql`update alerta set envio='ENVIADO', tarefa_id=${tarefa}, proxima_tentativa=${new Date(agora.getTime()+86_400_000)} where id=${id}`.execute(this.db);}
 async falhou(id:string,tentativas:number,agora:Date){const espera=Math.min(3600,60*2**Math.min(tentativas,6));await sql`update alerta set proxima_tentativa=${new Date(agora.getTime()+espera*1000)} where id=${id}`.execute(this.db);}
 async comentou(id:string,agora:Date){await sql`update alerta set ultimo_comentario=${agora} where id=${id}`.execute(this.db);}
 async resolver(uf:string,leiaute:string){await sql`update alerta set estado='RESOLVIDO', resolvida_em=now() where uf=${uf} and leiaute=${leiaute} and estado='ABERTO'`.execute(this.db);}
 async amostras(uf:string,leiaute:string){return (await sql<{id:string;conteudo:string;criada_em:Date}>`select a.id,a.conteudo,a.criada_em from amostra a join alerta l on l.id=a.alerta_id where l.uf=${uf} and l.leiaute=${leiaute} order by a.criada_em`.execute(this.db)).rows;}
}
