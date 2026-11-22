import {compare} from 'bcryptjs';
import {Database,userColumns} from './db';
import {token,fail,respond} from './support';
const sessionName='__Host-campus-session',csrfName='__Host-campus-csrf';
const utf8=new TextEncoder();
async function hash(text:string){const bytes=await crypto.subtle.digest('SHA-256',utf8.encode(text));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
function cookie(req:Request,name:string){return (req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(res:Response,name:string,value:string,maxAge=43200){res.headers.append('Set-Cookie',name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge);}
export function mutation(req:Request,known?:string){if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')fail(403,'csrf');const value=req.headers.get('x-csrf-token')||'';const expected=known??cookie(req,csrfName);if(!/^[a-f0-9]{64}$/.test(value)||value!==expected)fail(403,'csrf');}
export function csrfResponse(req:Request){const existing=cookie(req,csrfName);const csrf=/^[a-f0-9]{64}$/.test(existing)?existing:token();const res=respond({csrf,demo:true});setCookie(res,csrfName,csrf);return res;}
export async function rateLimit(db:Database,key:string,max:number,windowMs:number){
 const now=Date.now(),digest=await hash(key);
 const row=await db.one('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END WHERE reset_at<=? OR count<? RETURNING count',digest,now+windowMs,now,now,now,max);
 if(!row)fail(429,'rate_limited');
}
export async function identity(req:Request,db:Database){
 const raw=cookie(req,sessionName);if(!/^[a-f0-9]{64}$/.test(raw))fail(401,'unauthorized');
 const digest=await hash(raw);
 const sess=await db.one('SELECT user_id,csrf FROM sessions WHERE hash=? AND expires>?',digest,Date.now());
 if(!sess)fail(401,'unauthorized');const user=await db.one('SELECT '+userColumns+' FROM users WHERE id=? AND login_enabled=1',sess.user_id);
 if(!user)fail(401,'unauthorized');return {user,csrf:sess.csrf,digest};
}
const demos:Record<string,string>={alex:'student-alex',vera:'t-vera'};
export async function login(req:Request,db:Database,body:{login?:string;password?:string;demo?:string}){
 mutation(req);
 if(body.demo&&(body.login!==undefined||body.password!==undefined))fail(422,'invalid_input');
 if(body.demo)await rateLimit(db,'demo:'+body.demo,50,900000);
 let id;
 if(body.demo)id=demos[body.demo];
 else{const row=await db.one('SELECT id,password_hash FROM users WHERE login=? AND login_enabled=1',(body.login||'').toLowerCase());
 await rateLimit(db,'password:'+(row?.id??'unknown'),20,900000);
 const ok=await compare(body.password||'',row?.password_hash||'$2b$12$IlPauxVTD/v0.UqzQmu8t.22D05kqTbbY0wM4zy/lLTeOi6Zb6ATK');if(!ok||!row)fail(401,'invalid_credentials');id=row.id;}
 const user=await db.one('SELECT '+userColumns+' FROM users WHERE id=? AND login_enabled=1',id);if(!user)fail(401,'invalid_credentials');
 const raw=token(),csrf=token(),old=cookie(req,sessionName);
 const mutations=[db.statement('DELETE FROM sessions WHERE expires<?',Date.now()),db.statement('INSERT INTO sessions VALUES(?,?,?,?)',await hash(raw),user.id,csrf,Date.now()+43200000)];
 if(old)mutations.push(db.statement('DELETE FROM sessions WHERE hash=?',await hash(old)));
 if(user.role==='teacher')mutations.push(db.statement('UPDATE users SET last_seen_at=? WHERE id=?',new Date().toISOString(),user.id));
 await db.raw.batch(mutations);
 const res=respond({user,csrf});setCookie(res,sessionName,raw);setCookie(res,csrfName,csrf);return res;
}
export async function logout(req:Request,db:Database){const sess=await identity(req,db);mutation(req,sess.csrf);await db.run('DELETE FROM sessions WHERE hash=?',sess.digest);const res=respond({ok:true});setCookie(res,sessionName,'',0);setCookie(res,csrfName,'',0);return res;}
