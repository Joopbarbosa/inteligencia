import { notaSchema, type NotaLida } from '../api/leituras/schemas.js';
import { lerXml } from '../leitores/xml/leitor.js';
import { ErroLeitura } from '../shared/erro.js';
import { validarPortal } from '../seguranca/buscaSegura.js';
import { chaveDoQr, ufDaChave } from './chave.js';
import { identificarLeiaute } from '../leitores/leiaute.js';
import type { CacheNotas } from '../cache/notas.js';
export interface EntradaLeitura { modelo: 'NFE' | 'NFCE'; qrUrl?: string | undefined; chaveAcesso?: string | undefined;
 arquivo?: { dados: Buffer; mime: string } | undefined; confirmouEnvioIa?: boolean | undefined;
 pagina?: { html: string; uf: string; leiaute: string } | undefined }
export interface ContextoLeitura { chaveClienteId: string; contaId: string; signal: AbortSignal }
export interface AdaptadoresLeitura {
 leitorUf?: (entrada: EntradaLeitura, contexto: ContextoLeitura) => Promise<NotaLida | undefined>;
 ia?: (entrada: EntradaLeitura, contexto: ContextoLeitura) => Promise<NotaLida>;
 buscarPortal?: (url: string, signal: AbortSignal) => Promise<string>;
 decodificarQr?: (dados: Buffer, mime: string, signal: AbortSignal) => Promise<string | undefined>;
 cache?: CacheNotas;
 registrarFallback?: (pagina: NonNullable<EntradaLeitura['pagina']>) => Promise<void>;
}
export class Orquestrador {
 private emCurso = new Map<string,Promise<NotaLida>>();
 constructor(private readonly adaptadores: AdaptadoresLeitura = {}, private readonly iaHabilitada = false) {}
 async ler(entrada: EntradaLeitura, contexto: ContextoLeitura): Promise<NotaLida> {
  contexto.signal.throwIfAborted();
  const mime = entrada.arquivo?.mime;
  if (mime === 'application/xml' || mime === 'text/xml') {
   if (entrada.modelo !== 'NFE') throw new ErroLeitura('DOCUMENTO_INVALIDO');
   const nota = lerXml(entrada.arquivo!.dados); await this.adaptadores.cache?.guardar(nota); return nota;
  }
  if (entrada.arquivo && !entrada.confirmouEnvioIa) throw new ErroLeitura('CONFIRMACAO_ENVIO_IA_AUSENTE');
  let avisoQr = false;
  if (entrada.modelo === 'NFCE' && entrada.arquivo && this.adaptadores.decodificarQr) {
   const qrUrl = await this.adaptadores.decodificarQr(entrada.arquivo.dados, entrada.arquivo.mime, contexto.signal);
   if (qrUrl) entrada = { ...entrada, qrUrl };
   else avisoQr = true;
  }
  // Recusa antes de consultar cache; DNS só será resolvido se houver busca externa.
  if (entrada.qrUrl) validarPortal(entrada.qrUrl);
  const chave = entrada.qrUrl ? chaveDoQr(entrada.qrUrl) : entrada.chaveAcesso?.toUpperCase();
  if (chave) ufDaChave(chave);
  const realizar = async () => {
   const cached = chave ? await this.adaptadores.cache?.buscar(chave) : undefined;
   if (cached) return cached;
   let preparada = entrada;
   if (entrada.modelo === 'NFCE' && chave && this.adaptadores.buscarPortal) {
    const uf = ufDaChave(chave);
    const url = entrada.qrUrl ?? `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?chNFe=${chave}`;
    const html = await this.adaptadores.buscarPortal(url, contexto.signal);
    preparada = { ...entrada, chaveAcesso: chave, pagina: { html, uf, leiaute: identificarLeiaute(html, uf) } };
   }
   let nota: NotaLida | undefined;
   if (entrada.modelo === 'NFCE' && this.adaptadores.leitorUf) {
    try { const resultado = await this.adaptadores.leitorUf(preparada, contexto); if (resultado) nota = notaSchema.parse(resultado); }
    catch { contexto.signal.throwIfAborted(); }
   }
   if (!nota && this.iaHabilitada && this.adaptadores.ia) {
    if (preparada.pagina) {
     try { await this.adaptadores.registrarFallback?.(preparada.pagina); }
     catch { /* Falha de amostra não impede a leitura fiscal. */ }
    }
    nota = notaSchema.parse(await this.adaptadores.ia(preparada, contexto));
   }
   if (!nota) throw new ErroLeitura('LEITURA_IMPOSSIVEL');
   if (chave && (nota.chaveAcesso !== chave || nota.uf !== ufDaChave(chave))) throw new ErroLeitura('LEITURA_IMPOSSIVEL');
   if (avisoQr) nota = { ...nota, avisos: [...nota.avisos, 'O QR não pôde ser lido; a leitura foi feita pela imagem.'] };
   await this.adaptadores.cache?.guardar(nota); return nota;
  };
  if (!chave) return realizar();
  const anterior = this.emCurso.get(chave);
  if (anterior) {
   await anterior.catch(() => undefined); contexto.signal.throwIfAborted(); return this.ler(entrada, contexto);
  }
  const atual = realizar(); this.emCurso.set(chave, atual);
  try { return await atual; } finally { this.emCurso.delete(chave); }
 }
}
