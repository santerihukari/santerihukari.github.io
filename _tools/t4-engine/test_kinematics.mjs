// Adapted from the immutable 2026-10-17 r6 website handoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cylinderState} from '../../src/t4-engine/kinematics.mjs';

const p=JSON.parse(fs.readFileSync(new URL('../../assets/models/vw-t4-engine/r6/params.json',import.meta.url)));
for(let cylinder=1;cylinder<=4;cylinder++){
  const positions=[];
  for(let angle=0;angle<=720;angle+=5){
    const s=cylinderState(p,cylinder,angle);positions.push(s.pinZ);
    assert(Math.abs(Math.hypot(s.bigY,s.bigZ)-p.stroke/2)<1e-8);
    assert(Math.abs(Math.hypot(s.bigY,s.pinZ-s.bigZ)-p.rod_length)<1e-8);
    for(const lift of [s.intakeLift,s.exhaustLift])assert(lift>=0&&lift<=p.valve_lift);
  }
  assert(Math.abs(Math.max(...positions)-Math.min(...positions)-p.stroke)<1e-8);
  assert(Math.abs(cylinderState(p,cylinder,0).pinZ-cylinderState(p,cylinder,720).pinZ)<1e-8);
  for(let angle=0;angle<720;angle+=5){
    const a=cylinderState(p,cylinder,angle),b=cylinderState(p,cylinder,angle+720);
    for(const key of ['pinZ','bigY','bigZ','rodAngle','intakeLift','exhaustLift'])assert(Math.abs(a[key]-b[key])<1e-8);
    assert.equal(a.strokeName,b.strokeName);
  }
}
console.log('Browser slider-crank invariants passed, 4 cylinders / 720 degrees.');
