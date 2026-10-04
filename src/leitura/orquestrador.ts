import { notaSchema, type NotaLida } from '../api/leituras/schemas.js';
import { lerXml } from '../leitores/xml/leitor.js';
import { ErroLeitura } from '../shared/erro.js';
export interface EntradaLeitura { modelo: 'NFE' | 'NFCE'; qrUrl?: string | undefined; chaveAcesso?: string | undefined;
 arquivo?: { dados: Buffer; mime: string } | undefined; confirmouEnvioIa?: boolean | undefined }
export interface ContextoLeitura { chaveClienteId: string; contaId: string; signal: AbortSignal }
export interface AdaptadoresLeitura {
 leitorUf?: (entrada: EntradaLeitura, contexto: ContextoLeitura) => Promise<NotaLida | undefined>;
 ia?: (entrada: EntradaLeitura, contexto: ContextoLeitura) => Promise<NotaLida>;
}
export class Orquestrador {
 constructor(private readonly adaptadores: AdaptadoresLeitura = {}, private readonly iaHabilitada = false) {}
 async ler(entrada: EntradaLeitura, contexto: ContextoLeitura): Promise<NotaLida> {
  contexto.signal.throwIfAborted();
  const mime = entrada.arquivo?.mime;
  if (mime === 'application/xml' || mime === 'text/xml') {
   if (entrada.modelo !== 'NFE') throw new ErroLeitura('DOCUMENTO_INVALIDO');
   return lerXml(entrada.arquivo!.dados);
  }
  if (entrada.arquivo && !entrada.confirmouEnvioIa) throw new ErroLeitura('CONFIRMACAO_ENVIO_IA_AUSENTE');
  if (entrada.modelo === 'NFCE' && this.adaptadores.leitorUf) {
   const nota = await this.adaptadores.leitorUf(entrada, contexto);
   if (nota) return notaSchema.parse(nota);
  }
  if (this.iaHabilitada && this.adaptadores.ia) return notaSchema.parse(await this.adaptadores.ia(entrada, contexto));
  throw new ErroLeitura('LEITURA_IMPOSSIVEL');
 }
}
