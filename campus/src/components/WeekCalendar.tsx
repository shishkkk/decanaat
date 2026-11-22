'use client';
import {useCampus} from './CampusContext';
import {useUi} from './ui';
import {dayKey} from '@/lib/academics';
import {dateLabel,title,time} from '@/lib/format';
function shift(key:string,days:number){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return dayKey(d)}
const weekday=(day:string)=>(new Date(day+'T12:00:00Z').getUTCDay()+6)%7;
const minute=(iso:string)=>{const d=new Date(Date.parse(iso)+10800000);return d.getUTCHours()*60+d.getUTCMinutes()};
export function WeekCalendar({selected,select,children}:{selected:string;select:(v:string)=>void;children:React.ReactNode}){
 const {data}=useCampus(),{locale,t}=useUi();
 const monday=shift(selected,-weekday(selected)),days=Array.from({length:7},(_,i)=>shift(monday,i)),first=selected.slice(0,7)+'-01';
 const entries=[...data.lessons.map(l=>({id:l.id,name:title(l,locale),at:l.starts,end:minute(l.ends),kind:'lesson',cancel:l.change_kind==='cancelled'})),...data.exams.map(e=>({id:e.course_id,name:title(e,locale),at:e.starts,end:minute(e.starts)+30,kind:'exam',cancel:false})),...data.events.map(e=>({id:e.id,name:title(e,locale),at:e.starts,end:minute(e.starts)+30,kind:'event',cancel:false}))];
 const occupied=new Set(entries.map(e=>dayKey(e.at)));
 const week=entries.filter(e=>days.includes(dayKey(e.at))),start=Math.floor(Math.min(480,...week.map(e=>minute(e.at)))/60),end=Math.ceil(Math.max(1080,...week.map(e=>e.end))/60);
 const label=(key:string,options:Intl.DateTimeFormatOptions)=>dateLabel(key+'T12:00:00Z',locale,options);
 return <section className="calendar-frame"><div className="cal-controls"><button className="icon-button" aria-label={t('Предыдущая неделя','Previous week')} onClick={()=>select(shift(selected,-7))}>‹</button><strong>{label(monday,{day:'numeric',month:'short'})} – {label(days[6],{day:'numeric',month:'short'})}</strong><button className="icon-button" aria-label={t('Следующая неделя','Next week')} onClick={()=>select(shift(selected,7))}>›</button><button className="button" onClick={()=>select(dayKey(data.now))}>{t('Сегодня','Today')}</button><input aria-label={t('Выбрать дату','Choose date')} type="date" value={selected} onChange={e=>e.target.value&&select(e.target.value)}/></div>
 <div className="cal-columns"><div className="cal-week"><div className="cal-head"><span/>{days.map(day=><button key={day} aria-pressed={day===selected} onClick={()=>select(day)}>{label(day,{weekday:'short'})}<b>{Number(day.slice(-2))}</b></button>)}</div><div className="cal-grid" style={{height:(end-start)*55}}><div className="hour-labels">{Array.from({length:end-start},(_,i)=><small key={i}>{i+start}:00</small>)}</div>{days.map(day=>{
 const items=week.filter(e=>dayKey(e.at)===day).sort((a,b)=>minute(a.at)-minute(b.at));
 const positions:{item:typeof items[number];lane:number;span:number}[]=[];let group=0,until=-1,lanes:number[]=[];
 for(const item of items){const at=minute(item.at);if(at>=until){group=positions.length;lanes=[];until=-1}let lane=lanes.findIndex(v=>v<=at);if(lane<0)lane=lanes.length;lanes[lane]=item.end;until=Math.max(until,item.end);positions.push({item,lane,span:1});for(let i=group;i<positions.length;i++)positions[i].span=lanes.length}
 return <div className="cal-track" key={day}>{positions.map(({item,lane,span})=><button key={item.kind+item.id} title={item.name} className={'cal-block '+item.kind+(item.cancel?' cancelled':'')} style={{top:(minute(item.at)/60-start)*55,height:Math.max(22,(item.end-minute(item.at))*55/60-2),left:lane/span*100+'%',width:100/span+'%'}} onClick={()=>select(day)}><b>{time(item.at,locale)}</b>{item.name}</button>)}</div>})}</div></div>
 <aside className="cal-month"><div className="phone-days">{days.map(day=><button key={day} aria-pressed={day===selected} onClick={()=>select(day)}>{label(day,{weekday:"short"})}<b>{Number(day.slice(-2))}</b></button>)}</div><h3>{label(selected,{month:'long',year:'numeric'})}</h3><div>{days.map(d=><small key={d}>{label(d,{weekday:'short'})}</small>)}{Array.from({length:42},(_,i)=>shift(first,i-weekday(first))).map(day=><button key={day} aria-pressed={day===selected} className={day.slice(0,7)!==selected.slice(0,7)?'outside':''} onClick={()=>select(day)}>{Number(day.slice(-2))}{occupied.has(day)&&<i/>}</button>)}</div>{children}</aside></div></section>
}