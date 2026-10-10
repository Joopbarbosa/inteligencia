import { Kysely, PostgresDialect, type Generated } from 'kysely';
import pg from 'pg';
import type { NotaLida } from '../api/leituras/schemas.js';
interface ChaveCliente { id: Generated<string>; produto: string; hash: string; estado: 'ativa' | 'revogada'; criada_em: Generated<Date> }
interface UsoIa { chave_cliente_id: string; conta_id: string; mes: string; quantidade: number }
interface ReservaIa { id: string; chave_cliente_id: string; conta_id: string; mes: string; expira_em: Date }
export interface Banco { uso_ia: UsoIa; reserva_ia: ReservaIa; chave_cliente: ChaveCliente; nota_lida: { chave_acesso: string; resultado: NotaLida; criada_em: Generated<Date> } }
export function conectar(databaseUrl: string) {
 return new Kysely<Banco>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: databaseUrl, max: 5 }) }) });
}
