// Adapted from the immutable 2026-10-17 r8_live1 website handoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {angleAfter,effectiveRpm,eventsBetween,flowState,wrap} from '../../src/t4-engine/live1/cycle.mjs';
import {noiseSamples} from '../../src/t4-engine/live1/audio.mjs';

const p=JSON.parse(fs.readFileSync(new URL('../../assets/models/vw-t4-engine/r7/params.json',import.meta.url)));
assert.equal(effectiveRpm(850,.02),17);
assert.equal(angleAfter(0,60,850),850*360);
assert.equal(angleAfter(35,10,850,.02),1055);
assert.equal(wrap(-10),710);
for(const source of ['combustion','injection','intake','exhaust'])assert.equal(eventsBetween(0,5400,[source]).length,30);
assert.equal(eventsBetween(0,5400,['valves']).length,60);
assert.equal(eventsBetween(0,5400,['rotating']).length,15);
const all=['combustion','injection','valves','intake','exhaust','rotating'];
const whole=eventsBetween(-20,1440,all),split=[...eventsBetween(-20,333,all),...eventsBetween(333,1440,all)];
assert.deepEqual(whole,split);
assert.deepEqual(eventsBetween(0,1000,[]),[]);
for(const source of all){
  assert.deepEqual(eventsBetween(-20,1440,[source]),whole.filter(event=>event.source===source));
}
assert.deepEqual(eventsBetween(0,1440,['turbo']),[],'Turbo is continuous, not a cylinder event');
assert.deepEqual(eventsBetween(360,360,all),[]);
for(const bad of [0,-1,NaN,Infinity]){
  assert.throws(()=>effectiveRpm(bad));assert.throws(()=>effectiveRpm(850,bad));
}
assert.throws(()=>angleAfter(0,-1,850));
assert.throws(()=>eventsBetween(1,0,all));
assert.throws(()=>eventsBetween(0,Infinity,all));
for(const cylinder of [1,2,3,4])for(let angle=0;angle<720;angle+=5){
  const a=flowState(p,cylinder,angle),b=flowState(p,cylinder,angle+720);
  for(const key of ['air','fuel','exhaust','burn']){
    assert(a[key]>=0&&a[key]<=1);assert.equal(a[key],b[key]);
  }
  if(a.intakeLift===0)assert.equal(a.air,0);
  if(a.exhaustLift===0)assert.equal(a.exhaust,0);
}
assert(flowState(p,1,715).fuel>0);
assert(flowState(p,1,5).fuel>0);
assert.equal(flowState(p,1,450).fuel,0);
assert(flowState(p,1,30).burn>0);
assert.equal(flowState(p,1,450).burn,0);
const noise=noiseSamples(48000);assert.deepEqual(noise,noiseSamples(48000));
assert.notDeepEqual(noise,noiseSamples(48000,18));
assert(noise.every(x=>Number.isFinite(x)&&x>=-1&&x<=1));
assert(noise.some(x=>Math.abs(x)>.1));
console.log('Cycle, elapsed-time RPM, source gates, valve gates and deterministic audio-buffer checks passed.');
