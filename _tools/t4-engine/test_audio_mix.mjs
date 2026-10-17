// Adapted from the immutable 2026-10-17 r8_live1 website handoff.
import assert from 'node:assert/strict';
import {sourceDefinitions,normalizeMix,profileMix,cueShape} from '../../src/t4-engine/live1/audio_profiles.mjs';
import {audioSources,eventsBetween} from '../../src/t4-engine/live1/cycle.mjs';
import {EngineAudio} from '../../src/t4-engine/live1/audio.mjs';

const normal=profileMix(),issue=profileMix('issue','valves',.65);
assert.deepEqual(sourceDefinitions.map(s=>s.id),audioSources);
assert(new Set(Object.values(normal).map(v=>v.level)).size>3);
assert.equal(normal.combustion.level,1);assert.equal(normal.valves.level,.3);
assert(issue.valves.level>normal.valves.level);assert.equal(issue.valves.character,'issue');
for(const id of audioSources.filter(id=>id!=='valves'))assert.deepEqual(issue[id],normal[id]);
assert.equal(profileMix('issue','valves',0).valves.level,normal.valves.level);
const normalized=normalizeMix({valves:{level:-1},combustion:{level:99},turbo:{level:NaN,character:'other'}});
assert.equal(normalized.valves.level,0);assert.equal(normalized.combustion.level,2);
assert.deepEqual(normalized.turbo,normal.turbo);
for(const source of audioSources.filter(id=>id!=='turbo')){
  const a=cueShape(source,'normal',1,{cylinder:2,angle:0});
  const b=cueShape(source,'issue',1,{cylinder:2,angle:0});
  assert.notDeepEqual(a,b);assert.deepEqual(a,cueShape(source,'issue',0,{cylinder:2,angle:0}));
  for(const value of [b.frequency,b.duration,b.gain,b.q])assert(Number.isFinite(value)&&value>0);
}
const engine=new EngineAudio();engine.setMix(issue);assert.equal(engine.enabled,false);
assert.equal(engine.context,null);assert.deepEqual(engine.sources,[]);
const before=eventsBetween(0,1440,audioSources);engine.setMix(normal);
assert.deepEqual(eventsBetween(0,1440,audioSources),before);
for(const source of audioSources){
  engine.configure([source]);engine.setMix(profileMix('issue',source));
  engine.setTransport({playing:true});
  assert.equal(engine.enabled,false);assert.equal(engine.context,null);assert.equal(engine.snapshot().running,false);
}
engine.configure(audioSources);engine.setMix(normal);
assert.equal(engine.context,null,'All sources must not create an AudioContext');

// Deterministic API doubles check the real EngineAudio graph and cleanup, not PCM or acoustics.
class Param{
  constructor(value=0){this.value=value;this.targets=[];}
  setTargetAtTime(value,time,constant){this.value=value;this.targets.push({value,time,constant});}
  setValueAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
  exponentialRampToValueAtTime(value){this.value=value;}
}
class Node{
  constructor(kind){
    this.kind=kind;this.connections=[];this.listeners=[];this.stopped=false;
    for(const key of ['gain','frequency','Q','threshold','knee','ratio'])this[key]=new Param();
  }
  connect(node){this.connections.push(node);return node;}
  disconnect(){this.disconnected=true;}
  start(){this.started=true;}
  stop(){this.stopped=true;this.onended?.();for(const listener of this.listeners)listener();}
  addEventListener(type,listener){assert.equal(type,'ended');this.listeners.push(listener);}
}
class Context{
  constructor(){this.currentTime=0;this.sampleRate=48000;this.destination=new Node('destination');this.nodes=[];}
  node(kind){const node=new Node(kind);this.nodes.push(node);return node;}
  createGain(){return this.node('gain');}
  createDynamicsCompressor(){return this.node('compressor');}
  createBiquadFilter(){return this.node('filter');}
  createBufferSource(){return this.node('bufferSource');}
  createOscillator(){return this.node('oscillator');}
  createBuffer(){return {copyToChannel(){}};}
  async resume(){this.resumed=true;}
}
const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
const originalInterval=globalThis.setInterval,originalClear=globalThis.clearInterval;
const timers=new Map();let timerId=0;
try{
  globalThis.window={AudioContext:Context};
  globalThis.setInterval=callback=>{const id=++timerId;timers.set(id,callback);return id;};
  globalThis.clearInterval=id=>timers.delete(id);
  const live=new EngineAudio();
  await live.enable(true);
  assert(live.context.resumed);assert.equal(live.snapshot().running,false);
  assert.equal(live.master.gain.value,.15);
  assert.equal(new Set(Object.values(live.buses)).size,7,'Sources need independent gain buses');
  for(const id of audioSources){
    assert.equal(live.buses[id].gain.value,normal[id].level);
    assert.deepEqual(live.buses[id].connections,[live.master]);
  }
  for(const level of [0,.25,1.75,2]){
    const mix=Object.fromEntries(audioSources.map(id=>[id,{level,character:'normal'}]));
    live.setMix(mix);
    for(const id of audioSources){
      assert.equal(live.snapshot().sourceGains[id],level);
      assert.equal(live.buses[id].gain.targets.at(-1).constant,.015);
    }
  }
  live.volume(99);assert.equal(live.master.gain.value,.35);
  live.volume(-1);assert.equal(live.master.gain.value,0);
  live.volume(.15);live.setMix(normal);
  live.setTransport({playing:true});assert.equal(live.snapshot().running,false);
  for(const id of audioSources){
    const counts={...live.counts};live.configure([id]);live.setTransport({playing:true,angle:0});
    assert.equal(live.snapshot().running,true);
    for(const other of audioSources.filter(source=>source!==id))assert.equal(live.counts[other],counts[other]);
    if(id==='turbo')assert(live.turbo?.started);
    else assert(live.counts[id]>(counts[id]||0),`${id} gate must schedule only its own cues`);
  }
  live.configure(audioSources);live.setMix(profileMix('issue','turbo'));live.setTransport({playing:true});
  assert(live.turbo&&live.turboMod);assert(live.voices.size>0);
  const voices=[...live.voices.keys()],turbo=live.turbo,modulation=live.turboMod;
  live.setTransport({playing:false});
  assert.equal(live.enabled,true,'Pause disarms transport without changing explicit enable');
  assert.equal(live.voices.size,0);assert(voices.every(node=>node.stopped));
  assert(turbo.stopped&&turbo.disconnected&&modulation.stopped&&modulation.disconnected);
  assert.equal(live.turbo,null);assert.equal(live.turboMod,null);assert.equal(timers.size,0);
  live.setTransport({playing:true});assert.equal(live.snapshot().running,true);
  const mutedVoices=[...live.voices.keys()];await live.enable(false);
  assert(mutedVoices.every(node=>node.stopped));assert.equal(live.voices.size,0);
  assert.equal(live.turbo,null);assert.equal(live.turboMod,null);assert.equal(timers.size,0);
  const mutedCounts={...live.counts};
  live.setMix(profileMix('issue','turbo'));live.configure(audioSources);
  live.setTransport({playing:false});live.setTransport({playing:true});
  assert.equal(live.enabled,false);assert.equal(live.snapshot().running,false);
  assert.deepEqual(live.counts,mutedCounts,'Play, source gates and presets must not auto-unmute');
  live.configure([]);await live.enable(true);assert.equal(live.snapshot().running,false);
  await live.enable(false);
}finally{
  globalThis.setInterval=originalInterval;globalThis.clearInterval=originalClear;
  if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else delete globalThis.window;
}
console.log('Audio defaults, source gates, presets, independent gain buses, pause/mute cleanup and no auto-unmute checks passed (Web Audio API doubles).');
