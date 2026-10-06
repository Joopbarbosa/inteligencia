import type { CadeiaIa } from '../ia/cadeia.js';
import type { Alertas } from '../alertas/repositorio.js';
import type { CacheNotas } from '../cache/notas.js';
import type { NotaLida } from '../api/leituras/schemas.js';
import { LimitesIa } from './limites.js';
import { Orquestrador, type AdaptadoresLeitura } from './orquestrador.js';

export interface DependenciasLeitura {
 cadeia?: Pick<CadeiaIa, 'ler'> | undefined; limites: LimitesIa; alertas: Pick<Alertas, 'registrar'>; cache: CacheNotas;
 leitores: Readonly<Record<string, (html: string) => NotaLida | undefined>>;
 /** Falso em produção sem `SP_LEITOR_LIBERADO=true`: o leitor próprio fica desligado por política, não por falha. */
 leitoresLiberados: boolean;
 buscarPortal?: AdaptadoresLeitura['buscarPortal']; decodificarQr?: AdaptadoresLeitura['decodificarQr'];
 hostsPermitidos?: AdaptadoresLeitura['hostsPermitidos'];
}
/** Composição real do serviço (usada por `server.ts` e pelos testes de integração): cache, leitor da UF, IA atrás do limite e alerta de fallback. */
export function montarOrquestrador(d: DependenciasLeitura): Orquestrador {
 const { cadeia, limites, alertas, leitores } = d;
 return new Orquestrador({
  ...(cadeia ? { ia: (entrada, contexto) => limites.executar(contexto, () => cadeia.ler(entrada, contexto)) } : {}),
  cache: d.cache, ...(d.decodificarQr ? { decodificarQr: d.decodificarQr } : {}), ...(d.buscarPortal ? { buscarPortal: d.buscarPortal } : {}),
  ...(d.hostsPermitidos ? { hostsPermitidos: d.hostsPermitidos } : {}),
  registrarFallback: async pagina => {
   const temLeitor = leitores[pagina.uf] !== undefined;
   // Leitor desligado por política não é falha do leitor: não abre alerta nem tarefa "Mapear leitor da UF".
   if (temLeitor && !d.leitoresLiberados) return;
   await alertas.registrar(pagina, temLeitor ? 'LEITOR_FALHOU' : 'UF_SEM_LEITOR');
  },
  leitorUf: async entrada => d.leitoresLiberados && entrada.pagina ? leitores[entrada.pagina.uf]?.(entrada.pagina.html) : undefined,
 }, Boolean(cadeia));
}
