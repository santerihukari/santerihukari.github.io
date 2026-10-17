// Adapted from the immutable 2026-10-17 r8_live1 website handoff.
import assert from 'node:assert/strict';
import {AudioPhase} from '../../src/t4-engine/live1/audio_transport.mjs';
import {EngineAudio} from '../../src/t4-engine/live1/audio.mjs';
import {TurboSpool,turboTarget} from '../../src/t4-engine/live1/turbo_response.mjs';
import {pulleyMarkSpecs,markedPulleys} from '../../src/t4-engine/live1/pulley_marks.mjs';

const timeline=new AudioPhase(1,100,1000);
assert.equal(timeline.angleAt(1),100);assert.equal(timeline.angleAt(2),6100);
timeline.retime(2,2000);assert.equal(timeline.angleAt(3),18100);
timeline.retime(2.5,500);assert.equal(timeline.angleAt(3),13600);
for(let time=1;time<4;time+=.003)assert(Math.abs(timeline.timeAt(timeline.angleAt(time))-time)<1e-9);
const preserved=timeline.angleAt(3);timeline.prune(2.8);assert.equal(timeline.angleAt(3),preserved);

for(const id of markedPulleys){
  const marks=pulleyMarkSpecs(id,[[200,-70,-70],[217,70,70]]);
  assert.equal(marks.length,8);assert.equal(marks.filter(m=>m.kind==='witness').length,2);
  assert(marks.every(m=>m.size.every(v=>v>0)&&Math.hypot(m.center[1],m.center[2])+m.size[2]/2<70));
}
assert.deepEqual(pulleyMarkSpecs('block',[[0,0,0],[1,1,1]]),[]);

assert(turboTarget(3500,1)>turboTarget(3500,.1));
assert(turboTarget(3500,1)>turboTarget(850,1));
assert.equal(turboTarget(3500,1,0),0);
const spool=new TurboSpool(turboTarget(850,.25));
const initial=spool.rpm,up=spool.advance(.1,3500,1,60000);
assert(up>initial&&up<spool.target);const down=spool.advance(.1,850,0,60000);
assert(down<up&&down>spool.target);
const whole=new TurboSpool(10000),split=new TurboSpool(10000);
whole.advance(1,3000,.8,60000);for(let i=0;i<100;i++)split.advance(.01,3000,.8,60000);
assert(Math.abs(whole.rpm-split.rpm)<1e-8);

class FakeParam{constructor(){this.value=0;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}setTargetAtTime(){}}
class FakeNode{
  constructor(context){this.context=context;this.frequency=new FakeParam();this.Q=new FakeParam();this.gain=new FakeParam();}
  connect(node){return node;}disconnect(){}addEventListener(){}
  start(time){this.started=time;this.context.nodes.push(this);}
  stop(time=this.context.currentTime){this.stopped=time;}
}
const context={currentTime:0,nodes:[],createBufferSource(){return new FakeNode(this);},createBiquadFilter(){return new FakeNode(this);},createGain(){return new FakeNode(this);}};
const engine=new EngineAudio();engine.context=context;engine.enabled=true;engine.buffer={};engine.buses.combustion=new FakeNode(context);
engine.configure(['combustion']);engine.setTransport({playing:true,rpm:850,angle:0});
try{
  let previous=0;
  for(let i=1;i<=1000;i++){
    context.currentTime=i*.002;
    engine.setTransport({playing:true,rpm:850+Math.round(2650*i/1000),angle:0});
    const phase=engine.snapshot().phaseAngle;
    assert(phase>=previous,'Frequent edits rewound the independent audio phase');previous=phase;
  }
  assert.equal(engine.snapshot().transportStarts,1);
  assert.equal(engine.snapshot().liveRetimes,1000);
  const played=context.nodes.filter(n=>n.started<context.currentTime&&n.stopped>n.started).map(n=>n.started).sort((a,b)=>a-b);
  assert(played.length>70,'Rapid edits starved the audible event stream');
  assert(Math.max(...played.slice(1).map((t,i)=>t-played[i]))<.05,'Rapid edits inserted an audible scheduling gap');
  assert(played.every((t,i)=>i===0||t>played[i-1]+1e-6),'Committed events were duplicated');
}finally{engine.stop();}
assert.equal(engine.snapshot().running,false);
console.log('Live audio phase/retiming, sub-quantum edits, spool response and pulley witness geometry checks passed.');
