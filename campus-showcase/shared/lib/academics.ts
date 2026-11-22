import type {Course,Lesson} from './types';
export function academicSummary(courses:Course[]) {
 const numeric=courses.filter(c=>c.grade!==null&&c.grade>=0&&c.grade<=100); const average=numeric.length?numeric.reduce((s,c)=>s+c.grade!,0)/numeric.length:null;
 const completed=courses.filter(c=>c.passed===1).length; const debts=courses.filter(c=>c.debt===1);
 return {average,completed,total:courses.length,progress:courses.length?Math.round(completed/courses.length*100):0,debts};
}
export function nextLesson(lessons:Lesson[],now:Date) {return lessons.filter(l=>l.change_kind!=='cancelled'&&new Date(l.ends)>now).sort((a,b)=>a.starts.localeCompare(b.starts))[0]??null;}
export function dayKey(value:string|Date) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
