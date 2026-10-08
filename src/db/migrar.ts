import { readFile, readdir } from 'node:fs/promises';
import { sql, type Kysely } from 'kysely';
import type { Banco } from './conexao.js';
export async function migrar(db: Kysely<Banco>) {
 const pasta = new URL('./migracoes/', import.meta.url);
 const arquivos = (await readdir(pasta)).filter(n => /^\d+_[a-z_]+\.sql$/.test(n)).sort();
 await db.transaction().execute(async tx => {
  await sql`select pg_advisory_xact_lock(677001)`.execute(tx);
  await sql`create table if not exists schema_migration (nome text primary key, aplicada_em timestamptz not null default now())`.execute(tx);
  for (const nome of arquivos) {
   const existente = await sql<{ nome: string }>`select nome from schema_migration where nome = ${nome}`.execute(tx);
   if (existente.rows.length) continue;
   await sql.raw(await readFile(new URL(nome, pasta), 'utf8')).execute(tx);
   await sql`insert into schema_migration (nome) values (${nome})`.execute(tx);
  }
 });
}
