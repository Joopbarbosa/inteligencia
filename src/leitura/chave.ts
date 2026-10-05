import { chaveAcesso } from '../api/leituras/schemas.js';
import { validarPortal } from '../seguranca/buscaSegura.js';
import { ErroLeitura } from '../shared/erro.js';
const ufs: Record<string,string> = { '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
 '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
 '31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF' };
export function ufDaChave(chave: string): string {
 const valida = chaveAcesso.safeParse(chave.toUpperCase());
 const uf = ufs[chave.slice(0,2)];
 if (!valida.success || !uf) throw new ErroLeitura('DOCUMENTO_INVALIDO'); return uf;
}
export function chaveDoQr(texto: string): string {
 const url = validarPortal(texto);
 const p = url.searchParams.get('p');
 const chave = (p?.split('|')[0] ?? url.searchParams.get('chNFe') ?? '').toUpperCase();
 ufDaChave(chave); return chave;
}
