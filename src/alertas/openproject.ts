import {z} from 'zod';
import type {Alerta} from './repositorio.js';
const tarefaSchema=z.object({id:z.number().int().positive(),subject:z.string(),_links:z.object({addComment:z.object({href:z.string(),method:z.string().optional()}).optional()}).optional()});
export const tituloAlerta=(a:Pick<Alerta,'uf'|'leiaute'>)=>`[LEITOR-FISCAL] - Mapear leitor da UF ${a.uf} (leiaute ${a.leiaute})`;
export class OpenProject {
 private readonly base:URL;
 constructor(base:string,private readonly chave:string,private readonly tipoId:number,private readonly prioridadeId:number,private readonly enviar:typeof fetch=fetch,private readonly projetoId:number=9){
  this.base=new URL(base);if(this.base.username||this.base.password||(!['https:'].includes(this.base.protocol)&&!(this.base.protocol==='http:'&&['localhost','127.0.0.1'].includes(this.base.hostname))))throw new Error('URL OpenProject inválida');
 }
 private async pedir(caminho:string,method='GET',body?:unknown){
  const url=new URL(caminho,this.base);if(url.origin!==this.base.origin||!url.pathname.startsWith('/api/v3/'))throw new Error('Link OpenProject inválido');
  const res=await this.enviar(url,{method,redirect:'error',signal:AbortSignal.timeout(15_000),headers:{authorization:'Basic '+Buffer.from('apikey:'+this.chave).toString('base64'),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!res.ok)throw new Error('OpenProject indisponível');
  const partes:Uint8Array[]=[];let tamanho=0;if(res.body)for await(const parte of res.body){tamanho+=parte.length;if(tamanho>2_000_000)throw new Error('Resposta OpenProject grande');partes.push(parte);}
  return JSON.parse(Buffer.concat(partes).toString('utf8')) as unknown;
 }
 async obterOuCriar(a:Alerta){
  const titulo=tituloAlerta(a);const query=new URLSearchParams({filters:JSON.stringify([{project:{operator:'=',values:[String(this.projetoId)]}},{subject:{operator:'~',values:[titulo]}}]),pageSize:'100'});
  const lista=z.object({_embedded:z.object({elements:z.array(tarefaSchema)}),total:z.number().int().nonnegative()}).parse(await this.pedir('/api/v3/work_packages?'+query));
  const existente=lista._embedded.elements.find(t=>t.subject===titulo);if(existente)return existente.id;
  if(lista.total>lista._embedded.elements.length)throw new Error('Busca incompleta; não criar duplicata');
  const criada=tarefaSchema.parse(await this.pedir('/api/v3/work_packages','POST',{subject:titulo,description:{format:'markdown',raw:`UF: ${a.uf}\nLeiaute: ${a.leiaute}\nMotivo: ${a.motivo}\nCriado em: ${a.criada_em.toISOString()}\nLeituras: ${a.contador}\nAlerta local: ${a.id}\nConsultar: npm run amostra:ver -- ${a.uf} ${a.leiaute}`},_links:{project:{href:'/api/v3/projects/'+this.projetoId},type:{href:'/api/v3/types/'+this.tipoId},priority:{href:'/api/v3/priorities/'+this.prioridadeId}}}));return criada.id;
 }
 async comentar(tarefa:number,contador:number){
  const t=tarefaSchema.parse(await this.pedir('/api/v3/work_packages/'+tarefa));const link=t._links?.addComment;
  if(!link || (link.method && link.method.toUpperCase()!=='POST'))return false;
  await this.pedir(link.href,'POST',{comment:{format:'markdown',raw:`Contador local de leituras deste UF/leiaute: ${contador}. Amostras disponíveis somente na CLI local do serviço.`}});return true;
 }
}
