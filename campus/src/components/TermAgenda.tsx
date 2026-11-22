'use client';
import {Download} from 'lucide-react';
import {useCampus} from './CampusContext';
import {useUi} from './ui';
import {title} from '@/lib/format';
const stamp=(date:string)=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const escapeText=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/([,;])/g,'\\$1');
function fold(line:string){
 const enc=new TextEncoder();let part='',size=0;const lines:string[]=[];
 for(const ch of line){const bytes=enc.encode(ch).length;if(size+bytes>75){lines.push(part);part=' ';size=1}part+=ch;size+=bytes}
 return [...lines,part].join('\r\n');
}
export function TermAgenda(){
 const {data}=useCampus(),{locale,t}=useUi();
 const records=[...data.lessons.filter(l=>l.change_kind!=='cancelled').map(l=>({id:l.id,starts:l.starts,ends:l.ends,title:title(l,locale),place:l.building+' · '+l.room})),...data.exams.map(e=>({id:'exam-'+e.course_id,starts:e.starts,ends:'',title:t('Аттестация','Assessment')+' · '+title(e,locale),place:e.room})),...data.events.filter(e=>e.registered).map(e=>({id:'event-'+e.id,starts:e.starts,ends:'',title:title(e,locale),place:t(e.location,e.location_en)}))];
 function download(){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CAMPUS//Student calendar//RU','CALSCALE:GREGORIAN'];
 for(const r of records){lines.push('BEGIN:VEVENT','UID:'+r.id+'@campus.example','DTSTAMP:'+stamp(data.now),'DTSTART:'+stamp(r.starts));if(r.ends)lines.push('DTEND:'+stamp(r.ends));lines.push('SUMMARY:'+escapeText(r.title),'LOCATION:'+escapeText(r.place),'END:VEVENT')}
 lines.push('END:VCALENDAR');const url=URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='campus.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="export-calendar"><button className="button" disabled={!records.length} onClick={download}><Download size={18}/>{t('Скачать мой календарь (.ics)','Download my calendar (.ics)')}</button><small>{t('В файл войдут пары, аттестации и мероприятия, на которые вы записаны.','Includes classes, assessments and events you have joined.')}</small></div>
}
