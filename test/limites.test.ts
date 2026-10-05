import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {conectar} from '../src/db/conexao.js';
import {migrar} from '../src/db/migrar.js';
import {Chaves} from '../src/autenticacao/chaves.js';
import {LimitesIa,mesSaoPaulo} from '../src/leitura/limites.js';
const env={...parseEnv(readFileSync('.pocket.env','utf8')),...process.env};const url=new URL(env.DATABASE_URL??'');
if(env.POCKET_TEST_DB!=='1'||!env.DB_NAME?.startsWith('test_')||!env.DB_CONTAINER?.startsWith('test_')||url.hostname!=='localhost'||url.pathname!=='/'+env.DB_NAME||url.port!==env.DB_PORT)throw new Error('Alvo não confirmado');
const db=conectar(url.href);const produto='limites678-'+randomUUID();let ids: string[]=[];
const contexto=(i=0,contaId=randomUUID())=>({chaveClienteId:ids[i]!,contaId,signal:new AbortController().signal});
beforeAll(async()=>{await migrar(db);const chaves=new Chaves(db);ids=[(await chaves.criar(produto)).id,(await chaves.criar(produto)).id];});
afterEach(async()=>{await db.deleteFrom('reserva_ia').where('chave_cliente_id','in',ids).execute();await db.deleteFrom('uso_ia').where('chave_cliente_id','in',ids).execute();});
afterAll(async()=>{await db.deleteFrom('chave_cliente').where('produto','=',produto).execute();await db.destroy();});
it('CEN38: 30ª leitura conta; 31ª bloqueia antes de chamar IA',async()=>{
 const c=contexto();const mes=mesSaoPaulo(new Date());await db.insertInto('uso_ia').values({chave_cliente_id:c.chaveClienteId,conta_id:c.contaId,mes,quantidade:29}).execute();
 const ia=vi.fn(async()=>({valido:true}));const limite=new LimitesIa(db);
 await limite.executar(c,ia);await expect(limite.executar(c,ia)).rejects.toThrow('LIMITE_IA_ATINGIDO');expect(ia).toHaveBeenCalledOnce();
 expect((await db.selectFrom('uso_ia').select('quantidade').where('chave_cliente_id','=',c.chaveClienteId).executeTakeFirst())?.quantidade).toBe(30);
});
it('reserva atômica impede duas contas ultrapassarem teto da chave',async()=>{
 let liberar!:()=>void;const espera=new Promise<void>(r=>{liberar=r;});let entrou!:()=>void;const inicio=new Promise<void>(r=>{entrou=r;});
 const limite=new LimitesIa(db,30,1);const a=limite.executar(contexto(),async()=>{entrou();await espera;return 'válida';});await inicio;
 const segunda=vi.fn(async()=>true);await expect(limite.executar(contexto(),segunda)).rejects.toThrow('LIMITE_IA_ATINGIDO');expect(segunda).not.toHaveBeenCalled();
 liberar();expect(await a).toBe('válida');expect((await db.selectFrom('reserva_ia').selectAll().where('chave_cliente_id','=',ids[0]!).execute())).toHaveLength(0);
});
it('falha/aborto devolvem reserva e não contam; próxima leitura pode usar limite',async()=>{
 const limite=new LimitesIa(db,1,1);const c=contexto();await expect(limite.executar(c,async()=>{throw new Error('falhou');})).rejects.toThrow('falhou');
 expect(await db.selectFrom('uso_ia').selectAll().where('chave_cliente_id','=',ids[0]!).execute()).toHaveLength(0);
 const abortar=new AbortController();await expect(limite.executar({...c,signal:abortar.signal},async()=>{abortar.abort();return true;})).rejects.toThrow();
 expect(await limite.executar(c,async()=>true)).toBe(true);
});
it('mês civil São Paulo vira às03hUTC; contagem do mês anterior não bloqueia o novo',async()=>{
 expect(mesSaoPaulo(new Date('2026-10-01T02:59:59Z'))).toBe('2026-09');expect(mesSaoPaulo(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10');
 const c=contexto();await db.insertInto('uso_ia').values({chave_cliente_id:c.chaveClienteId,conta_id:c.contaId,mes:'2026-09',quantidade:30}).execute();
 await expect(new LimitesIa(db,30,2000,()=>new Date('2026-10-01T02:59:59Z')).executar(c,async()=>true)).rejects.toThrow('LIMITE_IA_ATINGIDO');
 expect(await new LimitesIa(db,30,2000,()=>new Date('2026-10-01T03:00:00Z')).executar(c,async()=>true)).toBe(true);
});
it('reservas vencidas após queda não cobram uso; chaves/contas isoladas',async()=>{
 const c=contexto();await db.insertInto('reserva_ia').values({id:randomUUID(),chave_cliente_id:c.chaveClienteId,conta_id:c.contaId,mes:mesSaoPaulo(new Date()),expira_em:new Date(Date.now()-1)}).execute();
 const limite=new LimitesIa(db,1,2);expect(await limite.executar(c,async()=>true)).toBe(true);
 await expect(limite.executar(c,async()=>true)).rejects.toThrow('LIMITE_IA_ATINGIDO');
 expect(await limite.executar(contexto(0),async()=>true)).toBe(true);await expect(limite.executar(contexto(0),async()=>true)).rejects.toThrow('LIMITE_IA_ATINGIDO');
 expect(await limite.executar(contexto(1,c.contaId),async()=>true)).toBe(true);
});
