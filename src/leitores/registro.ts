import type { NotaLida } from '../api/leituras/schemas.js';
import { lerSp } from './sp/leitor.js';
export const leitores: Readonly<Record<string,(html: string) => NotaLida | undefined>> = { SP: lerSp };
