import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {User} from '../src/lib/types';

test('Calendar enrolment is student-scoped and idempotent, and chat presence reflects teacher activity',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'campus-calendar-'));
  process.env.DATABASE_PATH=join(directory,'test.sqlite');
  process.env.DEMO_MODE='true';
  const {db,one,userColumns,run}=await import('../src/server/db');
  const {calendarData,setRegistration,recordTeacherActivity}=await import('../src/server/calendar');
  const {getChat}=await import('../src/server/chat');
  try {
    const user=(id:string)=>one<User>('SELECT '+userColumns+' FROM users WHERE id=?',id)!;
    const a=user('student-alex'),b=user('student-max'),teacher=user('t-vera');
    const event=calendarData(a).events.find(e=>Date.parse(e.starts)>Date.now())!;
    assert.ok(event);
    assert.ok(calendarData(a).exams.length);
    assert.ok(calendarData(a).exams.every(e=>e.course_id.startsWith(a.id)));
    assert.ok(calendarData(b).exams.every(e=>e.course_id.startsWith(b.id)));
    const enrolled=(who:User)=>calendarData(who).events.find(e=>e.id===event.id)!.registered;
    setRegistration(a,event.id,true);setRegistration(a,event.id,true);
    assert.equal(enrolled(a),1);assert.equal(enrolled(b),0);
    setRegistration(b,event.id,true);setRegistration(a,event.id,false);
    assert.equal(enrolled(a),0);assert.equal(enrolled(b),1);
    assert.throws(()=>setRegistration(teacher,event.id,true),{status:403});
    assert.throws(()=>setRegistration(a,'missing',true),{status:404});
    run('UPDATE campus_events SET starts=? WHERE id=?','2000-01-01T12:00:00+03:00',event.id);
    assert.throws(()=>setRegistration(a,event.id,true),{status:409});
    assert.equal(getChat(a,'student-alex-c0').teacher_seen_at,null);
    recordTeacherActivity(teacher);
    const seen=getChat(a,'student-alex-c0').teacher_seen_at;
    assert.ok(seen && Math.abs(Date.now()-Date.parse(seen))<5000);
    recordTeacherActivity(a);
    assert.equal(one<{last_seen_at:string|null}>('SELECT last_seen_at FROM users WHERE id=?',a.id)?.last_seen_at,null);
  } finally {
    db().close();
    rmSync(directory,{recursive:true,force:true});
  }
});
