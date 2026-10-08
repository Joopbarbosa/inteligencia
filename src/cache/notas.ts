import type { Kysely } from 'kysely';
import type { Banco } from '../db/conexao.js';
import { notaSchema, type NotaLida } from '../api/leituras/schemas.js';
export interface CacheNotas {
 buscar(chave: string): Promise<NotaLida | undefined>;
 guardar(nota: NotaLida): Promise<void>;
}
export class CachePostgres implements CacheNotas {
 constructor(private readonly db: Kysely<Banco>) {}
 async buscar(chave: string) {
  const r = await this.db.selectFrom('nota_lida').select('resultado').where('chave_acesso','=',chave).executeTakeFirst();
  return r ? { ...notaSchema.parse(r.resultado), doCache: true } : undefined;
 }
 async guardar(nota: NotaLida) {
  const valida = notaSchema.parse(nota);
  await this.db.insertInto('nota_lida').values({ chave_acesso: valida.chaveAcesso, resultado: { ...valida, doCache: false } })
   .onConflict(c => c.column('chave_acesso').doNothing()).execute();
 }
}
export class CacheMemoria implements CacheNotas {
 private notas = new Map<string,NotaLida>();
 async buscar(chave: string) { const n = this.notas.get(chave); return n ? { ...structuredClone(n), doCache: true } : undefined; }
 async guardar(nota: NotaLida) { this.notas.set(nota.chaveAcesso, structuredClone(notaSchema.parse(nota))); }
}
