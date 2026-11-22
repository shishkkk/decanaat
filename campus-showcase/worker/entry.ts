import {token} from './support';
import {api} from './api';
import script from '../generated/browser.txt';
import styles from '../generated/styles.txt';

const common = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
function page(state:unknown,status=200){
 const nonce=token(18);
 const initial=JSON.stringify(state).replace(/</g,'\\u003c');
 const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>CAMPUS — Цифровой деканат</title><link rel="stylesheet" href="/campus.css"></head><body><div id="app"></div><noscript>Для работы кабинета включите JavaScript.</noscript><script type="application/json" id="initial">'+initial+'</script><script nonce="'+nonce+'" src="/campus.js" defer></script></body></html>';
 return new Response(html,{status,headers:{...common,'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+nonce+"'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}});
}
export default {
 async fetch(request:Request,env:any){
   const url=new URL(request.url),path=url.pathname;
   const internal=(endpoint:string)=>api(new Request(new URL(endpoint,url.origin),{headers:request.headers}),env);
   if(path.startsWith('/api/'))return api(request,env);
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
   if(path==='/campus.js'||path==='/campus.css')return new Response(path.endsWith('.js')?script:styles,{headers:{...common,'Content-Type':path.endsWith('.js')?'application/javascript':'text/css','Cache-Control':'no-cache'}});
   const redirect=(p:string)=>Response.redirect(new URL(p,url.origin).href,307);
   const missing=()=>page({screen:'missing'},404);
   if(path==='/login')return page({screen:'login'});
   if(path==='/index.html')return redirect('/');
   if(path.startsWith('/verify/')){
     if(!/^\/verify\/[a-f0-9]{48}$/.test(path))return missing();
     const res=await internal('/api'+path);
     return res.ok?page({screen:'verify',record:await res.json()}):missing();
   }
   if(path==='/favicon.ico')return new Response(null,{status:204});
   const session=await internal('/api/me');
   if(session.status===401)return redirect('/login');
   if(!session.ok)return new Response('Кабинет временно недоступен',{status:503});
   const data=await session.json() as any;
   const [section,id,extra]=path.slice(1).split('/');
   const allowed:Record<string,string[]>={teacher:['teaching','attendance','schedule','profile','notifications'],staff:['office','profile','notifications'],student:['','schedule','grades','requests','notes','profile','notifications','calendar','courses']};
   if(!section&&data.user.role!=='student')return redirect(data.user.role==='teacher'?'/teaching':'/office');
   if(extra!==undefined||!allowed[data.user.role]?.includes(section))return missing();
   if(section==='courses'&&!data.courses.some((v:any)=>v.id===id))return missing();
   if(id&&section!=='courses'&&(!(section==='requests'||section==='office')||!(section==='requests'&&id==='new')&&!data.requests.some((v:any)=>v.id===id)))return missing();
   return page({screen:'portal',data});
 }
};
