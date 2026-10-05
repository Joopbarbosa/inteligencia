export async function comSinal<T>(promessa: Promise<T>, signal: AbortSignal): Promise<T> {
 signal.throwIfAborted();
 return new Promise<T>((resolve, reject) => {
  const abortar = () => { limpar(); reject(signal.reason); };
  const limpar = () => signal.removeEventListener('abort', abortar);
  signal.addEventListener('abort', abortar, { once: true });
  if (signal.aborted) abortar();
  promessa.then(valor => { limpar(); resolve(valor); }, erro => { limpar(); reject(erro); });
 });
}
