import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const campus=path.resolve(here,'../campus');
const require=createRequire(import.meta.url);
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
const installed=await exists(path.join(here,'node_modules/esbuild'));
const dependencies=path.join(installed?here:campus,'node_modules');
const esbuild=installed?require('esbuild'):require(path.join(dependencies,'.pnpm/esbuild@0.28.2/node_modules/esbuild'));
if(await exists(path.join(campus,'src/components'))){
  for(const folder of ['components','lib']){
    await fs.mkdir(path.join(here,'shared',folder),{recursive:true});
    await fs.cp(path.join(campus,'src',folder),path.join(here,'shared',folder),{recursive:true});
  }
  await fs.copyFile(path.join(campus,'src/app/globals.css'),path.join(here,'shared/globals.css'));
}
const base={absWorkingDir:here,bundle:true,minify:true,logLevel:'warning',nodePaths:[dependencies],target:'es2022',define:{'process.env.NODE_ENV':'"production"'},legalComments:'none'};
await fs.mkdir(path.join(here,'generated'),{recursive:true});
const client=await esbuild.build({...base,entryPoints:['client/main.tsx'],platform:'browser',format:'iife',jsx:'automatic',write:false,alias:{'next/link':path.join(here,'client/navigation.tsx'),'next/navigation':path.join(here,'client/navigation.tsx'),'@':path.join(here,'shared')}});
await fs.writeFile(path.join(here,'generated/browser.txt'),client.outputFiles[0].contents);
let styles=await fs.readFile(path.join(here,'shared/globals.css'),'utf8');
// The PDF has its own typeface. Embed interface fonts for the portable HTML.
styles=styles.replace(/@font-face\{[^}]+\}/,'');
for(const name of ['montserrat-latin','montserrat-cyrillic','syne-latin']){
 const font=await fs.readFile(path.join(here,'shared/fonts',name+'.woff2'));
 styles=styles.replace('/fonts/'+name+'.woff2','data:font/woff2;base64,'+font.toString('base64'));
}
styles=styles.replace('/mgimo.webp','data:image/webp;base64,'+(await fs.readFile(path.join(here,'shared/mgimo.webp'))).toString('base64'));
await fs.writeFile(path.join(here,'generated/styles.txt'),styles);
if(!process.argv.includes('--client-only')){
 await esbuild.build({...base,entryPoints:['worker/entry.ts'],platform:'browser',mainFields:['module','main'],conditions:['worker','browser'],format:'esm',loader:{'.txt':'text','.ttf':'binary'},external:['node:*','cloudflare:*'],outfile:'dist/server/index.js'});
 await fs.mkdir(path.join(here,'dist/.openai'),{recursive:true});
 if(await exists(path.join(here,'.openai/hosting.json'))) await fs.copyFile(path.join(here,'.openai/hosting.json'),path.join(here,'dist/.openai/hosting.json'));
}
