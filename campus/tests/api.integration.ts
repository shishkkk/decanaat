import {test} from 'node:test';import assert from 'node:assert/strict';import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
class Client{cookies=new Map<string,string>();csrf='';async req(path:string,method='GET',body?:unknown,options:{csrf?:boolean;origin?:string}={}){const res=await fetch(base+path,{method,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),Origin:options.origin||base,...(options.csrf===false?{}:{'x-csrf-token':this.csrf}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});for(const cookie of res.headers.getSetCookie()){const [pair]=cookie.split(';');const i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1));}return res;}async json(path:string,method='GET',body?:unknown,status=200){const r=await this.req(path,method,body);const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}async login(login:string){const init=await this.json('/api/auth');this.csrf=init.csrf;const result=await this.json('/api/auth','POST',{login,password:'CampusDemo!2026'});this.csrf=result.csrf;return result;}}
test('End-to-end roles, isolation, workflow, private notes, chat, PDF, CSRF and logout',async()=>{
 const anon=new Client();assert.equal((await anon.req('/api/me')).status,401);assert.equal((await anon.req('/')).status,307);
 const a=new Client(),b=new Client(),staff=new Client();const login=await a.login('alex');assert.equal(login.user.role,'student');await b.login('max');await staff.login('elena');
 const ad=await a.json('/api/me'),bd=await b.json('/api/me');assert.notEqual(ad.user.id,bd.user.id);assert.ok(ad.lessons.length);assert.ok(bd.lessons.length);assert.notDeepEqual(ad.courses.map((c:{title:string})=>c.title),bd.courses.map((c:{title:string})=>c.title));assert.ok(!JSON.stringify(ad).includes('password_hash'));assert.ok(ad.courses.every((c:{id:string})=>c.id.startsWith(ad.user.id)));assert.ok(bd.courses.some((c:{debt:number})=>c.debt===1));
 assert.equal((await b.req('/api/profile/'+ad.user.id)).status,404);assert.equal((await b.req('/api/grades/'+ad.user.id)).status,404);assert.equal((await b.req('/api/requests/request-alex')).status,404);assert.equal((await b.req('/requests/request-alex')).status,404);assert.equal((await b.req('/api/requests/request-alex/document')).status,404);assert.equal((await b.req('/api/staff')).status,403);
 assert.equal((await a.req('/api/tasks','POST',{title:'Test',subject:'',due:''},{csrf:false})).status,403);assert.equal((await a.req('/api/tasks','POST',{title:'Test',subject:'',due:''},{origin:'https://evil.example'})).status,403);
 assert.equal((await a.req('/api/profile','PATCH',{role:'staff'})).status,422);
 const request=await a.json('/api/requests','POST',{type:'study',delivery:'digital',body:'Integration test: fictional certificate request.'},201);assert.equal(request.status,'created');assert.ok(request.number);assert.equal(request.user_id,ad.user.id);assert.equal(request.history.length,1);
 assert.equal((await b.req('/api/requests/'+request.id,'PATCH',{status:'accepted',comment:'',version:1})).status,403);
 assert.equal((await b.req('/api/requests/'+request.id+'/comments','POST',{body:'Intrusion'})).status,404);
 assert.equal((await a.req('/api/requests','POST',{type:'study',delivery:'digital',body:'Fake owner attempt',userId:bd.user.id})).status,422);
 let r=await staff.json('/api/requests/'+request.id,'PATCH',{status:'accepted',comment:'Принято тестом',version:1});
 assert.equal((await staff.req('/api/requests/'+request.id,'PATCH',{status:'processing',comment:'',version:1})).status,409);
 r=await staff.json('/api/requests/'+request.id,'PATCH',{status:'processing',comment:'Проверка',version:r.version});
 assert.equal((await staff.req('/api/requests/'+request.id,'PATCH',{status:'clarification',comment:'',version:r.version})).status,422);
 r=await staff.json('/api/requests/'+request.id,'PATCH',{status:'clarification',comment:'Уточните назначение справки.',version:r.version});
 r=await a.json('/api/requests/'+request.id+'/comments','POST',{body:'По месту требования, данные вымышленные.'});assert.equal(r.status,'processing');
 r=await staff.json('/api/requests/'+request.id,'PATCH',{status:'ready',comment:'Демо-документ подготовлен.',version:r.version});assert.equal(r.status,'ready');assert.equal((await a.json('/api/requests/'+request.id)).status,'ready');assert.ok((await a.json('/api/me')).notices.some((n:{link:string})=>n.link==='/requests/'+request.id));
 const doc=await a.json('/api/requests/'+request.id+'/document');assert.ok(doc.qr.startsWith('data:image/png'));const verified=await anon.json(new URL(doc.verify).pathname.replace('/verify/','/api/verify/'));assert.equal(verified.number,request.number);assert.ok(!JSON.stringify(verified).includes(ad.user.name));assert.equal((await anon.req(new URL(doc.verify).pathname)).status,200);
 const pdfResponse=await a.req('/api/requests/'+request.id+'/document?format=pdf');assert.equal(pdfResponse.status,200);assert.equal(pdfResponse.headers.get('content-type'),'application/pdf');const pdf=await PDFDocument.load(await pdfResponse.arrayBuffer());assert.equal(pdf.getPageCount(),1);
 assert.equal((await b.req('/api/requests/'+request.id+'/document?format=pdf')).status,404);
 const task=await a.json('/api/tasks','POST',{title:'Проверить эссе',subject:'История',due:'2026-11-20T18:00'},201);assert.equal((await b.req('/api/tasks/'+task.id,'PATCH',{done:true})).status,404);await a.json('/api/tasks/'+task.id,'PATCH',{done:true});assert.ok((await a.json('/api/me')).tasks.find((x:{id:string;done:number})=>x.id===task.id&&x.done));await a.json('/api/tasks/'+task.id,'DELETE');
 const reflection=await a.json('/api/reflections','POST',{body:'Вымышленная личная запись теста',mood:'mixed'},201);assert.equal((await b.req('/api/reflections/'+reflection.id,'DELETE')).status,404);assert.ok(!(await staff.json('/api/me')).reflections.length);await a.json('/api/reflections/'+reflection.id,'DELETE');
 const course=ad.courses[0].id;assert.equal((await b.req('/api/chat/'+course)).status,404);const form=new FormData();form.set('body','Проверка вложения');form.set('file',new File(['fictional study note'],'seminar.txt',{type:'text/plain'}));const chat=await a.json('/api/chat/'+course,'POST',form);const attachment=chat.messages.at(-1).attachment;assert.ok(attachment.id);assert.equal((await a.req('/api/attachments/'+attachment.id)).status,200);assert.equal((await b.req('/api/attachments/'+attachment.id)).status,404);assert.equal((await staff.req('/api/attachments/'+attachment.id)).status,403);
 const unsafe=new FormData();unsafe.set('file',new File(['<script>alert(1)</script>'],'test.html',{type:'text/html'}));assert.equal((await a.req('/api/chat/'+course,'POST',unsafe)).status,422);
 const badMagic=new FormData();badMagic.set('file',new File(['not a pdf'],'test.pdf',{type:'application/pdf'}));assert.equal((await a.req('/api/chat/'+course,'POST',badMagic)).status,422);
 assert.equal((await b.req('/api/notifications/'+ad.notices[0].id,'PATCH',{})).status,404);await a.json('/api/notifications/'+ad.notices[0].id,'PATCH',{});
 const cookieResponse=await staff.req('/api/auth');assert.ok(cookieResponse.headers.getSetCookie().every(c=>c.includes('HttpOnly')&&c.includes('SameSite=lax')));
 const oldCookies=new Map(a.cookies);await a.json('/api/auth','DELETE');assert.equal((await a.req('/api/me')).status,401);a.cookies=oldCookies;assert.equal((await a.req('/api/me')).status,401);
 const wrong=new Client();wrong.csrf=(await wrong.json('/api/auth')).csrf;assert.equal((await wrong.req('/api/auth','POST',{login:'alex',password:'incorrect'})).status,401);
});

test('Teacher login, assigned students, replies, attachments and role boundaries',async()=>{
 const teacher=new Client(), alex=new Client(), max=new Client(), quick=new Client();
 assert.equal((await teacher.login('vera')).user.role,'teacher');
 quick.csrf=(await quick.json('/api/auth')).csrf;
 assert.equal((await quick.json('/api/auth','POST',{demo:'vera'})).user.role,'teacher');
 await alex.login('alex'); await max.login('max');
 const panel=await teacher.json('/api/me');
 assert.equal(panel.requests.length,0);
 assert.ok(panel.teaching.some((c:{id:string})=>c.id==='student-max-c1'));
 assert.equal((await teacher.req('/teaching')).status,200);
 assert.equal((await alex.req('/teaching')).status,404);
 for(const path of ['/api/grades','/api/staff','/api/requests','/api/tasks']){
   const res=path==='/api/tasks'?await teacher.req(path,'POST',{title:'x',subject:'',due:''}):await teacher.req(path);
   assert.equal(res.status,403,path);
 }
 const course='student-alex-c0',other='student-alex-c1';
 const msg=new FormData();msg.set('body','Вопрос по семинару');
 await alex.json('/api/chat/'+course,'POST',msg);
 assert.equal((await teacher.json('/api/chat/'+course)).messages.at(-1).body,'Вопрос по семинару');
 const reply=new FormData();reply.set('body','Прочитайте первую главу');reply.set('file',new File(['study material'],'material.txt',{type:'text/plain'}));
 await teacher.json('/api/chat/'+course,'POST',reply);
 const response=(await alex.json('/api/chat/'+course)).messages.at(-1);
 assert.equal(response.sender,'teacher');assert.equal(response.body,'Прочитайте первую главу');
 assert.equal((await alex.req('/api/attachments/'+response.attachment.id)).status,200);
 assert.equal((await max.req('/api/attachments/'+response.attachment.id)).status,404);
 assert.equal((await teacher.req('/api/chat/'+other)).status,404);
 assert.equal((await teacher.req('/api/chat/'+other,'POST',reply)).status,404);
 const unrelated=await alex.json('/api/chat/'+other,'POST',reply);
 assert.equal((await teacher.req('/api/attachments/'+unrelated.messages.at(-1).attachment.id)).status,404);
});

test('Teacher timetable: ownership, move, overlap, cancellation and restoration',async()=>{
 const vera=new Client(),alex=new Client(),staff=new Client();
 await vera.login('vera');await alex.login('alex');await staff.login('elena');
 const owned=(await vera.json('/api/me')).lessons;
 const student=(await alex.json('/api/me')).lessons;
 const pick=owned.find((l:{id:string;ends:string;change_kind:string})=>Date.parse(l.ends)>Date.now()&&l.change_kind!=='cancelled'&&student.some((x:{id:string})=>x.id===l.id));
 assert.ok(pick);assert.ok(owned.every((l:{teacher_id:string})=>l.teacher_id==='t-vera'));
 const other=student.find((x:{teacher_id:string})=>x.teacher_id!=='t-vera');
 const endpoint='/api/lessons/'+pick.id;
 const snapshot=(l:typeof pick)=>JSON.stringify([l.starts,l.ends,l.building,l.room,l.change_kind,l.reason]);
 const current=async()=>(await alex.json('/api/me')).lessons.find((x:{id:string})=>x.id===pick.id);
 const cancel={action:'cancel',reason:'Командировка преподавателя',expected:snapshot(pick)};
 assert.equal((await alex.req(endpoint,'PATCH',cancel)).status,403);
 assert.equal((await staff.req(endpoint,'PATCH',cancel)).status,403);
 assert.equal((await vera.req('/api/lessons/'+other.id,'PATCH',cancel)).status,404);
 const move={action:'edit',reason:'Семинар перенесён',start:'2099-02-03T09:00',end:'2099-02-03T10:30',building:'А',room:'205',expected:snapshot(pick)};
 const clash=owned.find((l:{id:string;starts:string;change_kind:string})=>l.id!==pick.id&&Date.parse(l.starts)>Date.now()&&l.change_kind!=='cancelled');
 assert.equal((await vera.req(endpoint,'PATCH',{...move,start:clash.starts.slice(0,16),end:clash.ends.slice(0,16)})).status,409);
 await vera.json(endpoint,'PATCH',move);assert.equal((await current()).change_kind,'moved');
 assert.equal((await vera.req(endpoint,'PATCH',cancel)).status,409);
 await vera.json(endpoint,'PATCH',{...cancel,expected:snapshot(await current())});
 assert.equal((await current()).change_kind,'cancelled');
 assert.ok((await alex.json('/api/me')).notices.some((n:{body:string})=>n.body.includes(cancel.reason)));
 await vera.json(endpoint,'PATCH',{...move,expected:snapshot(await current()),reason:'Занятие состоится'});
 assert.equal((await current()).change_kind,'restored');
});

test('Calendar API persists individual registrations, restricts changes and reports real teacher activity',async()=>{
  const alex=new Client(),max=new Client(),vera=new Client();
  await alex.login('alex');await max.login('max');await vera.login('vera');
  const a=await alex.json('/api/me'),b=await max.json('/api/me');
  const event=a.events.find((e:{starts:string})=>Date.parse(e.starts)>Date.now());
  assert.ok(event);assert.ok(a.exams.length);assert.ok(b.exams.length);
  assert.ok(a.exams.every((e:{course_id:string})=>a.courses.some((c:{id:string})=>e.course_id===c.id)));
  const endpoint='/api/events/'+event.id;
  const registration=async(user:Client)=>(await user.json('/api/me')).events.find((e:{id:string})=>e.id===event.id).registered;
  const original=!!event.registered,other=await registration(max);
  try {
    await alex.json(endpoint,'PATCH',{registered:!original});
    assert.equal(await registration(alex),Number(!original));assert.equal(await registration(max),other);
    assert.equal((await vera.req(endpoint,'PATCH',{registered:true})).status,403);
    assert.equal((await max.req(endpoint,'PATCH',{registered:true,userId:a.user.id})).status,422);
    assert.equal((await alex.req(endpoint,'PATCH',{registered:true},{csrf:false})).status,403);
    assert.equal((await alex.req('/api/events/missing','PATCH',{registered:true})).status,404);
    const staffData=await vera.json('/api/me');
    assert.equal(staffData.events.length,0);assert.equal(staffData.exams.length,0);
    const chat=await alex.json('/api/chat/student-alex-c0');
    assert.ok(chat.teacher_seen_at&&Math.abs(Date.now()-Date.parse(chat.teacher_seen_at))<90000);
  } finally {
    await alex.json(endpoint,'PATCH',{registered:original});
  }
});
