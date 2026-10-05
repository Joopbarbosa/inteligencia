import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi, afterAll } from 'vitest';
import { Ajv } from 'ajv';
import { criarApp } from '../src/api/app.js';
import { CacheMemoria } from '../src/cache/notas.js';
import { lerSp } from '../src/leitores/sp/leitor.js';
import { Orquestrador, type EntradaLeitura } from '../src/leitura/orquestrador.js';

// OpenProject #708: o portal de SP exige captcha na consulta pela chave. Só a chave, sem cache, não deve
// consultar o portal nem gastar IA com a página do captcha: devolve a orientação de usar o QR ou o link.
const chaveSp = '35' + '1'.repeat(42), chaveRj = '33' + '1'.repeat(42);
const linkSp = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chaveSp}|2|1|1|HASH`;
const contexto = () => ({ chaveClienteId: randomUUID(), contaId: randomUUID(), signal: new AbortController().signal });
const html = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
const montar = (extra: { cache?: CacheMemoria } = {}) => {
 const buscarPortal = vi.fn(async () => html), ia = vi.fn(), leitorUf = vi.fn(async (e: EntradaLeitura) => e.pagina ? lerSp(e.pagina.html) : undefined);
 return { buscarPortal, ia, leitorUf, orquestrador: new Orquestrador({ buscarPortal, ia, leitorUf, ...extra }, true) };
};

describe('#708: NFC-e de SP só pela chave', () => {
 it('recusa sem consultar o portal nem a IA', async () => {
  const { orquestrador, buscarPortal, ia, leitorUf } = montar();
  await expect(orquestrador.ler({ modelo: 'NFCE', chaveAcesso: chaveSp }, contexto())).rejects.toThrow('CHAVE_EXIGE_QR');
  expect(buscarPortal).not.toHaveBeenCalled(); expect(ia).not.toHaveBeenCalled(); expect(leitorUf).not.toHaveBeenCalled();
 });
 it('o link do QR de SP continua sendo lido', async () => {
  const { orquestrador, buscarPortal } = montar();
  expect((await orquestrador.ler({ modelo: 'NFCE', qrUrl: linkSp }, contexto())).metodo).toBe('LEITOR_UF');
  expect(buscarPortal).toHaveBeenCalledOnce();
 });
 it('chave já lida antes pelo QR vem do cache, sem recusar', async () => {
  const { orquestrador, buscarPortal } = montar({ cache: new CacheMemoria() });
  await orquestrador.ler({ modelo: 'NFCE', qrUrl: linkSp }, contexto());
  expect((await orquestrador.ler({ modelo: 'NFCE', chaveAcesso: chaveSp }, contexto())).doCache).toBe(true);
  expect(buscarPortal).toHaveBeenCalledOnce();
 });
 it('chave de outro estado segue para o portal', async () => {
  const { orquestrador, buscarPortal } = montar();
  await orquestrador.ler({ modelo: 'NFCE', chaveAcesso: chaveRj }, contexto()).catch(() => undefined);
  expect(buscarPortal).toHaveBeenCalledOnce();
 });
});

const chave = 'a'.repeat(64);
const app = await criarApp({ autenticar: async v => v === chave ? 'produto-teste' : undefined, orquestrador: montar().orquestrador });
afterAll(() => app.close());
describe('#708: resposta HTTP', () => {
 it('400 BLOQUEIO com a orientação para usar o QR ou o link, no formato do contrato', async () => {
  const spec = JSON.parse(readFileSync('docs/openapi.yaml', 'utf8'));
  const validarErro = new Ajv({ strict: false }).compile(spec.components.schemas.Erro);
  const r = await app.inject({ method: 'POST', url: '/v1/leituras', headers: { authorization: 'Bearer ' + chave, 'x-conta-id': randomUUID() },
   payload: { modelo: 'NFCE', chaveAcesso: chaveSp } });
  expect(r.statusCode).toBe(400);
  expect(validarErro(r.json())).toBe(true);
  expect(r.json()).toMatchObject({ tipo: 'BLOQUEIO', codigo: 'CHAVE_EXIGE_QR',
   motivo: expect.stringContaining('captcha'), comoResolver: expect.stringContaining('QR code') });
 });
});
