import {all,one,run,transaction} from './db';
import {fail,requireStudent} from './auth';
import type {CampusEvent,Exam,User} from '../lib/types';

export function calendarData(user:User) {
  if(user.role!=='student')return {events:[],exams:[]};
  return {
    events:all<CampusEvent>(
      'SELECT e.*,EXISTS(SELECT 1 FROM event_registrations r WHERE r.event_id=e.id AND r.user_id=?) AS registered FROM campus_events e ORDER BY e.starts',
      user.id),
    exams:all<Exam>(
      'SELECT c.id AS course_id,c.title,c.title_en,e.starts,e.room FROM exams e JOIN courses c ON c.id=e.course_id WHERE c.user_id=? ORDER BY e.starts',
      user.id)
  };
}

export function setRegistration(user:User,eventId:string,registered:boolean) {
  requireStudent(user);
  return transaction(()=>{
    const event=one<{starts:string}>('SELECT starts FROM campus_events WHERE id=?',eventId);
    if(!event)return fail(404,'not_found');
    if(Date.parse(event.starts)<=Date.now())return fail(409,'event_closed');
    if(registered)run('INSERT OR IGNORE INTO event_registrations VALUES(?,?)',eventId,user.id);
    else run('DELETE FROM event_registrations WHERE event_id=? AND user_id=?',eventId,user.id);
    return {ok:true};
  });
}

export function recordTeacherActivity(user:User) {
  if(user.role!=='teacher')return;
  const now=Date.now();
  run('UPDATE users SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)',
    new Date(now).toISOString(),user.id,new Date(now-30_000).toISOString());
}
