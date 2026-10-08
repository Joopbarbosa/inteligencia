import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load } from 'cheerio';
import { decimalPt, lerCabecalhoNfce } from '../src/leitores/cabecalho.js';
import { lerSp } from '../src/leitores/sp/leitor.js';
import { prepararIa } from '../src/ia/preparar.js';
const html = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
const chave = '35' + '1'.repeat(42);
it('#678 achado 3: o leitor de SP e o preparo da IA leem o mesmo cabeçalho, de um só lugar', async () => {
 const cab = lerCabecalhoNfce(load(html).root().text().replace(/\s+/g, ' '));
 expect(cab).toEqual({ numero: '1234', serie: '1', dataEmissao: '2026-05-20T14:31:29-03:00', descontoGeral: '2.25', acrescimos: '0.17' });
 const sp = lerSp(html)!;
 const ia = await prepararIa({ modelo: 'NFCE', chaveAcesso: chave, pagina: { html, uf: 'SP', leiaute: 'SP-x' } }, new AbortController().signal);
 for (const campo of ['numero', 'serie', 'dataEmissao', 'descontoGeral', 'acrescimos', 'totalPago'] as const) expect(ia.metadados?.[campo], campo).toBe(sp[campo]);
});
it('decimal brasileiro com milhar e sem número', () => {
 expect(decimalPt('1.234,56')).toBe('1234.56'); expect(decimalPt('59,57')).toBe('59.57'); expect(decimalPt('7')).toBe('7'); expect(decimalPt('')).toBeUndefined();
});
