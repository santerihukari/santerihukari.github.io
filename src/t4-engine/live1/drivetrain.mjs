export const driveDefaults={gear:'1',engagement:1,bias:0};
export function driveSettings(input={},reference){
  const gear=Object.hasOwn(reference?.ratios||{},input.gear)?input.gear:'1';
  const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
  return {gear,engagement:clamp(input.engagement,0,1,1),bias:clamp(input.bias,-1,1,0)};
}
export function driveRates(reference,input={}){
  const s=driveSettings({...driveDefaults,...input},reference),ratio=reference.ratios[s.gear];
  const rates={crank:1,input:s.engagement,output:ratio&&s.engagement?-s.engagement/ratio:0};
  rates.carrier=rates.output?-rates.output/reference.final_ratio:0;
  rates.left=rates.carrier*(1-s.bias);rates.right=rates.carrier*(1+s.bias);
  rates.spider=rates.carrier*s.bias;
  for(let i=1;i<=5;i++)rates['loose_'+i]=-s.engagement/reference.ratios[String(i)];
  rates.reverse_idler=-s.engagement*reference.reverse_idler_ratio;rates.reverse_free=s.engagement/Math.abs(reference.ratios.R);
  for(const role of Object.keys(rates))if(rates[role]===0)rates[role]=0;
  return rates;
}
export function advanceDrive(phases,delta,reference,settings){
  const rates=driveRates(reference,settings);
  return Object.fromEntries(Object.entries(rates).map(([role,rate])=>[role,(phases[role]||0)+delta*rate]));
}
export function driveReadout(rpm,reference,settings){
  const rates=driveRates(reference,settings),circumference=reference.tyre_diameter_mm/1000*Math.PI;
  return {inputRpm:rpm*rates.input,outputRpm:rpm*rates.output,carrierRpm:rpm*rates.carrier,
    leftRpm:rpm*rates.left,rightRpm:rpm*rates.right,roadKph:rpm*rates.carrier*circumference*.06};
}
