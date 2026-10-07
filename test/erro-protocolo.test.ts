import { connect } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/api/app.js';

// #764 (ataque do Claude ao leitor, caso A8): erro de protocolo recusado pelo servidor HTTP do Node
// (cabeçalho grande demais) responde no formato de erro do serviço, não no padrão do Fastify.
const app = await criarApp({ autenticar: async () => undefined });
let porta = 0;
beforeAll(async () => { await app.listen({ host: '127.0.0.1', port: 0 }); porta = (app.server.address() as { port: number }).port; });
afterAll(() => app.close());

function bruto(requisicao: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(porta, '127.0.0.1', () => socket.write(requisicao));
    let resposta = '';
    socket.on('data', d => { resposta += d.toString(); });
    socket.on('close', () => resolve(resposta));
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); resolve(resposta); }, 3000);
  });
}

describe('erros de protocolo no formato do serviço (#764)', () => {
  it('cabeçalho de 100 KB responde 431 com o corpo de erro do serviço', async () => {
    const resposta = await bruto(`GET /saude HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer ${'a'.repeat(100_000)}\r\n\r\n`);
    expect(resposta.startsWith('HTTP/1.1 431')).toBe(true);
    const corpo = JSON.parse(resposta.slice(resposta.indexOf('\r\n\r\n') + 4));
    expect(corpo).toMatchObject({ tipo: 'BLOQUEIO', codigo: 'DOCUMENTO_INVALIDO' });
    expect(corpo.error).toBeUndefined();
  });

  it('requisição HTTP malformada responde 400 no formato do serviço', async () => {
    const resposta = await bruto('ISSO NAO E HTTP\r\n\r\n');
    expect(resposta.startsWith('HTTP/1.1 400')).toBe(true);
    expect(JSON.parse(resposta.slice(resposta.indexOf('\r\n\r\n') + 4))).toMatchObject({ codigo: 'DOCUMENTO_INVALIDO' });
  });
});

// #768 (Schemathesis do leitor, commit cdd5d1d): multipart malformado devolvia 500 ERRO_INTERNO.
describe('multipart malformado é entrada inválida (#768)', () => {
  const chave = 'a'.repeat(64);
  const appAutenticado = criarApp({ autenticar: async () => 'chave-teste' });
  const enviar = async (corpo: string, tipo: string) => (await appAutenticado).inject({
    method: 'POST', url: '/v1/leituras', payload: corpo,
    headers: { authorization: `Bearer ${chave}`, 'x-conta-id': '00000000-0000-4000-8000-000000000001', 'content-type': tipo },
  });

  it('parte sem cabeçalhos responde 400 DOCUMENTO_INVALIDO', async () => {
    const r = await enviar('--B\r\nTrue--B--\r\n', 'multipart/form-data; boundary=B');
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ tipo: 'BLOQUEIO', codigo: 'DOCUMENTO_INVALIDO' });
  });

  it('corpo cortado no meio da parte responde 400', async () => {
    const r = await enviar('--B\r\nContent-Disposition: form-data; name="modelo"\r\n\r\nNFCE', 'multipart/form-data; boundary=B');
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ codigo: 'DOCUMENTO_INVALIDO' });
  });
});

// #776 (Schemathesis do leitor, commit 1fff805): rota que existe com outro método responde 405 com Allow, não 404.
describe('método HTTP fora do contrato é 405 com Allow (#776)', () => {
  const appUnico = criarApp({ autenticar: async () => undefined });
  it.each([['/saude', 'GET, HEAD'], ['/v1/leituras', 'POST']])('TRACE em %s responde 405', async (url, allow) => {
    const r = await (await appUnico).inject({ method: 'TRACE', url });
    expect(r.statusCode).toBe(405);
    expect(r.headers.allow).toBe(allow);
    expect(r.json()).toMatchObject({ tipo: 'BLOQUEIO', codigo: 'METODO_NAO_PERMITIDO' });
  });
  it('rota inexistente continua 404', async () => {
    const r = await (await appUnico).inject({ method: 'TRACE', url: '/nao-existe' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toMatchObject({ codigo: 'RECURSO_INEXISTENTE' });
  });
});
