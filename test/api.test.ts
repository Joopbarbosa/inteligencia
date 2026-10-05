import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { criarApp } from '../src/api/app.js';
import { Orquestrador } from '../src/leitura/orquestrador.js';
import { lerXml } from '../src/leitores/xml/leitor.js';
import { Ajv } from 'ajv';
import { z } from 'zod';
const spec = JSON.parse(readFileSync('docs/openapi.yaml','utf8'));
const ajv = new Ajv({ strict:false });
ajv.addFormat('date-time', { validate: (v: string) => z.iso.datetime({offset:true}).safeParse(v).success });
const validarNota = ajv.compile(spec.components.schemas.NotaLida);
const validarErro = ajv.compile(spec.components.schemas.Erro);
const chave = 'a'.repeat(64), conta = randomUUID();
const xml = readFileSync(new URL('./fixtures/nfe.xml',import.meta.url));
const ia = vi.fn(), leitorUf = vi.fn();
const app = await criarApp({ autenticar: async v => v === chave ? 'produto-teste' : undefined,
 orquestrador: new Orquestrador({ ia, leitorUf }, true) });
const headers = { authorization: 'Bearer ' + chave, 'x-conta-id':conta };
function upload(dados: Buffer, modelo='NFE', mime='application/xml', confirmou?: string) {
 const boundary = 'leitor-fiscal-677-boundary';
 const partes = ['--'+boundary+'\r\nContent-Disposition: form-data; name="modelo"\r\n\r\n'+modelo+'\r\n'];
 if (confirmou) partes.push('--'+boundary+'\r\nContent-Disposition: form-data; name="confirmouEnvioIa"\r\n\r\n'+confirmou+'\r\n');
 return { headers: { ...headers, 'content-type': 'multipart/form-data; boundary='+boundary },
 payload: Buffer.concat([Buffer.from(partes.join('')+'--'+boundary+'\r\nContent-Disposition: form-data; name="arquivo"; filename="nota.xml"\r\nContent-Type: '+mime+'\r\n\r\n'), dados, Buffer.from('\r\n--'+boundary+'--\r\n')]) };
}
beforeAll(() => app.ready());
afterAll(() => app.close());
describe('contrato HTTP OpenAPI e cenários #677', () => {
 it('GET /saude público e sem dados sensíveis', async () => {
  const r = await app.inject({ method:'GET',url:'/saude' });
  expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ status:'ok' });
 });
 it('CEN-NOVO-5: upload XML lê três itens sem leitor UF nem IA', async () => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',...upload(xml) });
  expect(r.statusCode).toBe(200); expect(validarNota(r.json()), JSON.stringify(validarNota.errors)).toBe(true);
  expect(r.json()).toMatchObject({ numero:'1234',origem:'NFE_XML',metodo:'XML',totalPago:'61.9513' });
  expect(r.json().itens).toHaveLength(3); expect(ia).not.toHaveBeenCalled(); expect(leitorUf).not.toHaveBeenCalled();
 });
 it.each([undefined,'Bearer invalida','Bearer '+'b'.repeat(64)])('CEN-NOVO-41: 401 antes de ler mesmo corpo inválido (%#)', async authorization => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',headers: authorization ? { authorization } : {}, payload:'XML inválido' });
  expect(r.statusCode).toBe(401); expect(validarErro(r.json())).toBe(true);
  expect(r.json().codigo).toBe('CHAVE_INVALIDA'); expect(ia).not.toHaveBeenCalled(); expect(leitorUf).not.toHaveBeenCalled();
 });
 it('exige UUID da conta', async () => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',headers:{ authorization:headers.authorization, 'x-conta-id':'cpf-ou-email' },payload:{ modelo:'NFCE', chaveAcesso:'3'.repeat(44) } });
  expect(r.statusCode).toBe(400); expect(validarErro(r.json())).toBe(true);
 });
 it.each([{ modelo:'NFCE' },{ modelo:'NFCE', qrUrl:'https://portal', chaveAcesso:'3'.repeat(44) },{ modelo:'NFE',chaveAcesso:'3'.repeat(44),extra:'x' }])('exige exatamente uma entrada e recusa campos desconhecidos (%#)', async payload => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',headers,payload });
  expect(r.statusCode).toBe(400); expect(validarErro(r.json())).toBe(true);
 });
 it.each(['image/png','image/jpeg','application/pdf'])('exige confirmação para %s antes de chamar IA', async mime => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',...upload(Buffer.from('arquivo'), 'NFE', mime) });
  expect(r.statusCode).toBe(400); expect(r.json().codigo).toBe('CONFIRMACAO_ENVIO_IA_AUSENTE'); expect(ia).not.toHaveBeenCalled();
 });
 it('multipart sem boundary devolve 400, nunca erro interno', async () => {
  const r = await app.inject({method:'POST',url:'/v1/leituras',headers:{...headers,'content-type':'multipart/form-data'},payload:'malformado'});
  expect(r.statusCode).toBe(400); expect(r.json().codigo).toBe('DOCUMENTO_INVALIDO'); expect(validarErro(r.json())).toBe(true);
 });
 it('XML maior que 5 MB é 400 estruturado', async () => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',...upload(Buffer.alloc(5*1024*1024+1)) });
  expect(r.statusCode).toBe(400); expect(validarErro(r.json())).toBe(true);
 });
 it('arquivo maior que 10 MB é 400 estruturado', async () => {
  const r = await app.inject({ method:'POST',url:'/v1/leituras',...upload(Buffer.alloc(10*1024*1024+1),'NFE','application/pdf','true') });
  expect(r.statusCode).toBe(400); expect(validarErro(r.json())).toBe(true);
 });
 it('rota inexistente devolve 404 no contrato', async () => {
  const r = await app.inject({method:'GET',url:'/inexistente'});
  expect(r.statusCode).toBe(404); expect(validarErro(r.json())).toBe(true);
 });
});
it('ponto de encaixe leitor UF precede IA', async () => {
 const nota = lerXml(xml);
 const uf = vi.fn().mockResolvedValue(nota), inteligencia = vi.fn();
 const o = new Orquestrador({ leitorUf:uf,ia:inteligencia },true);
 expect(await o.ler({modelo:'NFCE',chaveAcesso:nota.chaveAcesso},{chaveClienteId:'chave',contaId:conta,signal:new AbortController().signal})).toEqual(nota);
 expect(uf).toHaveBeenCalledOnce(); expect(inteligencia).not.toHaveBeenCalled();
});
it('sem adaptadores, link não faz busca externa nem IA', async () => {
 const o = new Orquestrador();
 await expect(o.ler({modelo:'NFCE',qrUrl:'https://portal'},{chaveClienteId:'chave',contaId:conta,signal:new AbortController().signal})).rejects.toThrow('PORTAL_NAO_PERMITIDO');
});
it('IA desligada não chama adaptador', async () => {
 const inteligencia = vi.fn();
 await expect(new Orquestrador({ia:inteligencia},false).ler({modelo:'NFE',arquivo:{dados:Buffer.from('imagem'),mime:'image/png'},confirmouEnvioIa:true},{chaveClienteId:'chave',contaId:conta,signal:new AbortController().signal})).rejects.toThrow('LEITURA_IMPOSSIVEL');
 expect(inteligencia).not.toHaveBeenCalled();
});

it('#679: upload HTTP de QR gerado em PNG usa SP controlado e releitura usa cache sem rede/IA', async () => {
 const QRCode = await import('qrcode');
 const { decodificarQr } = await import('../src/leitura/qr/decodificar.js');
 const { CacheMemoria } = await import('../src/cache/notas.js');
 const { lerSp } = await import('../src/leitores/sp/leitor.js');
 const html = readFileSync(new URL('./fixtures/sp-controlado.html', import.meta.url), 'utf8');
 const chaveNota = '35' + '1'.repeat(42);
 const link = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=' + chaveNota + '|2|1|1|HASH';
 const dados = await QRCode.toBuffer(link, { width: 640, margin: 4 });
 const busca = vi.fn(async () => html), inteligencia = vi.fn();
 const real = await criarApp({ autenticar: async () => 'produto-teste', orquestrador: new Orquestrador({
  cache: new CacheMemoria(), decodificarQr, buscarPortal: busca,
  leitorUf: async entrada => entrada.pagina ? lerSp(entrada.pagina.html) : undefined, ia: inteligencia
 }, true) });
 try {
  const primeira = await real.inject({method:'POST',url:'/v1/leituras',...upload(dados,'NFCE','image/png','true')});
  expect(primeira.statusCode).toBe(200);expect(validarNota(primeira.json())).toBe(true);expect(primeira.json().metodo).toBe('LEITOR_UF');
  const segunda = await real.inject({method:'POST',url:'/v1/leituras',headers,payload:{modelo:'NFCE',qrUrl:link}});
  expect(segunda.statusCode).toBe(200);expect(segunda.json().doCache).toBe(true);expect(busca).toHaveBeenCalledOnce();expect(inteligencia).not.toHaveBeenCalled();
 } finally { await real.close(); }
});
