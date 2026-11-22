import {demoTerm,termMarker,type OccupiedLesson} from '../lib/demoTerm';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {seed} from './seed';
import {seedCalendar} from './calendarSeed';
const state=globalThis as unknown as {campusDb?:DatabaseSync};
export const demoEnabled=()=> process.env.DEMO_MODE==='true'||(process.env.NODE_ENV!=='production'&&process.env.DEMO_MODE!=='false');
export function db() {
 if(!state.campusDb){
 const file=resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH||'data/campus.sqlite');mkdirSync(dirname(file),{recursive:true});
 const connection=new DatabaseSync(file);connection.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 connection.exec(readFileSync(resolve('migrations/001_initial.sql'),'utf8'));
 connection.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
 try {
   if (!connection.prepare('SELECT 1 FROM migrations WHERE version=2').get()) {
     connection.exec(readFileSync(resolve('migrations/002_teacher.sql'),'utf8'));
     if (connection.prepare('PRAGMA foreign_key_check').get()) throw new Error('Invalid course references');
   }
   if (!connection.prepare('SELECT 1 FROM migrations WHERE version=3').get()) {
     connection.exec(readFileSync(resolve('migrations/003_calendar.sql'),'utf8'));
   }
   if (!connection.prepare('SELECT 1 FROM migrations WHERE version=4').get()) connection.exec(readFileSync(resolve('migrations/004_attendance.sql'),'utf8'));
   if (!connection.prepare('SELECT 1 FROM migrations WHERE version=5').get()) connection.exec(readFileSync(resolve('migrations/005_profile.sql'),'utf8'));
   if (!connection.prepare('SELECT 1 FROM migrations WHERE version=6').get()) connection.exec(readFileSync(resolve('migrations/006_grade_points.sql'),'utf8'));
   connection.exec('COMMIT');
 } catch (error) {
   connection.exec('ROLLBACK');
   throw error;
 } finally {
   connection.exec('PRAGMA foreign_keys=ON');
 }
 if(demoEnabled()){seed(connection);seedCalendar(connection);
 if(!connection.prepare("SELECT id FROM courses WHERE id=?").get(termMarker)){
 const busy=connection.prepare("SELECT l.starts,l.ends,l.room,l.building,c.teacher_id,u.group_name FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id").all() as unknown as OccupiedLesson[];
 connection.exec("BEGIN IMMEDIATE");try{for(const entry of demoTerm(busy))connection.prepare(entry.sql).run(entry.json);connection.exec("COMMIT")}catch(e){connection.exec("ROLLBACK");throw e}
 }}
 state.campusDb=connection;
 }
 return state.campusDb;
}
export function all<T>(sql:string,...values:SQLInputValue[]):T[]{return db().prepare(sql).all(...values).map(row=>({...row})) as T[];}
export function one<T>(sql:string,...values:SQLInputValue[]):T|undefined{const row=db().prepare(sql).get(...values);return row?{...row} as T:undefined;}
export function run(sql:string,...values:SQLInputValue[]){return db().prepare(sql).run(...values);}
export function transaction<T>(action:()=>T):T {db().exec('BEGIN IMMEDIATE');try{const result=action();db().exec('COMMIT');return result;}catch(error){db().exec('ROLLBACK');throw error;}}
export const userColumns='id,login,role,name,name_en,group_name,faculty,faculty_en,program,program_en,year,admission,funding,student_no,email,phone,avatar';
