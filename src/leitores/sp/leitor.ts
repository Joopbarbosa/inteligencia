import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { notaSchema, type NotaLida } from '../../api/leituras/schemas.js';
import { identificarLeiaute } from '../leiaute.js';
import { decimalPt, lerCabecalhoNfce } from '../cabecalho.js';
// Atributos de #tabResult na página real do portal (nota de 2026-10-05, OpenProject #707); o número da linha vira N.
const classes = ['id:tabResult', 'id:Item + N', 'class:filterable', 'class:RCod', 'class:RUN', 'class:Rqtd', 'class:RvlUnit',
 'class:noWrap', 'class:txtTit', 'class:valor'].sort();
export const LEIAUTE_SP = 'SP-' + createHash('sha256').update(classes.join('\n')).digest('hex').slice(0,16);
/** Seletores conservadores: dado obrigatório ausente ou assinatura nova devolve falha para IA. */
export function lerSp(html: string): NotaLida | undefined {
 try {
  const $ = load(html); const texto = $.root().text().replace(/\s+/g,' ');
  const leiaute = identificarLeiaute(html, 'SP');
  if (leiaute !== LEIAUTE_SP) return undefined;
  const chave = $('.chave').text().replace(/\s/g,'').toUpperCase();
  if (!chave.startsWith('35')) return undefined;
  const cnpj = texto.match(/CNPJ:\s*([\dA-Z./-]{14,18})/i)?.[1]?.replace(/[./-]/g,'').toUpperCase();
  const { numero, serie, dataEmissao, descontoGeral, acrescimos } = lerCabecalhoNfce(texto);
  const itens = $('#tabResult tr').toArray().map(el => ({
   // O nome vem só do span: a coluna do valor também tem a classe txtTit ("Vl. Total").
   nome: $(el).find('span.txtTit').first().text().trim(), quantidade: decimalPt($(el).find('.Rqtd').text()),
   unidade: $(el).find('.RUN').text().replace(/^\s*UN\s*:\s*/i,'').trim(),
   valorFinal: decimalPt($(el).find('.valor').text())
  }));
  const totalPago = decimalPt($('#totalNota .txtMax').text());
  if (!dataEmissao) return undefined;
  return notaSchema.parse({ emitente: { cnpj, nome: $('.txtTopo').first().text().trim(), uf:'SP' },
   chaveAcesso:chave,numero,serie,dataEmissao,
   totalPago,descontoGeral,acrescimos,itens,origem:'NFCE_QR',metodo:'LEITOR_UF',doCache:false,uf:'SP',leiaute,avisos:[] });
 } catch { return undefined; }
}
