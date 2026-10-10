import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/api/app.js';
import { CacheMemoria, type CacheNotas } from '../src/cache/notas.js';
import { CadeiaIa } from '../src/ia/cadeia.js';
import type { ProvedorIa } from '../src/ia/adaptadores.js';
import { lerSp } from '../src/leitores/sp/leitor.js';
import { Orquestrador, type EntradaLeitura } from '../src/leitura/orquestrador.js';
import { portaisPorChave } from '../src/leitores/registro.js';
import { lerXml } from '../src/leitores/xml/leitor.js';
import { entradaJsonSchema } from '../src/api/leituras/schemas.js';

const htmlSp = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
const xml = readFileSync(new URL('./fixtures/nfe.xml', import.meta.url));
const contexto = () => ({ chaveClienteId: randomUUID(), contaId: randomUUID(), signal: new AbortController().signal });
const chaveSp = '35' + '1'.repeat(42), chaveRj = '33' + '1'.repeat(42);
const linkSp = (chave: string) => `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|2|1|1|HASH`;
const espiaoCache = (): CacheNotas & { buscar: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> } => ({ buscar: vi.fn(async () => undefined), guardar: vi.fn(async () => undefined) });
const provedor = () => { const ler = vi.fn<ProvedorIa['ler']>(async () => { throw new Error('a IA não devia ser chamada'); }); return { ler, cadeia: new CadeiaIa([{ nome: 'p', modelo: 'm', ler }]) }; };
const nota = lerSp(htmlSp)!;

describe('CEN-NOVO-36: portal exige verificação humana', () => {
 const captcha = '<html><body><form><img src="/captcha.jpg" alt="captcha"><input name="captcha"><button>Consultar</button></form></body></html>';
 const semTabela = htmlSp.replace(/<table[\s\S]*?<\/table>/g, '');
 it.each([['página de captcha', captcha], ['sem tabela de itens', semTabela], ['página vazia', '<html></html>']])('%s, IA habilitada: LEITURA_IMPOSSIVEL, sem rascunho, sem cache e sem chamar o provedor', async (_n, html) => {
  const cache = espiaoCache(), { ler, cadeia } = provedor();
  const o = new Orquestrador({ cache, buscarPortal: async () => html, leitorUf: async e => e.pagina ? lerSp(e.pagina.html) : undefined, ia: (e, c) => cadeia.ler(e, c) });
  await expect(o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveSp) }, contexto())).rejects.toThrow('LEITURA_IMPOSSIVEL');
  expect(cache.guardar).not.toHaveBeenCalled(); expect(ler).not.toHaveBeenCalled();
 });
 it.each([['página de captcha', captcha], ['sem tabela de itens', semTabela]])('%s, IA desabilitada: LEITURA_IMPOSSIVEL e sem cache', async (_n, html) => {
  const cache = espiaoCache();
  const o = new Orquestrador({ cache, buscarPortal: async () => html, leitorUf: async e => e.pagina ? lerSp(e.pagina.html) : undefined });
  await expect(o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveSp) }, contexto())).rejects.toThrow('LEITURA_IMPOSSIVEL');
  expect(cache.guardar).not.toHaveBeenCalled();
 });
 it('pela API: 400 BLOQUEIO LEITURA_IMPOSSIVEL, sem nota', async () => {
  const o = new Orquestrador({ cache: espiaoCache(), buscarPortal: async () => captcha, leitorUf: async () => undefined });
  const app = await criarApp({ autenticar: async () => 'produto', orquestrador: o });
  try {
   const r = await app.inject({ method: 'POST', url: '/v1/leituras', headers: { authorization: 'Bearer ' + 'a'.repeat(64), 'x-conta-id': randomUUID() }, payload: { modelo: 'NFCE', qrUrl: linkSp(chaveSp) } });
   expect(r.statusCode).toBe(400); expect(r.json()).toMatchObject({ tipo: 'BLOQUEIO', codigo: 'LEITURA_IMPOSSIVEL' }); expect(r.json().itens).toEqual([]);
  } finally { await app.close(); }
 });
});

describe('RN-NOVA-8: portal por UF', () => {
 it('chave de UF 33 (sem portal cadastrado): LEITURA_IMPOSSIVEL com zero chamadas de rede, IA ou cache', async () => {
  const buscarPortal = vi.fn(async () => htmlSp), cache = espiaoCache(), { ler, cadeia } = provedor();
  const o = new Orquestrador({ buscarPortal, cache, leitorUf: async () => undefined, ia: (e, c) => cadeia.ler(e, c) });
  await expect(o.ler({ modelo: 'NFCE', chaveAcesso: chaveRj }, contexto())).rejects.toThrow('LEITURA_IMPOSSIVEL');
  expect(buscarPortal).not.toHaveBeenCalled(); expect(ler).not.toHaveBeenCalled(); expect(cache.guardar).not.toHaveBeenCalled();
 });
 it('o registro só cadastra SP (escopo atual do Gestor) e monta a URL com a chave', () => {
  expect(Object.keys(portaisPorChave)).toEqual(['SP']);
  expect(portaisPorChave.SP!(chaveSp)).toBe('https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?chNFe=' + chaveSp);
 });
});

describe('cache só com chave verificada', () => {
 it('IA lê foto e devolve uma chave que ninguém confirmou: a nota é devolvida mas não vai ao cache', async () => {
  const cache = espiaoCache(); const chaveDaIa = lerXml(xml).chaveAcesso;
  const ia = vi.fn(async () => ({ ...lerXml(xml), metodo: 'IA' as const, origem: 'NFE_FOTO' as const }));
  const o = new Orquestrador({ cache, ia });
  const r = await o.ler({ modelo: 'NFE', arquivo: { dados: Buffer.from('imagem'), mime: 'image/png' }, confirmouEnvioIa: true }, contexto());
  expect(r.chaveAcesso).toBe(chaveDaIa); expect(cache.guardar).not.toHaveBeenCalled();
 });
 it('foto forjada não planta conteúdo sob a chave de um cupom real: a leitura seguinte pelo QR vem do portal', async () => {
  const cache = new CacheMemoria();
  const forjada = { ...nota, metodo: 'IA' as const, origem: 'NFE_FOTO' as const, itens: [{ nome: 'Item forjado', quantidade: '1', valorFinal: '1' }] };
  const buscarPortal = vi.fn(async () => htmlSp);
  const o = new Orquestrador({ cache, buscarPortal, leitorUf: async e => e.pagina ? lerSp(e.pagina.html) : undefined, ia: async e => e.pagina ? nota : forjada });
  await o.ler({ modelo: 'NFE', arquivo: { dados: Buffer.from('imagem'), mime: 'image/png' }, confirmouEnvioIa: true }, contexto());
  const legitima = await o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveSp) }, contexto());
  expect(legitima.doCache).toBe(false); expect(legitima.itens[0]?.nome).not.toBe('Item forjado'); expect(buscarPortal).toHaveBeenCalledOnce();
 });
 it('nota lida da página do portal com chave conferida entra no cache', async () => {
  const cache = espiaoCache();
  await new Orquestrador({ cache, buscarPortal: async () => htmlSp, leitorUf: async e => e.pagina ? lerSp(e.pagina.html) : undefined }).ler({ modelo: 'NFCE', qrUrl: linkSp(chaveSp) }, contexto());
  expect(cache.guardar).toHaveBeenCalledOnce();
 });
 it('XML sem assinatura, ou com assinatura de enfeite, não entra no cache (a assinatura válida é coberta em xml-assinatura.test.ts, #743)', async () => {
  const cache = espiaoCache(); const o = new Orquestrador({ cache });
  await o.ler({ modelo: 'NFE', arquivo: { dados: xml, mime: 'application/xml' } }, contexto());
  expect(cache.guardar).not.toHaveBeenCalled();
  // SignatureValue presente mas sem assinatura verificável: desde a #743 isso não basta.
  const assinado = Buffer.from(xml.toString('utf8').replace('</NFe>', '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>QUJD</SignatureValue></Signature></NFe>'));
  await o.ler({ modelo: 'NFE', arquivo: { dados: assinado, mime: 'application/xml' } }, contexto());
  expect(cache.guardar).not.toHaveBeenCalled();
 });
 it('o aviso do QR ilegível não vai ao cache: leitura posterior pelo QR não o recebe', async () => {
  const cache = new CacheMemoria();
  const o = new Orquestrador({ cache, buscarPortal: async () => htmlSp, leitorUf: async e => e.pagina ? lerSp(e.pagina.html) : undefined,
   decodificarQr: async () => undefined, ia: async () => nota });
  // imagem sem QR legível: não há chave confirmada, a IA lê a foto; nada vai ao cache e o aviso fica só na resposta
  const foto = await o.ler({ modelo: 'NFCE', arquivo: { dados: Buffer.from('imagem'), mime: 'image/png' }, confirmouEnvioIa: true }, contexto());
  expect(foto.avisos).toContain('O QR não pôde ser lido; a leitura foi feita pela imagem.');
  const porQr = await o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveSp) }, contexto());
  expect(porQr.avisos).toEqual([]);
 });
});

describe('CEN-NOVO-55: chave em minúsculas é a mesma chave', () => {
 const chaveLetras = '35' + 'ABCDEF' + '1'.repeat(36);
 const htmlLetras = htmlSp.replace(chaveSp, chaveLetras);
 const montar = () => {
  const buscarPortal = vi.fn(async () => htmlLetras);
  const o = new Orquestrador({ cache: new CacheMemoria(), buscarPortal, leitorUf: async (e: EntradaLeitura) => e.pagina ? lerSp(e.pagina.html) : undefined });
  return { o, buscarPortal };
 };
 it('schema JSON normaliza para maiúsculas antes de validar', () => {
  expect(entradaJsonSchema.parse({ modelo: 'NFCE', chaveAcesso: chaveLetras.toLowerCase() }).chaveAcesso).toBe(chaveLetras);
  expect(entradaJsonSchema.safeParse({ modelo: 'NFCE', chaveAcesso: chaveLetras.slice(1).toLowerCase() }).success).toBe(false);
 });
 it('JSON em minúsculas devolve a mesma nota que o QR deixou no cache; e HTTP aceita (200)', async () => {
  const { o } = montar();
  const doQr = await o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveLetras) }, contexto());
  expect(doQr.chaveAcesso).toBe(chaveLetras);
  const app = await criarApp({ autenticar: async () => 'produto', orquestrador: o });
  try {
   const r = await app.inject({ method: 'POST', url: '/v1/leituras', headers: { authorization: 'Bearer ' + 'a'.repeat(64), 'x-conta-id': randomUUID() }, payload: { modelo: 'NFCE', chaveAcesso: chaveLetras.toLowerCase() } });
   expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ ...doQr, doCache: true });
  } finally { await app.close(); }
 });
 it('QR com a chave em minúsculas devolve a mesma nota do cache', async () => {
  const { o, buscarPortal } = montar();
  const primeira = await o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveLetras) }, contexto());
  const minusculas = await o.ler({ modelo: 'NFCE', qrUrl: linkSp(chaveLetras.toLowerCase()) }, contexto());
  expect(minusculas).toEqual({ ...primeira, doCache: true }); expect(buscarPortal).toHaveBeenCalledOnce();
 });
});
