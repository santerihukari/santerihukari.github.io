export const SHUTTER_PRESETS=[
  ...[8000,6400,5000,4000,3200,2500,2000,1600,1250,1000,800,640,500,400,320,250,200,160,125,100,80,60,50,40,30,25,20,15,13,10,8,6,5,4].map(n=>({value:1/n,label:`1/${n} s`})),
  ...[.3,.4,.5,.6,.8,1,1.3,1.6,2,2.5,3.2,4,5,6,8,10,13,15,20,25,30].map(value=>({value,label:`${value} s`})),
  ...[1,2,5,10,30,60].map(minutes=>({value:minutes*60,label:`${minutes} min`}))
];
export function shutterPreset(seconds){
  const preset=SHUTTER_PRESETS.find(p=>Math.abs(p.value-seconds)<=Math.max(p.value,seconds)*1e-9);
  return preset?String(preset.value):'custom';
}
export function shutterSliderIndex(seconds){
  let best=0,error=Infinity;
  for(const [i,preset]of SHUTTER_PRESETS.entries()){const delta=Math.abs(Math.log2(seconds)-Math.log2(preset.value));if(delta<error){error=delta;best=i;}}
  return best;
}
export function shutterLabel(seconds){
  const preset=SHUTTER_PRESETS.find(p=>String(p.value)===shutterPreset(seconds));
  if(preset)return preset.label;
  const scale=seconds>=3600?3600:seconds>=60?60:1,unit=scale===3600?'h':scale===60?'min':'s';
  return `${Number((seconds/scale).toPrecision(4))} ${unit} (custom)`;
}
export function noiseParameters(settings,spanWidth,spanHeight,width,height){
  if(settings.workMode!=='exposure'||!settings.sensorNoise)return {shot:0,read:0};
  const gain=settings.iso/100,pixelArea=(settings.pitch/6)**2;
  const bin=Math.max(1,(spanWidth*1000/settings.pitch/width)*(spanHeight*1000/settings.pitch/height));
  // Generic display-referred Poisson/Gaussian variance, not measured camera data.
  return {shot:gain/(6000*pixelArea*bin),read:(3*gain/(6000*pixelArea))**2/bin};
}
