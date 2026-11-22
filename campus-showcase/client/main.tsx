import React from 'react';
import {createRoot} from 'react-dom/client';
import {CampusApp} from '@/components/CampusApp';
import {Login} from '@/components/Login';
import {Providers} from '@/components/ui';
import {Verification} from '@/components/Verification';

const state=JSON.parse(document.getElementById('initial')!.textContent!);
let screen;
switch(state.screen){
 case 'login': screen=<Login/>;break;
 case 'portal': screen=<CampusApp route={window.location.pathname} initial={state.data}/>;break;
 case 'verify': screen=<Verification record={state.record}/>;break;
 default: screen=<main className="verify-page"><h1>404</h1><p>Страница недоступна.</p><a href="/" className="button">В кабинет</a></main>;
}
createRoot(document.getElementById('app')!).render(<Providers>{screen}</Providers>);
