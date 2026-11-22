import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const [script,styles]=await Promise.all(['browser','styles'].map(name=>fs.readFile(path.join(here,'generated',name+'.txt'),'utf8')));
const html=`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>CAMPUS · Цифровой деканат</title>
<style>${styles}</style></head><body>
<div id="app"></div><noscript>Для работы кабинета включите JavaScript.</noscript>
<template id="local-help"><main class="verify-page"><div class="page-heading"><p>CAMPUS</p><h1>Цифровой деканат</h1></div><h2>Открыть свой кабинет</h2><p>Запустите Start.cmd из комплекта CAMPUS. Когда появится адрес кабинета, откройте его кнопкой ниже.</p><p><a class="button primary" href="http://127.0.0.1:3048/index.html">Перейти ко входу →</a></p><footer>Конкурсный прототип. Не является официальным сервисом учебного заведения</footer></main></template>
<script type="application/json" id="initial">{"screen":"login"}</script>
<script>if(location.protocol==='file:'){document.getElementById('app').append(document.getElementById('local-help').content.cloneNode(true))}else{${script.replace(/<\/script/gi,'<\\/script')}
}</script></body></html>`;
for(const name of ['../campus/portable/index.html','../campus/public/index.html','dist/index.html']) await fs.writeFile(path.resolve(here,name),html);
await fs.copyFile(path.join(here,'dist/server/index.js'),path.join(here,'../campus/portable/backend.mjs'));
