// Adapted from the immutable 2026-10-17 r8_live1 website handoff.
import assert from 'node:assert/strict';
import {rpmControl,rpmGuides,rpmSource,parseRpm,rpmBand} from '../../src/t4-engine/live1/rpm_reference.mjs';

assert.deepEqual(rpmControl,{min:300,max:5000,step:1,default:850});
assert.equal(parseRpm('850'),rpmControl.default);
for(const value of [300,1735,2500,3700,5000]){
  assert.equal(parseRpm(String(value)),value);assert.equal(parseRpm(value),value);
}
assert.equal(parseRpm(' 1735 '),1735);
for(const value of ['', ' ', 'bad',NaN,Infinity,-Infinity,299,5001,850.5])assert.equal(parseRpm(value),null);
assert.equal(rpmBand(850),'Idle (approx.)');assert.equal(rpmBand(2000),'Driving (approx.)');
assert.equal(rpmBand(3700),'Rated power reference');assert.equal(rpmBand(5000),'High speed');
for(const [rpm,band] of [[300,'Below idle guide'],[799,'Below idle guide'],[800,'Idle (approx.)'],
  [950,'Idle (approx.)'],[951,'Low speed'],[1499,'Low speed'],[1500,'Driving (approx.)'],
  [3000,'Driving (approx.)'],[3001,'High speed'],[3699,'High speed'],[3701,'High speed']])assert.equal(rpmBand(rpm),band);
assert.equal(new Set(rpmGuides.map(guide=>guide.id)).size,4);
for(const guide of rpmGuides){assert(guide.min>=rpmControl.min&&guide.max<=rpmControl.max);assert(guide.max>=guide.min);}
assert(rpmGuides.filter(guide=>guide.id==='idle'||guide.id==='driving').every(guide=>guide.approximate));
assert.equal(rpmGuides.find(guide=>guide.id==='torque').min,2000);
assert.equal(rpmGuides.find(guide=>guide.id==='torque').max,3000);
assert.equal(rpmGuides.find(guide=>guide.id==='power').min,3700);
assert(rpmGuides.filter(guide=>guide.id==='torque'||guide.id==='power').every(guide=>guide.approximate===false));
assert.equal(new URL(rpmSource).protocol,'https:');
assert.equal(rpmGuides.some(guide=>/redline|safe range/i.test(guide.label)),false);
console.log('RPM bounds, integer pairing, invalid input, guide boundaries and approximate/published reference checks passed.');
