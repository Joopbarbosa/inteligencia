// Servidor HTTP com rotas reais, banco test_* e resolução DNS que impede tráfego ao portal no fuzz.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { conectar } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import { Chaves } from '../src/autenticacao/chaves.js';
import { CachePostgres } from '../src/cache/notas.js';
import { criarApp } from '../src/api/app.js';
import { Orquestrador } from '../src/leitura/orquestrador.js';
import { BuscaSegura } from '../src/seguranca/buscaSegura.js';
import { decodificarQr } from '../src/leitura/qr/decodificar.js';
const env = parseEnv(readFileSync('.pocket.env', 'utf8'));
const url = new URL(env.DATABASE_URL ?? '');
if (env.POCKET_TEST_DB !== '1' || !env.DB_NAME?.startsWith('test_') || !env.DB_CONTAINER?.startsWith('test_') ||
 url.hostname !== 'localhost' || url.pathname !== '/' + env.DB_NAME || url.port !== env.DB_PORT) throw new Error('Alvo não confirmado');
const db = conectar(url.href); await migrar(db);
const chaves = new Chaves(db), busca = new BuscaSegura(async () => [{ address:'127.0.0.1', family:4 }]);
const app = await criarApp({ autenticar: chave => chaves.autenticar(chave), orquestrador: new Orquestrador({
 cache: new CachePostgres(db), decodificarQr, buscarPortal: (texto, signal) => busca.buscar(texto, signal)
}) });
app.addHook('onClose', async () => db.destroy());
for (const sinal of ['SIGINT','SIGTERM'] as const) process.once(sinal, () => { void app.close(); });
await app.listen({host:'127.0.0.1',port:Number(env.API_PORT)});
