import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { sql } from 'kysely';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkerAlertas } from '../src/alertas/worker.js';
import { Alertas, type Alerta } from '../src/alertas/repositorio.js';
import { OpenProject } from '../src/alertas/openproject.js';
import { Chaves } from '../src/autenticacao/chaves.js';
import { CacheMemoria } from '../src/cache/notas.js';
import { conectar } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import type { ProvedorIa } from '../src/ia/adaptadores.js';
import { CadeiaIa } from '../src/ia/cadeia.js';
import { identificarLeiaute } from '../src/leitores/leiaute.js';
import { leitores } from '../src/leitores/registro.js';
import { lerSp } from '../src/leitores/sp/leitor.js';
import { montarOrquestrador } from '../src/leitura/composicao.js';
import { LimitesIa, mesSaoPaulo } from '../src/leitura/limites.js';

const env = { ...parseEnv(readFileSync('.pocket.env', 'utf8')), ...process.env }; const url = new URL(env.DATABASE_URL ?? '');
if (env.POCKET_TEST_DB !== '1' || !env.DB_NAME?.startsWith('test_') || !env.DB_CONTAINER?.startsWith('test_') || url.hostname !== 'localhost' ||
 url.pathname !== '/' + env.DB_NAME || url.port !== env.DB_PORT) throw new Error('Alvo não confirmado');
const db = conectar(url.href); const repo = new Alertas(db); const produto = 'alerta728-' + randomUUID(); let chaveClienteId = '';
const htmlSp = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
const chaveSp = '35' + '1'.repeat(42), chavePi = '22' + '1'.repeat(42), chavePi2 = '22' + '2'.repeat(42);
const htmlPi = (chave: string) => htmlSp.replace(chaveSp, chave);
const htmlSpLeiauteNovo = htmlSp.replace('class="valor"', 'class="valor-novo"');
const leiautesSp = [identificarLeiaute(htmlSp, 'SP'), identificarLeiaute(htmlSpLeiauteNovo, 'SP')];
const hostTeste = 'portal-teste.invalid'; const link = (chave: string, uf = 'PI') => `https://${hostTeste}/${uf}/qrcode?p=${chave}|2|1|1|HASH`;
const extracao = (uf: string) => ({ emitente: { cnpj: '12ABC345000190', nome: 'Papelaria Aurora', uf }, itens: [{ nome: 'Folha A4 premium', quantidade: '2.5', valorFinal: '19.95' }] });
const ler = vi.fn<ProvedorIa['ler']>();
const provedor: ProvedorIa = { nome: 'primario', modelo: 'modelo-teste', ler };
const contexto = (contaId: string) => ({ chaveClienteId, contaId, signal: new AbortController().signal });
const uso = async (conta: string) => (await db.selectFrom('uso_ia').select('quantidade').where('chave_cliente_id', '=', chaveClienteId)
 .where('conta_id', '=', conta).where('mes', '=', mesSaoPaulo(new Date())).executeTakeFirst())?.quantidade ?? 0;
const alertas = async (filtro: ReturnType<typeof sql>) => (await sql<Alerta>`select * from alerta where ${filtro}`.execute(db)).rows;
const alertasPi = () => alertas(sql`uf = 'PI'`);
const alertasSp = () => alertas(sql`uf = 'SP' and leiaute in (${sql.join(leiautesSp)})`);
const limpar = async () => {
 await sql`delete from amostra where alerta_id in (select id from alerta where uf = 'PI' or leiaute in (${sql.join(leiautesSp)}))`.execute(db);
 await sql`delete from alerta where uf = 'PI' or leiaute in (${sql.join(leiautesSp)})`.execute(db);
 await db.deleteFrom('reserva_ia').where('chave_cliente_id', '=', chaveClienteId).execute(); await db.deleteFrom('uso_ia').where('chave_cliente_id', '=', chaveClienteId).execute();
};
// Composição real (src/leitura/composicao.ts) com portal de teste injetado: só o host e o HTML saem do mundo real.
const montar = (pagina: (chave: string) => string, extra: { leitoresLiberados?: boolean } = {}) => montarOrquestrador({
 cadeia: new CadeiaIa([provedor]), limites: new LimitesIa(db), alertas: repo, cache: new CacheMemoria(), leitores, leitoresLiberados: extra.leitoresLiberados ?? true,
 hostsPermitidos: [hostTeste], buscarPortal: async url => pagina(new URL(url).searchParams.get('p')!.split('|')[0]!) });

beforeAll(async () => { await migrar(db); chaveClienteId = (await new Chaves(db).criar(produto)).id; await limpar(); });
afterEach(async () => { ler.mockReset(); await limpar(); });
afterAll(async () => { await db.deleteFrom('chave_cliente').where('produto', '=', produto).execute(); await db.destroy(); });

describe('CEN-NOVO-2 e CEN-NOVO-53 (parte de outro estado): composição real, banco de teste', () => {
 it('cupom do PI (UF sem leitor) lido pela IA: nota devolvida, conta +1, um alerta, uma tarefa no OpenProject', async () => {
  const conta = randomUUID(); await db.insertInto('uso_ia').values({ chave_cliente_id: chaveClienteId, conta_id: conta, mes: mesSaoPaulo(new Date()), quantidade: 10 }).execute();
  ler.mockResolvedValue({ json: JSON.stringify(extracao('PI')), entradaTokens: 90, saidaTokens: 20 });
  const o = montar(htmlPi);
  const nota = await o.ler({ modelo: 'NFCE', qrUrl: link(chavePi) }, contexto(conta));
  expect(nota).toMatchObject({ metodo: 'IA', uf: 'PI', chaveAcesso: chavePi, doCache: false }); expect(nota.avisos).toEqual([]);
  expect(await uso(conta)).toBe(11);
  const [alerta, ...resto] = await alertasPi(); expect(resto).toEqual([]);
  expect(alerta).toMatchObject({ uf: 'PI', motivo: 'UF_SEM_LEITOR', contador: 1 }); expect(alerta?.leiaute).toMatch(/^PI-/);
  // outra nota do mesmo estado e leiaute: o mesmo alerta sobe o contador; a nota repetida vem do cache e não mexe em nada
  await o.ler({ modelo: 'NFCE', qrUrl: link(chavePi2) }, contexto(conta));
  await o.ler({ modelo: 'NFCE', qrUrl: link(chavePi) }, contexto(conta));
  expect(await uso(conta)).toBe(12); const depois = await alertasPi(); expect(depois).toHaveLength(1); expect(depois[0]?.contador).toBe(2);
  expect(ler).toHaveBeenCalledTimes(2);
  // worker: a tarefa "Mapear leitor da UF PI" é aberta uma única vez, sem dado do cupom
  const pedidos: { url: string; metodo: string; corpo: string }[] = [];
  const enviar = vi.fn<typeof fetch>(async (u, init) => {
   pedidos.push({ url: String(u), metodo: init?.method ?? 'GET', corpo: String(init?.body ?? '') });
   return new Response(JSON.stringify(init?.method === 'POST' ? { id: 321, subject: 'x' } : { _embedded: { elements: [] }, total: 0 }), { status: 200 });
  });
  const worker = new WorkerAlertas(repo, new OpenProject('https://openproject.example', 'chave-ficticia', 1, 8, enviar, 9));
  await worker.executar(); await worker.executar();
  const criacoes = pedidos.filter(p => p.metodo === 'POST' && p.url.endsWith('/api/v3/work_packages'));
  expect(criacoes).toHaveLength(1);
  const corpo = JSON.parse(criacoes[0]!.corpo); expect(corpo.subject).toContain('UF PI'); expect(corpo._links.project.href).toBe('/api/v3/projects/9');
  for (const proibido of [chavePi, chavePi2, hostTeste, 'Papelaria', 'Folha A4']) expect(criacoes[0]!.corpo).not.toContain(proibido);
 });

 it('IA que falha no cupom do PI: alerta já registrado, nenhuma contagem', async () => {
  const conta = randomUUID(); ler.mockRejectedValue(new Error('provedor fora'));
  await expect(montar(htmlPi).ler({ modelo: 'NFCE', qrUrl: link(chavePi) }, contexto(conta))).rejects.toThrow('IA_INDISPONIVEL');
  expect(await alertasPi()).toHaveLength(1); expect(await uso(conta)).toBe(0);
 });
});

describe('RN-NOVA-9: leitor de SP desligado por política não é falha do leitor', () => {
 it('SP_LEITOR_LIBERADO diferente de true: a IA lê, mas nenhum alerta LEITOR_FALHOU nem tarefa nasce', async () => {
  ler.mockResolvedValue({ json: JSON.stringify(extracao('SP')), entradaTokens: 90, saidaTokens: 20 });
  const o = montar(() => htmlSp, { leitoresLiberados: false });
  for (const chave of [chaveSp, chaveSp.replace(/1$/, '2'), chaveSp.replace(/1$/, '3')])
   expect((await o.ler({ modelo: 'NFCE', qrUrl: link(chave, 'SP') }, contexto(randomUUID()))).metodo).toBe('IA');
  expect(await alertasSp()).toHaveLength(0);
 });
 it('leitor liberado e layout novo: continua registrando LEITOR_FALHOU (positivo)', async () => {
  ler.mockResolvedValue({ json: JSON.stringify(extracao('SP')), entradaTokens: 90, saidaTokens: 20 });
  await montar(() => htmlSpLeiauteNovo, { leitoresLiberados: true }).ler({ modelo: 'NFCE', qrUrl: link(chaveSp, 'SP') }, contexto(randomUUID()));
  const encontrados = await alertasSp(); expect(encontrados).toHaveLength(1); expect(encontrados[0]?.motivo).toBe('LEITOR_FALHOU');
 });
 it('leitor liberado e página conhecida: o leitor lê e não há alerta', async () => {
  const nota = await montar(() => htmlSp).ler({ modelo: 'NFCE', qrUrl: link(chaveSp, 'SP') }, contexto(randomUUID()));
  expect(nota.metodo).toBe('LEITOR_UF'); expect(await alertasSp()).toHaveLength(0); expect(lerSp(htmlSp)).toBeDefined();
 });
});

describe('RN-NOVA-9: alerta com recorte mínimo quando o recorte completo falha', () => {
 const semDados = htmlSp.replace(/<table[\s\S]*?<\/table>/g, '').replace('Papelaria Aurora', '');
 it('página que perdeu emitente e tabela: o alerta nasce antes da IA, só com UF, leiaute e estrutura, sem CPF, endereço, chave nem texto', async () => {
  await expect(montar(() => semDados).ler({ modelo: 'NFCE', qrUrl: link(chavePi) }, contexto(randomUUID()))).rejects.toThrow();
  const [alerta] = await alertasPi(); expect(alerta).toMatchObject({ uf: 'PI', motivo: 'UF_SEM_LEITOR' });
  const [amostra] = await repo.amostras('PI', alerta!.leiaute); const texto = amostra!.conteudo;
  expect(texto).toContain('Recorte mínimo'); expect(texto).toContain('UF: PI'); expect(texto).toContain(alerta!.leiaute);
  for (const proibido of ['123.456.789-09', '12345678909', 'www.nfce', 'http', chavePi, 'CONSUMIDOR', '12.ABC.345']) expect(texto).not.toContain(proibido);
  expect(ler).not.toHaveBeenCalled();
 });
 it('Alertas.registrar direto com página sem recorte possível não lança e guarda a amostra mínima', async () => {
  const id = await repo.registrar({ uf: 'PI', leiaute: 'PI-semrecorte', html: '<html><body><div id="x12" class="a1 b"><p>CPF 123.456.789-09 https://x.test/?c=1</p></div></body></html>' }, 'LEITOR_FALHOU');
  expect(id).toBeTruthy(); const [amostra] = await repo.amostras('PI', 'PI-semrecorte');
  expect(amostra!.conteudo).toContain('div#xN.aN.b'); expect(amostra!.conteudo).not.toContain('123.456'); expect(amostra!.conteudo).not.toContain('x.test');
 });
});

describe('configuração única do OpenProject', () => {
 it('.env.example tem um só conjunto de variáveis e o id do projeto por variável', () => {
  const exemplo = readFileSync('.env.example', 'utf8');
  expect(exemplo).not.toMatch(/^OP_/m); expect(exemplo).toMatch(/^OPENPROJECT_PROJETO_ID=9$/m);
  for (const v of ['OPENPROJECT_URL', 'OPENPROJECT_API_KEY', 'OPENPROJECT_TIPO_TAREFA_ID', 'OPENPROJECT_PRIORIDADE_NORMAL_ID']) expect(exemplo).toMatch(new RegExp('^' + v + '=', 'm'));
  expect(readFileSync('README.md', 'utf8')).toContain('OPENPROJECT_PROJETO_ID');
 });
 it('o id do projeto vai no filtro de busca e no vínculo da tarefa criada', async () => {
  const pedidos: string[] = [];
  const enviar = vi.fn<typeof fetch>(async (u, init) => { pedidos.push(decodeURIComponent(String(u)) + ' ' + String(init?.body ?? ''));
   return new Response(JSON.stringify(init?.method === 'POST' ? { id: 5, subject: 'x' } : { _embedded: { elements: [] }, total: 0 }), { status: 200 }); });
  await new OpenProject('https://openproject.example', 'ficticia', 1, 8, enviar, 42).obterOuCriar({ uf: 'PI', leiaute: 'PI-x', motivo: 'UF_SEM_LEITOR', contador: 1, criada_em: new Date(), id: 'a', tentativas: 0, tarefa_id: null, ultimo_comentario: null });
  expect(pedidos[0]).toContain('"values":["42"]'); expect(pedidos[1]).toContain('/api/v3/projects/42');
 });
});
