export const sourceDefinitions=[
  {id:'combustion',label:'Combustion pulses',level:1,issue:'Harder, uneven pulses'},
  {id:'injection',label:'Injector / pump ticks',level:.35,issue:'Sharper double ticks'},
  {id:'valves',label:'Valve closures',level:.3,issue:'Longer metallic clatter'},
  {id:'intake',label:'Intake pulses',level:.25,issue:'Airy hiss emphasis'},
  {id:'exhaust',label:'Exhaust pulses',level:.65,issue:'Rasping pulse emphasis'},
  {id:'rotating',label:'Rotating mechanics',level:.3,issue:'Low resonant knocks'},
  {id:'turbo',label:'Turbo shaft tone',level:.2,issue:'Warbling tone'},
];

export function normalizeMix(input){
  return Object.fromEntries(sourceDefinitions.map(source=>{
    const value=input?.[source.id],number=Number(value?.level??source.level);
    return [source.id,{level:Number.isFinite(number)?Math.max(0,Math.min(2,number)):source.level,
      character:value?.character==='issue'?'issue':'normal'}];
  }));
}

export function profileMix(profile='normal',target='valves',severity=.65){
  const mix=normalizeMix();
  if(profile==='issue'&&mix[target]){
    const strength=Math.max(0,Math.min(1,Number.isFinite(severity)?severity:.65));
    mix[target]={level:Math.min(2,mix[target].level*(1+4*strength)),character:'issue'};
  }
  return mix;
}

export function cueShape(source,character='normal',severity=.65,event={}){
  const normal={combustion:[700,.065,.7,.8],injection:[3300,.006,.18,.8],valves:[2100,.012,.2,.8],
    intake:[450,.06,.3,.8],exhaust:[230,.085,.5,.8],rotating:[150,.04,.22,.8]}[source];
  if(!normal)throw new Error('Unknown cue source');
  const issue={combustion:[1200,.09,.7,1.4],injection:[4200,.018,.18,2.5],valves:[3200,.045,.2,5],
    intake:[1800,.12,.3,.6],exhaust:[1100,.12,.5,.7],rotating:[110,.09,.22,3.5]}[source];
  const amount=character==='issue'?Math.max(0,Math.min(1,Number.isFinite(severity)?severity:.65)):0;
  const values=normal.map((v,i)=>v+(issue[i]-v)*amount);
  const variation=source==='combustion'?1-amount*.1*(1+Math.sin((event.angle||0)*.037)):1;
  return {frequency:values[0],duration:values[1],gain:values[2]*variation,q:values[3],
    filter:amount>0&&source==='rotating'?'bandpass':amount>0&&source==='intake'?'highpass':
      source==='combustion'||source==='exhaust'?'lowpass':'bandpass',
    echo:amount>0&&['injection','valves'].includes(source)&&values[1]>.012?amount:0};
}
