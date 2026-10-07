import { readFileSync, readdirSync } from 'node:fs';
import { connect, type Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/api/app.js';
import { CODIGOS_ERRO, corpoErro } from '../src/shared/erro.js';
import { ufPorCodigoIbge } from '../src/shared/uf.js';
import { ufDaChave } from '../src/leitura/chave.js';
import { lerXml } from '../src/leitores/xml/leitor.js';

const spec = JSON.parse(readFileSync('docs/openapi.yaml', 'utf8'));
const enumOpenApi: string[] = spec.components.schemas.Erro.properties.codigo.enum;
const contrato = readFileSync('docs/modulos/LEITOR_FISCAL/contrato-leitor_fiscal.md', 'utf8');
const arquivos = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? arquivos(dir + '/' + e.name) : e.name.endsWith('.ts') ? [dir + '/' + e.name] : []);
const emitidos = new Set(arquivos('src').flatMap(f => [...readFileSync(f, 'utf8').matchAll(/ErroLeitura\('([A-Z_]+)'/g)].map(m => m[1]!)));

describe('#677 achado 1: contrato de erros declara todos os códigos que o serviço emite', () => {
  it('o enum do OpenAPI contém todo código emitido e nada além dele', () => {
    for (const c of ['RECURSO_INEXISTENTE', 'METODO_NAO_PERMITIDO', 'ERRO_INTERNO']) emitidos.add(c);
    expect([...enumOpenApi].sort()).toEqual([...emitidos].sort());
    expect([...CODIGOS_ERRO].sort()).toEqual([...emitidos].sort());
  });
  it('a tabela "Erros de negócio" do contrato lista cada código do enum e não diz que o leitor "ainda não está ligado"', () => {
    const tabela = contrato.slice(contrato.indexOf('**Erros de negócio:**'), contrato.indexOf('Erros sempre trazem'));
    for (const c of enumOpenApi) expect(tabela, c).toMatch(new RegExp('\\| ' + c + ':'));
    expect(tabela).not.toContain('ainda não ligado');
  });
  it('o limite de IA segue o código real do serviço, único para conta e chave', () => {
    expect(enumOpenApi).toContain('LIMITE_IA_ATINGIDO');
    expect(enumOpenApi).not.toContain('LIMITE_IA_CONTA');
  });
  it.each(CODIGOS_ERRO)('corpo de %s traz os quatro campos do formato de erro e tipo BLOQUEIO', codigo => {
    const corpo = corpoErro(codigo);
    expect(Object.keys(corpo).sort()).toEqual(['codigo', 'comoResolver', 'itens', 'motivo', 'tipo', 'titulo']);
    expect(corpo.tipo).toBe('BLOQUEIO');
    expect(corpo.motivo.length).toBeGreaterThan(0);
  });
});

describe('#677 achado 3: tabela IBGE para UF num só lugar', () => {
  it('resolve as 27 UFs e a chave e o XML usam a mesma tabela', () => {
    expect(Object.keys(ufPorCodigoIbge)).toHaveLength(27);
    expect(ufDaChave('33' + '1'.repeat(42))).toBe('RJ');
    expect(ufDaChave('35' + '1'.repeat(42))).toBe('SP');
    expect(lerXml(readFileSync(new URL('./fixtures/nfe.xml', import.meta.url))).uf).toBe('SP');
    for (const f of ['src/leitura/chave.ts', 'src/leitores/xml/leitor.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/'11':'RO'/);
  });
});

describe('#677 achado 4: vaga de leitura simultânea é liberada sem o hook onTimeout', () => {
  it('conexões penduradas ocupam as quatro vagas e, ao cair, liberam (onRequestAbort), sem timeout de conexão configurado', async () => {
    const chave = 'c'.repeat(64);
    const app = await criarApp({ autenticar: async v => v === chave ? 'produto-teste' : undefined });
    afterAll(() => app.close());
    expect(app.server.timeout).toBe(0); // Fastify só emite onTimeout com connectionTimeout > 0; o app nunca o configura
    await app.listen({ host: '127.0.0.1', port: 0 });
    const porta = (app.server.address() as { port: number }).port;
    const cabecalho = `POST /v1/leituras HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer ${chave}\r\nX-Conta-Id: ${randomUUID()}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`;
    const penduradas: Socket[] = [];
    for (let i = 0; i < 4; i++) {
      const s = connect(porta, '127.0.0.1'); s.on('error', () => undefined); s.write(cabecalho); penduradas.push(s);
    }
    await new Promise(r => setTimeout(r, 300));
    const quinta = await app.inject({ method: 'POST', url: '/v1/leituras', headers: { authorization: 'Bearer ' + chave, 'x-conta-id': randomUUID() }, payload: { modelo: 'NFCE', chaveAcesso: '3'.repeat(44) } });
    expect(quinta.json().codigo).toBe('LIMITE_SIMULTANEAS');
    for (const s of penduradas) s.destroy();
    await new Promise(r => setTimeout(r, 300));
    const depois = await app.inject({ method: 'POST', url: '/v1/leituras', headers: { authorization: 'Bearer ' + chave, 'x-conta-id': randomUUID() }, payload: { modelo: 'NFCE', chaveAcesso: '3'.repeat(44) } });
    expect(depois.json().codigo).not.toBe('LIMITE_SIMULTANEAS');
  });
});
