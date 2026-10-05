import { z } from 'zod';
import { conectar } from './db/conexao.js';
import { migrar } from './db/migrar.js';
import { Chaves } from './autenticacao/chaves.js';
import { criarApp } from './api/app.js';
import { Orquestrador } from './leitura/orquestrador.js';
import { CachePostgres } from './cache/notas.js';
import { BuscaSegura } from './seguranca/buscaSegura.js';
import { decodificarQr } from './leitura/qr/decodificar.js';
import { leitores } from './leitores/registro.js';
const config = z.object({ DATABASE_URL: z.string().url(), API_PORT: z.coerce.number().int().min(1).max(65535).default(3000) }).parse(process.env);
const db = conectar(config.DATABASE_URL);
try {
 await migrar(db);
 const chaves = new Chaves(db);
 const busca = new BuscaSegura();
 const orquestrador = new Orquestrador({ cache: new CachePostgres(db), decodificarQr,
  buscarPortal: (url, signal) => busca.buscar(url, signal),
  leitorUf: async entrada => {
   if (process.env.NODE_ENV === 'production' && process.env.SP_LEITOR_LIBERADO !== 'true') return undefined;
   return entrada.pagina ? leitores[entrada.pagina.uf]?.(entrada.pagina.html) : undefined;
  } });
 const app = await criarApp({ autenticar: chave => chaves.autenticar(chave), orquestrador });
 app.addHook('onClose', async () => { await db.destroy(); });
 for (const sinal of ['SIGINT','SIGTERM'] as const) process.once(sinal, () => { void app.close(); });
 await app.listen({ host: '0.0.0.0', port: config.API_PORT });
} catch {
 await db.destroy();
 process.stderr.write('Falha ao iniciar o serviço. Confira configuração e banco.\n');
 process.exitCode = 1;
}
