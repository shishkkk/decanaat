import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(origin?.startsWith('https://') || origin?.startsWith('http://127.0.0.1:'));
class Account {
 cookies=new Map();csrf='';
 async call(path,method='GET',body){
   const response=await fetch(new URL(path,origin),{method,redirect:'manual',headers:{origin,cookie:[...this.cookies].map(([key,v])=>key+'='+v).join('; '),'x-csrf-token':this.csrf,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
   for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
   return response;
 }
 async json(path,method='GET',body){
   const r=await this.call(path,method,body);assert.ok(r.ok,path+' '+r.status+' '+(r.ok?'':(await r.text()).slice(0,120)));return r.json();
 }
 async login(demo){this.csrf=(await this.json('/api/auth')).csrf;const reply=await this.json('/api/auth','POST',{demo});this.csrf=reply.csrf;return reply.user;}
}
const anon=new Account();const home=await anon.call('/');assert.equal(home.status,307);
assert.equal((await anon.call('/api/me')).status,401);
const screen=await anon.call('/login');assert.equal(screen.status,200);assert.match(await screen.text(),/id="initial"/);
const js=await anon.call('/campus.js');assert.equal(js.status,200);const script=await js.text();assert.ok(script.length>100000);assert.ok(!script.includes('CampusDemo!2026'));
assert.match(screen.headers.get('content-security-policy')||'',/script-src 'nonce-/);
assert.equal(screen.headers.get('referrer-policy'),'no-referrer');
const apiHeaders=(await anon.call('/api/auth')).headers;
assert.match(apiHeaders.get('cache-control')||'',/no-store/);
assert.equal(apiHeaders.get('cross-origin-resource-policy'),'same-origin');
const alex=new Account(),vera=new Account();
assert.equal((await alex.login('alex')).role,'student');
assert.equal((await vera.login('vera')).role,'teacher');
for(const retired of ['max','elena']){
 const denied=new Account();denied.csrf=(await denied.json('/api/auth')).csrf;
 assert.equal((await denied.call('/api/auth','POST',{demo:retired})).status,422);
 assert.equal((await denied.call('/api/auth','POST',{login:retired,password:'CampusDemo!2026'})).status,401);
}
const student=await alex.json('/api/me'),teacher=await vera.json('/api/me');
assert.equal((await vera.call('/api/grades')).status,403);
assert.equal((await alex.call('/api/grades/student-max')).status,404);
assert.equal(teacher.recentGrades.length,0);
assert.equal(teacher.courses.length,0);
assert.equal((await alex.call('/api/auth','POST',{demo:'alex',login:'alex'})).status,422);
assert.ok(student.courses.length && student.events.length && student.notices.some(n=>n.kind==='event'));
assert.equal((await alex.call('/api/profile/student-max')).status,404);
assert.equal((await alex.call('/api/requests/request-max')).status,404);
assert.equal((await alex.call('/requests/request-max')).status,404);
assert.equal((await vera.call('/api/staff')).status,403);
const lesson=teacher.lessons.find(l=>l.change_kind!=='cancelled');
const url='/api/attendance/'+lesson.id;
assert.equal((await alex.call(url)).status,403);
assert.equal((await vera.call('/attendance')).status,200);
assert.equal((await alex.call('/attendance')).status,404);
const rows=await vera.json(url);assert.ok(rows.length>=4);
assert.equal((await vera.call(url,'PATCH',{member:'someone-else',status:'present'})).status,404);
const row=rows[0],status=row.status==='late'?'present':'late';
await vera.json(url,'PATCH',{member:row.id,status});await vera.json('/api/auth','DELETE');
await vera.login('vera');assert.equal((await vera.json(url)).find(r=>r.id===row.id).status,status);
await vera.json(url,'PATCH',{member:row.id,status:row.status});
const other=student.lessons.find(l=>l.teacher_id!==teacher.user.id);assert.ok(other);
assert.equal((await vera.call('/api/attendance/'+other.id)).status,404);

const card=await alex.json('/api/student-card');
assert.ok(card.book&&card.birth&&card.qr.startsWith('data:image/png;base64,'));
assert.equal((await anon.call('/api/student-card')).status,401);
assert.equal((await vera.call('/api/student-card')).status,403);
assert.equal((await alex.call('/api/student-card/student-max')).status,404);
assert.equal((await vera.call('/api/my-attendance')).status,403);
const past=teacher.lessons.find(l=>Date.parse(l.ends)<Date.now() && l.group_name===student.user.group_name && l.change_kind!=='cancelled');
assert.ok(past);
const markPath='/api/attendance/'+past.id;
const before=(await vera.json(markPath)).find(r=>r.id===student.user.id);
try{
 await vera.json(markPath,'PATCH',{member:before.id,status:'present'});
 assert.equal((await alex.json('/api/my-attendance')).find(r=>r.id===past.id)?.status,'present');
}finally{await vera.json(markPath,'PATCH',{member:before.id,status:before.status})}

const ready=student.requests.find(r=>r.status==='ready');
const pdf=await alex.call('/api/requests/'+ready.id+'/document?format=pdf');assert.equal(pdf.status,200);
assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
const task=await alex.json('/api/tasks','POST',{title:'Проверка сохранения',subject:'',due:''});
await alex.json('/api/tasks/'+task.id,'DELETE');
await vera.json('/api/auth','DELETE');await alex.json('/api/auth','DELETE');
assert.equal((await alex.call('/api/me')).status,401);
console.log('PASS two demo logins, retired credentials rejected, role isolation, attendance persisted across login, PDF, tasks and logout');
