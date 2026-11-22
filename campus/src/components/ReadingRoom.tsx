'use client';
import {useCallback,useState} from 'react';
import {BookOpen,Feather,Library,Search,ArrowUpRight,ListPlus,Check} from 'lucide-react';
import {readings} from '@/lib/readings';
import {useCampus} from './CampusContext';
import {api,Modal,useUi,ErrorMessage} from './ui';
const motifs=[Library,Feather,BookOpen];
export function ReadingRoom(){
 const {data,refresh}=useCampus(),{locale,t}=useUi(),lang=locale==='ru'?0:1;
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selected,select]=useState<number|null>(null),[answer,setAnswer]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=useCallback(()=>select(null),[]),item=selected===null?null:readings[selected];
 const saved=(r:typeof readings[number])=>data.tasks.some(task=>r.task.some(name=>name===task.title));
 async function assign(){if(!item||saved(item))return;setBusy(true);setError('');try{await api('tasks',data.csrf,'POST',{title:item.task[lang],subject:item.title[lang],due:''});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const catalog=readings.map((r,i)=>({r,i})).filter(({r})=>(filter==='all'||r.category[0]===filter)&&(r.title[lang]+' '+r.lead[lang]).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section id="reading-room" className="reading-room paper-panel"><div className="library-head"><Library/><div><h2>{t('Читальный зал','Reading room')}</h2><p>{t('Шесть практикумов к гуманитарным семинарам. В каждом — источник, разбор и вопрос для самопроверки.','Six humanities workshops, each with a practice source, commentary and a self-check.')}</p></div></div>
 <div className="reading-controls"><label className="reading-search"><Search size={17}/><input type="search" aria-label={t('Найти практикум','Find a workshop')} placeholder={t('Найти практикум','Find a workshop')} value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="folio-tabs">{[['all','Все','All'],['Архив','Архив','Archives'],['Метод','Метод','Method'],['Текст','Текст','Text']].map(([id,ru,en])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{t(ru,en)}</button>)}</div></div>
 <div className="reading-cards">{catalog.map(({r,i})=>{const Icon=motifs[i%3];return <button className={'reading-card cover-'+(i%3)} key={r.id} onClick={()=>{select(i);setAnswer(null);setError('')}}><span className="bookplate"><Icon size={26}/><small>{r.category[lang]}</small></span><strong>{r.title[lang]}</strong><span>{r.lead[lang]}</span><i><ArrowUpRight size={17}/></i></button>})}</div>
 {!catalog.length&&<p role="status">{t('По этому запросу практикумов нет.','No matching workshops.')}</p>}
 {item&&<Modal title={item.title[lang]} onClose={close}><article className="reader"><p className="reader-lead">{item.lead[lang]}</p><h3>{t('Учебный источник','Practice source')}</h3><blockquote>{item.source[lang]}</blockquote><h3>{t('Разбор','Commentary')}</h3><p>{item.analysis[lang]}</p><fieldset><legend>{item.question[lang]}</legend>{[item.a,item.b].map((a,i)=><button className="button" key={i} aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{a[lang]}</button>)}{answer!==null&&<strong role="status">{answer===item.correct?t('Верно','Correct'):t('Попробуйте ещё раз — подсказка в разборе.','Try again. Revisit the commentary.')}</strong>}</fieldset><h3>{t('К семинару','Seminar assignment')}</h3><p>{item.task[lang]}</p><ErrorMessage code={error}/><button className="button primary" disabled={saved(item)||busy} onClick={assign}>{saved(item)?<Check size={17}/>:<ListPlus size={17}/>} {saved(item)?t('В ваших задачах','In your tasks'):t('Добавить в мои задачи','Add to my tasks')}</button></article></Modal>}</section>;
}
