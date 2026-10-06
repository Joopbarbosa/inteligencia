export class ErroLeitura extends Error {
 constructor(readonly codigo: string, readonly status = 400) { super(codigo); }
}
export function corpoErro(codigo: string) {
 return { tipo: 'BLOQUEIO' as const, codigo, titulo: 'Não foi possível concluir a leitura',
 motivo: codigo === 'CHAVE_INVALIDA' ? 'Credencial ausente, inválida ou revogada.' :
 codigo === 'ERRO_INTERNO' ? 'O serviço encontrou um erro inesperado.' :
 codigo === 'LIMITE_IA_ATINGIDO' ? 'O limite mensal de leituras por IA foi atingido.' :
 codigo === 'LIMITE_SIMULTANEAS' ? 'Há quatro leituras em andamento para este produto.' :
 codigo === 'IA_INDISPONIVEL' ? 'Os serviços de IA não conseguiram concluir a leitura.' :
 codigo === 'CONFIRMACAO_ENVIO_IA_AUSENTE' ? 'Imagem ou PDF só é lido por IA depois que você confirma o envio do arquivo.' :
 codigo === 'PORTAL_NAO_PERMITIDO' ? 'O link informado não é de um portal oficial da Fazenda aceito pelo serviço.' :
 codigo === 'CHAVE_EXIGE_QR' ? 'O portal da Fazenda deste estado exige um código de imagem (captcha) na consulta pela chave de acesso.' :
 'O documento não pôde ser lido com os dados enviados.',
 comoResolver: codigo === 'CONFIRMACAO_ENVIO_IA_AUSENTE' ? 'Confirme o envio do arquivo para leitura por IA ou use o QR code, o link do QR ou o XML da nota.' :
 codigo === 'PORTAL_NAO_PERMITIDO' ? 'Use o QR code do cupom ou cole o link exatamente como aparece no QR; se não funcionar, registre a compra à mão.' :
 codigo === 'CHAVE_EXIGE_QR' ? 'Use o QR code do cupom (pela câmera ou por uma foto) ou cole o link do QR code.' :
 'Confira os dados e tente novamente ou registre a compra à mão.', itens: [] as string[] };
}
