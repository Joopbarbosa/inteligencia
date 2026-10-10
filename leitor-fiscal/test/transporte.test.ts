import { describe, it, expect, afterEach } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { lookupFixo } from '../src/seguranca/buscaSegura.js';

// OpenProject #705: o transporte seguro fixa o IP validado por um lookup customizado. O Node 20+
// chama o lookup com `all: true` e exige uma lista; devolver um endereço só dava
// ERR_INVALID_IP_ADDRESS em toda consulta real. Aqui o lookup passa pela pilha de rede real.
describe('#705: lookup que fixa o IP validado', () => {
 let servidor: Server | undefined;
 afterEach(() => new Promise<void>(fim => servidor ? servidor.close(() => fim()) : fim()));

 const subir = async () => {
  servidor = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<html>ok</html>'));
  await new Promise<void>(pronto => servidor!.listen(0, '127.0.0.1', pronto));
  return (servidor.address() as AddressInfo).port;
 };
 const buscar = (porta: number, host: string) => new Promise<string>((resolve, reject) => {
  const req = request({ host, port: porta, lookup: lookupFixo({ address: '127.0.0.1', family: 4 }) }, res => {
   const partes: Buffer[] = []; res.on('data', (p: Buffer) => partes.push(p));
   res.on('end', () => resolve(Buffer.concat(partes).toString('utf8'))); res.on('error', reject);
  });
  req.on('error', reject); req.end();
 });

 it('conecta no IP fixado mesmo que o nome do host aponte para outro lugar', async () => {
  expect(await buscar(await subir(), 'www.nfce.fazenda.sp.gov.br')).toBe('<html>ok</html>');
 });
 it('responde em lista quando o Node pede all: true', () => {
  const chamada = new Promise(resolve => lookupFixo({ address: '8.8.8.8', family: 4 })('h', { all: true }, (erro, resposta) => resolve({ erro, resposta })));
  return expect(chamada).resolves.toEqual({ erro: null, resposta: [{ address: '8.8.8.8', family: 4 }] });
 });
 it('responde endereço e família quando o Node não pede lista', () => {
  const chamada = new Promise(resolve => lookupFixo({ address: '2606:4700:4700::1111', family: 6 })('h', {}, (erro, endereco, familia) => resolve({ erro, endereco, familia })));
  return expect(chamada).resolves.toEqual({ erro: null, endereco: '2606:4700:4700::1111', familia: 6 });
 });
});
