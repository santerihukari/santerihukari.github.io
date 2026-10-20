// Adapted from the immutable 2026-10-20 frozen website handoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cylinderState,crankRadians,crankRotationSign} from '../../src/t4-engine/release-2026-10-20/kinematics.mjs';

const p=JSON.parse(fs.readFileSync(new URL('../../assets/models/vw-t4-engine/r9/params.json',import.meta.url)));
assert.equal(crankRotationSign,-1);
assert.equal(crankRadians(90),-Math.PI/2);
assert(cylinderState(p,1,90).bigY>0,'Top crank pin must move right in a +X timing-end view');
for(let cylinder=1;cylinder<=4;cylinder++){
  const positions=[];
  for(let angle=0;angle<=720;angle+=5){
    const s=cylinderState(p,cylinder,angle);positions.push(s.pinZ);
    assert(Math.abs(Math.hypot(s.bigY,s.bigZ)-p.stroke/2)<1e-8);
    assert(Math.abs(Math.hypot(s.bigY,s.pinZ-s.bigZ)-p.rod_length)<1e-8);
    assert(Math.abs(s.bigY-p.rod_length*Math.sin(s.rodAngle))<1e-8,'Rod small end must stay on the bore axis');
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
console.log('Clockwise timing-end rotation and slider-crank invariants passed, 4 cylinders / 720 degrees.');
