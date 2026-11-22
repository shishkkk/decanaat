'use client';
import { MessageCircle } from 'lucide-react';
import { useCampus } from './CampusContext';
import { useUi, Empty } from './ui';

export function Teaching() {
  const { data, openChat } = useCampus();
  const { t } = useUi();
  return <>
    <div className="page-heading">
      <p>{t('Кабинет преподавателя','Teacher workspace')}</p>
      <h1>{t('Учебные диалоги','Course conversations')}</h1>
      <p>{t(data.user.name,data.user.name_en)}</p>
    </div>
    {data.teaching.length === 0 && <Empty>{t('Пока нет назначенных дисциплин.','No assigned courses yet.')}</Empty>}
    {data.teaching.map(thread => <article className="course-row" key={thread.id}>
      <div><h3>{t(thread.title,thread.title_en)}</h3>
        <p>{t(thread.student,thread.student_en)} · {thread.group_name}</p>
        <small>{t('Семестр','Semester')} {thread.semester}</small></div>
      <button className="icon-button" onClick={() => openChat(thread.id)}
        aria-label={t('Открыть диалог','Open conversation')+' · '+t(thread.student,thread.student_en)+' · '+t(thread.title,thread.title_en)}>
        <MessageCircle size={20}/>
      </button>
    </article>)}
  </>;
}
