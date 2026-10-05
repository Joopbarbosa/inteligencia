import type {Alertas,Alerta} from './repositorio.js';
export interface DestinoAlertas {obterOuCriar(a:Alerta):Promise<number>;comentar(tarefa:number,contador:number):Promise<boolean>}
export class WorkerAlertas {
 private executando=false;
 constructor(private readonly alertas:Alertas,private readonly destino:DestinoAlertas,private readonly agora:()=>Date=()=>new Date()){}
 async executar(){
  if(this.executando)return;this.executando=true;
  try {const agora=this.agora();for(const a of await this.alertas.pendentes(agora)){
   await this.alertas.tentativa(a.id,agora);
   try {
    const id=a.tarefa_id??await this.destino.obterOuCriar(a);await this.alertas.enviado(a.id,id,agora);
    if(a.tarefa_id && (!a.ultimo_comentario||agora.getTime()-a.ultimo_comentario.getTime()>=86_400_000)){
     // Reserva antes do envio: resposta perdida não duplica comentário no mesmo dia.
     await this.alertas.comentou(a.id,agora);
     await this.destino.comentar(id,a.contador);
    }
   }catch{await this.alertas.falhou(a.id,a.tentativas,agora);}
  }}finally{this.executando=false;}
 }
}
