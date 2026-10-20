// Adapted from the immutable 2026-10-20 frozen website handoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {driveSettings,driveRates,advanceDrive,driveReadout} from '../../src/t4-engine/release-2026-10-20/drivetrain.mjs';

const p=JSON.parse(fs.readFileSync(new URL('../../assets/models/vw-t4-powertrain/r13/powertrain_params.json',import.meta.url)));
const reference={ratios:{...Object.fromEntries([1,2,3,4,5].map(i=>[i,p['gear_'+i]])),R:-p.reverse_ratio,N:0},
  final_ratio:p.final_ratio,reverse_idler_ratio:.8,tyre_diameter_mm:p.rim_inches*25.4+2*p.tyre_width*p.tyre_aspect/100};
assert.equal(driveSettings({gear:'bad'},reference).gear,'1');
assert.equal(driveSettings({engagement:7,bias:-4},reference).engagement,1);
assert.equal(driveSettings({bias:-4},reference).bias,-1);
for(const gear of ['N','1','2','3','4','5','R'])for(const engagement of [0,.4,1])for(const bias of [-1,-.3,0,.4,1]){
  const s={gear,engagement,bias},rates=driveRates(reference,s);
  assert(Math.abs((rates.left+rates.right)/2-rates.carrier)<1e-12);
  assert.equal(rates.input,engagement);
  if(gear==='N'||engagement===0)assert.equal(rates.carrier,0);
  else assert.equal(Math.sign(rates.carrier),gear==='R'?-1:1);
  if(gear==='N'&&engagement>0)assert(rates.loose_1!==0);
  const all=advanceDrive({},1440,reference,s);
  const split=advanceDrive(advanceDrive({},500,reference,s),940,reference,s);
  for(const role of Object.keys(all))assert(Math.abs(all[role]-split[role])<1e-9);
  const rpm=driveReadout(2000,reference,s);
  assert(Math.abs((rpm.leftRpm+rpm.rightRpm)/2-rpm.carrierRpm)<1e-9);
  assert(Math.abs(rpm.roadKph-2000*rates.carrier*Math.PI*reference.tyre_diameter_mm/1000*.06)<1e-9);
}
const phases=advanceDrive({},720,reference,{gear:'1',engagement:1});
const neutral=advanceDrive(phases,720,reference,{gear:'N',engagement:1});
assert.equal(neutral.carrier,phases.carrier);assert(neutral.input>phases.input);
assert.equal(reference.tyre_diameter_mm,654);
console.log('Gear/clutch/reverse, differential average, continuous phases and no-slip speed checks passed.');
