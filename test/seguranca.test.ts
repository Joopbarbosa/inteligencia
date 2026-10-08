import { describe,it,expect,vi } from 'vitest';
import { BuscaSegura, ipPublico, LimitePortais, validarPortal } from '../src/seguranca/buscaSegura.js';
const signal = () => new AbortController().signal;
const url = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35' + '1'.repeat(42);
const resolver = vi.fn(async () => [{address:'8.8.8.8',family:4}]);
const transporte = vi.fn(async (_url: URL, _endereco: {address: string; family: number}, _signal: AbortSignal) => ({status:200,tipo:'text/html; charset=utf-8',html:'<html>nota</html>'}));
describe('RN-NOVA-8 / CEN39,40: recusa antes de fazer requisição', () => {
 it.each(['http://www.nfce.fazenda.sp.gov.br','https://www.nfce.fazenda.sp.gov.br:8443','https://usuario:senha@www.nfce.fazenda.sp.gov.br',
  'https://www.nfce.fazenda.sp.gov.br.evil.com','https://evil.com','https://127.0.0.1','https://www.nfce.fazenda.sp.gov.br.'])('esquema/credencial/porta/host %s', async texto => {
  const dns=vi.fn(), http=vi.fn(); await expect(new BuscaSegura(dns,http).buscar(texto,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');
  expect(dns).not.toHaveBeenCalled();expect(http).not.toHaveBeenCalled();
 });
 it.each(['127.0.0.1','0.0.0.0','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','192.0.0.1',
  '198.18.0.1','224.0.0.1','240.0.0.1','::','::1','fe80::1','fc00::1','fd00::1','::ffff:8.8.8.8','::ffff:127.0.0.1','2001:db8::1'])('recusa DNS interno/reservado/mapeado %s', async ip => {
  expect(ipPublico(ip)).toBe(false);const http=vi.fn();
  await expect(new BuscaSegura(async()=>[{address:'8.8.8.8',family:4},{address:ip,family:ip.includes(':')?6:4}],http).buscar(url,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');
  expect(http).not.toHaveBeenCalled();
 });
 it('usa endereço já resolvido no transporte e não repete DNS', async () => {
  resolver.mockClear();transporte.mockClear();expect(await new BuscaSegura(resolver,transporte).buscar(url,signal())).toBe('<html>nota</html>');
  expect(resolver).toHaveBeenCalledOnce();expect(transporte.mock.calls[0]?.[1]).toEqual({address:'8.8.8.8',family:4});
  expect(validarPortal(url).hostname).toBe('www.nfce.fazenda.sp.gov.br');expect(ipPublico('2606:4700:4700::1111')).toBe(true);
 });
 it('CEN40: redirect oficial que resolve IP interno é barrado antes da segunda busca', async () => {
  const dns=vi.fn().mockResolvedValueOnce([{address:'8.8.8.8',family:4}]).mockResolvedValueOnce([{address:'10.1.1.1',family:4}]);
  const http=vi.fn().mockResolvedValue({status:302,local:'/interno',html:''});
  await expect(new BuscaSegura(dns,http).buscar(url,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');expect(http).toHaveBeenCalledOnce();
 });
 it('redirect externo não faz DNS do destino; máximo três redirecionamentos', async () => {
  const dns=vi.fn(async()=>[{address:'8.8.8.8',family:4}]);const http=vi.fn().mockResolvedValue({status:302,local:'https://evil.com',html:''});
  await expect(new BuscaSegura(dns,http).buscar(url,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');expect(dns).toHaveBeenCalledOnce();
  const loop=vi.fn().mockResolvedValue({status:302,local:'/loop',html:''});
  await expect(new BuscaSegura(dns,loop,new LimitePortais(0)).buscar(url,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');expect(loop).toHaveBeenCalledTimes(4);
 });
 it.each([{status:200,tipo:'application/json',html:'{}'},{status:200,tipo:'text/html',html:'a'.repeat(2*1024*1024+1)}])('só HTML até 2MB', async resposta => {
  await expect(new BuscaSegura(resolver,async()=>resposta).buscar(url,signal())).rejects.toThrow('PORTAL_NAO_PERMITIDO');
 });
 it('aborto impede DNS/transporte', async () => {
  const c=new AbortController();c.abort();const dns=vi.fn(), http=vi.fn();
  await expect(new BuscaSegura(dns,http).buscar(url,c.signal)).rejects.toThrow();expect(dns).not.toHaveBeenCalled();expect(http).not.toHaveBeenCalled();
 });
});
it('limita global4 e host2; uma requisição por segundo', async () => {
 const limites=new LimitePortais(0);let ativos=0,max=0;const porHost=new Map<string,number>();const maxHost=new Map<string,number>();
 const jobs=Array.from({length:10},(_v,i)=>{
  const h=i%2?'a':'b';return limites.executar(h,signal(),async()=>{
   ativos++;max=Math.max(max,ativos);porHost.set(h,(porHost.get(h)??0)+1);maxHost.set(h,Math.max(maxHost.get(h)??0,porHost.get(h)!));
   await new Promise(r=>setTimeout(r,10));ativos--;porHost.set(h,porHost.get(h)!-1);
  });
 });await Promise.all(jobs);expect(max).toBe(4);expect([...maxHost.values()]).toEqual([2,2]);
 const tempos:number[]=[];const taxa=new LimitePortais();
 await Promise.all([1,2].map(()=>taxa.executar('sp',signal(),async()=>{tempos.push(Date.now());})));
 expect(tempos[1]!-tempos[0]!).toBeGreaterThanOrEqual(990);
});
