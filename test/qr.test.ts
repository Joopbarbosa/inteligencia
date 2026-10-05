import {it,expect} from 'vitest';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {decodificarQr} from '../src/leitura/qr/decodificar.js';
const link='https://www.nfce.fazenda.sp.gov.br/qrcode?p=35'+'1'.repeat(42)+'|2|1|1|HASH';
const png=await QRCode.toBuffer(link,{width:640,margin:4});
const sinal=()=>new AbortController().signal;
it.each(['image/png','image/jpeg'])('CEN7: QR de %s decodificado sem IA',async mime=>{
 const dados=mime==='image/png'?png:await sharp(png).jpeg({quality:90}).toBuffer();
 expect(await decodificarQr(dados,mime,sinal())).toBe(link);
});
it('QR de PDF nas três primeiras páginas; quarto não é rasterizado',async()=>{
 const doc=await PDFDocument.create();const p=doc.addPage([600,800]);const img=await doc.embedPng(png);p.drawImage(img,{x:60,y:250,width:480,height:480});
 expect(await decodificarQr(Buffer.from(await doc.save()),'application/pdf',sinal())).toBe(link);
 const quatro=await PDFDocument.create();for(let i=0;i<4;i++)quatro.addPage([600,800]);const qr=await quatro.embedPng(png);quatro.getPage(3).drawImage(qr,{x:60,y:250,width:480,height:480});
 expect(await decodificarQr(Buffer.from(await quatro.save()),'application/pdf',sinal())).toBeUndefined();
});
it('sem QR devolve ausência; documento corrompido/tamanho/aborto bloqueiam',async()=>{
 const branco=await sharp({create:{width:50,height:50,channels:4,background:'#ffffff'}}).png().toBuffer();
 expect(await decodificarQr(branco,'image/png',sinal())).toBeUndefined();
 await expect(decodificarQr(Buffer.from('pdf falso'),'application/pdf',sinal())).rejects.toThrow('DOCUMENTO_INVALIDO');
 await expect(decodificarQr(Buffer.alloc(10*1024*1024+1),'image/png',sinal())).rejects.toThrow('DOCUMENTO_INVALIDO');
 const c=new AbortController();c.abort();await expect(decodificarQr(png,'image/png',c.signal)).rejects.toThrow();
});
