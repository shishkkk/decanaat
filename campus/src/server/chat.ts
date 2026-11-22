import {randomUUID} from 'node:crypto';
import {all,one,run,transaction} from './db';

import {fail,rateLimit} from './auth';
import type {User,Chat,Message} from '../lib/types';
function courseAccess(user:User) {
 if (user.role==='teacher') return 'c.teacher_id=?';
 if (user.role==='student') return 'c.user_id=?';
 return fail(403,'forbidden');
}
export function getChat(user:User,courseId:string):Chat {
 const access=courseAccess(user);
 const course=one<{id:string;user_id:string;title:string;title_en:string;teacher:string;teacher_en:string;student:string;student_en:string;connected:number;teacher_seen_at:string|null}>(
   'SELECT c.id,c.user_id,c.title,c.title_en,c.teacher,c.teacher_en,u.name AS student,u.name_en AS student_en,(SELECT t.last_seen_at FROM users t WHERE t.id=c.teacher_id) AS teacher_seen_at,EXISTS(SELECT 1 FROM users t WHERE t.id=c.teacher_id AND t.role=?) AS connected FROM courses c JOIN users u ON u.id=c.user_id WHERE c.id=? AND '+access,'teacher',courseId,user.id);
 if(!course)return fail(404,'not_found');
 run('INSERT OR IGNORE INTO conversations VALUES(?,?,?)',randomUUID(),course.user_id,courseId);
 const c=one<{id:string}>('SELECT id FROM conversations WHERE course_id=? AND user_id=?',courseId,course.user_id)!;
 const messages=all<Message&{attachment_id:string|null;attachment_name:string|null;attachment_size:number|null}>('SELECT m.id,m.body,m.sender,m.created_at,a.id as attachment_id,a.name as attachment_name,a.size as attachment_size FROM messages m LEFT JOIN attachments a ON a.message_id=m.id WHERE m.conversation_id=? ORDER BY m.rowid',c.id).map(m=>({id:m.id,body:m.body,sender:m.sender,created_at:m.created_at,attachment:m.attachment_id?{id:m.attachment_id,name:m.attachment_name!,size:m.attachment_size!}:null}));
 return {...course,id:c.id,course_id:course.id,messages};
}
export async function sendMessage(user:User,courseId:string,form:FormData){
 courseAccess(user);rateLimit('chat:'+user.id,60,3600000);const chat=getChat(user,courseId);
 const body=String(form.get('body')||'').trim();const file=form.get('file');if(body.length>3000)fail(422,'invalid_input');
 let attachment:{name:string;mime:string;data:Buffer}|null=null;
 if(file instanceof File&&file.size){if(file.size>2*1024*1024)fail(413,'file_too_large');const data=Buffer.from(await file.arrayBuffer());const name=file.name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._ ()-]/g,'_').slice(0,120);let mime='';const ext=name.toLowerCase().split('.').pop();
 if(ext==='pdf'&&data.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
 if(ext==='png'&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 if(['jpg','jpeg'].includes(ext||'')&&data[0]===255&&data[1]===216&&data[2]===255)mime='image/jpeg';
 if(ext==='txt'&&!data.includes(0))mime='text/plain';
 if(!mime)fail(422,'file_type');attachment={name,mime,data};}
 if(!body&&!attachment)fail(422,'empty_message');
 transaction(()=>{const id=randomUUID();run('INSERT INTO messages VALUES(?,?,?,?,?)',id,chat.id,user.role,body,new Date().toISOString());if(attachment)run('INSERT INTO attachments VALUES(?,?,?,?,?,?)',randomUUID(),id,attachment.name,attachment.mime,attachment.data.length,attachment.data);});return getChat(user,courseId);
}
export function attachment(user:User,id:string){const access=courseAccess(user);const row=one<{name:string;mime:string;content:Uint8Array}>('SELECT a.name,a.mime,a.content FROM attachments a JOIN messages m ON m.id=a.message_id JOIN conversations v ON v.id=m.conversation_id JOIN courses c ON c.id=v.course_id AND c.user_id=v.user_id WHERE a.id=? AND '+access,id,user.id);if(!row)return fail(404,'not_found');return row;}
