const flat = {id:'flat',label:'Flat',curve:'0,1|0.25,1|0.5,1|0.75,1|1,1'};
const dished = {id:'dished',label:'Dished',curve:'0,1|0.25,0.75|0.5,0.5|0.75,0.75|1,1'};
const domed = {id:'domed',label:'Domed',curve:'0,1|0.25,1.25|0.5,1.5|0.75,1.25|1,1'};
export const profilePresets = Object.freeze({
  depth:[flat,{id:'front-high',label:'Front higher',curve:'0,1.5|0.5,1.25|1,1'},
    {id:'back-high',label:'Back higher',curve:'0,1|0.5,1.25|1,1.5'},dished,domed],
  width:[flat,dished,domed]
});

function points(curve) {
  return String(curve).split('|').map(token=>token.split(',').map(Number));
}

export function matchingPreset(kind, curve) {
  const data=points(curve);
  if(data.length>=2&&data.every(point=>point.length===2&&point.every(Number.isFinite)&&Math.abs(point[1]-1)<1e-8))return 'flat';
  return profilePresets[kind].find(preset=>{
    const candidate=points(preset.curve);
    return candidate.length===data.length&&candidate.every((point,i)=>point.every((value,j)=>Math.abs(value-data[i][j])<1e-8));
  })?.id || 'custom';
}

export function presetChanges(config, id, values, curveKey) {
  const preset=profilePresets[config.kind].find(candidate=>candidate.id===id);
  if(!preset)return null;
  const changes={[curveKey]:preset.curve};
  if(id!=='flat'&&(matchingPreset(config.kind,values[curveKey])==='flat'||Number(values[config.amountKey])===0))changes[config.amountKey]=config.kind==='width'?0.75:1;
  return changes;
}
