const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));

// Dimensionless exhaust-demand proxy only, not an ABL turbine/compressor map.
export function turboTarget(rpm,load,reference=60000){
  const speed=clamp((rpm-650)/3050,0,1.25),demand=clamp(load,0,1);
  return clamp(reference,0,180000)*Math.min(1.25,.08+.92*speed**1.25*(.12+.88*demand));
}
export class TurboSpool{
  constructor(rpm=0){this.rpm=Math.max(0,rpm);this.target=this.rpm;}
  advance(seconds,rpm,load,reference){
    this.target=turboTarget(rpm,load,reference);
    const tau=this.target>this.rpm ? .55 : .9;
    this.rpm+=(this.target-this.rpm)*-Math.expm1(-Math.max(0,seconds)/tau);
    return this.rpm;
  }
}
