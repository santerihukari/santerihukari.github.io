// Adapted from the immutable 2026-10-17 r6 website handoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeIssue,issueDefinitions,issueCycleSettings,issueEventsBetween,issueTreatment} from '../../src/t4-engine/audio_issues.mjs';
import {audioSources,cycleSettings,eventsBetween,flowState,wrap} from '../../src/t4-engine/cycle.mjs';
import {firingAngles} from '../../src/t4-engine/kinematics.mjs';
import {EngineAudio} from '../../src/t4-engine/audio.mjs';

const p=JSON.parse(fs.readFileSync(new URL('../../assets/models/vw-t4-engine/r6/params.json',import.meta.url)));
const none=normalizeIssue();assert.equal(none.type,'none');
assert.deepEqual(issueCycleSettings(cycleSettings,none),cycleSettings);
assert.equal(normalizeIssue({type:'bad',cylinder:9,strength:NaN,timingOffset:Infinity}).type,'none');
assert.equal(normalizeIssue({type:'piston_bearing',cylinder:0}).cylinder,1);
assert.equal(normalizeIssue({type:'pump_timing'}).cylinder,0);
assert.equal(normalizeIssue({strength:2,timingOffset:-99}).strength,1);
assert.equal(normalizeIssue({timingOffset:-99}).timingOffset,-30);
assert.equal(normalizeIssue({timingOffset:99}).timingOffset,30);
for(const type of ['piston_valve','piston_bearing'])for(const cylinder of [1,2,3,4]){
  const issue=normalizeIssue({type,cylinder,strength:1});
  const source=issueDefinitions.find(d=>d.id===type).source;
  const events=issueEventsBetween(0,1440,issue,[source]);assert.equal(events.length,2);
  assert(events.every(event=>event.cylinder===cylinder&&event.issue===type&&event.source===source));
  const offset=type==='piston_valve'?360:8;
  assert(events.every(event=>wrap(event.angle-firingAngles[cylinder-1])===offset));
  assert.deepEqual(events,[...issueEventsBetween(0,333,issue,[source]),...issueEventsBetween(333,1440,issue,[source])]);
  assert.equal(issueEventsBetween(0,1440,issue,[]).length,0);
  assert.equal(issueEventsBetween(0,1440,issue,audioSources.filter(id=>id!==source)).length,0);
  assert.equal(issueEventsBetween(0,1440,{...issue,strength:0},[source]).length,0);
  const treatment=issueTreatment(events[0],issue);assert.equal(treatment.level,1);
  assert(treatment.shape.frequency>0&&treatment.shape.duration>0);
  assert.equal(issueTreatment(events[0],none).level,0);
  assert.equal(issueTreatment({...events[0],cylinder:cylinder%4+1},issue).level,0);
}
const combustion=eventsBetween(-1,719,['combustion']),exhaust=eventsBetween(0,720,['exhaust']);
for(const cylinder of [1,2,3,4]){
  const issue={type:'weak_cylinder',cylinder,strength:1};
  for(const event of combustion)assert.equal(issueTreatment(event,issue).level,event.cylinder===cylinder?0:1);
  for(const event of exhaust)assert.equal(issueTreatment(event,issue).level,event.cylinder===cylinder?.35:1);
  for(const event of eventsBetween(0,720,['injection'])){
    const treatment=issueTreatment(event,{type:'cylinder_injector',cylinder,strength:.8});
    assert.equal(treatment.character,event.cylinder===cylinder?'issue':undefined);
    if(event.cylinder===cylinder)assert.equal(treatment.severity,.8);
  }
  for(const source of audioSources){
    const event={source,cylinder,angle:0};
    assert.equal(issueTreatment(event,{...issue,strength:0}).level,1);
    const treatment=issueTreatment(event,{type:'cylinder_injector',cylinder,strength:0});
    assert.equal(treatment.level,1);
    if(source==='injection')assert.equal(treatment.severity,0);
  }
}
const baseline=eventsBetween(-50,670,['injection']);
for(const cylinder of [0,1,2,3,4])for(const timingOffset of [-30,-10,0,10,30]){
  const issue=normalizeIssue({type:'pump_timing',cylinder,timingOffset});
  const settings=issueCycleSettings(cycleSettings,issue);
  const moved=eventsBetween(-50,670,['injection'],settings);assert.equal(moved.length,4);
  for(const event of moved){
    const before=baseline.find(e=>e.cylinder===event.cylinder);
    assert.equal(event.angle-before.angle,!cylinder||cylinder===event.cylinder?timingOffset:0);
    const midpoint=firingAngles[event.cylinder-1]+cycleSettings.injection_start+cycleSettings.injection_duration/2+
      (!cylinder||cylinder===event.cylinder?timingOffset:0);
    assert(Math.abs(flowState(p,event.cylinder,midpoint,settings).fuel-1)<1e-9);
    for(const key of ['burn','air','exhaust'])assert.equal(flowState(p,event.cylinder,midpoint,settings)[key],flowState(p,event.cylinder,midpoint)[key]);
    for(let angle=0;angle<720;angle+=5){
      const actual=flowState(p,event.cylinder,angle,settings),normal=flowState(p,event.cylinder,angle);
      for(const key of ['burn','air','exhaust','pinZ','intakeLift','exhaustLift'])assert.equal(actual[key],normal[key]);
      if(timingOffset===0||(cylinder&&cylinder!==event.cylinder))assert.equal(actual.fuel,normal.fuel);
    }
    if(timingOffset===0)assert.deepEqual(issueTreatment(event,issue),{level:1});
  }
  assert.deepEqual(eventsBetween(-50,670,['combustion'],settings),eventsBetween(-50,670,['combustion']));
  assert.deepEqual(moved,[...eventsBetween(-50,333,['injection'],settings),...eventsBetween(333,670,['injection'],settings)]);
  assert.equal(cycleSettings.injection_offsets,undefined,'Timing edits must not mutate shared baseline settings');
}
const existing={...cycleSettings,injection_offsets:[1,2,3,4]};
assert.deepEqual(issueCycleSettings(existing,{type:'pump_timing',cylinder:2,timingOffset:-10}).injection_offsets,[1,-8,3,4]);
assert.deepEqual(existing.injection_offsets,[1,2,3,4]);
assert.notDeepEqual(issueTreatment({source:'injection',cylinder:1},{type:'pump_timing',timingOffset:-20}),
  issueTreatment({source:'injection',cylinder:1},{type:'pump_timing',timingOffset:20}));
const engine=new EngineAudio();
for(const {id} of issueDefinitions){
  engine.setIssue({type:id,cylinder:1});engine.setTransport({playing:true});
  assert.equal(engine.enabled,false);assert.equal(engine.context,null);assert.deepEqual(engine.sources,[]);
  engine.configure(audioSources);engine.setIssue({type:id,cylinder:4});engine.setTransport({playing:true});
  assert.equal(engine.enabled,false);assert.equal(engine.context,null);assert.equal(engine.snapshot().running,false);
  engine.configure([]);
}
console.log('Cylinder isolation, source gates, zero strength, scripted cadence and signed injection/flow-only timing checks passed.');
