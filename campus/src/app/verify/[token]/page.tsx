import {notFound} from 'next/navigation';
import {one} from '@/server/db';
import {Verification} from '@/components/Verification';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;if(!/^[a-f0-9]{48}$/.test(token))notFound();const record=one<{number:number;updated_at:string}>('SELECT number,updated_at FROM requests WHERE verification=? AND status=? AND delivery=?',token,'ready','digital');if(!record)notFound();return <Verification record={record}/>;}
