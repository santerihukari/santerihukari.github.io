import {angleAfter,effectiveRpm,eventsBetween,cycleSettings} from './cycle.mjs';
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
  constructor(){this.context=null;this.enabled=false;this.sources=[];this.voices=new Set();this.counts={};this.issueCounts={};this.issue=normalizeIssue();this.mix=profileMix();this.severity=.65;this.buses={};this.state={playing:false,rpm:850,speed:.02,mode:'engine',angle:0,turboRpm:60000};}
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
    this.issue=issue;
    if(this.timer){
      const angle=angleAfter(this.anchorAngle,Math.max(0,this.context.currentTime-this.anchorTime),this.rate);
      this.setTransport({...this.state,angle});
    }
  }
  stopTurbo(){
    for(const key of ['turbo','turboMod'])if(this[key]){try{this[key].stop();}catch{}this[key].disconnect();this[key]=null;}
    this.turboGain?.disconnect();this.turboModGain?.disconnect();
  }
  startTurbo(){
    this.stopTurbo();if(!this.context||!this.enabled||!this.state.playing||!this.sources.includes('turbo'))return;
    const c=this.context,s=this.state,frequency=Math.min(6000,s.turboRpm/60*(s.mode==='playback'?s.speed:1));
    this.turbo=c.createOscillator();this.turbo.type='sine';this.turbo.frequency.value=frequency;
    this.turboGain=c.createGain();this.turboGain.gain.setValueAtTime(0,c.currentTime);
    this.turboGain.gain.linearRampToValueAtTime(.04,c.currentTime+.04);
    this.turbo.connect(this.turboGain).connect(this.buses.turbo);this.turbo.start();
    this.turboSeverity=this.severity;
    if(this.mix.turbo.character==='issue'&&this.severity>0){
      this.turboMod=c.createOscillator();this.turboMod.frequency.value=Math.max(2,frequency*.02);
      this.turboModGain=c.createGain();this.turboModGain.gain.value=frequency*.04*this.severity;
      this.turboMod.connect(this.turboModGain).connect(this.turbo.frequency);this.turboMod.start();
    }
  }
  stop(){
    clearInterval(this.timer);this.timer=null;
    for(const node of this.voices){try{node.stop();}catch{} }this.voices.clear();
    this.stopTurbo();
  }
  configure(sources){this.sources=[...sources];}
  setTransport(state){
    this.state={...this.state,...state};this.stop();
    if(!this.context||!this.enabled||!this.state.playing||!this.sources.length)return;
    const c=this.context,s=this.state;this.anchorTime=c.currentTime+.025;this.cursor=this.anchorTime;
    this.anchorAngle=s.angle;this.rate=effectiveRpm(s.rpm,s.mode==='playback'?s.speed:1);
    this.startTurbo();
    this.schedule();this.timer=setInterval(()=>this.schedule(),25);
  }
  schedule(){
    const now=this.context.currentTime,from=Math.max(this.cursor,now+.008),to=now+.12;
    if(to<=from)return;
    const a=angleAfter(this.anchorAngle,Math.max(0,from-this.anchorTime),this.rate);
    const b=angleAfter(this.anchorAngle,Math.max(0,to-this.anchorTime),this.rate);
    const settings=issueCycleSettings(this.settings||cycleSettings,this.issue);
    const events=[...eventsBetween(a,b,this.sources,settings),...issueEventsBetween(a,b,this.issue,this.sources)]
      .sort((x,y)=>x.angle-y.angle);
    for(const event of events){
      const time=this.anchorTime+(event.angle-this.anchorAngle)/(this.rate*6);
      if(time<now+.003)continue;
      const treatment=issueTreatment(event,this.issue);
      const node=cue(this.context,this.buses[event.source],this.buffer,event,time,treatment.level,
        {character:this.mix[event.source].character,severity:this.severity,...treatment});
      if(!node)continue;
      this.voices.add(node);node.addEventListener('ended',()=>this.voices.delete(node),{once:true});
      this.counts[event.source]=(this.counts[event.source]||0)+1;
      if(event.issue){const key=`${event.issue}:${event.cylinder}`;this.issueCounts[key]=(this.issueCounts[key]||0)+1;}
    }
    this.cursor=to;
  }
  snapshot(){return {enabled:this.enabled,contextCreated:Boolean(this.context),running:Boolean(this.timer),
    contextTime:this.context?.currentTime||0,
    rpm:this.rate||0,mode:this.state.mode,sources:[...this.sources],scheduled:{...this.counts},
    mix:normalizeMix(this.mix),severity:this.severity,turboModulated:Boolean(this.turboMod),
    issue:{...this.issue},issueScheduled:{...this.issueCounts},
    sourceGains:Object.fromEntries(Object.entries(this.buses).map(([key,bus])=>[key,bus.gain.value]))};}
}
