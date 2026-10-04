import { z } from 'zod';
import { conectar } from '../db/conexao.js';
import { migrar } from '../db/migrar.js';
import { Chaves } from './chaves.js';
const db = conectar(z.string().url().parse(process.env.DATABASE_URL));
try {
 await migrar(db);
 const chaves = new Chaves(db);
 const [acao, argumento] = process.argv.slice(2);
 if (acao === 'criar') {
  const resultado = await chaves.criar(z.string().min(1).max(100).parse(argumento));
  process.stdout.write(JSON.stringify(resultado) + '\n');
 } else if (acao === 'revogar') {
  if (!await chaves.revogar(z.uuid().parse(argumento))) throw new Error('Chave não encontrada');
  process.stdout.write('Chave revogada\n');
 } else throw new Error('Use criar <produto> ou revogar <id>');
} catch {
 process.stderr.write('Não foi possível executar o comando. Confira ação, argumento e banco.\n');
 process.exitCode = 1;
} finally { await db.destroy(); }
