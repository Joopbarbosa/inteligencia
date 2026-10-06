import { chaveAcesso } from '../api/leituras/schemas.js';
import { validarPortal } from '../seguranca/buscaSegura.js';
import { ErroLeitura } from '../shared/erro.js';
import { ufPorCodigoIbge } from '../shared/uf.js';
export function ufDaChave(chave: string): string {
 const valida = chaveAcesso.safeParse(chave.toUpperCase());
 const uf = ufPorCodigoIbge[chave.slice(0,2)];
 if (!valida.success || !uf) throw new ErroLeitura('DOCUMENTO_INVALIDO'); return uf;
}
export function chaveDoQr(texto: string, permitidos?: readonly string[]): string {
 const url = validarPortal(texto, permitidos);
 const p = url.searchParams.get('p');
 const chave = (p?.split('|')[0] ?? url.searchParams.get('chNFe') ?? '').toUpperCase();
 ufDaChave(chave); return chave;
}
