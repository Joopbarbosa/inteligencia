import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Banco } from '../db/conexao.js';
export const hashChave = (chave: string) => createHash('sha256').update(chave).digest('hex');
export class Chaves {
 constructor(private readonly db: Kysely<Banco>) {}
 async criar(produto: string) {
  if (!produto.trim() || produto.length > 100) throw new Error('Produto inválido');
  const chave = randomBytes(32).toString('hex');
  const id = randomUUID();
  await this.db.insertInto('chave_cliente').values({ id, produto, hash: hashChave(chave), estado: 'ativa' }).execute();
  return { id, chave };
 }
 async revogar(id: string) {
  const resultado = await this.db.updateTable('chave_cliente').set({ estado: 'revogada' }).where('id', '=', id).executeTakeFirst();
  return resultado.numUpdatedRows === 1n;
 }
 async autenticar(chave: string) {
  const hash = hashChave(chave);
  const registro = await this.db.selectFrom('chave_cliente').select(['id','estado']).where('hash', '=', hash).executeTakeFirst();
  return registro?.estado === 'ativa' ? registro.id : undefined;
 }
}
