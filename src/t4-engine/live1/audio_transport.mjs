import {angleAfter,effectiveRpm} from './cycle.mjs';

// Keep a short rate timeline so edits cannot invalidate already committed cues.
export class AudioPhase{
  constructor(time,angle,rpm){this.segments=[{time,angle,rpm:effectiveRpm(rpm)}];}
  angleAt(time){
    const segment=this.segments.findLast(s=>s.time<=time)||this.segments[0];
    return angleAfter(segment.angle,Math.max(0,time-segment.time),segment.rpm);
  }
  timeAt(angle){
    const segment=this.segments.findLast(s=>s.angle<=angle)||this.segments[0];
    return segment.time+(angle-segment.angle)/(segment.rpm*6);
  }
  retime(time,rpm){
    const angle=this.angleAt(time),rate=effectiveRpm(rpm);
    this.segments=this.segments.filter(s=>s.time<time);
    this.segments.push({time,angle,rpm:rate});
    return angle;
  }
  prune(time){
    const index=this.segments.findLastIndex(s=>s.time<=time);
    if(index>0)this.segments.splice(0,index);
  }
}
