import {effectiveRpm,eventsBetween,cycleSettings} from './cycle.mjs';
import {AudioPhase} from './audio_transport.mjs';
import {TurboSpool,turboTarget} from './turbo_response.mjs';
import {sourceDefinitions,normalizeMix,profileMix,cueShape} from './audio_profiles.mjs';
import {normalizeIssue,issueCycleSettings,issueEventsBetween,issueTreatment} from './audio_issues.mjs';

export function noiseSamples(length,seed=17){
  const data=new Float32Array(length);let state=seed>>>0;
  for(let i=0;i<length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;data[i]=state/2147483648-1;}
  return data;
}

export function cue(context,destination,buffer,event,time,level=1,options={}){
  if(level<=0)return null;
  const shape=options.shape||cueShape(event.source,options.character,options.severity,event);
  const {frequency,duration,gain}=shape;
  const noise=context.createBufferSource();noise.buffer=buffer;
  const filter=context.createBiquadFilter();filter.type=shape.filter;
  filter.frequency.value=frequency;filter.Q.value=shape.q;
  const envelope=context.createGain();envelope.gain.setValueAtTime(0,time);
  envelope.gain.linearRampToValueAtTime(gain*level,time+.0015);
  if(shape.echo){
    envelope.gain.linearRampToValueAtTime(gain*level*.18,time+.005);
    envelope.gain.linearRampToValueAtTime(gain*level*.6*shape.echo,time+.007);
  }
  envelope.gain.exponentialRampToValueAtTime(.00001,time+duration);
  noise.connect(filter).connect(envelope).connect(destination);
  noise.start(time,((event.cylinder*37+Math.floor(event.angle))%100+100)%100/200);noise.stop(time+duration+.01);
  noise.onended=()=>{noise.disconnect();filter.disconnect();envelope.disconnect();};
  return noise;
}

export class EngineAudio{
  constructor(){this.context=null;this.enabled=false;this.sources=[];this.voices=new Map();this.counts={};this.issueCounts={};this.issue=normalizeIssue();this.mix=profileMix();this.severity=.65;this.buses={};this.starts=0;this.retimes=0;this.needsReschedule=false;this.state={playing:false,rpm:850,speed:.02,mode:'engine',angle:0,turboRpm:60000,load:.25};}
  async enable(enabled){
    this.enabled=enabled;
    if(enabled){
      if(!this.context){
        const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)throw new Error('Web Audio unavailable');
        this.context=new Constructor();const c=this.context;
        this.master=c.createGain();this.master.gain.value=.15;
        const limiter=c.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=12;limiter.ratio.value=8;
        const highpass=c.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=35;
        this.master.connect(highpass).connect(limiter).connect(c.destination);
        for(const source of sourceDefinitions){
          const bus=c.createGain();bus.gain.value=this.mix[source.id].level;bus.connect(this.master);this.buses[source.id]=bus;
        }
        this.buffer=c.createBuffer(1,c.sampleRate,c.sampleRate);this.buffer.copyToChannel(noiseSamples(c.sampleRate),0);
      }
      await this.context.resume();this.setTransport(this.state);
    }else this.stop();
  }
  volume(value){if(this.context)this.master.gain.setTargetAtTime(Math.max(0,Math.min(.35,value)),this.context.currentTime,.02);}
  setMix(mix,severity=.65){
    const previous=this.mix.turbo;this.mix=normalizeMix(mix);this.severity=Math.max(0,Math.min(1,Number.isFinite(severity)?severity:.65));
    if(this.context)for(const source of sourceDefinitions)this.buses[source.id].gain.setTargetAtTime(this.mix[source.id].level,this.context.currentTime,.015);
    if(this.turbo&&(previous.character!==this.mix.turbo.character||this.turboSeverity!==this.severity))this.startTurbo();
  }
  setIssue(input){
    const issue=normalizeIssue(input);if(JSON.stringify(issue)===JSON.stringify(this.issue))return;
    this.issue=issue;this.needsReschedule=true;
    if(this.timer)this.setTransport(this.state);
  }
  stopTurbo(){
    for(const key of ['turbo','turboMod'])if(this[key]){try{this[key].stop();}catch{}this[key].disconnect();this[key]=null;}
    this.turboGain?.disconnect();this.turboModGain?.disconnect();
  }
  startTurbo(){
    this.stopTurbo();if(!this.context||!this.enabled||!this.state.playing||!this.sources.includes('turbo'))return;
    const c=this.context,s=this.state;
    this.spool=new TurboSpool(turboTarget(s.rpm,s.load,s.turboRpm));this.spoolTime=c.currentTime;
    const frequency=Math.min(6000,this.spool.rpm/60*(s.mode==='playback'?s.speed:1));
    this.turbo=c.createOscillator();this.turbo.type='sine';this.turbo.frequency.value=frequency;
    this.turboGain=c.createGain();this.turboGain.gain.setValueAtTime(0,c.currentTime);
    this.turboGain.gain.linearRampToValueAtTime(.04*(.15+.85*s.load),c.currentTime+.04);
    this.turbo.connect(this.turboGain).connect(this.buses.turbo);this.turbo.start();
    this.turboSeverity=this.severity;
    if(this.mix.turbo.character==='issue'&&this.severity>0){
      this.turboMod=c.createOscillator();this.turboMod.frequency.value=Math.max(2,frequency*.02);
      this.turboModGain=c.createGain();this.turboModGain.gain.value=frequency*.04*this.severity;
      this.turboMod.connect(this.turboModGain).connect(this.turbo.frequency);this.turboMod.start();
    }
  }
  updateTurbo(){
    if(!this.turbo)return;
    const c=this.context,s=this.state,speed=s.mode==='playback'?s.speed:1;
    const rpm=this.spool.advance((c.currentTime-this.spoolTime)*speed,s.rpm,s.load,s.turboRpm);
    this.spoolTime=c.currentTime;
    const frequency=Math.min(6000,rpm/60*speed);
    this.turbo.frequency.setTargetAtTime(frequency,c.currentTime,.015);
    this.turboGain.gain.setTargetAtTime(.04*(.15+.85*s.load),c.currentTime,.03);
    if(this.turboMod){
      this.turboMod.frequency.setTargetAtTime(Math.max(2,frequency*.02),c.currentTime,.02);
      this.turboModGain.gain.setTargetAtTime(frequency*.04*this.severity,c.currentTime,.02);
    }
  }
  stop(){
    clearInterval(this.timer);this.timer=null;
    for(const node of this.voices.keys()){try{node.stop();}catch{} }this.voices.clear();
    this.stopTurbo();
  }
  configure(sources){
    if(sources.length!==this.sources.length||sources.some(source=>!this.sources.includes(source)))this.needsReschedule=true;
    this.sources=[...sources];
  }
  setTransport(state){
    this.state={...this.state,...state};
    if(!this.context||!this.enabled||!this.state.playing||!this.sources.length){this.stop();return;}
    const c=this.context,s=this.state,rate=effectiveRpm(s.rpm,s.mode==='playback'?s.speed:1);
    if(!this.timer){
      this.rate=rate;this.cursor=c.currentTime+.01;this.phase=new AudioPhase(this.cursor,s.angle,rate);
      this.starts++;this.needsReschedule=false;this.startTurbo();
      this.schedule();this.timer=setInterval(()=>this.schedule(),25);return;
    }
    if(rate!==this.rate||this.needsReschedule){
      // Let active tails and the next audio quantum play; replace only later cues.
      const boundary=c.currentTime+.008;
      this.phase.retime(boundary,rate);this.phase.prune(c.currentTime);
      for(const [node,time] of this.voices)if(time>boundary){try{node.stop();}catch{}this.voices.delete(node);}
      this.rate=rate;this.cursor=boundary;this.needsReschedule=false;this.retimes++;
      this.schedule();
    }
    if(!this.sources.includes('turbo'))this.stopTurbo();
    else if(!this.turbo)this.startTurbo();
    else this.updateTurbo();
  }
  schedule(){
    this.updateTurbo();
    const now=this.context.currentTime,from=Math.max(this.cursor,now+.008),to=now+.12;
    if(to<=from)return;
    const a=this.phase.angleAt(from),b=this.phase.angleAt(to);
    const settings=issueCycleSettings(this.settings||cycleSettings,this.issue);
    const events=[...eventsBetween(a,b,this.sources,settings),...issueEventsBetween(a,b,this.issue,this.sources)]
      .sort((x,y)=>x.angle-y.angle);
    for(const event of events){
      const time=this.phase.timeAt(event.angle);
      if(time<now+.003)continue;
      const treatment=issueTreatment(event,this.issue);
      const node=cue(this.context,this.buses[event.source],this.buffer,event,time,treatment.level,
        {character:this.mix[event.source].character,severity:this.severity,...treatment});
      if(!node)continue;
      this.voices.set(node,time);node.addEventListener('ended',()=>this.voices.delete(node),{once:true});
      this.counts[event.source]=(this.counts[event.source]||0)+1;
      if(event.issue){const key=`${event.issue}:${event.cylinder}`;this.issueCounts[key]=(this.issueCounts[key]||0)+1;}
    }
    this.cursor=to;
    this.phase.prune(now);
  }
  snapshot(){return {enabled:this.enabled,contextCreated:Boolean(this.context),running:Boolean(this.timer),
    contextTime:this.context?.currentTime||0,
    phaseAngle:this.phase?.angleAt(this.context?.currentTime||0)||0,transportStarts:this.starts,liveRetimes:this.retimes,
    turboShaftRpm:this.turbo?this.spool.rpm:0,turboTargetRpm:this.turbo?this.spool.target:0,turboFrequency:this.turbo?.frequency.value||0,load:this.state.load,
    rpm:this.rate||0,mode:this.state.mode,sources:[...this.sources],scheduled:{...this.counts},
    mix:normalizeMix(this.mix),severity:this.severity,turboModulated:Boolean(this.turboMod),
    issue:{...this.issue},issueScheduled:{...this.issueCounts},
    sourceGains:Object.fromEntries(Object.entries(this.buses).map(([key,bus])=>[key,bus.gain.value]))};}
}
