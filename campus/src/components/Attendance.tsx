'use client';
import {useEffect,useState} from 'react';
import {useCampus} from './CampusContext';
import {useUi,api,Empty,ErrorMessage} from './ui';
import {dateLabel,time,title} from '@/lib/format';

type Member={id:string;name:string;name_en:string;status:string};
const options=[['unmarked','Без отметки','Unmarked'],['present','Присутствует','Present'],['late','Опоздание','Late'],['absent','Отсутствует','Absent'],['excused','Уважительная причина','Excused']];

export function Attendance(){
 const {data}=useCampus(),{t,locale}=useUi();
 const [chosen,choose]=useState('');
 const lessons=data.lessons;
 const lesson=lessons.find(l=>l.id===chosen)??lessons.find(l=>l.change_kind!=='cancelled'&&Date.parse(l.ends)>=Date.parse(data.now))??lessons.at(-1);
 return <><div className="page-heading"><h1>{t('Посещаемость','Attendance')}</h1><p>{t('Журнал занятий','Class register')} · {t(data.user.name,data.user.name_en)}</p></div>
 {lesson?<section className="register-panel"><label>{t('Занятие и группа','Class and group')}<select value={lesson.id} onChange={e=>choose(e.target.value)}>{lessons.map(l=><option value={l.id} key={l.id}>{dateLabel(l.starts,locale)} · {time(l.starts,locale)} · {l.group_name} · {title(l,locale)}</option>)}</select></label>
 <Register key={lesson.id} id={lesson.id} cancelled={lesson.change_kind==='cancelled'}/></section>:<Empty>{t('Занятий пока нет.','No classes yet.')}</Empty>}</>;
}
function Register({id,cancelled}:{id:string;cancelled:boolean}){
 const {data}=useCampus(),{t}=useUi();
 const [rows,setRows]=useState<Member[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState(false),[attempt,retry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');api<Member[]>('attendance/'+id).then(r=>{if(active)setRows(r)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id,attempt]);
 async function mark(member:string,status:string){
  setBusy(true);setError('');setSaved(false);
  try{await api('attendance/'+id,data.csrf,'PATCH',{member,status});setRows(old=>old.map(r=>r.id===member?{...r,status}:r));setSaved(true)}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <><div className="section-head"><h2>{t('Список группы','Group roster')}</h2><span>{rows.filter(r=>r.status!=='unmarked').length} / {rows.length}</span></div>
 {cancelled&&<p>{t('Занятие отменено. Журнал доступен для просмотра.','Class cancelled. Attendance is read-only.')}</p>}
 <ErrorMessage code={error}/>{error&&<button className="button" onClick={()=>retry(x=>x+1)}>{t('Обновить','Reload')}</button>}
 {loading?<p>{t('Загружаем список…','Loading roster…')}</p>:rows.map(r=><label key={r.id} className="register-row"><span>{t(r.name,r.name_en)}</span><select disabled={cancelled||busy} value={r.status} onChange={e=>void mark(r.id,e.target.value)}>{options.map(([v,ru,en])=><option key={v} value={v}>{t(ru,en)}</option>)}</select></label>)}
 <p className="muted" aria-live="polite">{busy?t('Сохраняем…','Saving…'):saved?t('Отметка сохранена','Attendance saved'):''}</p></>;
}
