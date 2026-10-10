/** Decimal brasileiro ("1.234,56") para o formato do serviço ("1234.56"); sem número devolve undefined. */
export function decimalPt(texto: string): string | undefined {
 const valor = texto.match(/(?:^|[^\d])([\d.]+,\d+|\d+)(?:\s|$)/)?.[1];
 return valor?.replaceAll('.', '').replace(',', '.');
}
export interface CabecalhoNfce { numero?: string | undefined; serie?: string | undefined; dataEmissao?: string | undefined;
 descontoGeral: string; acrescimos: string }
/** Emissão, número, série, descontos e acréscimos do texto corrido da página do portal (única leitura, usada pelo leitor de SP e pela IA). */
export function lerCabecalhoNfce(texto: string): CabecalhoNfce {
 const data = texto.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
 return { numero: texto.match(/N[uú]mero:\s*(\d+)/i)?.[1], serie: texto.match(/S[eé]rie:\s*(\d+)/i)?.[1],
  dataEmissao: data ? `${data[3]}-${data[2]}-${data[1]}T${data[4]}-03:00` : undefined,
  descontoGeral: decimalPt(texto.match(/Descontos?:\s*([\d.,]+)/i)?.[1] ?? '') ?? '0',
  acrescimos: decimalPt(texto.match(/Acr[eé]scimos?:\s*([\d.,]+)/i)?.[1] ?? '') ?? '0' };
}
