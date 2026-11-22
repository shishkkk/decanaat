import QR from 'qrcode/lib/core/qrcode.js';
import {PDFDocument,PDFName,PDFHexString,pushGraphicsState,popGraphicsState,beginText,endText,setFillingRgbColor,setFontAndSize,setTextMatrix,showText,rgb} from 'pdf-lib';
import template from './document-template.json';
import type {Database} from './db';
import {fail} from './support';
const utf8=new TextEncoder();
function concat(...parts:Uint8Array[]){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;}
const u32=(v:number)=>Uint8Array.of(v>>>24,(v>>>16)&255,(v>>>8)&255,v&255);
function chunk(name:string,data:Uint8Array){const body=concat(utf8.encode(name),data);let crc=-1;for(const b of body){crc^=b;for(let i=0;i<8;i++)crc=crc>>>1^(crc&1?0xedb88320:0);}return concat(u32(data.length),body,u32(~crc));}
export async function qrPng(url:string){
 const {modules}=QR.create(url,{errorCorrectionLevel:'M'});
 const scale=3,border=4,w=(modules.size+2*border)*scale,pixels=new Uint8Array((1+w)*w);
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){const ix=Math.floor(x/scale)-border,iy=Math.floor(y/scale)-border;pixels[y*(w+1)+x+1]=(ix>=0&&iy>=0&&ix<modules.size&&iy<modules.size&&modules.get(iy,ix))?0:255;}
 const compressed=await new Response(new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
 return concat(Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',concat(u32(w),u32(w),Uint8Array.of(8,0,0,0,0))),chunk('IDAT',new Uint8Array(compressed)),chunk('IEND',new Uint8Array()));
}
export async function documentData(db:Database,item:any,origin:string){
 if(item.status!=='ready'||item.delivery!=='digital')fail(409,'document_unavailable');
 const info=await db.one('SELECT u.name,u.group_name,u.program,r.verification FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?',item.id);
 const verify=origin+'/verify/'+info.verification,png=await qrPng(verify);
 return {item,student:info.name,group:info.group_name,program:info.program,verify,qr:'data:image/png;base64,'+btoa(String.fromCharCode(...png))};
}
export async function makePdf(data:Awaited<ReturnType<typeof documentData>>){
 const pdf=await PDFDocument.load(template.pdf),page=pdf.getPages()[0],font=PDFName.of(template.font);
 const line=(text:string,y:number,size=12,color=[.047,.137,.251])=>{const hex=[...text].map(c=>template.glyphs[c]||template.glyphs['?']).join('');
 page.pushOperators(pushGraphicsState(),beginText(),setFillingRgbColor(color[0],color[1],color[2]),setFontAndSize(font,size),setTextMatrix(1,0,0,1,52,y),showText(PDFHexString.of(hex)),endText(),popGraphicsState());};
 line('CAMPUS',770,26);line('Цифровой деканат',744,13);page.drawLine({start:{x:52,y:722},end:{x:543,y:722},color:rgb(.65,.51,.28)});
 line('ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ',674,18);line('Обращение № '+data.item.number,640,14);
 line(data.student,565,18);line('Учебная группа: '+data.group,532);line(data.program,505);
 line('Дата: '+new Date(data.item.updated_at).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}),466);
 line('ОБРАЗЕЦ',371,44,[.77,.79,.81]);page.drawImage(await pdf.embedPng(data.qr),{x:52,y:192,width:120,height:120});
 line('QR подтверждает запись в демонстрационной базе.',164,11);line('Все персональные данные вымышлены.',120,11);
 line('Не содержит ЭЦП. Не имеет юридической силы.',97,11);pdf.setTitle('CAMPUS — образец');return pdf.save();
}