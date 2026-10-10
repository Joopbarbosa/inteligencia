function partes(valor: string) {
 const [inteiro = '0', fracao = ''] = valor.split('.');
 return { digitos: BigInt(inteiro + fracao), escala: fracao.length };
}
export function somar(...valores: string[]): string {
 const numeros = valores.map(partes);
 const escala = Math.max(...numeros.map(n => n.escala));
 return formatar(numeros.reduce((s, n) => s + n.digitos * 10n ** BigInt(escala - n.escala), 0n), escala);
}
export function subtrair(a: string, b: string): string {
 const x = partes(a), y = partes(b), escala = Math.max(x.escala, y.escala);
 const valor = x.digitos * 10n ** BigInt(escala-x.escala) - y.digitos * 10n ** BigInt(escala-y.escala);
 if (valor < 0n) throw new Error('Decimal negativo');
 return formatar(valor, escala);
}
function formatar(valor: bigint, escala: number) {
 const texto = valor.toString().padStart(escala + 1, '0');
 return escala ? texto.slice(0, -escala) + '.' + texto.slice(-escala) : texto;
}
