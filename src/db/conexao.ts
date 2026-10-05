import { Kysely, PostgresDialect, type Generated } from 'kysely';
import pg from 'pg';
interface ChaveCliente { id: Generated<string>; produto: string; hash: string; estado: 'ativa' | 'revogada'; criada_em: Generated<Date> }
export interface Banco { chave_cliente: ChaveCliente }
export function conectar(databaseUrl: string) {
 return new Kysely<Banco>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: databaseUrl, max: 5 }) }) });
}
