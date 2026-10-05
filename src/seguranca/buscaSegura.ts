import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import type { LookupFunction } from 'node:net';
import { setTimeout as pausa } from 'node:timers/promises';
import ipaddr from 'ipaddr.js';
import portais from './portais.json' with { type: 'json' };
import { comSinal } from '../shared/prazo.js';
import { ErroLeitura } from '../shared/erro.js';

export function validarPortal(texto: string, permitidos: readonly string[] = portais): URL {
 let url: URL;
 try { url = new URL(texto); } catch { throw new ErroLeitura('PORTAL_NAO_PERMITIDO'); }
 if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
  || !permitidos.includes(url.hostname.toLowerCase())) throw new ErroLeitura('PORTAL_NAO_PERMITIDO');
 return url;
}
export function ipPublico(ip: string): boolean {
 try {
  const endereco = ipaddr.parse(ip);
  return endereco.range() === 'unicast' && !(endereco.kind() === 'ipv6' && (endereco as ipaddr.IPv6).isIPv4MappedAddress());
 } catch { return false; }
}
export interface RespostaPortal { status: number; tipo?: string | undefined; local?: string | undefined; html: string }
interface Endereco { address: string; family: number }
export type Resolver = (host: string) => Promise<Endereco[]>;
export type Transporte = (url: URL, endereco: Endereco, signal: AbortSignal) => Promise<RespostaPortal>;

/**
 * Lookup que devolve só o IP já validado, sem nova consulta de DNS (contra DNS rebinding). O Node 20+ pede
 * `all: true` e exige lista; sem isso toda consulta falha com ERR_INVALID_IP_ADDRESS (#705).
 */
export const lookupFixo = (endereco: Endereco): LookupFunction => (_host, opcoes, callback) => {
 if (opcoes.all) (callback as (erro: null, enderecos: Endereco[]) => void)(null, [endereco]);
 else callback(null, endereco.address, endereco.family);
};

/** O lookup fixa o IP validado; SNI/certificado continuam associados ao host oficial. */
export const transportar: Transporte = (url, endereco, signal) => new Promise((resolve, reject) => {
 const req = request(url, { signal, agent: false, servername: url.hostname,
  lookup: lookupFixo(endereco),
  headers: { accept: 'text/html', 'user-agent': 'leitor-fiscal/0.16.0' } }, res => {
  const status = res.statusCode ?? 500;
  if ([301,302,303,307,308].includes(status)) {
   res.resume(); resolve({ status, local: res.headers.location, html: '' }); return;
  }
  if (!/^text\/html(?:;|$)/i.test(res.headers['content-type'] ?? '') || Number(res.headers['content-length'] ?? 0) > 2 * 1024 * 1024) {
   res.destroy(); reject(new ErroLeitura('PORTAL_NAO_PERMITIDO')); return;
  }
  const partes: Buffer[] = []; let bytes = 0;
  res.on('data', (parte: Buffer) => {
   bytes += parte.length;
   if (bytes > 2 * 1024 * 1024) { res.destroy(); reject(new ErroLeitura('PORTAL_NAO_PERMITIDO')); }
   else partes.push(parte);
  });
  res.on('end', () => resolve({ status, tipo: res.headers['content-type'], html: Buffer.concat(partes).toString('utf8') }));
  res.on('error', reject);
 });
 req.on('error', reject); req.end();
});
export class LimitePortais {
 private ativos = 0;
 private hosts = new Map<string, { ativos: number; proximo: number }>();
 private esperando = new Set<() => void>();
 constructor(private readonly intervaloMs = 1000) {}
 async executar<T>(host: string, signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  const estado = this.hosts.get(host) ?? { ativos: 0, proximo: 0 }; this.hosts.set(host, estado);
  while (this.ativos >= 4 || estado.ativos >= 2) {
   signal.throwIfAborted();
   await new Promise<void>((resolve, reject) => {
    const pronto = () => { limpar(); resolve(); };
    const abortar = () => { limpar(); reject(signal.reason); };
    const limpar = () => { this.esperando.delete(pronto); signal.removeEventListener('abort', abortar); };
    this.esperando.add(pronto); signal.addEventListener('abort', abortar, { once: true });
    if (signal.aborted) abortar();
   });
  }
  signal.throwIfAborted(); this.ativos++; estado.ativos++;
  const demora = Math.max(0, estado.proximo - Date.now()); estado.proximo = Date.now() + demora + this.intervaloMs;
  try { if (demora) await pausa(demora, undefined, { signal }); signal.throwIfAborted(); return await fn(); }
  finally { this.ativos--; estado.ativos--; for (const pronto of [...this.esperando]) pronto(); }
 }
}
export class BuscaSegura {
 constructor(private readonly resolver: Resolver = host => lookup(host, { all: true, verbatim: true }),
  private readonly transporte: Transporte = transportar, private readonly limites = new LimitePortais(),
  private readonly permitidos: readonly string[] = portais) {}
 async buscar(texto: string, signal: AbortSignal): Promise<string> {
  let url = validarPortal(texto, this.permitidos);
  const prazo = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  for (let salto = 0; salto <= 3; salto++) {
   prazo.throwIfAborted();
   const ips = await comSinal(this.resolver(url.hostname), prazo);
   if (!ips.length || ips.some(ip => !ipPublico(ip.address))) throw new ErroLeitura('PORTAL_NAO_PERMITIDO');
   const destino = url;
   const resposta = await this.limites.executar(url.hostname, prazo, () => this.transporte(destino, ips[0]!, prazo));
   if ([301,302,303,307,308].includes(resposta.status)) {
    if (!resposta.local || salto === 3) throw new ErroLeitura('PORTAL_NAO_PERMITIDO');
    url = validarPortal(new URL(resposta.local, url).href, this.permitidos); continue;
   }
   if (resposta.status !== 200) throw new ErroLeitura('LEITURA_IMPOSSIVEL');
   if (!/^text\/html(?:;|$)/i.test(resposta.tipo ?? '') || Buffer.byteLength(resposta.html) > 2 * 1024 * 1024)
    throw new ErroLeitura('PORTAL_NAO_PERMITIDO');
   return resposta.html;
  }
  throw new ErroLeitura('PORTAL_NAO_PERMITIDO');
 }
}
