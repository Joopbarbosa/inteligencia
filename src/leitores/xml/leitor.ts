import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { decimal, notaSchema, type NotaLida } from '../../api/leituras/schemas.js';
import { subtrair, somar } from '../../shared/decimal.js';
import { ErroLeitura } from '../../shared/erro.js';
const obj = z.looseObject;
const produto = obj({ xProd: z.string(), qCom: decimal, vProd: decimal, vDesc: decimal.optional(),
 uCom: z.string().optional(), cProd: z.string().optional(), cEAN: z.string().optional() });
const infoSchema = obj({ '@_Id': z.string(), '@_versao': z.string().min(1),
 ide: obj({ cUF: z.string(), mod: z.literal('55'), nNF: z.string(), serie: z.string(), dhEmi: z.string() }),
 emit: obj({ CNPJ: z.string(), xNome: z.string(), enderEmit: obj({ UF: z.string() }) }),
 det: z.array(obj({ prod: produto })).min(1),
 total: obj({ ICMSTot: obj({ vNF: decimal, vDesc: decimal.optional(), vFrete: decimal.optional(), vSeg: decimal.optional(), vOutro: decimal.optional() }) })
});
const ufs: Record<string, string> = { '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
 '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
 '31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF' };
export function lerXml(dados: Buffer): NotaLida {
 try {
  if (dados.length > 5 * 1024 * 1024) throw new Error('Tamanho');
  const texto = new TextDecoder('utf-8', { fatal: true }).decode(dados);
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(texto) || XMLValidator.validate(texto) !== true) throw new Error('XML inválido');
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false,
   parseAttributeValue: false, trimValues: false, processEntities: true, isArray: name => name === 'det' });
  const raiz = obj({ NFe: obj({ infNFe: z.unknown() }).optional(),
   nfeProc: obj({ NFe: obj({ infNFe: z.unknown() }) }).optional() }).parse(parser.parse(texto) as unknown);
  if (Number(Boolean(raiz.NFe)) + Number(Boolean(raiz.nfeProc)) !== 1) throw new Error('Raiz');
  const info = infoSchema.parse((raiz.NFe ?? raiz.nfeProc?.NFe)?.infNFe);
  if (!/^NFe[0-9A-Z]{44}$/.test(info['@_Id'])) throw new Error('Identificador');
  const chave = info['@_Id'].slice(3);
  const uf = ufs[chave.slice(0, 2)];
  if (!uf || uf !== info.emit.enderEmit.UF || info.ide.cUF !== chave.slice(0,2) || chave.slice(6,20) !== info.emit.CNPJ || chave.slice(20,22) !== '55') throw new Error('Dados incoerentes');
  const itens = info.det.map(({ prod: p }) => ({ nome: p.xProd, quantidade: p.qCom,
   valorFinal: subtrair(p.vProd, p.vDesc ?? '0'), valorBruto: p.vProd,
   ...(p.vDesc !== undefined ? { desconto: p.vDesc } : {}),
   ...(p.uCom !== undefined ? { unidade: p.uCom } : {}),
   ...(p.cProd !== undefined ? { codigo: p.cProd } : {}),
   ...(p.cEAN !== undefined ? { ean: p.cEAN } : {}) }));
  const total = info.total.ICMSTot;
  const descontoItens = somar(...info.det.map(d => d.prod.vDesc ?? '0'));
  let descontoGeral: string;
  try { descontoGeral = subtrair(total.vDesc ?? '0', descontoItens); } catch { descontoGeral = '0'; }
  return notaSchema.parse({ emitente: { cnpj: info.emit.CNPJ, nome: info.emit.xNome, uf }, chaveAcesso: chave,
   numero: info.ide.nNF, serie: info.ide.serie, dataEmissao: info.ide.dhEmi, totalPago: total.vNF,
   descontoGeral, acrescimos: somar(total.vFrete ?? '0', total.vSeg ?? '0', total.vOutro ?? '0'),
   itens, origem: 'NFE_XML', metodo: 'XML', doCache: false, uf, leiaute: uf + '-NFE-XML-' + info['@_versao'], avisos: [] });
 } catch { throw new ErroLeitura('DOCUMENTO_INVALIDO'); }
}
