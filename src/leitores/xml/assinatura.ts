import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { SignedXml } from 'xml-crypto';

const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';

/**
 * #743: verifica criptograficamente a assinatura XMLDSig da NF-e (integridade do XML contra o certificado embutido
 * em KeyInfo). Não valida a cadeia ICP-Brasil nem a revogação do certificado: prova que o conteúdo assinado não foi
 * alterado depois de assinado, e que o trecho assinado é o `infNFe` cuja chave foi lida (defesa contra assinatura
 * válida colada em outro conteúdo). Qualquer falha responde `false`; nunca lança.
 * Só deve ser chamada depois de `lerXml`, que já recusa DOCTYPE e entidades.
 */
export function assinaturaXmlValida(dados: Buffer, chaveAcesso: string): boolean {
 try {
  const texto = new TextDecoder('utf-8', { fatal: true }).decode(dados);
  const doc = new DOMParser({ errorHandler: () => { throw new Error('xml'); } }).parseFromString(texto, 'text/xml');
  const assinaturas = xpath.select(`//*[local-name(.)='Signature' and namespace-uri(.)='${NS_DSIG}']`, doc as unknown as Node) as Node[];
  if (assinaturas.length !== 1) return false;
  // A biblioteca não confia no certificado embutido por padrão; aqui ele é usado de propósito (integridade, não autenticidade).
  const verificador = new SignedXml({ getCertFromKeyInfo: SignedXml.getCertFromKeyInfo });
  verificador.loadSignature(assinaturas[0]!);
  if (!verificador.checkSignature(texto)) return false;
  const assinados = verificador.getSignedReferences();
  if (assinados.length !== 1) return false;
  const alvo = new DOMParser().parseFromString(assinados[0]!, 'text/xml').documentElement;
  return alvo?.localName === 'infNFe' && alvo.getAttribute('Id') === 'NFe' + chaveAcesso;
 } catch { return false; }
}
