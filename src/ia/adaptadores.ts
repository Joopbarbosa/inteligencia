import { z } from 'zod';
import { imagensPdf } from '../leitura/pdf.js';
export interface ConteudoIa { texto?: string | undefined; arquivo?: {dados: Buffer; mime: string} | undefined }
export interface ResultadoIa { json: string; entradaTokens: number; saidaTokens: number }
export interface ProvedorIa { nome: string; modelo: string; ler(conteudo: ConteudoIa, instrucao: string, signal: AbortSignal): Promise<ResultadoIa> }
export interface ConfigProvedor { nome: string; modelo: string; urlBase: string; chave: string; tipo: 'openai-compativel' | 'anthropic' }
export class FalhaProvedor extends Error { constructor(readonly repetir: boolean) { super('FALHA_PROVEDOR'); } }
const tokens = z.number().int().nonnegative().max(1_000_000_000);
const compativel = z.object({ choices:z.array(z.object({message:z.object({content:z.string()})})).min(1),
 usage:z.object({prompt_tokens:tokens,completion_tokens:tokens}) });
const anthropic = z.object({content:z.array(z.object({type:z.string(),text:z.string().optional()})),
 usage:z.object({input_tokens:tokens,output_tokens:tokens}) });
async function jsonLimitado(resposta: Response): Promise<unknown> {
 if (!resposta.body) throw new FalhaProvedor(true);
 const leitor = resposta.body.getReader(); const partes: Uint8Array[]=[]; let bytes=0;
 try {
  while(true) { const {done,value}=await leitor.read();if(done)break;bytes+=value.byteLength;
   if(bytes>2*1024*1024)throw new FalhaProvedor(true);partes.push(value); }
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
 } finally { await leitor.cancel().catch(()=>undefined); }
}
export function criarProvedor(config: ConfigProvedor, enviar: typeof fetch = fetch): ProvedorIa {
 const base = new URL(config.urlBase);
 if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && process.env.NODE_ENV === 'test' && ['localhost','127.0.0.1'].includes(base.hostname))))
  throw new Error('Configuração de provedor inválida');
 const url = new URL(config.tipo === 'anthropic' ? 'messages' : 'chat/completions',config.urlBase.replace(/\/?$/,'/')).href;
 return { nome:config.nome,modelo:config.modelo,async ler(conteudo,instrucao,signal) {
  let payload: unknown;const headers: Record<string,string> = {'content-type':'application/json'};
  if(config.tipo === 'anthropic') {
   headers['x-api-key']=config.chave;headers['anthropic-version']='2023-06-01';
   const content: unknown[] = [{type:'text',text:conteudo.texto??'Leia o documento anexado.'}];
   if(conteudo.arquivo) content.push({type:conteudo.arquivo.mime === 'application/pdf'?'document':'image',
    source:{type:'base64',media_type:conteudo.arquivo.mime,data:conteudo.arquivo.dados.toString('base64')}});
   payload={model:config.modelo,max_tokens:8192,system:instrucao,messages:[{role:'user',content}]};
  } else {
   headers.authorization='Bearer '+config.chave;
   const content: unknown[]=[{type:'text',text:conteudo.texto??'Leia o documento anexado.'}];
   if(conteudo.arquivo) {
    const arquivo=conteudo.arquivo;
    let imagens: {dados:Buffer;mime:string}[];
    if(arquivo.mime === 'application/pdf') {
     try { imagens=(await imagensPdf(arquivo.dados,signal)).map(dados=>({dados,mime:'image/png'})); }
     catch { signal.throwIfAborted();throw new FalhaProvedor(true); }
    } else imagens=[arquivo];
    for(const imagem of imagens)content.push({type:'image_url',image_url:{url:`data:${imagem.mime};base64,${imagem.dados.toString('base64')}`}});
   }
   payload={model:config.modelo,messages:[{role:'system',content:instrucao},{role:'user',content}],response_format:{type:'json_object'}};
  }
  let resposta: Response;
  try { resposta=await enviar(url,{method:'POST',headers,body:JSON.stringify(payload),signal,redirect:'error'}); }
  catch { signal.throwIfAborted();throw new FalhaProvedor(true); }
  if(!resposta.ok) { await resposta.body?.cancel().catch(()=>undefined);throw new FalhaProvedor(resposta.status===429 || resposta.status>=500); }
  try {
   const dados=await jsonLimitado(resposta);
   if(config.tipo === 'anthropic') {
    const r=anthropic.parse(dados);const texto=r.content.filter(c=>c.type==='text').map(c=>c.text??'').join('');
    if(!texto)throw new FalhaProvedor(true);return {json:texto,entradaTokens:r.usage.input_tokens,saidaTokens:r.usage.output_tokens};
   }
   const r=compativel.parse(dados);return {json:r.choices[0]!.message.content,entradaTokens:r.usage.prompt_tokens,saidaTokens:r.usage.completion_tokens};
  } catch { signal.throwIfAborted();throw new FalhaProvedor(true); }
 }};
}
