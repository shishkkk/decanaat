'use client';
import {useState} from 'react';
import type {Lesson} from '@/lib/types';
import {Modal,ErrorMessage,api,useUi} from './ui';
import {useCampus} from './CampusContext';

export function LessonEditor({lesson,onClose}:{lesson:Lesson;onClose:()=>void}){
  const {t}=useUi();
  const {data,refresh}=useCampus();
  const [action,setAction]=useState('edit');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    const expected=JSON.stringify([lesson.starts,lesson.ends,lesson.building,lesson.room,lesson.change_kind,lesson.reason]);
    setBusy(true);setError('');
    try{
      await api('lessons/'+lesson.id,data.csrf,'PATCH',{...fields,action,expected});
      await refresh();
      onClose();
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <Modal title={t('Изменить занятие','Edit class')} onClose={onClose}>
    <p>{t(lesson.title,lesson.title_en)} · {lesson.group_name}</p>
    <form className="lesson-editor" onSubmit={submit}>
      <label>{t('Действие','Action')}<select value={action} onChange={e=>setAction(e.target.value)}>
        <option value="edit">{lesson.change_kind==='cancelled'?t('Вернуть в расписание','Restore class'):t('Изменить время или место','Change time or location')}</option>
        {lesson.change_kind!=='cancelled'&&<option value="cancel">{t('Отменить пару','Cancel class')}</option>}
      </select></label>
      {action==='edit'&&<>
        <label>{t('Начало · Москва','Start · Moscow time')}<input type="datetime-local" required name="start" defaultValue={lesson.starts.slice(0,16)}/></label>
        <label>{t('Окончание · Москва','End · Moscow time')}<input type="datetime-local" required name="end" defaultValue={lesson.ends.slice(0,16)}/></label>
        <div className="lesson-location"><label>{t('Корпус','Building')}<input required name="building" maxLength={50} defaultValue={lesson.building}/></label>
        <label>{t('Аудитория','Room')}<input required name="room" maxLength={40} defaultValue={lesson.room}/></label></div>
      </>}
      <label>{t('Причина для студентов','Reason shown to students')}<textarea required minLength={3} maxLength={300} name="reason" rows={2}/></label>
      <ErrorMessage code={error}/>
      <button className="button primary" disabled={busy}>{action==='cancel'?t('Подтвердить отмену','Confirm cancellation'):t('Сохранить занятие','Save class')}</button>
    </form>
  </Modal>;
}
