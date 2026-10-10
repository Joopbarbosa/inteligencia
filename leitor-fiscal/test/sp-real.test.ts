import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { identificarLeiaute } from '../src/leitores/leiaute.js';
import { LEIAUTE_SP, lerSp } from '../src/leitores/sp/leitor.js';
const ler = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');
const real = ler('sp-real-sanitizado.html'), controlado = ler('sp-controlado.html');

// OpenProject #707: o leitor de SP só lia a fixture inventada. Estas fixtures têm a estrutura da página
// real do portal (nota de supermercado, 6 itens, emissão normal), com dados fictícios.
describe('#707: leiaute real do portal de SP', () => {
 it('lê a nota real: emitente, chave, data, 6 itens e total', () => {
  const nota = lerSp(real)!;
  expect(nota).toMatchObject({
   emitente: { cnpj: '11222333000181', nome: 'Supermercado Exemplo Ltda', uf: 'SP' },
   chaveAcesso: '35261011222333000181653150000556161001120196', numero: '55616', serie: '315',
   dataEmissao: '2026-10-04T14:47:48-03:00', totalPago: '90.84', descontoGeral: '0', acrescimos: '0',
   metodo: 'LEITOR_UF', origem: 'NFCE_QR', uf: 'SP', leiaute: LEIAUTE_SP,
  });
  expect(nota.itens).toEqual([
   { nome: 'COMFORT BOOM BRIG 275g', quantidade: '1', valorFinal: '19.99', unidade: 'UN' },
   { nome: 'ACAI UNI SABOR TRAD 3,6l', quantidade: '1', valorFinal: '49.99', unidade: 'UN' },
   { nome: 'FUBA MIMOSO DO VALL 500g', quantidade: '1', valorFinal: '3.89', unidade: 'UN' },
   { nome: 'FAR MAND EXEMPLO 1kg', quantidade: '1', valorFinal: '6.99', unidade: 'UN' },
   { nome: 'ESPONJA ACO BOMBRIL 60g', quantidade: '1', valorFinal: '3.99', unidade: 'PC' },
   { nome: 'HASTES FLEX UNI 150un', quantidade: '1', valorFinal: '5.99', unidade: 'UN' },
  ]);
  const soma = nota.itens.reduce((total, item) => total + Math.round(Number(item.valorFinal) * 100), 0);
  expect(soma).toBe(Math.round(Number(nota.totalPago) * 100));
 });
 it('o nome do item não leva o texto "Vl. Total" da coluna do valor', () => {
  for (const item of lerSp(real)!.itens) expect(item.nome).not.toMatch(/Vl\. Total/);
 });
 it('a assinatura não depende do número de itens (6 na real, 3 na controlada)', () => {
  expect(identificarLeiaute(real, 'SP')).toBe(LEIAUTE_SP);
  expect(identificarLeiaute(controlado, 'SP')).toBe(LEIAUTE_SP);
  const semUmItem = real.replace(/<tr id="Item \+ 6">[\s\S]*?<\/tr>/, '');
  expect(semUmItem).not.toBe(real);
  expect(lerSp(semUmItem)!.itens).toHaveLength(5);
 });
 it('classe nova dentro da tabela de itens declara falha (a leitura cai para a IA)', () => {
  expect(lerSp(real.replace('class="RCod"', 'class="RCod codigo-novo"'))).toBeUndefined();
 });
});
