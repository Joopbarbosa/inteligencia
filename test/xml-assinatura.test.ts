import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignedXml } from 'xml-crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { assinaturaXmlValida } from '../src/leitores/xml/assinatura.js';
import { lerXml } from '../src/leitores/xml/leitor.js';
import { Orquestrador } from '../src/leitura/orquestrador.js';

// #743: a assinatura XMLDSig da NF-e é verificada criptograficamente (não só a presença de SignatureValue).
const pasta = mkdtempSync(join(tmpdir(), 'assinatura-'));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(pasta, 'k.pem'), '-out', join(pasta, 'c.pem'),
 '-subj', '/CN=Emitente Teste', '-days', '2'], { stdio: 'ignore' });
const chavePrivada = readFileSync(join(pasta, 'k.pem'), 'utf8'), certificado = readFileSync(join(pasta, 'c.pem'), 'utf8');
const original = readFileSync(new URL('./fixtures/nfe.xml', import.meta.url), 'utf8');
const nota = lerXml(Buffer.from(original));
const CHAVE = nota.chaveAcesso;

function assinar(xml: string): string {
 const sig = new SignedXml({ privateKey: chavePrivada, publicCert: certificado,
  signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315' });
 sig.addReference({ xpath: "//*[local-name(.)='infNFe']",
  transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
  digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1' });
 // A NF-e real embute o certificado do emitente em KeyInfo/X509Data.
 sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${certificado.replace(/-----[A-Z ]+-----|\s/g, '')}</X509Certificate></X509Data>`;
 sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='NFe']", action: 'append' } });
 return sig.getSignedXml();
}
const assinado = assinar(original);

describe('verificação criptográfica da assinatura da NF-e (#743)', () => {
 it('aceita XML assinado e íntegro', () => {
  expect(assinaturaXmlValida(Buffer.from(assinado), CHAVE)).toBe(true);
 });
 it('recusa XML sem assinatura', () => {
  expect(assinaturaXmlValida(Buffer.from(original), CHAVE)).toBe(false);
 });
 it('recusa XML alterado depois de assinado (valor de item)', () => {
  const adulterado = assinado.replace(/<vProd>[^<]+<\/vProd>/, '<vProd>1.00</vProd>');
  expect(adulterado).not.toBe(assinado);
  expect(assinaturaXmlValida(Buffer.from(adulterado), CHAVE)).toBe(false);
 });
 it('recusa SignatureValue corrompido, mesmo com a assinatura "presente"', () => {
  const corrompido = assinado.replace(/(<SignatureValue>)[^<]{8}/, '$1AAAAAAAA');
  expect(corrompido).not.toBe(assinado);
  expect(assinaturaXmlValida(Buffer.from(corrompido), CHAVE)).toBe(false);
 });
 it('recusa assinatura válida quando a chave lida não é a do trecho assinado', () => {
  expect(assinaturaXmlValida(Buffer.from(assinado), '0'.repeat(44))).toBe(false);
 });
 it('recusa duas assinaturas no mesmo documento', () => {
  const bloco = assinado.match(/<Signature[\s\S]*<\/Signature>/)![0];
  expect(assinaturaXmlValida(Buffer.from(assinado.replace(bloco, bloco + bloco)), CHAVE)).toBe(false);
 });
 it('só o XML com assinatura verificável entra no cache', async () => {
  const guardadas: string[] = [];
  const orquestrador = new Orquestrador({ cache: { guardar: async n => { guardadas.push(n.chaveAcesso); }, buscar: async () => undefined } } as never);
  const contexto = { signal: new AbortController().signal, contaId: 'c', chaveClienteId: 'k' } as never;
  const entrada = (xml: string) => ({ modelo: 'NFE' as const, arquivo: { dados: Buffer.from(xml), mime: 'application/xml' } });
  await orquestrador.ler(entrada(original), contexto);
  expect(guardadas).toHaveLength(0);
  await orquestrador.ler(entrada(assinado.replace(/(<SignatureValue>)[^<]{8}/, '$1AAAAAAAA')), contexto);
  expect(guardadas).toHaveLength(0);
  await orquestrador.ler(entrada(assinado), contexto);
  expect(guardadas).toEqual([CHAVE]);
 });
});
