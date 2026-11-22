'use client';
import Link from 'next/link';
import {ChevronRight,FileText,Download} from 'lucide-react';
import {useCampus} from './CampusContext';
import {Badge,useLabels,useUi} from './ui';
import {dateLabel} from '@/lib/format';

export function StudentDocuments({openTab}:{openTab:(tab:string)=>void}){
 const {data}=useCampus(),{t,locale}=useUi(),labels=useLabels(),u=data.user;
 const name=t(u.name,u.name_en),id=u.student_no,year=u.admission;
 const records=[
  [t('Паспорт','Passport'),t('Владелец','Holder')+' · '+name,t('Номер образца','Sample ID')+' · DEMO-PAS-'+id],
  [t('СНИЛС','Pension insurance number'),name,'DEMO-SNILS-'+id],
  [t('ИНН','Taxpayer identification number'),name,'DEMO-INN-'+id],
  [t('Документ о предыдущем образовании','Prior education certificate'),t('Аттестат о среднем общем образовании','Secondary school certificate'),t('Год выдачи','Year issued')+' · '+year+' · DEMO-EDU-'+id],
  [t('Выписка из приказа о зачислении','Enrolment order extract'),t(u.program,u.program_en),year+' · '+u.group_name+' · DEMO-ORD-'+id],
  [t('Согласие на обработку персональных данных','Personal data processing consent'),name,t('Демонстрационный экземпляр личного дела','Sample for the student file')],
  ...(u.funding==='budget'?[]:[[t('Договор об обучении','Tuition agreement'),t(u.program,u.program_en),'DEMO-CONTRACT-'+id]])
 ];
 const certificates=new Set(['study','official','military','academic']);
 const requests=data.requests.filter(r=>certificates.has(r.type)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 return <div className="student-docs"><h2>{t('Мои документы','My documents')}</h2><p>{t('Личное дело и документы деканата. Все реквизиты в прототипе вымышлены.','Student file and university documents. All details in this prototype are fictional.')}</p>
 <div className="doc-columns"><section><h3>{t('Личное дело','Student file')}</h3>{records.map(([label,line,detail])=><details key={label}><summary><FileText size={19}/>{label}<ChevronRight size={16}/></summary><div><p>{line}</p><small>{detail}</small></div></details>)}
 <details><summary><FileText size={19}/>{t('Документы по обстоятельствам','Case-specific documents')}<ChevronRight size={16}/></summary><div><p>{t('Воинский учёт, миграционный учёт, смена фамилии, основания для льгот или академического отпуска. В демодосье эти документы отсутствуют.','Military or migration registration, name change, benefits or academic leave. This demo file contains none of these records.')}</p><Link href="/requests/new?type=question">{t('Уточнить комплект в деканате','Ask which documents to provide')} →</Link></div></details></section>
 <section><h3>{t('Учебные документы','Academic records')}</h3>{[['pass',t('Студенческий билет и QR-пропуск','Student ID and QR pass')],['book',t('Зачётная книжка','Gradebook')],['plan',t('Мой учебный план','My curriculum')]].map(([key,label])=><button className="doc-link" key={key} onClick={()=>openTab(key)}><FileText size={19}/>{label}<ChevronRight size={16}/></button>)}
 <h3>{t('Справки деканата','Certificates')}</h3>{requests.map(r=><article className="doc-request" key={r.id}><Link href={'/requests/'+r.id}><strong>{labels.service(r.type)}</strong><small>№ {r.number} · {dateLabel(r.created_at,locale)}</small><Badge status={r.status}/></Link>{r.status==='ready'&&r.delivery==='digital'&&<a className="text-button" href={'/api/requests/'+r.id+'/document?format=pdf'}><Download size={16}/>{t('Скачать PDF','Download PDF')}</a>}</article>)}{!requests.length&&<p>{t('Заказанные справки появятся здесь.','Requested certificates will appear here.')}</p>}<Link className="button primary" href="/requests/new?type=study">{t('Заказать справку','Request a certificate')}</Link><Link className="text-button" href="/requests">{t('Все мои обращения','All my requests')} →</Link></section></div></div>
}