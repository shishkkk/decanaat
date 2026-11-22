type Value=string|number|null;
export type OccupiedLesson={starts:string;ends:string;teacher_id:string;group_name:string;building:string;room:string};
export const termMarker='humanities-archive';
export function demoTerm(occupied:OccupiedLesson[],now=new Date()){
 const rows=new Map<string,Value[][]>(),user='student-alex',group='ИСТ-31',stamp=now.toISOString();
 function add(table:string,...values:Value[]){if(!rows.has(table))rows.set(table,[]);rows.get(table)!.push(values)}
 const monday=new Date(now.getTime()+10800000);monday.setUTCHours(0,0,0,0);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const date=(d:number)=>new Date(+monday+d*86400000).toISOString().slice(0,10);
 const at=(d:number,h:string)=>date(d)+'T'+h+':00+03:00';
 const subjects=[
 ['archive','Архивоведение','Archival Studies','t-vera','Вера Лебедева','Vera Lebedeva','exam'],
 ['museum','Музеология','Museum Studies','t-anna','Анна Петрова','Anna Petrova','graded'],
 ['city','История города','Urban History','t-vera','Вера Лебедева','Vera Lebedeva','coursework'],
 ['ethics','Этика исследования','Research Ethics','t-pavel','Павел Орлов','Pavel Orlov','pass'],
 ['media','История медиа','Media History','t-marina','Марина Белова','Marina Belova','exam'],
 ['heritage','Охрана культурного наследия','Heritage Conservation','t-olga','Ольга Синицына','Olga Sinitsyna','graded']];
 const topics=[['Опись архивного фонда','Finding aid'],['Каталог музейной коллекции','Collection catalogue'],['Карта городской памяти','City memory map'],['Согласие на интервью','Interview consent'],['Анализ газетного выпуска','Newspaper analysis'],['Паспорт памятника','Heritage inventory']];
 subjects.forEach(([key,ru,en,tid,tr,te,assessment],i)=>{
 const id='humanities-'+key;
 add('courses',id,user,ru,en,tid,tr,te,5,assessment,i===1?80:null,i===1?1:0,0,i%3+2);
 for(let h=0;h<3;h++)add('grade_history',id+'-mark-'+h,id,[topics[i][0],'Доклад на семинаре','Разбор источника'][h],[topics[i][1],'Seminar presentation','Source analysis'][h],[80,100,80,100,100][(i+h)%5],at(-25+i+h*6,'13:00'));
 add('exams',id,at(i===1?-5:23+i*2,'10:00'),String(401+i));
 add('tasks',id+'-task',user,topics[i][0],ru,date(7+i)+'T18:00',i===1?1:0);
 const chat=id+'-chat';add('conversations',chat,user,id);add('messages',chat+'-1',chat,'student','Можно использовать материалы семинара в работе «'+topics[i][0]+'»?',at(-3,'12:00'));add('messages',chat+'-2',chat,'teacher','Да. Укажите автора источника, дату и место хранения в списке литературы.',at(-3,'13:10'))
 });
 const slots=[['09:00','10:30'],['10:45','12:15'],['13:00','14:30'],['16:00','17:30']];
 for(let day=-7;day<42;day++){const weekday=(day+7)%7;if(weekday===6)continue;
 for(let slot=0;slot<(weekday===5?3:4);slot++){const starts=at(day,slots[slot][0]),ends=at(day,slots[slot][1]);const busy=occupied.filter(l=>l.starts<ends&&l.ends>starts);
 if(busy.some(l=>l.group_name===group))continue;
 const index=slot===3?(weekday%2?2:0):weekday===5&&slot===0?0:(day+14+slot)%6;
 const order=[...subjects.slice(index),...subjects.slice(0,index)];const subject=order.find(s=>!busy.some(l=>l.teacher_id===s[3]));if(!subject)continue;
 const room=String(410+slot);add('lessons','term-'+date(day)+'-'+slot,'humanities-'+subject[0],starts,ends,room,'В',['lecture','seminar','practice','seminar'][slot],null,null,null,null);
 if(Date.parse(ends)<+now){['student-alex','kira','ilya','anna','lev'].forEach((member,i)=>add('attendance_marks','term-'+date(day)+'-'+slot,member,(day+14+slot+i)%11===0?'late':(day+14+slot+i)%13===0?'excused':'present'))}
 }}
 const events=[
 ['Мастерская семейного архива','Family archive workshop','Принесите вымышленную семейную историю и составьте аннотированную опись.','Build an annotated inventory from a fictional family history.'],
 ['Экскурсия по городской типографии','Printing house tour','Проследим путь текста от набора до печати и сравним два выпуска газеты.','Trace the journey from typesetting to print and compare newspaper editions.'],
 ['Кураторская лаборатория','Curatorial lab','Подготовим этикетку экспоната и обсудим замысел небольшой выставки.','Write an exhibit label and develop a small exhibition concept.'],
 ['Дискуссия об этике интервью','Interview ethics forum','Обсудим анонимизацию интервью и право рассказчика на отзыв согласия.','Discuss anonymising interviews and withdrawing consent.']];
 events.forEach(([ru,en,body,bodyEn],i)=>{const id='term-event-'+i,when=at(7+i*3,'18:00');add('campus_events',id,ru,en,body,bodyEn,when,'Корпус В, зал '+(i+1),'Building C, hall '+(i+1));add('notifications',id+'-notice',user,ru,en,body,bodyEn,'event','/calendar',null,stamp)});
 const cases=[['academic','processing','Нужна выписка с оценками за предыдущий семестр.'],['official','accepted','Прошу подготовить бумажную справку с печатью.'],['military','ready','Прошу подготовить справку для воинского учёта.'],['extension','clarification','Прошу перенести сроки сдачи курсовой работы.']];
 cases.forEach(([service,status,body],i)=>{const id='term-request-'+i;const timeline=status==='accepted'?['created','accepted']:status==='ready'?['created','accepted','processing','ready']:['created','accepted',status];const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','').slice(0,16);
 add('requests',id,2301+i,user,service,i%2?'paper':'digital',body,status,timeline.length,at(-8+i,'10:00'),at(-8+i+timeline.length-1,'10:00'),token);
 timeline.forEach((s,j)=>add('request_history',id+'-'+j,id,s,s==='clarification'?'Уточните дату сдачи и название дисциплины.':s==='ready'?'Документ подготовлен.':'',j?'staff-elena':user,at(-8+i+j,'10:00')))});
 return [...rows].map(([table,values])=>({sql:'INSERT OR IGNORE INTO '+table+(table==='courses'?'(id,user_id,title,title_en,teacher_id,teacher,teacher_en,semester,assessment,grade,passed,debt,credits)':'')+' SELECT '+values[0].map((_,i)=>"json_extract(value,'$["+i+"]')").join(',')+' FROM json_each(?)',json:JSON.stringify(values)}))
}
