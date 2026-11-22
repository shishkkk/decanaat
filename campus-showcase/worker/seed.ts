import {demoTerm,termMarker,type OccupiedLesson} from '../shared/lib/demoTerm';
import {token} from './support';
import type {Database} from './db';
const demoHash="$2b$12$IlPauxVTD/v0.UqzQmu8t.22D05kqTbbY0wM4zy/lLTeOi6Zb6ATK";
export async function ensureSeed(db:Database) {
 await baseSeed(db);
 if(await db.one('SELECT id FROM courses WHERE id=?',termMarker))return;
 const busy=await db.all<OccupiedLesson>('SELECT l.starts,l.ends,l.room,l.building,c.teacher_id,u.group_name FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id');
 await db.raw.batch(demoTerm(busy).map(s=>db.statement(s.sql,s.json)));
}
async function baseSeed(db:Database) {
 if(await db.one("SELECT id FROM users WHERE id='student-alex'")) return;
 const groups=new Map<string,{table:string;columns:string;rows:unknown[][]}>();
 function insert(statement:string,...args:unknown[]) {
   const parts=/^INSERT INTO (\w+)(\([^)]*\))? VALUES\(/.exec(statement);
   if(!parts) throw new Error('Invalid seed statement');
   const group=groups.get(statement)??{table:parts[1],columns:parts[2]||'',rows:[]};
   group.rows.push(args);groups.set(statement,group);
 }
 insert('INSERT INTO users(id,login,password_hash,role,name,name_en,faculty,faculty_en) VALUES(?,?,?,?,?,?,?,?)','t-vera','vera',demoHash,'teacher','Вера Лебедева','Vera Lebedeva','Истории и культуры','History and Culture');
 const now=new Date();const stamp=now.toISOString();
 const moscow=new Date(now.getTime()+3*3600000); const monday=new Date(Date.UTC(moscow.getUTCFullYear(),moscow.getUTCMonth(),moscow.getUTCDate()));monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const date=(offset:number)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
 const password=demoHash;

 const users=[['student-alex','alex','student','Александр Миронов','Alexander Mironov','ИСТ-31','Истории и культуры','History and Culture','История и культурное наследие','History and Cultural Heritage',3,2024,'budget','DEMO-240031'],['student-max','max','student','Максим Волков','Maxim Volkov','ФИЛ-11','Филологии и коммуникаций','Philology and Communication','Филология и межкультурная коммуникация','Philology and Intercultural Communication',1,2026,'contract','DEMO-260011'],['staff-elena','elena','staff','Елена Соколова','Elena Sokolova','','Деканат','Dean’s Office','Специалист деканата','Student Affairs Specialist',0,0,'','']];
 for(const u of users)insert('INSERT INTO users(id,login,role,name,name_en,group_name,faculty,faculty_en,program,program_en,year,admission,funding,student_no,password_hash,email,avatar,login_enabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',...u,password,String(u[1])+'@campus.example',u[1]==='max'?'gold':'ink',u[1]==='alex'?1:0);
 const sets=[[
 ['История мировой культуры','World Cultural History','t-vera','Вера Лебедева','Vera Lebedeva','exam',100,1,0,4],
 ['Философия','Philosophy','t-anna','Анна Петрова','Anna Petrova','exam',100,1,0,4],
 ['Источниковедение','Historical Sources','t-pavel','Павел Орлов','Pavel Orlov','graded',80,1,0,3],
 ['История России','Russian History','t-olga','Ольга Синицына','Olga Sinitsyna','coursework',100,1,0,5],
 ['Академическое письмо','Academic Writing','t-marina','Марина Белова','Marina Belova','pass',null,0,0,2]],[
 ['Введение в языкознание','Introduction to Linguistics','t-marina','Марина Белова','Marina Belova','exam',40,0,1,4],
 ['История литературы','History of Literature','t-vera','Вера Лебедева','Vera Lebedeva','exam',80,1,0,4],
 ['Культура речи','Speech Culture','t-anna','Анна Петрова','Anna Petrova','graded',60,1,0,3],
 ['Иностранный язык','Foreign Language','t-olga','Ольга Синицына','Olga Sinitsyna','pass',null,1,0,3],
 ['Введение в специальность','Introduction to the Profession','t-pavel','Павел Орлов','Pavel Orlov','coursework',null,0,0,2]]];
 for(let s=0;s<2;s++){
 const uid=String(users[s][0]);const semester=s===0?5:1;
 for(let c=0;c<sets[s].length;c++){
 const values=sets[s][c];const cid=uid+'-c'+c;
 insert('INSERT INTO courses(id,user_id,title,title_en,teacher_id,teacher,teacher_en,semester,assessment,grade,passed,debt,credits) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',cid,uid,...values.slice(0,5),semester,...values.slice(5));
 for(let h=0;h<3;h++)insert('INSERT INTO grade_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),cid,['Семинар','Эссе','Коллоквиум'][h],['Seminar','Essay','Colloquium'][h],s===0?(c===2&&h===1?80:100):[60,80,40][(h+c)%3],new Date(now.getTime()-(21-h*7)*86400000).toISOString());
 if(s===0)insert('INSERT INTO courses(id,user_id,title,title_en,teacher_id,teacher,teacher_en,semester,assessment,grade,passed,debt,credits) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',cid+'-prev',uid,...values.slice(0,5),4,...values.slice(5,6),c===4?null:100,1,0,Number(values[9]));
 }
 for(let offset=-7;offset<21;offset++){
 if((offset+28)%7>4)continue;
 for(let slot=0;slot<3;slot++){
 const c=(offset+28+slot+s)%5;const start=[s===0?'09:00':'10:15',s===0?'10:45':'12:00',s===0?'13:00':'14:15'][slot];const end=[s===0?'10:30':'11:45',s===0?'12:15':'13:30',s===0?'14:30':'15:45'][slot];
 const changed=slot===1&&(offset+28)%7===0;const cancelled=slot===2&&(offset+28)%7===3;const moved=slot===0&&(offset+28)%7===2;
 insert('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),uid+'-c'+c,date(offset)+'T'+start+':00+03:00',date(offset)+'T'+end+':00+03:00',changed?'304':String(201+slot+s*10),s===0?'А':'Б',['lecture','seminar','practice'][slot],cancelled?'cancelled':changed?'room':moved?'moved':null,cancelled?'Преподаватель на конференции':changed?'Замена аудитории из-за оборудования':moved?'Перенос с пятницы':null,cancelled?'Teacher attending a conference':changed?'Room changed for equipment':moved?'Moved from Friday':null,changed?'212':null);
 }
 }
 const rid='request-'+(s===0?'alex':'max');
 insert('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?)',rid,2401+s,uid,s===0?'study':'retake',s===0?'digital':'paper',s===0?'Прошу подготовить справку об обучении для предоставления по месту требования.':'Прошу назначить дату пересдачи по введению в языкознание.',s===0?'ready':'clarification',1,stamp,stamp,token(24));
 for(const status of ['created','accepted',s===0?'ready':'clarification'])insert('INSERT INTO request_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),rid,status,status==='ready'?'Демонстрационная справка готова. Без юридической силы.':status==='clarification'?'Уточните удобную дату пересдачи.':'Заявка зарегистрирована',status==='created'?uid:'staff-elena',stamp);
 const notices=[['Изменение расписания','Schedule update','В понедельник семинар пройдёт в аудитории 304.','Monday seminar will take place in room 304.','schedule','/schedule'],['Новая оценка','New grade','В журнале появились результаты коллоквиума.','Colloquium results are available.','grade','/grades'],['Стипендиальная комиссия','Scholarship committee','Приём заявлений открыт. Все сведения в прототипе вымышлены.','Applications are open. All prototype information is fictional.','announcement','/requests/new?type=aid'],['Ближайшее задание','Upcoming task',s===0?'Подготовьте эссе по истории культуры.':'Повторите темы по языкознанию перед пересдачей.',s===0?'Prepare an essay on cultural history.':'Revise linguistics before your retake.','deadline','/notes'],['Статус обращения обновлён','Request status updated',s===0?'Справка готова к просмотру.':'По заявке требуется уточнение.',s===0?'Your certificate is ready to preview.':'Your request needs clarification.','request','/requests/'+rid],['Открытая лекция','Open lecture','В пятницу в 17:00 — обсуждение литературы и памяти. Корпус А, зал 1.','Friday at 17:00: literature and memory. Building A, hall 1.','event','/calendar']];
 for(const n of notices)insert('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),uid,...n,null,stamp);
 for(let t=0;t<4;t++)insert('INSERT INTO tasks VALUES(?,?,?,?,?,?)',crypto.randomUUID(),uid,(s===0?['Написать эссе о культуре','Прочитать первоисточник','Подготовить доклад','Отправить конспект']:['Повторить фонетику','Прочитать рассказ','Выписать термины','Подготовить презентацию'])[t],String(sets[s][t][0]),date(Math.max(0,(moscow.getUTCDay()+6)%7)+t)+'T18:00',t>1?1:0);
 insert('INSERT INTO reflections VALUES(?,?,?,?,?)',crypto.randomUUID(),uid,'Сегодня удалось разобраться в сложной теме. Хочу оставить больше времени на чтение.','mixed',stamp);
 for(let c=0;c<5;c++){const chat=uid+'-chat'+c;insert('INSERT INTO conversations VALUES(?,?,?)',chat,uid,uid+'-c'+c);insert('INSERT INTO messages VALUES(?,?,?,?,?)',crypto.randomUUID(),chat,'teacher','Это пример переписки. Можно сохранить вопрос и приложить учебный файл; реальные преподаватели к прототипу не подключены.',stamp);}
 }

 const starts=(after:number,time:string)=>date(after)+'T'+time+':00+03:00';
    insert('INSERT INTO campus_events VALUES(?,?,?,?,?,?,?,?)','literature-memory','Литература и память','Literature and memory',
      'Открытая лекция о том, как письма и дневники становятся литературой.','An open lecture on how letters and diaries become literature.',
      starts(4,'17:00'),'Корпус А, зал 1','Building A, hall 1');
    insert('INSERT INTO campus_events VALUES(?,?,?,?,?,?,?,?)','archive-lab','Лаборатория устной истории','Oral history workshop',
      'Разберём фрагменты интервью и составим вопросы для собственного исследования.','Analyse interview excerpts and prepare questions for your own study.',
      starts(10,'16:00'),'Библиотека, зал 2','Library, room 2');
    insert('INSERT INTO campus_events VALUES(?,?,?,?,?,?,?,?)','debate-club','Клуб университетских дебатов','Campus debate club',
      'Практикум по аргументации для студентов всех направлений.','An argumentation workshop for students of all programmes.',
      starts(17,'18:00'),'Корпус Б, ауд. 203','Building B, room 203');
 const examCourses=[['student-alex-c0',true],['student-alex-c1',true],['student-max-c0',false],['student-max-c1',true]] as const;
 examCourses.forEach(([id,passed],i)=>insert('INSERT INTO exams VALUES(?,?,?)',id,starts(passed?-7+i:14+i,'10:00'),String(301+i)));
 const statements=[db.statement("INSERT INTO campus_revision(id,rev) VALUES (1,0)")];
 for (const {table,columns,rows} of groups.values()){
   const fields=rows[0].map((_,i)=>"json_extract(value,'$["+i+"]')").join(',');
   statements.push(db.statement("INSERT INTO "+table+columns+" SELECT "+fields+" FROM json_each(?)",JSON.stringify(rows)));
 }
 try{await db.raw.batch(statements)}catch(error){
   if(!await db.one("SELECT id FROM users WHERE id='student-alex'")) throw error;
 }
}
