import type {Metadata} from 'next';
import {Providers} from '@/components/ui';
import './globals.css';
export const metadata:Metadata={title:'CAMPUS — цифровой деканат',description:'Независимый конкурсный прототип студенческого кабинета. Только вымышленные данные.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;}
