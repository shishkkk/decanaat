'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {BookOpen,ContactRound,GraduationCap,FileText,ScanLine} from 'lucide-react';
import {api,ErrorMessage,useUi} from './ui';
import {StudentDocuments} from './StudentDocuments';
import {useCampus} from './CampusContext';
import {dateLabel,title} from '@/lib/format';
type Card={birth:string|null;book:string;qr:string};
export function StudentDossier(){
 const {data}=useCampus(),{t,locale}=useUi(),u=data.user;
 const [card,setCard]=useState<Card|null>(null),[error,setError]=useState(''),[tab,setTab]=useState('pass'),[attempt,retry]=useState(0);
 const terms=[...new Set(data.courses.map(c=>c.semester))].sort((a,b)=>b-a);
 const [history,setHistory]=useState<{id:string;starts:string;title:string;title_en:string;status:string}[]|null>(null);
 useEffect(()=>{if(tab!=='attendance')return;let alive=true;api<NonNullable<typeof history>>('my-attendance').then(v=>{if(alive)setHistory(v)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[tab,attempt]);
 const [term,selectTerm]=useState(terms[0]);
 useEffect(()=>{let alive=true;setError('');api<Card>('student-card').then(v=>{if(alive)setCard(v)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[attempt]);
 const courses=data.courses.filter(c=>c.semester===term);
 const forms:Record<string,string>={exam:t('Экзамен','Exam'),graded:t('Дифф. зачёт','Graded assessment'),pass:t('Зачёт','Pass/fail'),coursework:t('Курсовая','Coursework')};
 return <section className="dossier paper-panel"><div className="folio-tabs">{[[t('Пропуск','Pass'),'pass',ScanLine],[t('Зачётная книжка','Gradebook'),'book',BookOpen],[t('Учебный план','Curriculum'),'plan',GraduationCap],[t('Посещаемость','Attendance'),'attendance',BookOpen],[t('Документы','Documents'),'docs',FileText]].map(([label,key,icon])=>{const Icon=icon as typeof ScanLine;return <button key={String(key)} aria-pressed={tab===key} onClick={()=>setTab(String(key))}><Icon size={18}/>{String(label)}</button>})}</div>
 {error&&<><ErrorMessage code={error}/><button className="button" onClick={()=>retry(i=>i+1)}>{t('Повторить','Retry')}</button></>}
 {tab==='docs'?<StudentDocuments openTab={setTab}/>:tab==='attendance'?<><h2>{t('Моя посещаемость','My attendance')}</h2><p>{t('Отметки преподавателей по прошедшим занятиям.','Teacher marks for past classes.')}</p>{history===null?<p>{t('Загрузка…','Loading…')}</p>:history.length===0?<p>{t('Завершённых занятий пока нет.','No past classes yet.')}</p>:history.map(r=><div className="folio-row" key={r.id}><span>{title(r,locale)}<small>{dateLabel(r.starts,locale)}</small></span><b>{{present:t('Присутствие','Present'),late:t('Опоздание','Late'),absent:t('Отсутствие','Absent'),excused:t('Уважительная причина','Excused'),unmarked:t('Без отметки','Unmarked')}[r.status]}</b></div>)}</>:tab==='pass'?<div className="pass-layout"><div className="campus-pass"><span className="pass-wordmark">CAMPUS <ScanLine size={25}/></span><h2>{t('Студенческий пропуск','Student pass')}</h2><p>{t(u.name,u.name_en)} · {u.group_name}</p><code>{u.student_no}</code>{card&&<img className="pass-qr" src={card.qr} alt={t('QR-код демонстрационного пропуска','Demo pass QR code')} width="132" height="132"/>}<small>{t('Демонстрационный пропуск','Demonstration pass')}</small></div>
 <div><h2><ContactRound size={22}/> {t('Личные данные','Personal details')}</h2><dl className="profile-details">{[[t('Дата рождения','Date of birth'),card?.birth?dateLabel(card.birth,locale,{day:'numeric',month:'long',year:'numeric'}):'—'],[t('Телефон','Phone'),u.phone||t('Можно добавить ниже','Add below')],['Email',u.email],[t('Номер ЗК','Gradebook ID'),card?.book??'—']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div></div>:<>
 <div className="section-head"><h2>{tab==='book'?t('Зачётная книжка','Gradebook'):t('Учебный план','Curriculum')}</h2><label>{t('Семестр','Semester')} <select value={term} onChange={e=>selectTerm(Number(e.target.value))}>{terms.map(v=><option key={v}>{v}</option>)}</select></label></div>
 <p className="folio-caption">{tab==='book'?card?.book:t(u.program,u.program)} · {courses.reduce((sum,c)=>sum+c.credits,0)} {t('зачётных единиц','credits')}</p>
 {courses.map(c=><Link className="folio-row" key={c.id} href={'/courses/'+c.id}><span><strong>{title(c,locale)}</strong><small>{forms[c.assessment]} · {t(c.teacher,c.teacher_en)}</small></span><b>{tab==='plan'?c.credits+' '+t('з.е.','cr.'):c.debt?t('Долг','Retake'):c.grade??(c.passed?t('Зачтено','Pass'):'—')}</b></Link>)}</>}</section>;
}