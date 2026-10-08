import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lerXml } from '../src/leitores/xml/leitor.js';
import { somar, subtrair } from '../src/shared/decimal.js';
const xml = readFileSync(new URL('./fixtures/nfe.xml', import.meta.url));
describe('CEN-NOVO-5: NF-e 1234, Distribuidora Aurora, 3 itens, CNPJ alfanumérico', () => {
 it('devolve dados exatos sem IA, nomes completos e decimais sem arredondar', () => {
  const nota = lerXml(xml);
  expect(nota).toMatchObject({ numero:'1234', serie:'1', origem:'NFE_XML', metodo:'XML', doCache:false,
   emitente: { cnpj:'12ABCDEF000195', nome:'Distribuidora Aurora', uf:'SP' }, totalPago:'61.9513',
   descontoGeral:'1.2334', acrescimos:'0.6067', uf:'SP', leiaute:'SP-NFE-XML-4.00' });
  expect(nota.itens).toEqual([
   { nome:'PAPEL COUCHE 250G A4 C/100', quantidade:'1.2500', valorFinal:'36.0101', valorBruto:'38.1234', desconto:'2.1133', unidade:'PCT', codigo:'001', ean:'SEM GTIN' },
   { nome:'FITA  CETIM & AZUL', quantidade:'2.0000', valorFinal:'19.0001', valorBruto:'20.0017', desconto:'1.0016' },
   { nome:'Caneta GEL Preta', quantidade:'3.5000', valorFinal:'7.5678', valorBruto:'7.5678' }
  ]);
 });
 it('aceita raiz nfeProc', () => {
  expect(lerXml(Buffer.from('<nfeProc>' + xml.toString() + '</nfeProc>')).itens).toHaveLength(3);
 });
 it('não transforma desconto geral negativo em valor negativo', () => {
  expect(lerXml(Buffer.from(xml.toString().replace('<vDesc>4.3483</vDesc>', '<vDesc>0.0001</vDesc>'))).descontoGeral).toBe('0');
 });
 it.each([
  '<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + xml.toString(),
  '<!DOCTYPE NFe [<!ENTITY xxe "texto">]>' + xml.toString(),
  '<NFe>', xml.toString().replace('<qCom>1.2500</qCom>', ''),
  xml.toString().replace('<vProd>38.1234</vProd>','<vProd>NaN</vProd>'),
  xml.toString().replace('<UF>SP</UF>','<UF>RJ</UF>'),
  xml.toString().replace('<mod>55</mod>','<mod>65</mod>'),
  xml.toString().replace('<CNPJ>12ABCDEF000195</CNPJ>','<CNPJ>12ABCDEF000196</CNPJ>'),
  xml.toString().replace('<vDesc>2.1133</vDesc>','<vDesc>99.0000</vDesc>')
 ])('recusa XML inválido, incompleto, XXE ou incoerente (%#)', texto => {
  expect(() => lerXml(Buffer.from(texto))).toThrow('DOCUMENTO_INVALIDO');
 });
 it('recusa XML maior que 5 MB', () => {
  expect(() => lerXml(Buffer.alloc(5 * 1024 * 1024 + 1))).toThrow('DOCUMENTO_INVALIDO');
 });
});
it('decimais mantêm precisão acima da capacidade de Number', () => {
 expect(somar('9007199254740993.1234', '0.0001')).toBe('9007199254740993.1235');
 expect(subtrair('0.3017','0.2016')).toBe('0.1001');
});
