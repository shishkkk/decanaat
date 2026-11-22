// Local launcher for the editable HTML client and its persistent SQLite database.
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import worker from './backend.mjs';
import {fileURLToPath} from 'node:url';
const localFile=name=>fileURLToPath(new URL(name,import.meta.url));
const html=readFileSync(localFile('index.html'),'utf8');

const sql=new DatabaseSync(process.env.CAMPUS_DATABASE||localFile('campus.sqlite'));
sql.exec('PRAGMA foreign_keys=ON');
sql.exec('CREATE TABLE IF NOT EXISTS portable_migrations(file TEXT PRIMARY KEY)');
for(const file of readdirSync(localFile('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 if(sql.prepare('SELECT 1 FROM portable_migrations WHERE file=?').get(file))continue;
 sql.exec('BEGIN IMMEDIATE');
 try{sql.exec(readFileSync(localFile('drizzle/'+file),'utf8').replaceAll('--> statement-breakpoint',''));sql.prepare('INSERT INTO portable_migrations VALUES(?)').run(file);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}
}
function statement(query,values=[]){
 const params=values.map(v=>Array.isArray(v)?new Uint8Array(v):v instanceof ArrayBuffer?new Uint8Array(v):v);
 const invoke=()=>{
   const started=performance.now(),q=sql.prepare(query);
   let results=[],changes=0;
   if(q.columns().length)results=q.all(...params);else changes=Number(q.run(...params).changes);
   results=results.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Uint8Array?Array.from(v):v])));
   return {success:true,results,meta:{changes,duration:performance.now()-started}};
 };
 return {invoke,bind:(...args)=>statement(query,args),all:async()=>invoke(),run:async()=>invoke(),first:async col=>{const row=invoke().results[0];return col?row?.[col]??null:row??null;},raw:async()=>invoke().results.map(Object.values)};
}
const DB={prepare:statement,withSession(){return this;},exec:async text=>sql.exec(text),batch:async qs=>{
 sql.exec('BEGIN IMMEDIATE');
 try{const result=qs.map(q=>q.invoke());sql.exec('COMMIT');return result;}
 catch(e){sql.exec('ROLLBACK');throw e;}
}};
const primaryPort=Number(process.env.PORT||3048);
let port=primaryPort;
const version=createHash('sha256').update(html).update(readFileSync(localFile('backend.mjs'))).digest('hex');
function opened(){const address='http://127.0.0.1:'+port+'/index.html';console.log('CAMPUS '+address);if(process.platform==='win32'&&process.argv.includes('--open'))spawn('explorer.exe',[address],{stdio:'ignore',windowsHide:true}).unref()}
const server=createServer(async(req,res)=>{
 try{
   const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2)headers.append(req.rawHeaders[i],req.rawHeaders[i+1]);
   if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);return res.end()}
   if(req.url==='/campus-version'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});return res.end(version)}
   const body=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2200000){res.writeHead(413);return res.end()}body.push(chunk)}
   const request=new Request('http://127.0.0.1:'+port+(req.url==='/index.html'?'/login':req.url),{method:req.method,headers,body:body.length?Buffer.concat(body):undefined});
   const response=await worker.fetch(request,{DB},{waitUntil(p){p.catch(console.error);}});
   if(response.headers.get('content-type')?.startsWith('text/html')){
     const state=(await response.text()).match(/<script type="application\/json" id="initial">([\s\S]*?)<\/script>/)?.[1];
     if(!state)throw new Error('Invalid page state');
     const nonce=randomBytes(18).toString('base64');
     const page=html.replace('{"screen":"login"}</script>',()=>state+'</script>').replace('<script>', '<script nonce="'+nonce+'">');
     res.writeHead(response.status,{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-frame-options':'DENY','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'"});
     return res.end(page);
   }
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'set-cookie':response.headers.getSetCookie()});
   res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Internal error');}
});
server.on('error',async error=>{
 if(error.code!=='EADDRINUSE'||process.env.PORT)throw error;
 const existing=await fetch('http://127.0.0.1:'+port+'/campus-version',{signal:AbortSignal.timeout(1000),redirect:'error'}).then(r=>r.ok?r.text():'').catch(()=>'');
 if(existing===version){opened();sql.close();return}
 if(port>=primaryPort+8)throw error;
 port++;server.listen(port,'127.0.0.1');
});
server.once('listening',opened);server.listen(port,'127.0.0.1');
