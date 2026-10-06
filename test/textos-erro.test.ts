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
