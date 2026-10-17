import {firingAngles} from './kinematics.mjs';
import {cycleSettings,periodicEventsBetween,wrap} from './cycle.mjs';

export const issueDefinitions=[
  {id:'piston_valve',label:'Piston-valve contact',source:'valves',note:'Scripted impact at exchange TDC; no collision or damage calculation'},
  {id:'piston_bearing',label:'Piston / rod bearing',source:'rotating',note:'Scripted bearing knock near the selected power stroke; not a measured fault signature'},
  {id:'weak_cylinder',label:'Weak cylinder',source:'combustion',note:'Reduced selected-cylinder combustion/exhaust cues; no torque or speed response'},
  {id:'cylinder_injector',label:'Single injector tick',source:'injection',note:'Sharper ticks for the selected injector; not an injector diagnosis'},
  {id:'pump_timing',label:'Fuel-pump timing',source:'injection',note:'Injection cue and fuel marker phase only; burn timing, pump geometry and thermodynamics unchanged'},
];

export function normalizeIssue(input={}){
  const type=issueDefinitions.some(issue=>issue.id===input.type)?input.type:'none';
  const cylinder=Number(input.cylinder??(type==='pump_timing'?0:1));
  const strength=Number(input.strength??.65),offset=Number(input.timingOffset??-10);
  return {type,cylinder:Number.isInteger(cylinder)&&cylinder>=(type==='pump_timing'?0:1)&&cylinder<=4?cylinder:type==='pump_timing'?0:1,
    strength:Number.isFinite(strength)?Math.max(0,Math.min(1,strength)):.65,
    timingOffset:Number.isFinite(offset)?Math.max(-30,Math.min(30,offset)):-10};
}

export function issueCycleSettings(base=cycleSettings,input){
  const issue=normalizeIssue(input);
  if(issue.type!=='pump_timing')return base;
  return {...base,injection_offsets:[1,2,3,4].map(cylinder=>
    (base.injection_offsets?.[cylinder-1]||0)+(!issue.cylinder||issue.cylinder===cylinder?issue.timingOffset:0))};
}

export function issueEventsBetween(from,to,input,enabled){
  const issue=normalizeIssue(input),definition=issueDefinitions.find(d=>d.id===issue.type);
  if(!definition||!enabled.includes(definition.source)||issue.strength===0||!['piston_valve','piston_bearing'].includes(issue.type))return [];
  // Deliberate acoustic markers, not contact detection or a bearing load model.
  const phase=wrap(firingAngles[issue.cylinder-1]+(issue.type==='piston_valve'?360:8));
  return periodicEventsBetween(from,to,[{source:definition.source,cylinder:issue.cylinder,
    issue:issue.type,phase,period:720}]);
}

export function issueTreatment(event,input){
  const issue=normalizeIssue(input),selected=!issue.cylinder||event.cylinder===issue.cylinder;
  if(event.issue){
    if(event.issue!==issue.type||!selected||issue.strength===0)return {level:0};
    const contact=event.issue==='piston_valve';
    return {level:issue.strength,shape:{frequency:contact?4200:140,duration:contact?.035:.085,
      gain:contact?1.1:1.2,q:contact?6:2.8,filter:'bandpass',echo:contact?.8:0}};
  }
  if(!selected)return {level:1};
  if(issue.type==='weak_cylinder')return {level:event.source==='combustion'?1-issue.strength:event.source==='exhaust'?1-.65*issue.strength:1};
  if(issue.type==='cylinder_injector'&&event.source==='injection')return {level:1,character:'issue',severity:issue.strength};
  if(issue.type==='pump_timing'&&event.source==='injection'&&issue.timingOffset!==0){
    const strength=Math.abs(issue.timingOffset)/30;
    return {level:1,shape:{frequency:issue.timingOffset<0?3300+1200*strength:3300-1900*strength,
      duration:.006+.012*strength,gain:.18,q:1+2*strength,filter:'bandpass',echo:0}};
  }
  return {level:1};
}
