import type {Locale} from './types';
export const time=(date:string,locale:Locale)=>new Date(date).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
export const dateLabel=(date:string|Date,locale:Locale,options:Intl.DateTimeFormatOptions={day:'numeric',month:'long'})=>new Date(date).toLocaleDateString(locale==='ru'?'ru-RU':'en-GB',{...options,timeZone:'Europe/Moscow'});
export const title=(value:{title:string;title_en:string},locale:Locale)=>locale==='ru'?value.title:value.title_en;
export const teacher=(value:{teacher:string;teacher_en:string},locale:Locale)=>locale==='ru'?value.teacher:value.teacher_en;
