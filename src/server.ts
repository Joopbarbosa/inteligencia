import { z } from 'zod';
import { conectar } from './db/conexao.js';
import { migrar } from './db/migrar.js';
import { Chaves } from './autenticacao/chaves.js';
import { criarApp } from './api/app.js';
const config = z.object({ DATABASE_URL: z.string().url(), API_PORT: z.coerce.number().int().min(1).max(65535).default(3000) }).parse(process.env);
const db = conectar(config.DATABASE_URL);
try {
 await migrar(db);
 const chaves = new Chaves(db);
 const app = await criarApp({ autenticar: chave => chaves.autenticar(chave) });
 app.addHook('onClose', async () => { await db.destroy(); });
 for (const sinal of ['SIGINT','SIGTERM'] as const) process.once(sinal, () => { void app.close(); });
 await app.listen({ host: '0.0.0.0', port: config.API_PORT });
} catch {
 await db.destroy();
 process.stderr.write('Falha ao iniciar o serviço. Confira configuração e banco.\n');
 process.exitCode = 1;
}
