'use client';
import {useEffect,useState} from 'react';
import {api,ErrorMessage,useUi} from './ui';
import {useCampus} from './CampusContext';
import {dateLabel} from '@/lib/format';
import {dayKey} from '@/lib/academics';
type Mark={grade:number;created_at:string;course_id:string};
export function GradeTrend(){
 const {data}=useCampus(),{t,locale}=useUi();
 const [marks,setMarks]=useState<Mark[]|null>(null),[error,setError]=useState(''),[period,setPeriod]=useState('all'),[focus,setFocus]=useState('');
 useEffect(()=>{let live=true;api<{history:Mark[]}>('grades').then(r=>{if(live)setMarks(r.history)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 const days=new Map<string,number>();let sum=0,count=0;
 const courses=new Set(data.courses.filter(c=>period==='all'||c.semester===Number(period)).map(c=>c.id));
 for(const m of [...(marks??[])].filter(m=>courses.has(m.course_id)&&Number.isFinite(m.grade)).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))){sum+=m.grade;days.set(dayKey(m.created_at),sum/++count)}
 const points=[...days],first=points[0]?.[0],last=points.at(-1)?.[0];const short=(d:string)=>dateLabel(d+'T12:00:00Z',locale,{month:'short',day:'numeric',year:'numeric'});
 const x=(d:string)=>first===last?50:100*(Date.parse(d)-Date.parse(first))/(Date.parse(last!)-Date.parse(first));
 const xy=points.map(([d,v])=>x(d)+','+(100-v)).join(' '),active=points.find(([d])=>d===focus)??points.at(-1);
 return <section className="trend-panel"><div className="section-head"><h2>{t('Динамика среднего балла','Average grade trend')}</h2><select aria-label={t('Период графика','Chart period')} value={period} onChange={e=>{setFocus('');setPeriod(e.target.value)}}><option value="all">{t('Все семестры','All semesters')}</option>{[...new Set(data.courses.map(c=>c.semester))].sort().map(s=><option key={s} value={s}>{t('Семестр','Semester')} {s}</option>)}</select></div><ErrorMessage code={error}/>{points.length&&active?<><div className="trend-caption" aria-live="polite"><strong>{active[1].toLocaleString(locale,{maximumFractionDigits:2})}</strong> / 100 · {short(active[0])}</div><div className="trend-graph"><div className="trend-axis">{[100,75,50,25,0].map(v=><span key={v}>{v}</span>)}</div><div className="trend-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{points.length>1&&<polygon points={'0,100 '+xy+' 100,100'} fill="rgba(73,131,217,.13)"/>}<polyline points={xy} vectorEffect="non-scaling-stroke" fill="none" stroke="#4486cd" strokeWidth="3"/></svg>{points.map(([d,v])=><button className="plot-point" aria-label={short(d)+' · '+v.toFixed(2)} key={d} onFocus={()=>setFocus(d)} onPointerEnter={()=>setFocus(d)} onClick={()=>setFocus(d)} style={{left:x(d)+'%',top:(100-v)+'%'}}/>)}</div></div><div className="trend-range"><span>{short(first)}</span><span>{short(last!)}</span></div><small>{t('Накопительный средний по числовым оценкам за период','Cumulative average of numeric grades in this period')} · {count}</small></>:<p>{error?'':marks?t('За период нет числовых оценок','No numeric grades in this period'):t('Загрузка…','Loading…')}</p>}</section>
}