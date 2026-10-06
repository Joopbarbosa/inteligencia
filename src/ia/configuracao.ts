import { z } from 'zod';
import { criarProvedor, type ConfigProvedor } from './adaptadores.js';
import { CadeiaIa } from './cadeia.js';
export function configurarIa(env: NodeJS.ProcessEnv = process.env): CadeiaIa | undefined {
 if(!['1','true'].includes(env.IA_HABILITADA??'0'))return undefined;
 const schema=z.object({nome:z.string(),modelo:z.string().min(1),urlBase:z.url(),chave:z.string().min(1),tipo:z.enum(['openai-compativel','anthropic'])});
 const configs: ConfigProvedor[]=['PRIMARIO','FALLBACK'].map(p=>schema.parse({nome:p.toLowerCase(),
  modelo:env[`IA_PROVEDOR_${p}_MODELO`]??(p==='PRIMARIO'?'deepseek-flash':undefined),
  urlBase:env[`IA_PROVEDOR_${p}_URL_BASE`],chave:env[`IA_PROVEDOR_${p}_CHAVE`],
  tipo:env[`IA_PROVEDOR_${p}_TIPO_ADAPTADOR`]??(p==='PRIMARIO'?'openai-compativel':'anthropic')}));
 const precos: Record<string,{entrada:number;saida:number}>={};
 for(const p of ['PRIMARIO','FALLBACK']) {
  const entrada=env[`IA_PROVEDOR_${p}_PRECO_ENTRADA_USD_MILHAO`],saida=env[`IA_PROVEDOR_${p}_PRECO_SAIDA_USD_MILHAO`];
  if(entrada?.trim() && saida?.trim())precos[p.toLowerCase()]={entrada:z.coerce.number().nonnegative().parse(entrada),saida:z.coerce.number().nonnegative().parse(saida)};
 }
 return new CadeiaIa(configs.map(c=>criarProvedor(c)),uso=>process.stdout.write(JSON.stringify({evento:'uso_ia',...uso})+'\n'),20_000,precos,
  falha=>process.stdout.write(JSON.stringify({evento:'falha_provedor_ia',...falha})+'\n'));
}
