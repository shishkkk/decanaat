'use client';
import {useEffect,useRef,useState} from 'react';
import {Paperclip,Send,Download,FileText} from 'lucide-react';
import type {Chat} from '@/lib/types';
import {useCampus} from './CampusContext';
import {useUi,Modal,api,ErrorMessage,Loading} from './ui';
export function ChatDrawer({courseId,onClose}:{courseId:string;onClose:()=>void}){const {data}=useCampus();const {t,locale}=useUi();const [chat,setChat]=useState<Chat|null>(null);const [error,setError]=useState('');const [body,setBody]=useState('');const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const input=useRef<HTMLInputElement>(null);useEffect(()=>{
 let active=true;
 const refresh=async()=>{
   try{const next=await api<Chat>('chat/'+courseId);if(active)setChat(next);}
   catch(e){if(active)setError((e as Error).message);}
 };
 void refresh();
 const timer=setInterval(()=>{if(!document.hidden)void refresh();},3000);
 return ()=>{active=false;clearInterval(timer);};
 },[courseId]);
 async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const form=new FormData();form.set('body',body);if(file)form.set('file',file);setChat(await api<Chat>('chat/'+courseId,data.csrf,'POST',form));setBody('');setFile(null);if(input.current)input.current.value='';}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const seen=chat?.teacher_seen_at;
 const online=!!seen&&Date.parse(data.now)-Date.parse(seen)<90000;
 const presence=online?t('Преподаватель в сети','Teacher online'):seen
   ?t('Преподаватель был в сети ','Teacher last seen ')+new Date(seen).toLocaleString(locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})
   :t('Преподаватель пока не заходил','Teacher has not signed in yet');
 return <Modal title={chat?(data.user.role==='teacher'?t(chat.student,chat.student_en):t(chat.teacher,chat.teacher_en)):t('Чат с преподавателем','Teacher chat')} onClose={onClose}>{data.user.role==='student'&&chat?.connected===1&&<p className="chat-presence"><span className={online?'presence-online':''}/>{presence}</p>}<p className="demo-note">{chat?.connected?t('Учебная переписка в демоаккаунтах.','Course conversation between demo accounts.'):t('Для этой дисциплины доступна запись вопросов без аккаунта преподавателя.','Questions are saved here. This course has no teacher account.')}</p>{chat?<><p className="course-chip">{locale==='ru'?chat.title:chat.title_en}</p><div className="messages" aria-live="polite">{chat.messages.map(m=><div key={m.id} className={'message '+(m.sender===data.user.role?'mine':'')}><p>{m.body.startsWith('Это пример переписки. Можно сохранить вопрос и приложить учебный файл;')?t('Пример сообщения к семинару. Здесь можно задать вопрос и приложить файл.','Sample seminar message. Ask a question or attach a study file here.'):m.body}</p>{m.attachment&&<a className="attachment" href={'/api/attachments/'+m.attachment.id}><FileText size={20}/><span>{m.attachment.name}<small>{Math.ceil(m.attachment.size/1024)} KB</small></span><Download size={18}/></a>}<time>{new Date(m.created_at).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})}</time></div>)}</div><form className="chat-form" onSubmit={send}><ErrorMessage code={error}/>{file&&<div className="selected-file">{file.name}<button type="button" className="text-button" onClick={()=>{setFile(null);if(input.current)input.current.value='';}}>{t('Убрать','Remove')}</button></div>}<div className="composer"><label className="icon-button file-button" aria-label={t('Прикрепить файл','Attach a file')}><Paperclip size={22}/><input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e=>{const f=e.target.files?.[0]||null;if(f&&f.size>2097152){setError('file_too_large');e.target.value='';return;}setError('');setFile(f);}}/></label><input aria-label={t('Сообщение','Message')} placeholder={t('Написать сообщение…','Write a message…')} maxLength={3000} value={body} onChange={e=>setBody(e.target.value)}/><button className="icon-button primary" aria-label={t('Отправить','Send')} disabled={busy||(!body.trim()&&!file)}><Send size={20}/></button></div><small className="muted">PDF, PNG, JPG, TXT · {t('до 2 МБ','up to 2 MB')}</small></form></>:<><Loading/><ErrorMessage code={error}/></>}</Modal>;}
