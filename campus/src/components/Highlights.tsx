'use client';
import {useCallback,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,ChevronLeft,ChevronRight} from 'lucide-react';
import type {Notice} from '@/lib/types';
import {useCampus} from './CampusContext';
import {api,Modal,useUi} from './ui';
import {StoryIcon} from './StoryIcon';
import {dateLabel} from '@/lib/format';

type Group='events'|'important';
function Poster({group}:{group:Group}){
 return <svg className="bulletin-art" viewBox="0 0 600 390" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
 <defs><linearGradient id="poster-metal" x2=".85" y2="1"><stop stopColor="#fff0c4"/><stop offset=".45" stopColor="#ecc879"/><stop offset="1" stopColor="#b98240"/></linearGradient><linearGradient id="poster-ink" x2=".2" y2="1"><stop stopColor="#a3daff"/><stop offset="1" stopColor="#407cc2"/></linearGradient></defs>
 <g fill="none" stroke="#8abaf3" opacity=".27">{[0,1,2,3,4].map(i=><ellipse key={i} cx="316" cy="260" rx={125+i*33} ry={44+i*15} transform="rotate(-17 316 260)"/>)}</g>
 {group==='events'?<g transform="rotate(-9 300 214)"><circle cx="393" cy="87" r="47" fill="url(#poster-metal)"/><path d="M91 186q110-18 202 52 95-73 208-54l-8 110q-109-10-201 50-90-59-198-57z" fill="#315e99" stroke="#a7cdef" strokeWidth="3"/><path d="M102 160q97-4 190 64 106-70 194-64l-4 110q-96 0-190 62-94-68-195-69z" fill="url(#poster-metal)"/><path d="M110 150q103-6 182 71l-1 102q-82-76-191-79z" fill="#ffedca"/><path d="M292 221q94-76 185-76l-6 105q-90 4-180 73z" fill="url(#poster-ink)"/><g stroke="#ab885e" strokeWidth="3" fill="none">{[0,1,2,3].map(i=><path key={i} d={'M127 '+(175+i*14)+'q71 3 132 47'}/>)}</g><path d="m367 177-4 90 18-16 13 0 4-89" fill="#245889"/></g>:<g transform="rotate(-14 300 200)"><path d="m259 235 19 81q8 28 34 17l17-8-23-91" fill="url(#poster-metal)" stroke="#edcd96" strokeWidth="4"/><path d="M158 158h95q73-9 154-71v205q-76-52-154-65h-95q-35-35 0-69z" fill="url(#poster-ink)" stroke="#b8ddfa" strokeWidth="4"/><rect x="153" y="156" width="99" height="74" rx="21" fill="#2866a3"/><ellipse cx="406" cy="190" rx="28" ry="103" fill="url(#poster-metal)"/><ellipse cx="409" cy="188" rx="14" ry="84" fill="#203857"/><path d="m461 144 31-15m-28 59 42-1m-44 40 27 13" stroke="#eacd89" strokeWidth="7" strokeLinecap="round"/></g>}</svg>
}
export function Highlights(){
 const {data,refresh,setError}=useCampus(),{locale,t}=useUi();
 const [viewer,setViewer]=useState<{group:Group;items:Notice[];index:number}|null>(null);
 const close=useCallback(()=>setViewer(null),[]);
 const labels={events:t('События','Events'),important:t('Важное','Important')};
 const groups={events:data.notices.filter(n=>n.kind==='event'),important:data.notices.filter(n=>['schedule','deadline'].includes(n.kind)||(n.kind==='announcement'&&n.link!=='/requests/new?type=aid'))};
 async function show(group:Group,items:Notice[],index:number){
   const notice=items[index];if(!notice)return;
   setViewer({group,items,index});if(notice.read_at)return;
   try{await api('notifications/'+notice.id,data.csrf,'PATCH',{});await refresh()}catch(e){setError((e as Error).message)}
 }
 function move(step:number){if(!viewer)return;const index=viewer.index+step;if(index>=viewer.items.length)close();else if(index>=0)void show(viewer.group,viewer.items,index)}
 const current=viewer?.items[viewer.index];
 return <><section className="story-frame"><h2>{t('Актуальное','Highlights')}</h2><div className="stories"><Link href="/notes" className="story"><span><StoryIcon kind="notes"/></span>{t('Заметки','Notes')}</Link>{(['events','important'] as const).map(group=>{
   const items=groups[group],first=items.findIndex(n=>!n.read_at);
   return <button key={group} className={'story'+(first>=0?' fresh-story':'')} aria-label={labels[group]+(first>=0?t(' · есть новые истории',' · new stories'):'')} aria-haspopup="dialog" onClick={()=>items.length?void show(group,items,Math.max(first,0)):setViewer({group,items,index:0})}><span><StoryIcon kind={group}/></span>{labels[group]}</button>
 })}</div></section>{viewer&&<Modal title={labels[viewer.group]} onClose={close}><article className="bulletin" onKeyDown={e=>{if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)}}>
 <div className="bulletin-bars" aria-hidden="true">{viewer.items.map((item,i)=><i key={item.id} data-seen={i<=viewer.index}/>)}</div>
 <div className="bulletin-poster"><div className="bulletin-copy">{current?<><time>{dateLabel(current.created_at,locale)}</time><h3>{t(current.title,current.title_en)}</h3><p>{t(current.body,current.body_en)}</p></>:<h3>{t('Пока нет объявлений','No announcements yet')}</h3>}</div><Poster group={viewer.group}/>{current&&<Link href={current.link} className="button" onClick={close}>{t('Открыть раздел','Open section')}<ArrowUpRight size={18}/></Link>}</div>
 {current&&<footer><button onClick={()=>move(-1)} disabled={viewer.index===0} aria-label={t('Предыдущая история','Previous story')}><ChevronLeft/></button><span>{viewer.index+1} / {viewer.items.length}</span><button onClick={()=>move(1)} aria-label={viewer.index+1===viewer.items.length?t('Завершить просмотр','Finish viewing'):t('Следующая история','Next story')}><ChevronRight/></button></footer>}</article></Modal>}</>
}
