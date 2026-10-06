import type { NotaLida } from '../api/leituras/schemas.js';
import { lerSp } from './sp/leitor.js';
export const leitores: Readonly<Record<string,(html: string) => NotaLida | undefined>> = { SP: lerSp };
// URL da consulta pela chave de acesso, por UF. UF sem entrada não tem portal cadastrado: a leitura por chave não toca a rede (RN-NOVA-8).
export const portaisPorChave: Readonly<Record<string,(chave: string) => string>> = {
 SP: chave => `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?chNFe=${chave}` };
// UFs cujo portal exige captcha na consulta pela chave de acesso: só o link do QR é lido (#708).
export const ufsQueExigemQr: ReadonlySet<string> = new Set(['SP']);
