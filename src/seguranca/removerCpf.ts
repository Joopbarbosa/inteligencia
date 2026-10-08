import { load } from 'cheerio';
import { ErroLeitura } from '../shared/erro.js';
export function removerCpf(texto: string): string {
 return texto.replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g,'[CPF removido]');
}
export function recortarPagina(html: string): string {
 const $ = load(html); $('script,style,noscript').remove();
 const cnpjElemento = $('*').filter((_i, el) => $(el).children().length === 0 && /CNPJ:/i.test($(el).text())).first();
 const nome = $('.txtTopo,#emitente .nome,.emitente .nome').first().text().trim() || cnpjElemento.prev().text().trim();
 const cnpj = $.root().text().match(/CNPJ:\s*([\dA-Z./-]{14,18})/i)?.[1] ?? '';
 const tabela = $('#tabResult,#itens,#produtos').first().text().trim() || $('table').filter((_i, el) => /(?:Qtde|Quantidade|UN:)/i.test($(el).text())).first().text().trim();
 if (!nome || !cnpj || !tabela) throw new ErroLeitura('LEITURA_IMPOSSIVEL');
 return removerCpf(`Emitente: ${nome}\nCNPJ: ${cnpj}\nItens:\n${tabela}`);
}
/** PDF texto: remove seção de consumidor entre o marcador e o próximo cabeçalho fiscal. */
export function recortarTextoPdf(texto: string): string {
 const limpo = texto.replace(/(?:CONSUMIDOR|DESTINAT[AÁ]RIO)[\s\S]*?(?=(?:DADOS DOS PRODUTOS|PRODUTOS|ITENS|TOTAL|C[AÁ]LCULO DO IMPOSTO)|$)/gi,'');
 return removerCpf(limpo);
}
