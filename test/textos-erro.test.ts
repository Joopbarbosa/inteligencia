import { expect, it } from 'vitest';
import { corpoErro } from '../src/shared/erro.js';
const generico = corpoErro('DOCUMENTO_INVALIDO');
// Textos são rascunho até o Gestor validar (CLAUDE.md seção 8); o teste só exige que orientem e não sejam o texto genérico.
it.each(['CONFIRMACAO_ENVIO_IA_AUSENTE', 'PORTAL_NAO_PERMITIDO'])('%s tem motivo e comoResolver próprios, não o genérico', codigo => {
 const c = corpoErro(codigo);
 expect(c.motivo).not.toBe(generico.motivo); expect(c.comoResolver).not.toBe(generico.comoResolver);
 expect(c.motivo.length).toBeGreaterThan(20); expect(c.comoResolver.length).toBeGreaterThan(20);
});
it('confirmação de envio orienta a confirmar o envio; portal orienta a usar o QR', () => {
 expect(corpoErro('CONFIRMACAO_ENVIO_IA_AUSENTE').comoResolver).toMatch(/confirme o envio/i);
 expect(corpoErro('PORTAL_NAO_PERMITIDO').comoResolver).toMatch(/QR/);
});

// #777 (textos validados pelo Gestor em 2026-10-07): cada código com orientação própria no "Como resolver".
it('limite de IA, simultâneas, erro interno, IA indisponível e chave inválida não usam o texto genérico', () => {
 for (const codigo of ['LIMITE_IA_ATINGIDO', 'LIMITE_SIMULTANEAS', 'ERRO_INTERNO', 'IA_INDISPONIVEL', 'CHAVE_INVALIDA']) {
  expect(corpoErro(codigo).comoResolver, codigo).not.toBe(generico.comoResolver);
 }
 expect(corpoErro('LIMITE_IA_ATINGIDO').comoResolver).toMatch(/próximo mês.*QR code.*XML/);
 expect(corpoErro('LIMITE_SIMULTANEAS').comoResolver).toBe('Espere uma leitura terminar e tente de novo.');
 expect(corpoErro('ERRO_INTERNO').comoResolver).toBe('Tente de novo em alguns minutos; se continuar, registre a compra à mão.');
 expect(corpoErro('IA_INDISPONIVEL').comoResolver).toBe(corpoErro('ERRO_INTERNO').comoResolver);
 expect(corpoErro('CHAVE_INVALIDA').motivo).toBe('O leitor de notas não está disponível agora.');
 expect(corpoErro('CHAVE_INVALIDA').comoResolver).toBe('Registre a compra à mão e avise o suporte.');
});
