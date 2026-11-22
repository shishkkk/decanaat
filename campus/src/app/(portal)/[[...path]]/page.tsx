import {cookies} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {lookupSession,sessionName} from '@/server/auth';
import {one,userColumns} from '@/server/db';
import {bootstrap,requestDetail} from '@/server/queries';
import type {User} from '@/lib/types';
import {CampusApp} from '@/components/CampusApp';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){const session=lookupSession((await cookies()).get(sessionName())?.value);if(!session)redirect('/login');const user=one<User>('SELECT '+userColumns+' FROM users WHERE id=?',session.user_id);if(!user)redirect('/login');const path=(await params).path||[];const section=path[0]||'';if(user.role==='teacher'&&!['teaching','attendance','schedule','profile','notifications'].includes(section))redirect('/teaching');if(['attendance','teaching'].includes(section)&&user.role!=='teacher')notFound();if(!['','teaching','attendance','schedule','grades','requests','notes','profile','notifications','calendar','courses','office'].includes(section)||path.length>2)notFound();if(user.role==='staff'&&!['office','profile','notifications'].includes(section))redirect('/office');if(user.role==='student'&&section==='office')notFound();if(['requests','office'].includes(section)&&path[1]&&path[1]!=='new'){try{requestDetail(user,path[1]);}catch{notFound();}}if(section==='courses'&&(!path[1]||!one('SELECT id FROM courses WHERE id=? AND user_id=?',path[1],user.id)))notFound();if(path[1]&&!['requests','office','courses'].includes(section))notFound();return <CampusApp initial={bootstrap(user,session.csrf)} route={'/'+path.join('/')}/>;}
