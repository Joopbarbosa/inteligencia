import {conectar} from '../db/conexao.js';
import {migrar} from '../db/migrar.js';
import {Alertas} from '../alertas/repositorio.js';
const [comando,uf,leiaute]=process.argv.slice(2);
if(!process.env.DATABASE_URL||!uf||!leiaute||!['ver','resolver'].includes(comando??''))throw new Error('Uso: ver|resolver <uf> <leiaute>, com DATABASE_URL');
const db=conectar(process.env.DATABASE_URL);
try{await migrar(db);const alertas=new Alertas(db);if(comando==='ver')process.stdout.write(JSON.stringify(await alertas.amostras(uf,leiaute),null,2)+'\n');else await alertas.resolver(uf,leiaute);}finally{await db.destroy();}
