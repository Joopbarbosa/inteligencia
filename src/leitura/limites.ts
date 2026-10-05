import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Banco } from '../db/conexao.js';
import type { ContextoLeitura } from './orquestrador.js';
import { ErroLeitura } from '../shared/erro.js';
export function mesSaoPaulo(agora: Date): string {
 const p = new Intl.DateTimeFormat('en-US', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit' }).formatToParts(agora);
 return p.find(x => x.type === 'year')!.value + '-' + p.find(x => x.type === 'month')!.value;
}
export class LimitesIa {
 constructor(private readonly db: Kysely<Banco>, private readonly porConta = 30, private readonly porChave = 2000,
  private readonly agora: () => Date = () => new Date()) {}
 async executar<T>(contexto: ContextoLeitura, ler: () => Promise<T>): Promise<T> {
  contexto.signal.throwIfAborted();
  const mes = mesSaoPaulo(this.agora()), id = randomUUID();
  await this.db.transaction().execute(async tx => {
   await sql`select pg_advisory_xact_lock(hashtextextended(${contexto.chaveClienteId},678))`.execute(tx);
   await tx.deleteFrom('reserva_ia').where('expira_em','<=',new Date()).execute();
   const usos = await tx.selectFrom('uso_ia').select(['conta_id','quantidade'])
    .where('chave_cliente_id','=',contexto.chaveClienteId).where('mes','=',mes).execute();
   const reservas = await tx.selectFrom('reserva_ia').select('conta_id')
    .where('chave_cliente_id','=',contexto.chaveClienteId).where('mes','=',mes).execute();
   const conta = (usos.find(u => u.conta_id === contexto.contaId)?.quantidade ?? 0) + reservas.filter(r => r.conta_id === contexto.contaId).length;
   const chave = usos.reduce((s,u) => s + u.quantidade,0) + reservas.length;
   if (conta >= this.porConta || chave >= this.porChave) throw new ErroLeitura('LIMITE_IA_ATINGIDO');
   await tx.insertInto('reserva_ia').values({id,chave_cliente_id:contexto.chaveClienteId,conta_id:contexto.contaId,mes,
    expira_em:new Date(Date.now()+120_000)}).execute();
  });
  try {
   const resultado = await ler(); contexto.signal.throwIfAborted();
   await this.db.transaction().execute(async tx => {
    await sql`select pg_advisory_xact_lock(hashtextextended(${contexto.chaveClienteId},678))`.execute(tx);
    const reserva = await tx.selectFrom('reserva_ia').select('id').where('id','=',id).executeTakeFirst();
    if (!reserva) throw new ErroLeitura('LEITURA_IMPOSSIVEL');
    await tx.insertInto('uso_ia').values({chave_cliente_id:contexto.chaveClienteId,conta_id:contexto.contaId,mes,quantidade:1})
     .onConflict(c => c.columns(['chave_cliente_id','conta_id','mes']).doUpdateSet({quantidade:sql`uso_ia.quantidade + 1`})).execute();
    await tx.deleteFrom('reserva_ia').where('id','=',id).execute();
   });
   return resultado;
  } catch (erro) { await this.db.deleteFrom('reserva_ia').where('id','=',id).execute(); throw erro; }
 }
}
