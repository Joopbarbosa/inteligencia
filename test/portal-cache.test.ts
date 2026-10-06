import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {lerSp} from '../src/leitores/sp/leitor.js';
import {identificarLeiaute} from '../src/leitores/leiaute.js';
import {Orquestrador} from '../src/leitura/orquestrador.js';
import {CacheMemoria} from '../src/cache/notas.js';
const html=readFileSync(new URL('./fixtures/sp-controlado.html',import.meta.url),'utf8');
const chave='35'+'1'.repeat(42);
const qrUrl='https://www.nfce.fazenda.sp.gov.br/qrcode?p='+chave+'|2|1|1|HASH';
const contexto=()=>({chaveClienteId:randomUUID(),contaId:randomUUID(),signal:new AbortController().signal});
it('CEN1,43: SP controlado, nomes completos, alfanumérico e totais sem arredondar',()=>{
 const n=lerSp(html)!;expect(n).toMatchObject({emitente:{cnpj:'12ABC345000190',nome:'Papelaria Aurora'},numero:'1234',serie:'1',totalPago:'59.57',descontoGeral:'2.25',acrescimos:'0.17',metodo:'LEITOR_UF',uf:'SP'});
 expect(n.itens).toHaveLength(3);expect(n.itens[0]).toMatchObject({nome:'Folha A4 premium 180g — pacote de 50 folhas',quantidade:'2.5',valorFinal:'19.95',unidade:'PCT'});
});
it('leiaute novo/dado obrigatório ausente declara falha; diferença de soma não é falha',()=>{
 expect(lerSp(html.replace('class="Rqtd"','class="qtd-nova"'))).toBeUndefined();
 expect(lerSp(html.replace('class="txtTopo"','class="nome-novo"'))).toBeUndefined();
 expect(lerSp(html.replace('59,57','59,58'))?.totalPago).toBe('59.58');
 expect(identificarLeiaute(html,'SP')).not.toBe(identificarLeiaute(html.replace('class="valor"','class="valor-novo"'),'SP'));
});
it('CEN3,4: uma busca para chave simultânea e repetida; cache conserva método e sem IA',async()=>{
 const busca=vi.fn(async()=>{await new Promise(r=>setTimeout(r,10));return html;});const ia=vi.fn();const uf=vi.fn(async(e)=>lerSp(e.pagina.html));
 const o=new Orquestrador({buscarPortal:busca,leitorUf:uf,ia,cache:new CacheMemoria()});
 const [a,b]=await Promise.all([o.ler({modelo:'NFCE',qrUrl},contexto()),o.ler({modelo:'NFCE',qrUrl},contexto())]);
 expect(a.doCache).toBe(false);expect(b.doCache).toBe(true);expect(b.metodo).toBe('LEITOR_UF');
 expect((await o.ler({modelo:'NFCE',chaveAcesso:chave},contexto())).doCache).toBe(true);
 expect(busca).toHaveBeenCalledOnce();expect(uf).toHaveBeenCalledOnce();expect(ia).not.toHaveBeenCalled();
 await expect(o.ler({modelo:'NFCE',qrUrl:'https://evil.com/?p='+chave},contexto())).rejects.toThrow('PORTAL_NAO_PERMITIDO');expect(busca).toHaveBeenCalledOnce();
});
it('QR fora da lista não consulta cache nem faz rede; chave/UF da resposta precisam corresponder',async()=>{
 const cache={buscar:vi.fn(),guardar:vi.fn()};const busca=vi.fn(async()=>html);
 const o=new Orquestrador({cache,buscarPortal:busca,leitorUf:async()=>({...lerSp(html)!,chaveAcesso:'35'+'2'.repeat(42)})});
 await expect(o.ler({modelo:'NFCE',qrUrl:'https://evil.com/?p='+chave},contexto())).rejects.toThrow('PORTAL_NAO_PERMITIDO');expect(cache.buscar).not.toHaveBeenCalled();
 await expect(o.ler({modelo:'NFCE',qrUrl},contexto())).rejects.toThrow('LEITURA_IMPOSSIVEL');expect(cache.guardar).not.toHaveBeenCalled();
});
it('leitor UF falha e usa IA; imagem sem QR usa IA com aviso',async()=>{
 const nota={...lerSp(html)!,metodo:'IA' as const};const ia=vi.fn(async()=>nota);
 const o=new Orquestrador({buscarPortal:async()=>html,leitorUf:async()=>undefined,ia,decodificarQr:async()=>undefined});
 expect((await o.ler({modelo:'NFCE',qrUrl},contexto())).metodo).toBe('IA');expect(ia).toHaveBeenCalledOnce();
 expect((await o.ler({modelo:'NFCE',arquivo:{dados:Buffer.from('fixture'),mime:'image/png'},confirmouEnvioIa:true},contexto())).avisos).toEqual(['O QR não pôde ser lido; a leitura foi feita pela imagem.']);
});
it('UF da chave prevalece sobre host SP; código de UF impossível bloqueia',async()=>{
 const uf=vi.fn(async(e)=>{expect(e.pagina.uf).toBe('RJ');return undefined;});
 const chaveRj='33'+'1'.repeat(42);const ia=vi.fn(async()=>({...lerSp(html)!,uf:'RJ',chaveAcesso:chaveRj,metodo:'IA' as const}));
 const o=new Orquestrador({buscarPortal:async()=>html,leitorUf:uf,ia});
 expect((await o.ler({modelo:'NFCE',qrUrl:qrUrl.replace(chave,chaveRj)},contexto())).uf).toBe('RJ');
 await expect(o.ler({modelo:'NFCE',chaveAcesso:'99'+'1'.repeat(42)},contexto())).rejects.toThrow('DOCUMENTO_INVALIDO');
});
