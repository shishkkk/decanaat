export function CampusPrint(){
 const cols=Array.from({length:8},(_,i)=>110+i*39);
 return <svg className="campus-print" viewBox="0 0 540 216" aria-hidden="true" fill="none">
 <g stroke="#bfa877" strokeWidth=".65" opacity=".45"><circle cx="322" cy="94" r="71"/><circle cx="322" cy="94" r="82" strokeDasharray="2 5"/><path d="M30 94H488M322 6v196M38 185l414-92M380 208L104 34" strokeDasharray="4 6"/></g>
 <g stroke="#d6c08f" strokeLinejoin="round"><path d="M86 93L255 32l167 61z" fill="#193346"/><path d="M102 89l153-49 149 49zM122 85l134-39 126 39z"/><circle cx="255" cy="68" r="7"/><path d="M80 94h350v7H80zM89 102h330v7H89z" fill="#324653"/>
 {cols.map(x=><g key={x} fill="#193044"><path d={'M'+x+' 110h21v5h-2l-2 56h3v5h-20v-5h3l-2-56h-1z'}/>{[5,9,13].map(d=><path key={d} strokeWidth=".65" d={'M'+(x+d)+' 118v49'}/>)}</g>)}
 {[0,1,2,3].map(i=><path key={i} d={'M'+(91-i*6)+' '+(177+i*4)+'h'+(326+i*12)+'v3H'+(91-i*6)+'z'} fill="#203846"/>)}<path d="M37 194h448" opacity=".6"/></g>
 <g stroke="#87acba" strokeWidth=".65" opacity=".66">{Array.from({length:17},(_,i)=><path key={i} d={'M0 '+(166+i*3)+' C82 '+(109+i*2)+' 110 '+(183+i*3)+' 210 '+(185+i*3)+' S408 '+(111+i*4)+' 540 '+(136+i*3)}/>)}</g></svg>;
}