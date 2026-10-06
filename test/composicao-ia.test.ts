import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { criarApp } from '../src/api/app.js';
import { Chaves } from '../src/autenticacao/chaves.js';
import { CacheMemoria } from '../src/cache/notas.js';
import { conectar } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import type { ProvedorIa } from '../src/ia/adaptadores.js';
import { CadeiaIa } from '../src/ia/cadeia.js';
import { comporIa } from '../src/leitura/composicao.js';
import { LimitesIa, mesSaoPaulo } from '../src/leitura/limites.js';
import { Orquestrador } from '../src/leitura/orquestrador.js';

const env = { ...parseEnv(readFileSync('.pocket.env', 'utf8')), ...process.env }; const url = new URL(env.DATABASE_URL ?? '');
if (env.POCKET_TEST_DB !== '1' || !env.DB_NAME?.startsWith('test_') || !env.DB_CONTAINER?.startsWith('test_') || url.hostname !== 'localhost' ||
 url.pathname !== '/' + env.DB_NAME || url.port !== env.DB_PORT) throw new Error('Alvo não confirmado');
const db = conectar(url.href); const produto = 'composicao726-' + randomUUID(); let chaveClienteId = '';
const html = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
const xml = readFileSync(new URL('./fixtures/nfe.xml', import.meta.url));
const chave = '35' + '1'.repeat(42), qrUrl = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=' + chave + '|2|1|1|HASH';
const extracao = { emitente: { cnpj: '12ABC345000190', nome: 'Papelaria Aurora', uf: 'SP' }, itens: [{ nome: 'Folha A4 premium', quantidade: '2.5', valorFinal: '19.95' }] };
const lerProvedor = vi.fn<ProvedorIa['ler']>();
const provedor: ProvedorIa = { nome: 'primario', modelo: 'modelo-teste', ler: lerProvedor };
const usoDaConta = async (conta: string) => (await db.selectFrom('uso_ia').select('quantidade')
 .where('chave_cliente_id', '=', chaveClienteId).where('conta_id', '=', conta).where('mes', '=', mesSaoPaulo(new Date())).executeTakeFirst())?.quantidade ?? 0;
const semUso = (conta: string, quantidade: number) => db.insertInto('uso_ia').values({ chave_cliente_id: chaveClienteId, conta_id: conta, mes: mesSaoPaulo(new Date()), quantidade }).execute();
// Mesma composição de src/server.ts: IA atrás do limite, leitor da UF ausente (estado sem leitor próprio).
const orquestrador = () => new Orquestrador({ cache: new CacheMemoria(), buscarPortal: async () => html, leitorUf: async () => undefined,
 ia: comporIa(new LimitesIa(db), new CadeiaIa([provedor])) });
const contexto = (contaId: string) => ({ chaveClienteId, contaId, signal: new AbortController().signal });

beforeAll(async () => { await migrar(db); chaveClienteId = (await new Chaves(db).criar(produto)).id; });
afterEach(async () => { lerProvedor.mockReset(); await db.deleteFrom('reserva_ia').where('chave_cliente_id', '=', chaveClienteId).execute();
 await db.deleteFrom('uso_ia').where('chave_cliente_id', '=', chaveClienteId).execute(); });
afterAll(async () => { await db.deleteFrom('chave_cliente').where('produto', '=', produto).execute(); await db.destroy(); });

it('CEN-NOVO-2: estado sem leitor lido pela IA devolve a nota e a conta passa de 10 para 11; releitura vem do cache e não conta', async () => {
 const conta = randomUUID(); await semUso(conta, 10);
 lerProvedor.mockResolvedValue({ json: JSON.stringify(extracao), entradaTokens: 100, saidaTokens: 30 });
 const o = orquestrador();
 const nota = await o.ler({ modelo: 'NFCE', qrUrl }, contexto(conta));
 expect(nota).toMatchObject({ metodo: 'IA', origem: 'NFCE_QR', doCache: false, chaveAcesso: chave, totalPago: '59.57' });
 expect(nota.avisos).toEqual([]);
 expect(await usoDaConta(conta)).toBe(11);
 expect((await o.ler({ modelo: 'NFCE', qrUrl }, contexto(conta))).doCache).toBe(true);
 expect(lerProvedor).toHaveBeenCalledOnce(); expect(await usoDaConta(conta)).toBe(11);
});

it('CEN-NOVO-37/RN-NOVA-6: IA que falha não conta e não deixa reserva', async () => {
 const conta = randomUUID(); lerProvedor.mockRejectedValue(new Error('provedor fora'));
 await expect(orquestrador().ler({ modelo: 'NFCE', qrUrl }, contexto(conta))).rejects.toThrow('IA_INDISPONIVEL');
 expect(await usoDaConta(conta)).toBe(0);
 expect(await db.selectFrom('reserva_ia').selectAll().where('chave_cliente_id', '=', chaveClienteId).execute()).toHaveLength(0);
});

it('CEN-NOVO-38 pelo encaixe real: conta no limite recusa a leitura por IA antes de chamar o provedor', async () => {
 const conta = randomUUID(); await semUso(conta, 30);
 await expect(orquestrador().ler({ modelo: 'NFCE', qrUrl }, contexto(conta))).rejects.toThrow('LIMITE_IA_ATINGIDO');
 expect(lerProvedor).not.toHaveBeenCalled(); expect(await usoDaConta(conta)).toBe(30);
});

it('CEN-NOVO-70: conta no limite mensal envia o XML e recebe 200 com metodo XML, sem IA e sem mexer na contagem', async () => {
 const conta = randomUUID(); await semUso(conta, 30);
 const app = await criarApp({ autenticar: async () => chaveClienteId, orquestrador: orquestrador() });
 try {
  const boundary = 'cen70-boundary';
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="modelo"\r\n\r\nNFE\r\n--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="nota.xml"\r\nContent-Type: application/xml\r\n\r\n`),
   xml, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const r = await app.inject({ method: 'POST', url: '/v1/leituras', payload,
   headers: { authorization: 'Bearer ' + 'a'.repeat(64), 'x-conta-id': conta, 'content-type': 'multipart/form-data; boundary=' + boundary } });
  expect(r.statusCode).toBe(200);
  expect(r.json()).toMatchObject({ metodo: 'XML', origem: 'NFE_XML', numero: '1234' }); expect(r.json().itens).toHaveLength(3);
  expect(lerProvedor).not.toHaveBeenCalled(); expect(await usoDaConta(conta)).toBe(30);
 } finally { await app.close(); }
});
