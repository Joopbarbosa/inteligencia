import type { CadeiaIa } from '../ia/cadeia.js';
import type { LimitesIa } from './limites.js';
import type { AdaptadoresLeitura } from './orquestrador.js';
/** Encaixe `ia` do orquestrador: a cadeia de IA só roda depois da reserva de limite e só conta se terminar bem (RN-NOVA-6). */
export const comporIa = (limites: LimitesIa, cadeia: Pick<CadeiaIa, 'ler'>): NonNullable<AdaptadoresLeitura['ia']> =>
 (entrada, contexto) => limites.executar(contexto, () => cadeia.ler(entrada, contexto));
