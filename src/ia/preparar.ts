import { load } from 'cheerio';
import sharp from 'sharp';
import type { EntradaLeitura } from '../leitura/orquestrador.js';
import { textoPdf } from '../leitura/pdf.js';
import { recortarPagina, recortarTextoPdf } from '../seguranca/removerCpf.js';
import { ErroLeitura } from '../shared/erro.js';
import type { ConteudoIa } from './adaptadores.js';
export interface PreparadoIa { conteudo: ConteudoIa; metadados?: Record<string,unknown> | undefined }
function decimalPt(texto: string | undefined): string | undefined { return texto?.replaceAll('.','').replace(',','.'); }
export async function prepararIa(entrada: EntradaLeitura, signal: AbortSignal): Promise<PreparadoIa> {
 signal.throwIfAborted();
 if(entrada.pagina) {
  const $=load(entrada.pagina.html);const texto=$.root().text().replace(/\s+/g,' ');
  const data=texto.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
  const numero=texto.match(/N[uú]mero:\s*(\d+)/i)?.[1],serie=texto.match(/S[eé]rie:\s*(\d+)/i)?.[1];
  const totalPago=decimalPt($('#totalNota .txtMax').text().trim());
  if(!data || !numero || !serie || !totalPago || !entrada.chaveAcesso)throw new ErroLeitura('LEITURA_IMPOSSIVEL');
  return {conteudo:{texto:recortarPagina(entrada.pagina.html)},metadados:{chaveAcesso:entrada.chaveAcesso,numero,serie,
   dataEmissao:`${data[3]}-${data[2]}-${data[1]}T${data[4]}-03:00`,totalPago,
   descontoGeral:decimalPt(texto.match(/Descontos?:\s*([\d.,]+)/i)?.[1])??'0',acrescimos:decimalPt(texto.match(/Acr[eé]scimos?:\s*([\d.,]+)/i)?.[1])??'0',
   origem:'NFCE_QR',metodo:'IA',uf:entrada.pagina.uf,leiaute:entrada.pagina.leiaute,doCache:false,avisos:[]}};
 }
 const arquivo=entrada.arquivo;
 if(!arquivo || !entrada.confirmouEnvioIa)throw new ErroLeitura('CONFIRMACAO_ENVIO_IA_AUSENTE');
 if(arquivo.mime==='application/pdf') {
  const texto=await textoPdf(arquivo.dados,signal);
  if(texto.trim())return {conteudo:{texto:recortarTextoPdf(texto)}};
  return {conteudo:{arquivo}};
 }
 try {
  const metadata=await sharp(arquivo.dados,{limitInputPixels:12_000_000}).metadata();
  if(!['jpeg','png'].includes(metadata.format??''))throw new Error('Formato inválido');
 } catch { throw new ErroLeitura('DOCUMENTO_INVALIDO'); }
 return {conteudo:{arquivo}};
}
