import { z } from 'zod';
export const decimal = z.string().regex(/^\d+(\.\d+)?$/);
export const chaveAcesso = z.string().regex(/^[0-9A-Z]{44}$/);
const item = z.strictObject({ nome: z.string().min(1).max(500), quantidade: decimal, valorFinal: decimal,
 valorBruto: decimal.optional(), desconto: decimal.optional(), unidade: z.string().optional(),
 codigo: z.string().optional(), ean: z.string().optional() });
export const notaSchema = z.strictObject({
 emitente: z.strictObject({ cnpj: z.string().regex(/^[0-9A-Z]{12}[0-9]{2}$/), nome: z.string().min(1).max(500), uf: z.string().regex(/^[A-Z]{2}$/) }),
 chaveAcesso, numero: z.string().min(1), serie: z.string().min(1), dataEmissao: z.iso.datetime({ offset: true }),
 totalPago: decimal, descontoGeral: decimal, acrescimos: decimal, itens: z.array(item).min(1),
 origem: z.enum(['NFCE_QR','NFE_PDF','NFE_FOTO','NFE_XML']), metodo: z.enum(['LEITOR_UF','IA','XML']),
 doCache: z.boolean(), uf: z.string().regex(/^[A-Z]{2}$/), leiaute: z.string().min(1), avisos: z.array(z.string().max(500))
});
export type NotaLida = z.infer<typeof notaSchema>;
export const entradaJsonSchema = z.strictObject({ modelo: z.enum(['NFCE','NFE']),
 qrUrl: z.string().min(1).max(4096).optional(), chaveAcesso: chaveAcesso.optional()
}).refine(v => Number(v.qrUrl !== undefined) + Number(v.chaveAcesso !== undefined) === 1);
