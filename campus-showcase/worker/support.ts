export class HttpError extends Error {constructor(public status:number,public code:string){super(code);}}
export function fail(status:number,code:string):never{throw new HttpError(status,code);}
export function token(bytes=32){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export const requireStudent=(user:{role:string})=>{if(user.role!=='student')fail(403,'forbidden');};
export const requireStaff=(user:{role:string})=>{if(user.role!=='staff')fail(403,'forbidden');};
export async function readBytes(req:Request,limit:number){
 if(Number(req.headers.get('content-length'))>limit)fail(413,'too_large');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array(0);
 const chunks:Uint8Array[]=[];let total=0;
 for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;
 if(total>limit){await reader.cancel();fail(413,'too_large');}chunks.push(value);}
 const out=new Uint8Array(total);let i=0;for(const c of chunks){out.set(c,i);i+=c.length;}return out;
}
export async function json(req:Request){const bytes=await readBytes(req,20000);try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return fail(400,'invalid_input');}}
export const respond=(value:unknown,status=200)=>Response.json(value,{status});
