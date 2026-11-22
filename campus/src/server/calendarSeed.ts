import type {DatabaseSync} from 'node:sqlite';

export function seedCalendar(db:DatabaseSync) {
  if(db.prepare('SELECT id FROM campus_events LIMIT 1').get())return;
  const monday=new Date(Date.now()+3*3600_000);
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  function starts(after:number,time:string) {
    const date=new Date(monday);
    date.setUTCDate(date.getUTCDate()+after);
    return date.toISOString().slice(0,10)+'T'+time+':00+03:00';
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const event=db.prepare('INSERT OR IGNORE INTO campus_events VALUES(?,?,?,?,?,?,?,?)');
    event.run('literature-memory','Литература и память','Literature and memory',
      'Открытая лекция о том, как письма и дневники становятся литературой.','An open lecture on how letters and diaries become literature.',
      starts(4,'17:00'),'Корпус А, зал 1','Building A, hall 1');
    event.run('archive-lab','Лаборатория устной истории','Oral history workshop',
      'Разберём фрагменты интервью и составим вопросы для собственного исследования.','Analyse interview excerpts and prepare questions for your own study.',
      starts(10,'16:00'),'Библиотека, зал 2','Library, room 2');
    event.run('debate-club','Клуб университетских дебатов','Campus debate club',
      'Практикум по аргументации для студентов всех направлений.','An argumentation workshop for students of all programmes.',
      starts(17,'18:00'),'Корпус Б, ауд. 203','Building B, room 203');
    const exams=db.prepare("SELECT c.id,c.passed,c.debt FROM courses c WHERE c.assessment='exam' AND c.semester=(SELECT MAX(c2.semester) FROM courses c2 WHERE c2.user_id=c.user_id) ORDER BY c.id").all();
    const exam=db.prepare('INSERT OR IGNORE INTO exams VALUES(?,?,?)');
    exams.forEach((course,i)=>exam.run(course.id,starts(course.passed ? -7+i : 14+i,'10:00'),String(301+i)));
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
