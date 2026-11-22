'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Lesson} from '@/lib/types';
import {dayKey} from '@/lib/academics';
import {dateLabel,time,title} from '@/lib/format';
import {useCampus} from './CampusContext';
import {useUi} from './ui';
import {windowStyle} from './windowStyle';

export function findWindow(lessons:Lesson[],now:number,minutes:number){
 const sorted=lessons.filter(l=>l.change_kind!=='cancelled'&&Date.parse(l.ends)>Date.parse(l.starts)).sort((a,b)=>Date.parse(a.starts)-Date.parse(b.starts));
 let previous:Lesson|undefined;
 for(const next of sorted){
   if(previous&&dayKey(previous.ends)===dayKey(next.starts)){
     const start=Math.ceil(Math.max(now,Date.parse(previous.ends))/60000)*60000;
     const available=Math.floor((Date.parse(next.starts)-start)/60000);
     if(available>=minutes)return {previous,next,start,available};
   }
   if(!previous||Date.parse(next.ends)>Date.parse(previous.ends))previous=next;
 }
 return null;
}
function Slab({x,width,gap=false}:{x:number;width:number;gap?:boolean}){
 const top=gap?47:31,depth=gap?4:19,skew=19;
 return <g className={gap?'gap-slab open':'gap-slab'}>
 <polygon className="front" points={[[x,top],[x+width,top],[x+width,top+depth],[x,top+depth]].map(v=>v.join(',')).join(' ')}/>
 <polygon className="side" points={[[x+width,top],[x+width+skew,top-13],[x+width+skew,top-13+depth],[x+width,top+depth]].map(v=>v.join(',')).join(' ')}/>
 <polygon className="top" points={[[x,top],[x+skew,top-13],[x+skew+width,top-13],[x+width,top]].map(v=>v.join(',')).join(' ')}/></g>
}
export function StudyWindow(){
 const {data}=useCampus(),{t,locale}=useUi(),[duration,setDuration]=useState(45);
 const gap=findWindow(data.lessons,Date.parse(data.now),duration);
 const label=(ms:number)=>time(new Date(ms).toISOString(),locale);
 const needed=gap?Math.max(1,168*duration/gap.available):0;
 return <section className="study-window"><style>{windowStyle}</style>
 <h2>{t('Окно между парами','Between classes')}</h2>
 <div className="window-options" role="group" aria-label={t('Сколько времени нужно','Time needed')}>{[30,45,60].map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n} {t('мин','min')}</button>)}</div>
 <div aria-live="polite">{gap?<><p className="window-date">{dateLabel(gap.next.starts,locale,{weekday:'long',day:'numeric',month:'long'})}</p><p className="window-clock">{label(gap.start)} – {time(gap.next.starts,locale)} <small>{gap.available} {t('мин свободно','min free')}</small></p>
 <svg viewBox="0 0 320 65" aria-hidden="true" className="window-graphic"><path d="M6 57h302" stroke="#a1cbf2" strokeOpacity=".25" strokeDasharray="2 6"/><Slab x={5} width={52}/><Slab x={61} width={168} gap/><g transform="translate(62 0)"><path d={'M0 43h'+needed} stroke="#ffe2a4" strokeWidth="3"/><path d={'M0 39v9m'+needed+' -9v9'} stroke="#ffe2a4"/></g><Slab x={234} width={62}/></svg>
 <small className="window-key">{t('Золотая метка — нужное время внутри окна','Gold marker — time needed within the break')}</small>
 <p className="window-classes">{title(gap.previous,locale)} <span>→</span> {title(gap.next,locale)}</p>
 {gap.previous.building!==gap.next.building&&<small className="window-key">{t('Учтите переход между корпусами','Allow time to change buildings')} {gap.previous.building} → {gap.next.building}</small>}
 <Link className="window-link" href={'/schedule?day='+dayKey(gap.next.starts)}>{t('Открыть этот день','View this day')} →</Link></>:<p>{t('В опубликованном расписании нет окна такой длительности.','No break of this length in the published timetable.')}</p>}</div></section>
}
