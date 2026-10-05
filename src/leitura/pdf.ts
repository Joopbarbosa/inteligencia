import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ErroLeitura } from '../shared/erro.js';
const executar = promisify(execFile);
async function usarPdf<T>(dados: Buffer, signal: AbortSignal, fn: (arquivo: string,pasta: string) => Promise<T>): Promise<T> {
 if (dados.length > 10*1024*1024 || !dados.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new ErroLeitura('DOCUMENTO_INVALIDO');
 signal.throwIfAborted(); const pasta = await mkdtemp(join(tmpdir(),'leitor-ia-'));
 try { const arquivo = join(pasta,'entrada.pdf'); await writeFile(arquivo,dados,{mode:0o600}); return await fn(arquivo,pasta); }
 finally { await rm(pasta,{recursive:true,force:true}); }
}
export async function textoPdf(dados: Buffer, signal: AbortSignal): Promise<string> {
 try { return await usarPdf(dados,signal,async arquivo =>
  (await executar('pdftotext',['-layout',arquivo,'-'],{signal,timeout:15_000,maxBuffer:2*1024*1024})).stdout); }
 catch { signal.throwIfAborted(); throw new ErroLeitura('DOCUMENTO_INVALIDO'); }
}
export async function imagensPdf(dados: Buffer, signal: AbortSignal): Promise<Buffer[]> {
 return usarPdf(dados,signal,async (arquivo,pasta) => {
  const info = await executar('pdfinfo',[arquivo],{signal,timeout:15_000,maxBuffer:64*1024});
  const paginas = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > 3) throw new Error('FORMATO_NAO_SUPORTADO');
  const imagens: Buffer[] = [];
  for(let pagina=1;pagina<=paginas;pagina++) {
   const prefixo = join(pasta,'pagina');
   await executar('pdftoppm',['-f',String(pagina),'-l',String(pagina),'-scale-to','1500','-png','-singlefile',arquivo,prefixo],{signal,timeout:15_000,maxBuffer:64*1024});
   imagens.push(await readFile(prefixo+'.png'));
  }
  return imagens;
 });
}
