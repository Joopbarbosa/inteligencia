export class ErroLeitura extends Error {
 constructor(readonly codigo: string, readonly status = 400) { super(codigo); }
}
export function corpoErro(codigo: string) {
 return { tipo: 'BLOQUEIO' as const, codigo, titulo: 'Não foi possível concluir a leitura',
 motivo: codigo === 'CHAVE_INVALIDA' ? 'Credencial ausente, inválida ou revogada.' :
 codigo === 'ERRO_INTERNO' ? 'O serviço encontrou um erro inesperado.' :
 codigo === 'LIMITE_IA_ATINGIDO' ? 'O limite mensal de leituras por IA foi atingido.' :
 codigo === 'LIMITE_SIMULTANEAS' ? 'Há quatro leituras em andamento para este produto.' :
 codigo === 'IA_INDISPONIVEL' ? 'Os serviços de IA não conseguiram concluir a leitura.' : 'O documento não pôde ser lido com os dados enviados.',
 comoResolver: 'Confira os dados e tente novamente ou registre a compra à mão.', itens: [] as string[] };
}
