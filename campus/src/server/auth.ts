import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {compare} from 'bcryptjs';
import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {one,run,userColumns,demoEnabled} from './db';
import type {User} from '../lib/types';
export class HttpError extends Error {constructor(public status:number,public code:string){super(code);}}
export function fail(status:number,code:string):never {throw new HttpError(status,code);}
const secure=()=>process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='false';
export const sessionName=()=>secure()?'__Host-campus-session':'campus-session';
const csrfName=()=>secure()?'__Host-campus-csrf':'campus-csrf';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function lookupSession(token:string|undefined){if(!token||!/^[a-f0-9]{64}$/.test(token))return undefined;return one<{user_id:string;csrf:string;expires:number}>('SELECT user_id,csrf,expires FROM sessions WHERE hash=? AND expires>? AND user_id IN (SELECT id FROM users WHERE login_enabled=1)',hash(token),Date.now());}
export function identity(req:NextRequest){const session=lookupSession(req.cookies.get(sessionName())?.value);if(!session)return fail(401,'unauthorized');const user=one<User>('SELECT '+userColumns+' FROM users WHERE id=?',session.user_id);if(!user)return fail(401,'unauthorized');return {user,csrf:session.csrf};}
export function requireStudent(user:User){if(user.role!=='student')fail(403,'forbidden');}
export function requireStaff(user:User){if(user.role!=='staff')fail(403,'forbidden');}
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function checkMutation(req:NextRequest,csrf?:string){
 const origin=req.headers.get('origin'); const expected=process.env.APP_ORIGIN||new URL(req.url).origin;
 if(!origin||origin!==expected)fail(403,'csrf');
 if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'csrf');
 const sent=req.headers.get('x-csrf-token')||'';const stored=csrf||req.cookies.get(csrfName())?.value||'';
 if(!/^[a-f0-9]{64}$/.test(sent)||!same(sent,stored))fail(403,'csrf');
}
export function rateLimit(key:string,limit:number,windowMs:number){const k=hash(key);const now=Date.now();run('DELETE FROM rate_limits WHERE reset_at<?',now);const row=one<{count:number}>('SELECT count FROM rate_limits WHERE key=?',k);if(row&&row.count>=limit)fail(429,'rate_limited');run('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',k,now+windowMs);}
export function csrfResponse(req:NextRequest){const token=req.cookies.get(csrfName())?.value;const csrf=token&&/^[a-f0-9]{64}$/.test(token)?token:randomBytes(32).toString('hex');const res=NextResponse.json({csrf,demo:demoEnabled()});res.cookies.set(csrfName(),csrf,{httpOnly:true,secure:secure(),sameSite:'lax',path:'/',maxAge:43200});return res;}
export async function signIn(req:NextRequest,body:{login?:string;password?:string;demo?:string}){
 checkMutation(req);
 if(body.demo&&(body.login!==undefined||body.password!==undefined))fail(422,'invalid_input');
 if(body.demo)rateLimit('demo:'+body.demo,20,15*60000);
 let id:string|undefined;
 if(body.demo){if(!demoEnabled())fail(403,'demo_disabled');const map:Record<string,string>={alex:'student-alex',vera:'t-vera'};id=map[body.demo];if(!id)fail(400,'invalid_input');}
 else {const row=one<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE login=? AND login_enabled=1',(body.login||'').toLowerCase());rateLimit('password:'+(row?.id??'unknown'),20,15*60000);const valid=await compare(body.password||'',row?.password_hash||'$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxkH6/IOEfQHuCGhAcXxpbLnYOu');if(!row||!valid)fail(401,'invalid_credentials');id=row.id;}
 const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
 const old=req.cookies.get(sessionName())?.value;if(old)run('DELETE FROM sessions WHERE hash=?',hash(old));
 run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),id!,csrf,Date.now()+43200000);
 const user=one<User>('SELECT '+userColumns+' FROM users WHERE id=?',id!);
 const res=NextResponse.json({user,csrf});res.cookies.set(sessionName(),token,{httpOnly:true,secure:secure(),sameSite:'lax',path:'/',maxAge:43200});res.cookies.set(csrfName(),csrf,{httpOnly:true,secure:secure(),sameSite:'lax',path:'/',maxAge:43200});return res;
}
export function signOut(req:NextRequest){const {csrf}=identity(req);checkMutation(req,csrf);run('DELETE FROM sessions WHERE hash=?',hash(req.cookies.get(sessionName())!.value));const res=NextResponse.json({ok:true});res.cookies.set(sessionName(),'',{httpOnly:true,secure:secure(),sameSite:'lax',path:'/',maxAge:0});return res;}
