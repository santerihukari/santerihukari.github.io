import {cylinderState,firingAngles} from './kinematics.mjs';

export const cycleSettings={injection_start:-10,injection_duration:22,burn_start:0,burn_duration:65};
export const audioSources=['combustion','injection','valves','intake','exhaust','rotating','turbo'];
export const wrap=(value,period=720)=>((value%period)+period)%period;
export const injectionStart=(settings,cylinder)=>settings.injection_start+(settings.injection_offsets?.[cylinder-1]||0);

export function effectiveRpm(rpm,speed=1){
  if(!Number.isFinite(rpm)||rpm<=0||!Number.isFinite(speed)||speed<=0)throw new Error('Invalid playback rate');
  return rpm*speed;
}
export function angleAfter(start,seconds,rpm,speed=1){
  if(!Number.isFinite(start)||!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid transport time');
  return start+seconds*effectiveRpm(rpm,speed)*6;
}
export function flowState(p,cylinder,angle,settings=cycleSettings){
  const s=cylinderState(p,cylinder,angle);
  const pulse=(start,duration)=>{const t=wrap(s.local-start);return t<duration?Math.sin(Math.PI*t/duration):0;};
  return {...s,air:s.intakeLift/p.valve_lift,exhaust:s.exhaustLift/p.valve_lift,
    fuel:pulse(injectionStart(settings,cylinder),settings.injection_duration),burn:pulse(settings.burn_start,settings.burn_duration),
    gas:s.local<370?'products':'air',compressed:s.local>=540?(s.local-540)/180:0};
}

export function eventsBetween(from,to,enabled,settings=cycleSettings){
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)throw new Error('Invalid event interval');
  const selected=new Set(enabled), definitions=[];
  for(let i=0;i<4;i++){
    const phase=firingAngles[i],cylinder=i+1;
    for(const [source,offset] of [['combustion',settings.burn_start],['injection',injectionStart(settings,cylinder)],
      ['intake',350],['exhaust',150],['valves',370],['valves',570]]){
      if(selected.has(source))definitions.push({source,cylinder,phase:wrap(phase+offset),period:720});
    }
  }
  if(selected.has('rotating'))definitions.push({source:'rotating',cylinder:0,phase:0,period:360});
  return periodicEventsBetween(from,to,definitions);
}

export function periodicEventsBetween(from,to,definitions){
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)throw new Error('Invalid event interval');
  const events=[];
  for(const definition of definitions){
    const first=Math.floor((from-definition.phase)/definition.period)+1;
    const last=Math.floor((to-definition.phase)/definition.period);
    if(last-first>10000)throw new Error('Event interval too large');
    const {phase,period,...event}=definition;
    for(let k=first;k<=last;k++)events.push({...event,angle:phase+k*period});
  }
  return events.sort((a,b)=>a.angle-b.angle||a.source.localeCompare(b.source));
}
