import type { NotaLida } from '../api/leituras/schemas.js';
import { lerSp } from './sp/leitor.js';
export const leitores: Readonly<Record<string,(html: string) => NotaLida | undefined>> = { SP: lerSp };
// UFs cujo portal exige captcha na consulta pela chave de acesso: só o link do QR é lido (#708).
export const ufsQueExigemQr: ReadonlySet<string> = new Set(['SP']);
