import QRCode from 'qrcode';
import {markInput,readRoster,saveMark} from '@/lib/attendance';
import {NextRequest,NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {randomUUID} from 'node:crypto';
import {identity,checkMutation,csrfResponse,signIn,signOut,fail,HttpError,requireStudent,requireStaff,rateLimit} from '@/server/auth';
import {one,all,run,userColumns} from '@/server/db';
import {bootstrap,requests,requestDetail,courses,owned} from '@/server/queries';
import {createRequest,updateRequest,createRequestSchema,updateRequestSchema,addComment} from '@/server/requests';
import {setRegistration} from '@/server/calendar';
import {updateLesson} from '@/server/schedule';
import {getChat,sendMessage,attachment} from '@/server/chat';
import {documentData,makePdf} from '@/server/documents';
import {statuses,type User} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function json(req:NextRequest){if(Number(req.headers.get('content-length')||0)>20000)fail(413,'too_large');const text=await req.text();if(text.length>20000)fail(413,'too_large');try{return JSON.parse(text);}catch{return fail(400,'invalid_input');}}
const idSchema=z.string().min(1).max(100);
async function dispatch(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 try {
 const {path}=await context.params;const [section,id,action]=path;const method=req.method;const respond=(value:unknown,status=200)=>NextResponse.json(value,{status});
 if(path.length>3)fail(404,'not_found');
 if(section==='auth'&&path.length===1){if(method==='GET')return csrfResponse(req);if(method==='POST'){const body=z.object({login:z.string().max(60).optional(),password:z.string().max(128).optional(),demo:z.enum(['alex','vera']).optional()}).strict().parse(await json(req));return await signIn(req,body);}if(method==='DELETE')return signOut(req);}
 if(section==='verify'&&id&&method==='GET'){const entry=one<{number:number;status:string;updated_at:string}>('SELECT number,status,updated_at FROM requests WHERE verification=? AND status=? AND delivery=?',id,'ready','digital');if(!entry)fail(404,'not_found');return respond({valid:true,number:entry!.number,updated_at:entry!.updated_at,demo:true});}
 const {user,csrf}=identity(req);if(!['GET','HEAD'].includes(method))checkMutation(req,csrf);if(id)idSchema.parse(id);
 if(section==='me'&&!id&&method==='GET')return respond(bootstrap(user,csrf));
 if(section==='attendance'&&id&&!action){
   if(user.role!=='teacher')fail(403,'forbidden');
   if(method==='GET'){
     const rows=all(readRoster,id,user.id);
     if(!rows.length)fail(404,'not_found');
     return respond(rows);
   }
   if(method==='PATCH'){
     const mark=markInput.parse(await json(req));
     const result=run(saveMark,mark.status,id,user.id,mark.member);
     if(!result.changes)fail(404,'not_found');
     return respond({ok:true});
   }
 }
 if(section==='my-attendance'&&!id&&method==='GET'){
   requireStudent(user);
   return respond(all("SELECT l.id,l.starts,c.title,c.title_en,COALESCE(m.status,'unmarked') status FROM lessons l JOIN courses c ON c.id=l.course_id LEFT JOIN attendance_marks m ON m.lesson_id=l.id AND m.member_id=c.user_id WHERE c.user_id=? AND l.starts<=? AND COALESCE(l.change_kind,'')<>'cancelled' AND l.starts>=date('now','-6 months') ORDER BY l.starts DESC",user.id,new Date(Date.now()+3*3600000).toISOString().slice(0,19)+'+03:00'));
 }
 if(section==='student-card'&&!id&&method==='GET'){
   requireStudent(user);
   const record=one<{birth_date:string|null;gradebook_no:string;pass_code:string}>('SELECT * FROM student_credentials WHERE user_id=?',user.id);
   if(!record)return fail(404,'not_found');
   return respond({birth:record.birth_date,book:record.gradebook_no,qr:await QRCode.toDataURL('CAMPUS:DEMO:'+record.pass_code,{width:216,margin:4})});
 }
 if(section==='profile'){
 if(id&&id!==user.id)fail(404,'not_found');
 if(method==='GET')return respond(user);
 if(method==='PATCH'){requireStudent(user);const input=z.object({email:z.string().email().max(160),phone:z.string().max(30),avatar:z.enum(['ink','gold','slate'])}).strict().parse(await json(req));run('UPDATE users SET email=?,phone=?,avatar=? WHERE id=?',input.email,input.phone,input.avatar,user.id);return respond(one<User>('SELECT '+userColumns+' FROM users WHERE id=?',user.id));}}
 if(section==='grades'&&method==='GET'){requireStudent(user);if(id&&id!==user.id)fail(404,'not_found');return respond({courses:courses(user),history:all('SELECT h.*,c.title,c.title_en FROM grade_history h JOIN courses c ON c.id=h.course_id WHERE c.user_id=? ORDER BY h.created_at DESC',user.id)});}
 if(section==='requests'){if(user.role==='teacher')fail(403,'forbidden');
 if(!id&&method==='GET'){const status=req.nextUrl.searchParams.get('status');if(status&&!statuses.includes(status as typeof statuses[number]))fail(422,'invalid_input');return respond(requests(user,status||undefined));}
 if(!id&&method==='POST')return respond(createRequest(user,createRequestSchema.parse(await json(req))),201);
 if(id&&!action&&method==='GET')return respond(requestDetail(user,id));
 if(id&&!action&&method==='PATCH')return respond(updateRequest(user,id,updateRequestSchema.parse(await json(req))));
 if(id&&action==='comments'&&method==='POST'){const {body}=z.object({body:z.string().trim().min(1).max(2000)}).strict().parse(await json(req));rateLimit('comment:'+user.id,60,3600000);return respond(addComment(user,id,body));}
 if(id&&action==='document'&&method==='GET'){const origin=process.env.APP_ORIGIN||req.nextUrl.origin;if(req.nextUrl.searchParams.get('format')==='pdf')return new NextResponse(await makePdf(user,id,origin),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="campus-demo.pdf"'}});return respond(await documentData(user,id,origin));}}
 if(section==='notifications'){
 if(method==='PATCH'){const {all:markAll}=z.object({all:z.boolean().optional()}).strict().parse(await json(req));if(id){const result=run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?',new Date().toISOString(),id,user.id);if(!result.changes)fail(404,'not_found');}else if(markAll)run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?',new Date().toISOString(),user.id);else fail(422,'invalid_input');return respond({ok:true});}}
 if(section==='tasks'){requireStudent(user);
 if(method==='POST'&&!id){const input=z.object({title:z.string().trim().min(1).max(200),subject:z.string().max(120),due:z.string().max(16).refine(v=>!v||!Number.isNaN(Date.parse(v)))}).strict().parse(await json(req));const taskId=randomUUID();run('INSERT INTO tasks VALUES(?,?,?,?,?,?)',taskId,user.id,input.title,input.subject,input.due,0);return respond({id:taskId},201);}
 if(id){owned('tasks',id,user.id);if(method==='PATCH'){const input=z.object({done:z.boolean()}).strict().parse(await json(req));run('UPDATE tasks SET done=? WHERE id=? AND user_id=?',input.done?1:0,id,user.id);return respond({ok:true});}if(method==='DELETE'){run('DELETE FROM tasks WHERE id=? AND user_id=?',id,user.id);return respond({ok:true});}}}
 if(section==='reflections'){requireStudent(user);
 if(method==='POST'&&!id){const input=z.object({body:z.string().trim().min(1).max(5000),mood:z.enum(['','easy','mixed','hard'])}).strict().parse(await json(req));const rid=randomUUID();run('INSERT INTO reflections VALUES(?,?,?,?,?)',rid,user.id,input.body,input.mood,new Date().toISOString());return respond({id:rid},201);}
 if(id&&method==='DELETE'){owned('reflections',id,user.id);run('DELETE FROM reflections WHERE id=? AND user_id=?',id,user.id);return respond({ok:true});}}
 if(section==='events'&&id&&!action&&method==='PATCH'){
   const {registered}=z.object({registered:z.boolean()}).strict().parse(await json(req));
   return respond(setRegistration(user,id,registered));
 }
 if(section==='lessons'&&id&&!action&&method==='PATCH')return respond(updateLesson(user,id,await json(req)));
 if(section==='chat'&&id){if(method==='GET')return respond(getChat(user,id));if(method==='POST'){if(Number(req.headers.get('content-length')||0)>2200000)fail(413,'file_too_large');return respond(await sendMessage(user,id,await req.formData()));}}
 if(section==='attachments'&&id&&method==='GET'){const file=attachment(user,id);return new NextResponse(new Uint8Array(file.content),{headers:{'Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name),'Content-Security-Policy':"default-src 'none'; sandbox"}});}
 if(section==='staff'&&method==='GET'){requireStaff(user);return respond(requests(user));}
 return fail(404,'not_found');
 }catch(error){if(error instanceof HttpError)return NextResponse.json({error:error.code},{status:error.status});if(error instanceof ZodError)return NextResponse.json({error:'invalid_input'},{status:422});console.error('API failure',error instanceof Error?error.message:'unknown');return NextResponse.json({error:'server_error'},{status:500});}
}
async function handle(req:NextRequest,context:{params:Promise<{path:string[]}>}){const res=await dispatch(req,context);res.headers.set('Cache-Control','no-store, private');return res;}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
