import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, it, expect } from 'vitest';
import { sql } from 'kysely';
import { conectar } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import { Chaves, hashChave } from '../src/autenticacao/chaves.js';
import { criarApp } from '../src/api/app.js';
const ambiente = { ...parseEnv(readFileSync('.pocket.env','utf8')), ...process.env };
const url = new URL(ambiente.DATABASE_URL ?? '');
if (ambiente.POCKET_TEST_DB !== '1' || !ambiente.DB_NAME?.startsWith('test_') ||
 !ambiente.DB_CONTAINER?.startsWith('test_') || url.pathname !== '/' + ambiente.DB_NAME ||
 url.hostname !== 'localhost' || url.port !== ambiente.DB_PORT) throw new Error('Alvo de teste não confirmado');
const db = conectar(url.toString());
const chaves = new Chaves(db);
const produto = 'teste-677-' + randomUUID();
const app = await criarApp({autenticar: v => chaves.autenticar(v)});
beforeAll(async () => { await migrar(db); await app.ready(); });
afterAll(async () => {
 await app.close(); await db.deleteFrom('chave_cliente').where('produto','=',produto).execute(); await db.destroy();
});
it('migrações são idempotentes e tabela existe em Postgres isolado', async () => {
 await migrar(db);
 const r = await sql<{ quantidade:string }>`select count(*) as quantidade from schema_migration where nome = '001_chave_cliente.sql'`.execute(db);
 expect(Number(r.rows[0]?.quantidade)).toBe(1);
});
it('32 bytes aleatórios; só SHA-256 é persistido; rotação e revogação por produto', async () => {
 const a = await chaves.criar(produto), b = await chaves.criar(produto);
 expect(a.chave).toMatch(/^[a-f0-9]{64}$/); expect(a.chave).not.toBe(b.chave);
 const row = await db.selectFrom('chave_cliente').selectAll().where('id','=',a.id).executeTakeFirstOrThrow();
 expect(row.hash).toBe(hashChave(a.chave)); expect(row.hash).not.toBe(a.chave);
 expect(await chaves.autenticar(a.chave)).toBe(a.id); expect(await chaves.autenticar(b.chave)).toBe(b.id);
 expect(await chaves.revogar(a.id)).toBe(true); expect(await chaves.autenticar(a.chave)).toBeUndefined();
 expect(await chaves.autenticar(b.chave)).toBe(b.id);
 const r = await app.inject({method:'POST',url:'/v1/leituras',headers:{authorization:'Bearer '+a.chave},payload:{modelo:'NFCE',chaveAcesso:'3'.repeat(44)}});
 expect(r.statusCode).toBe(401); expect(r.json().codigo).toBe('CHAVE_INVALIDA');
});
it('CLI cria e revoga chave localmente, sem endpoint administrativo', async () => {
 const criar = spawnSync('npm',['run','--silent','chave:criar','--',produto],{env:ambiente,encoding:'utf8'});
 expect(criar.status,criar.stderr).toBe(0);
 const chave = JSON.parse(criar.stdout) as {id:string;chave:string};
 expect(await chaves.autenticar(chave.chave)).toBe(chave.id);
 const revogar = spawnSync('npm',['run','--silent','chave:revogar','--',chave.id],{env:ambiente,encoding:'utf8'});
 expect(revogar.status,revogar.stderr).toBe(0); expect(await chaves.autenticar(chave.chave)).toBeUndefined();
 const r = await app.inject({method:'POST',url:'/v1/chaves'}); expect(r.statusCode).toBe(404);
});
