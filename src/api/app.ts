import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { entradaJsonSchema } from './leituras/schemas.js';
import { Orquestrador, type EntradaLeitura } from '../leitura/orquestrador.js';
import { ErroLeitura, corpoErro } from '../shared/erro.js';
declare module 'fastify' { interface FastifyRequest { chaveClienteId: string; liberarLeitura: (() => void) | null } }
export interface OpcoesApp { autenticar: (chave: string) => Promise<string | undefined>; orquestrador?: Orquestrador }
export async function criarApp(opcoes: OpcoesApp) {
 // #764: erros de protocolo recusados pelo próprio servidor HTTP (ex.: cabeçalho grande) saem no formato de erro do serviço.
 const clientErrorHandler = (erro: NodeJS.ErrnoException, socket: import('node:net').Socket) => {
  if (!socket.writable) { socket.destroy(erro); return; }
  const status = erro.code === 'HPE_HEADER_OVERFLOW' ? '431 Request Header Fields Too Large' : '400 Bad Request';
  const corpo = JSON.stringify(corpoErro('DOCUMENTO_INVALIDO'));
  socket.end(`HTTP/1.1 ${status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(corpo)}\r\nConnection: close\r\n\r\n${corpo}`);
 };
 const app = Fastify({ bodyLimit: 1024 * 1024, logger: false, requestTimeout: 60_000, clientErrorHandler });
 app.decorateRequest('chaveClienteId', '');
 app.decorateRequest('liberarLeitura', null);
 const simultaneas = new Map<string,number>();
 app.addHook('onResponse', async req => { req.liberarLeitura?.(); });
 app.addHook('onRequestAbort', async req => { req.liberarLeitura?.(); });
 const orquestrador = opcoes.orquestrador ?? new Orquestrador();
 await app.register(multipart, { limits: { files: 1, fields: 2, parts: 3, fileSize: 10 * 1024 * 1024 } });
 app.setErrorHandler((erro, _req, reply) => {
  if (erro instanceof ErroLeitura) return reply.code(erro.status).send(corpoErro(erro.codigo));
  if (erro instanceof z.ZodError || (typeof erro === 'object' && erro !== null && 'statusCode' in erro && typeof erro.statusCode === 'number' && erro.statusCode >= 400 && erro.statusCode < 500))
   return reply.code(400).send(corpoErro('DOCUMENTO_INVALIDO'));
  return reply.code(500).send(corpoErro('ERRO_INTERNO'));
 });
 app.setNotFoundHandler((_req, reply) => reply.code(404).send(corpoErro('RECURSO_INEXISTENTE')));
 app.get('/saude', async () => ({ status: 'ok' }));
 app.post('/v1/leituras', {
  onRequest: async (req) => {
   const bearer = req.headers.authorization?.match(/^Bearer ([0-9a-f]{64})$/);
   const id = bearer?.[1] ? await opcoes.autenticar(bearer[1]) : undefined;
   if (!id) throw new ErroLeitura('CHAVE_INVALIDA', 401);
   if ((simultaneas.get(id) ?? 0) >= 4) throw new ErroLeitura('LIMITE_SIMULTANEAS');
   simultaneas.set(id, (simultaneas.get(id) ?? 0) + 1);
   let liberada = false;
   req.liberarLeitura = () => {
    if (liberada) return; liberada = true;
    const restantes = (simultaneas.get(id) ?? 1) - 1;
    if (restantes) simultaneas.set(id, restantes); else simultaneas.delete(id);
   };
   req.chaveClienteId = id;
  }
 }, async (req) => {
  const chaveClienteId = req.chaveClienteId;
  const contaId = z.uuid().parse(req.headers['x-conta-id']);
  let entrada: EntradaLeitura;
  if (req.isMultipart()) {
   if (!/(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(req.headers['content-type'] ?? '')) throw new ErroLeitura('DOCUMENTO_INVALIDO');
   const campos: Record<string, string> = {};
   let arquivo: EntradaLeitura['arquivo'];
   for await (const parte of req.parts()) {
    if (parte.type === 'file') {
     if (parte.fieldname !== 'arquivo' || arquivo || !['application/xml','text/xml','application/pdf','image/png','image/jpeg'].includes(parte.mimetype)) throw new ErroLeitura('DOCUMENTO_INVALIDO');
     arquivo = { dados: await parte.toBuffer(), mime: parte.mimetype };
    } else {
     if (parte.fieldname in campos || typeof parte.value !== 'string') throw new ErroLeitura('DOCUMENTO_INVALIDO');
     campos[parte.fieldname] = parte.value;
    }
   }
   const dados = z.strictObject({ modelo: z.enum(['NFCE','NFE']), confirmouEnvioIa: z.enum(['true','false']).optional() }).parse(campos);
   if (!arquivo) throw new ErroLeitura('DOCUMENTO_INVALIDO');
   entrada = { modelo: dados.modelo, confirmouEnvioIa: dados.confirmouEnvioIa === 'true', arquivo };
  } else entrada = entradaJsonSchema.parse(req.body);
  const signal = AbortSignal.timeout(60_000);
  let abortar: (() => void) | undefined;
  const prazo = new Promise<never>((_resolve, reject) => {
   abortar = () => reject(new ErroLeitura('LEITURA_IMPOSSIVEL'));
   signal.addEventListener('abort', abortar, { once: true });
  });
  try { return await Promise.race([orquestrador.ler(entrada, { chaveClienteId, contaId, signal }), prazo]); }
  finally { if (abortar) signal.removeEventListener('abort', abortar); }
 });
 return app;
}
