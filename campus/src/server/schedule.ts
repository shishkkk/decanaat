import {z} from 'zod';
import type {User,Lesson} from '../lib/types';
import {one,run,transaction} from './db';
import {notify} from './queries';
import {fail} from './auth';

const localTime=z.iso.datetime({local:true,precision:-1}).refine(v=>v.length===16);
const common={reason:z.string().trim().min(3).max(300),expected:z.string().max(1500)};
const change=z.discriminatedUnion('action',[
  z.object({...common,action:z.literal('cancel')}).strict(),
  z.object({...common,action:z.literal('edit'),start:localTime,end:localTime,
    building:z.string().trim().min(1).max(50),room:z.string().trim().min(1).max(40)}).strict()
]);

export function updateLesson(user:User,id:string,input:unknown){
  if(user.role!=='teacher')return fail(403,'forbidden');
  const data=change.parse(input);
  return transaction(()=>{
    const lesson=one<Lesson & {user_id:string;group_name:string}>(
      'SELECT l.*,c.user_id,c.title,c.title_en,u.group_name FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id WHERE l.id=? AND c.teacher_id=?',id,user.id);
    if(!lesson)return fail(404,'not_found');
    const snapshot=JSON.stringify([lesson.starts,lesson.ends,lesson.building,lesson.room,lesson.change_kind,lesson.reason]);
    if(snapshot!==data.expected)return fail(409,'lesson_changed');
    if(Date.parse(lesson.ends)<=Date.now())return fail(422,'lesson_ended');
    let kind='cancelled',start=lesson.starts,end=lesson.ends,room=lesson.room,building=lesson.building;
    if(data.action==='cancel'){
      if(lesson.change_kind==='cancelled')return fail(409,'lesson_changed');
    }else{
      start=data.start+':00+03:00'; end=data.end+':00+03:00';room=data.room;building=data.building;
      if(start.slice(0,10)!==end.slice(0,10)||end<=start||Date.parse(end)<=Date.now())return fail(422,'lesson_time');
      const changesTime=start!==lesson.starts||end!==lesson.ends;
      const changesPlace=room!==lesson.room||building!==lesson.building;
      if(!changesTime&&!changesPlace&&lesson.change_kind!=='cancelled')return fail(422,'lesson_unchanged');
      const conflict=one('SELECT l.id FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id WHERE l.id<>? AND COALESCE(l.change_kind,?)<>? AND l.starts<? AND l.ends>? AND (c.teacher_id=? OR u.group_name=? OR (l.building=? AND l.room=?)) LIMIT 1',id,'','cancelled',end,start,user.id,lesson.group_name,building,room);
      if(conflict)return fail(409,'lesson_overlap');
      kind=changesTime?'moved':changesPlace?'room':'restored';
    }
    run('UPDATE lessons SET starts=?,ends=?,building=?,room=?,change_kind=?,reason=?,reason_en=?,old_room=? WHERE id=?',start,end,building,room,kind,data.reason,data.reason,lesson.room,id);
    notify(lesson.user_id,kind==='cancelled'?'Пара отменена':'Расписание изменено',kind==='cancelled'?'Class cancelled':'Schedule updated',lesson.title+' · '+data.reason,lesson.title_en+' · '+data.reason,'schedule','/schedule');
    return {ok:true};
  });
}
