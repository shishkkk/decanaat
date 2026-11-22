// Integration harness for the deployment bundle, using a disposable in-memory database.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';

const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
 sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
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
const port=Number(process.env.PORT||3024);
createServer(async(req,res)=>{
 try{
   const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2)headers.append(req.rawHeaders[i],req.rawHeaders[i+1]);
   const body=[];for await(const chunk of req)body.push(chunk);
   const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers,body:body.length?Buffer.concat(body):undefined});
   const response=await worker.fetch(request,{DB},{waitUntil(p){p.catch(console.error);}});
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'set-cookie':response.headers.getSetCookie()});
   res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Internal error');}
}).listen(port,'127.0.0.1',()=>console.log('Local Worker integration database ready on',port));
