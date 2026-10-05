import sharp from 'sharp';
import jsQRModule, { type QRCode } from 'jsqr';
// jsQR publica CommonJS com declaração default; ponte de tipo para NodeNext.
const jsQR = jsQRModule as unknown as (data: Uint8ClampedArray, width: number, height: number) => QRCode | null;
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErroLeitura } from '../../shared/erro.js';
const executar = promisify(execFile);
sharp.cache(false); sharp.concurrency(1);
let ultima: Promise<unknown> = Promise.resolve();

// O jsQR acerta ou erra conforme a escala em que o QR chega (a mesma foto lê em 1500 px e falha em 1280 px).
// Tenta poucas escalas, primeiro sem tratamento e depois com contraste normalizado, e para na primeira leitura (#706).
const LADOS = [1500, 1000, 800, 1200, 600];
async function imagem(dados: Buffer, signal: AbortSignal): Promise<string | undefined> {
 const origem = sharp(dados, { limitInputPixels: 12_000_000 });
 const { width = 0, height = 0 } = await origem.metadata();
 const tentativas = new Set<string>();
 for (const normalizar of [false, true]) {
  for (const lado of LADOS) {
   const efetivo = Math.min(lado, Math.max(width, height)), chave = `${normalizar}:${efetivo}`;
   if (tentativas.has(chave)) continue;
   tentativas.add(chave); signal.throwIfAborted();
   let pipeline = sharp(dados, { limitInputPixels: 12_000_000 }).rotate()
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true });
   if (normalizar) pipeline = pipeline.normalise();
   const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
   const qr = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)?.data;
   if (qr) return qr;
  }
 }
 return undefined;
}
async function processar(dados: Buffer, mime: string, signal: AbortSignal): Promise<string | undefined> {
 signal.throwIfAborted();
 if (dados.length > 10 * 1024 * 1024) throw new ErroLeitura('DOCUMENTO_INVALIDO');
 if (mime === 'image/png' || mime === 'image/jpeg') return imagem(dados, signal);
 if (mime !== 'application/pdf' || !dados.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new ErroLeitura('DOCUMENTO_INVALIDO');
 const pasta = await mkdtemp(join(tmpdir(), 'leitor-qr-'));
 try {
  const arquivo = join(pasta, 'entrada.pdf'); await writeFile(arquivo, dados, { mode: 0o600 });
  const info = await executar('pdfinfo', [arquivo], { timeout: 15_000, signal, maxBuffer: 64 * 1024 });
  const paginas = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isInteger(paginas) || paginas < 1) throw new ErroLeitura('DOCUMENTO_INVALIDO');
  for (let pagina = 1; pagina <= Math.min(paginas, 3); pagina++) {
   signal.throwIfAborted(); const saida = join(pasta, 'pagina');
   await executar('pdftoppm', ['-f', String(pagina), '-l', String(pagina), '-scale-to', '1500', '-png', '-singlefile', arquivo, saida],
    { timeout: 15_000, signal, maxBuffer: 64 * 1024 });
   const qr = await imagem(await readFile(saida + '.png'), signal); if (qr) return qr;
  }
  return undefined;
 } finally { await rm(pasta, { recursive: true, force: true }); }
}
/** Uma rasterização por processo, inclusive em requisições simultâneas. */
export async function decodificarQr(dados: Buffer, mime: string, signal: AbortSignal): Promise<string | undefined> {
 const atual = ultima.catch(() => undefined).then(() => processar(dados, mime, signal));
 ultima = atual;
 try { return await atual; } catch (erro) {
  if (erro instanceof ErroLeitura) throw erro;
  signal.throwIfAborted(); throw new ErroLeitura('DOCUMENTO_INVALIDO');
 }
}
