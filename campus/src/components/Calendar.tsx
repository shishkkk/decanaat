'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Check, CalendarCheck, BookOpen, Clock3} from 'lucide-react';
import {useCampus} from './CampusContext';
import {api,Empty,ErrorMessage,useUi} from './ui';
import {dayKey} from '@/lib/academics';
import {time,dateLabel,title} from '@/lib/format';
import type {CampusEvent} from '@/lib/types';

import {WeekCalendar} from './WeekCalendar';
import {TermAgenda} from './TermAgenda';
function EventCard({event}:{event:CampusEvent}) {
  const {data,refresh}=useCampus();
  const {locale,t}=useUi();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const closed=Date.parse(event.starts)<=Date.parse(data.now);
  async function register(){
    setBusy(true);
    setError('');
    try{
      await api('events/'+event.id,data.csrf,'PATCH',{registered:!event.registered});
      await refresh();
    } catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <article className="event-card">
    <small>{dateLabel(event.starts,locale)} · {time(event.starts,locale)}</small>
    <h3>{title(event,locale)}</h3>
    <p>{t(event.description,event.description_en)}</p>
    <small>{t(event.location,event.location_en)}</small>
    {event.registered===1&&<span className="success"><Check size={16}/>{t('Вы записаны','You are registered')}</span>}
    {closed?<small>{t('Событие завершено','Event closed')}</small>:<button className={'button '+(event.registered?'':'primary')} disabled={busy} onClick={register}>
      {event.registered?t('Отменить запись','Cancel registration'):t('Записаться','Register')}
    </button>}
    <ErrorMessage code={error}/>
  </article>;
}

export function CalendarPage(){
  const {data}=useCampus();
  const {t,locale}=useUi();
  const today=dayKey(data.now);
  const [selected,setSelected]=useState(today);
  const events=data.events.filter(e=>dayKey(e.starts)===selected);
  const future=data.events.filter(e=>Date.parse(e.starts)>Date.parse(data.now)&&dayKey(e.starts)!==selected);
  const dayLessons=data.lessons.filter(l=>dayKey(l.starts)===selected);
  const dayExams=data.exams.filter(e=>dayKey(e.starts)===selected);
  const tasks=data.tasks.filter(x=>x.due.startsWith(selected));
  const agenda=[
    ...dayLessons.map(l=>({id:l.id,at:l.starts,href:'/courses/'+l.course_id,label:title(l,locale),note:l.change_kind==='cancelled'?t('Отменено','Cancelled'):t('Занятие · ауд. ','Class · room ')+l.room,icon:Clock3})),
    ...dayExams.map(e=>({id:'exam-'+e.course_id,at:e.starts,href:'/courses/'+e.course_id,label:title(e,locale),note:t('Экзамен · ауд. ','Exam · room ')+e.room,icon:BookOpen})),
    ...tasks.map(task=>({id:task.id,at:task.due+'+03:00',href:'/notes',label:task.title,note:task.done?t('Задача выполнена','Task complete'):t('Срок задания','Assignment due'),icon:Check})),
    ...events.map(e=>({id:e.id,at:e.starts,href:'#event-'+e.id,label:title(e,locale),note:t('Событие кампуса','Campus event'),icon:CalendarCheck}))
  ].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  return <>
    <div className="page-heading"><h1>{t('Учебный календарь','Academic calendar')}</h1>
      <p>{t('Занятия, экзамены, сроки заданий и события кампуса','Classes, exams, deadlines and campus events')}</p>
    </div>
    <WeekCalendar selected={selected} select={setSelected}><section className="day-agenda"><h2>{dateLabel(selected+'T12:00:00Z',locale,{day:'numeric',month:'long',weekday:'long'})}</h2>
        {agenda.length?agenda.map(item=><Link className="calendar-item" href={item.href} key={item.id}>
          <time>{time(item.at,locale)}</time><span>{item.label}<small><item.icon size={14}/> {item.note}</small></span>
        </Link>):<Empty>{t('На эту дату ничего не запланировано.','Nothing scheduled for this date.')}</Empty>}
</section></WeekCalendar>
    <div className="calendar-layout">
      <section>        <h2>{t('Экзамены семестра','Semester exams')}</h2>
        {data.exams.length?data.exams.map(exam=><button className="calendar-item calendar-jump" key={exam.course_id} onClick={()=>setSelected(dayKey(exam.starts))}>
          <BookOpen size={18}/><span>{title(exam,locale)}<small>{dateLabel(exam.starts,locale)} · {time(exam.starts,locale)} · {t('ауд.','room')} {exam.room}</small></span>
        </button>):<Empty>{t('Расписание экзаменов пока не опубликовано.','The exam schedule is not available yet.')}</Empty>}
      </section>
      <section id="events"><h2>{t('События','Events')}</h2>
        {[...events,...future].map(event=><div key={event.id} id={'event-'+event.id}><EventCard event={event}/></div>)}
        {!events.length&&!future.length&&<Empty>{t('Ближайших мероприятий нет.','There are no upcoming events.')}</Empty>}
      </section>
    </div><TermAgenda/>
  </>;
}
