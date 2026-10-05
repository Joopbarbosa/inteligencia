import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {it,expect,vi} from 'vitest';
import QRCode from 'qrcode';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {CadeiaIa, type LogUsoIa} from '../src/ia/cadeia.js';
import {criarProvedor,FalhaProvedor,type ProvedorIa} from '../src/ia/adaptadores.js';
import {prepararIa} from '../src/ia/preparar.js';
import {removerCpf,recortarPagina} from '../src/seguranca/removerCpf.js';
import {lerXml} from '../src/leitores/xml/leitor.js';
import {configurarIa} from '../src/ia/configuracao.js';
const nota=lerXml(readFileSync(new URL('./fixtures/nfe.xml',import.meta.url)));
const html=readFileSync(new URL('./fixtures/sp-controlado.html',import.meta.url),'utf8');
const png=await QRCode.toBuffer('https://www.nfce.fazenda.sp.gov.br',{width:200});
const contexto=()=>({chaveClienteId:randomUUID(),contaId:randomUUID(),signal:new AbortController().signal});
const foto={modelo:'NFE' as const,arquivo:{dados:png,mime:'image/png'},confirmouEnvioIa:true};
const saida=()=>({json:JSON.stringify(nota),entradaTokens:127,saidaTokens:53});
it('integra transporte HTTP real com servidor IA local, sem credenciais externas',async()=>{
 const recebidos: unknown[]=[];
 const servidor=createServer(async(req,res)=>{
  const partes: Buffer[]=[];for await(const parte of req)partes.push(Buffer.from(parte));
  recebidos.push(JSON.parse(Buffer.concat(partes).toString('utf8')));
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(nota)}}],usage:{prompt_tokens:127,completion_tokens:53}}));
 });
 await new Promise<void>(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 try {
  const endereco=servidor.address();if(!endereco || typeof endereco==='string')throw new Error('Porta de teste ausente');
  const p=criarProvedor({nome:'simulado',modelo:'modelo-teste',urlBase:`http://127.0.0.1:${endereco.port}/v1`,chave:'credencial-ficticia',tipo:'openai-compativel'});
  const resultado=await new CadeiaIa([p]).ler(foto,contexto());
  expect(resultado.metodo).toBe('IA');expect(resultado.itens).toEqual(nota.itens);
  expect(recebidos).toHaveLength(1);
 } finally {await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));}
});
function provedor(ler: ProvedorIa['ler']=vi.fn(async()=>saida())): ProvedorIa { return {nome:'primario',modelo:'deepseek-flash',ler}; }
it('CEN8: recorta emitente/itens; remove CPF com/sem pontuação, conserva CNPJ alfanumérico',()=>{
 const texto=recortarPagina(html.replace('123.456.789-09','123.456.789-09 12345678909'));
 expect(texto).toContain('Papelaria Aurora');expect(texto).toContain('12.ABC.345/0001-90');expect(texto).toContain('Folha A4 premium');
 expect(texto).not.toContain('123.456.789-09');expect(texto).not.toContain('12345678909');expect(texto).not.toContain('Número:');
 expect(removerCpf('CPF 12345678909 CNPJ 12345678000190')).toBe('CPF [CPF removido] CNPJ 12345678000190');
});
it('portal IA recebe somente emitente/itens; metadata é combinada localmente',async()=>{
 const extracao={emitente:{cnpj:'12ABC345000190',nome:'Papelaria Aurora',uf:'SP'},itens:[{nome:'Folha A4 premium',quantidade:'2.5',valorFinal:'19.95'}]};
 const ler=vi.fn<ProvedorIa['ler']>(async()=>({json:JSON.stringify(extracao),entradaTokens:100,saidaTokens:30}));
 const n=await new CadeiaIa([provedor(ler)]).ler({modelo:'NFCE',chaveAcesso:'35'+'1'.repeat(42),pagina:{html,uf:'SP',leiaute:'SP-fixture'}},contexto());
 expect(ler.mock.calls[0]?.[0].texto).not.toContain('CPF');expect(n).toMatchObject({metodo:'IA',origem:'NFCE_QR',totalPago:'59.57',dataEmissao:'2026-05-20T14:31:29-03:00',chaveAcesso:'35'+'1'.repeat(42)});
});
it.each(['json','schema','timeout','5xx','429'])('fallback após %s; schema garante nomes/decimais',async falha=>{
 const primeiro=vi.fn(async()=>{
  if(falha==='json')return {...saida(),json:'não-json'};
  if(falha==='schema')return {...saida(),json:JSON.stringify({...nota,itens:[{nome:'Inventado',quantidade:'x'}]})};
  if(falha==='timeout')return new Promise<ReturnType<typeof saida>>(()=>{});
  throw new FalhaProvedor(true);
 });const segundo=vi.fn(async()=>saida());
 const n=await new CadeiaIa([provedor(primeiro),{...provedor(segundo),nome:'fallback'}],()=>undefined,20).ler(foto,contexto());
 expect(primeiro).toHaveBeenCalledOnce();expect(segundo).toHaveBeenCalledOnce();expect(n.metodo).toBe('IA');expect(n.origem).toBe('NFE_FOTO');expect(n.itens[0]?.nome).toBe(nota.itens[0]?.nome);expect(n.itens[0]?.valorFinal).toBe(nota.itens[0]?.valorFinal);
});
it('400/credencial não retenta; esgotada/aborto não envia mais',async()=>{
 const proximo=vi.fn(async()=>saida());
 await expect(new CadeiaIa([provedor(vi.fn(async()=>{throw new FalhaProvedor(false);})),provedor(proximo)]).ler(foto,contexto())).rejects.toThrow('IA_INDISPONIVEL');expect(proximo).not.toHaveBeenCalled();
 await expect(new CadeiaIa([provedor(vi.fn(async()=>({...saida(),json:'{}'})))]).ler(foto,contexto())).rejects.toThrow('IA_INDISPONIVEL');
 const c=contexto();const a=new AbortController();a.abort();await expect(new CadeiaIa([provedor(proximo)]).ler(foto,{...c,signal:a.signal})).rejects.toThrow();expect(proximo).not.toHaveBeenCalled();
});
it('chave/UF incoerente segue fallback e não vira resultado válido',async()=>{
 const primeiro=vi.fn(async()=>({...saida(),json:JSON.stringify({...nota,uf:'RJ'})}));const segundo=vi.fn(async()=>saida());
 expect((await new CadeiaIa([provedor(primeiro),provedor(segundo)]).ler(foto,contexto())).uf).toBe('SP');expect(segundo).toHaveBeenCalledOnce();
});
it('logs só provedor/modelo/tokens/custo; valores não redondos, sem conteúdo/segredos',async()=>{
 const log=vi.fn<(uso: LogUsoIa)=>void>();await new CadeiaIa([provedor()],log,20_000,{primario:{entrada:0.37,saida:0.91}}).ler(foto,contexto());
 expect(log.mock.calls[0]?.[0]).toMatchObject({provedor:'primario',modelo:'deepseek-flash',entradaTokens:127,saidaTokens:53,});expect(log.mock.calls[0]?.[0].custoEstimadoUsd).toBeCloseTo(0.00009522,12);
 expect(JSON.stringify(log.mock.calls)).not.toContain(nota.emitente.nome);expect(JSON.stringify(log.mock.calls)).not.toContain(nota.chaveAcesso);
});
it('adaptadores HTTP compatível e Anthropic usam payload/headers e tokens corretos',async()=>{
 const enviar=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(nota)}}],usage:{prompt_tokens:127,completion_tokens:53}}),{status:200}));
 const cfg={nome:'primario',modelo:'deepseek-flash',urlBase:'https://api.deepseek.com/v1',chave:'chave-ficticia',tipo:'openai-compativel' as const};
 expect((await criarProvedor(cfg,enviar).ler({arquivo:foto.arquivo},'instrucao',contexto().signal)).entradaTokens).toBe(127);
 const chamada=enviar.mock.calls[0]!;expect(chamada[0]).toBe('https://api.deepseek.com/v1/chat/completions');
 const options=chamada[1]!;expect(options.headers).toMatchObject({authorization:'Bearer chave-ficticia'});const body=JSON.parse(options.body as string);expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,'+png.toString('base64'));
 const anth=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(nota)}],usage:{input_tokens:91,output_tokens:31}}),{status:200}));
 const pdf=Buffer.from('%PDF-fixture');await criarProvedor({...cfg,tipo:'anthropic',urlBase:'https://api.anthropic.com/v1'},anth).ler({arquivo:{dados:pdf,mime:'application/pdf'}},'instrucao',contexto().signal);
 const payload=JSON.parse(anth.mock.calls[0]![1]!.body as string);expect(payload.messages[0].content[1]).toEqual({type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf.toString('base64')}});
});
it.each([429,500,503,400,401])('status HTTP %s determina fallback',async status=>{
 const enviar=vi.fn<typeof fetch>(async()=>new Response('{}',{status}));
 try {await criarProvedor({nome:'p',modelo:'m',urlBase:'https://api.deepseek.com/v1',chave:'ficticia',tipo:'openai-compativel'},enviar).ler({texto:'emitente e itens'},'instrucao',contexto().signal);expect.fail('Deveria falhar');}
 catch(e){expect(e).toBeInstanceOf(FalhaProvedor);expect((e as FalhaProvedor).repetir).toBe(status===429 || status>=500);}
});
it('PDF textual remove CPF; PDF escaneado/imagem preserva original com confirmação',async()=>{
 const doc=await PDFDocument.create();const page=doc.addPage();const font=await doc.embedFont(StandardFonts.Helvetica);page.drawText('Emitente Aurora CNPJ 12345678000190\nCPF 123.456.789-09\nITENS Papel A4 17,43',{font,size:12});
 const dados=Buffer.from(await doc.save());const r=await prepararIa({modelo:'NFE',arquivo:{dados,mime:'application/pdf'},confirmouEnvioIa:true},contexto().signal);
 expect(r.conteudo.texto).toContain('Emitente Aurora');expect(r.conteudo.texto).not.toContain('123.456.789-09');expect(r.conteudo.arquivo).toBeUndefined();
 const scan=await PDFDocument.create();scan.addPage();const original=Buffer.from(await scan.save());const s=await prepararIa({modelo:'NFE',arquivo:{dados:original,mime:'application/pdf'},confirmouEnvioIa:true},contexto().signal);expect(s.conteudo.arquivo?.dados).toEqual(original);
 await expect(prepararIa({...foto,confirmouEnvioIa:false},contexto().signal)).rejects.toThrow('CONFIRMACAO_ENVIO_IA_AUSENTE');
});
it('IA desligada não exige credenciais; configuração explícita valida URLs/credenciais',()=>{
 expect(configurarIa({IA_HABILITADA:'0'})).toBeUndefined();expect(()=>configurarIa({IA_HABILITADA:'1'})).toThrow();
 expect(()=>criarProvedor({nome:'p',modelo:'m',urlBase:'http://endereco-inseguro/v1',chave:'x',tipo:'anthropic'})).toThrow();
});
