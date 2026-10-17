export const markedPulleys=['aux_crank','aux_alt','aux_water','steering_crank','steering_pulley'];

export function pulleyMarkSpecs(id,bounds){
  if(!markedPulleys.includes(id))return [];
  const [min,max]=bounds,radius=Math.min(max[1]-min[1],max[2]-min[2])/2;
  const y=(min[1]+max[1])/2,z=(min[2]+max[2])/2;
  const inner=Math.max(12,radius*.22),outer=radius*.89,specs=[];
  for(const side of [-1,1]){
    const x=(side<0?min[0]:max[0])+side*.18;
    for(const angle of [0,Math.PI*2/3,Math.PI*4/3]){
      const radial=(inner+outer)/2;
      specs.push({kind:'spoke',color:'#34383b',size:[.24,radius*.15,outer-inner],angle,
        center:[x,y-radial*Math.sin(angle),z+radial*Math.cos(angle)]});
    }
    specs.push({kind:'witness',color:'#f6f7e8',size:[.26,radius*.065,outer-inner],angle:0,
      center:[x+side*.15,y,z+(inner+outer)/2]});
  }
  return specs;
}
