import {PDFDocument,rgb,degrees} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {one} from './db';
import {requestDetail} from './queries';
import {fail} from './auth';
import type {User} from '../lib/types';
export async function documentData(user:User,id:string,origin:string){const item=requestDetail(user,id);if(item.status!=='ready'||item.delivery!=='digital')fail(409,'document_unavailable');const info=one<{name:string;group_name:string;program:string;verification:string}>('SELECT u.name,u.group_name,u.program,r.verification FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?',id)!;const verify=origin+'/verify/'+info.verification;return {item,student:info.name,group:info.group_name,program:info.program,verify,qr:await QRCode.toDataURL(verify,{margin:1,width:200,color:{dark:'#0c2340',light:'#ffffff'}})};}
export async function makePdf(user:User,id:string,origin:string){const data=await documentData(user,id,origin);const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(await readFile(resolve('public/fonts/NotoSerif.ttf')),{subset:true});const page=pdf.addPage([595,842]);const navy=rgb(.047,.137,.251),gold=rgb(.65,.51,.28);const line=(text:string,y:number,size=12,color=navy)=>page.drawText(text,{x:52,y,size,font,color});
 line('CAMPUS',770,26);line('Цифровой деканат / конкурсный прототип',744,11);page.drawLine({start:{x:52,y:725},end:{x:543,y:725},thickness:1,color:gold});
 line('ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ',674,17);line('Обращение № '+data.item.number,642,13);line('Вымышленные учебные данные',609,11);line(data.student,565,17);line('Учебная группа: '+data.group,531);line(data.program,505,11);line('Статус: готова к получению',470);line('Дата: '+new Date(data.item.updated_at).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}),444);
 page.drawText('ОБРАЗЕЦ',{x:110,y:295,size:65,font,color:rgb(.88,.89,.91),rotate:degrees(22)});
 const qr=await pdf.embedPng(data.qr);page.drawImage(qr,{x:52,y:190,width:120,height:120});line('QR проверяет только запись в демосистеме.',166,10);line('Не является справкой учебного заведения.',123,11);line('Не содержит ЭЦП. Не имеет юридической силы.',103,11);line('Все персональные данные вымышлены.',83,11);
 pdf.setTitle('CAMPUS — демо-документ');return new Uint8Array(await pdf.save());}
