import {fail} from './support';
export type Statement = {
 bind(...args:unknown[]):Statement;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run():Promise<{meta:{changes:number}}>;
};
export type Binding={prepare(sql:string):Statement;batch(stmts:Statement[]):Promise<unknown[]>};
export class Database {
 constructor(readonly raw:Binding){}
 statement=(sql:string,...args:unknown[])=>args.length?this.raw.prepare(sql).bind(...args):this.raw.prepare(sql);
 all=async<T=any>(sql:string,...args:unknown[]) => (await this.statement(sql,...args).all<T>()).results;
 one=async<T=any>(sql:string,...args:unknown[]) => (await this.statement(sql,...args).first<T>())??undefined;
 run=async(sql:string,...args:unknown[]) => (await this.statement(sql,...args).run()).meta;
 // A D1 batch commits or rolls back the entire edit. Optimistic revision protects
 // cross-row decisions (request transitions and timetable conflicts) between reads and commit.
 revision=async()=> (await this.one('SELECT rev FROM campus_revision WHERE id=1')).rev as number;
 commit=async(revision:number,statements:Statement[])=>{
   const guard=this.statement('UPDATE campus_revision SET rev=CASE WHEN rev=? THEN rev+1 ELSE -1 END WHERE id=1',revision);
   try{await this.raw.batch([guard,...statements]);}
   catch(error){if((await this.revision())!==revision)fail(409,'conflict');throw error;}
 };
}
export const userColumns='id,login,role,name,name_en,group_name,faculty,faculty_en,program,program_en,year,admission,funding,student_no,email,phone,avatar';
