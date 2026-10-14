export function printPartFor(name='') {
  if(name.startsWith('front_pin_'))return 'front_cap_pin';
  if(name.startsWith('rear_pin_'))return 'rear_cap_pin';
  if(name.includes('_clip_'))return 'cap_clip';
  return name;
}

export function travel(value,maximum) {
  if(String(value).trim()==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,Math.min(maximum,number)):null;
}

// Mirrors the native spring reference, including its finite-difference tangent.
export function springGeometry(p,stroke) {
  const count=Math.max(80,Math.trunc(p.spring_turns*60)),sides=12;
  const wire=p.spring_wire_diameter/2,radius=(p.spring_outer_diameter-p.spring_wire_diameter)/2;
  const start=p.piston_length+stroke+wire,length=p.chamber_length-wire-start;
  const centers=[],angles=[],positions=[],indices=[];
  for(let i=0;i<count;i++){
    const t=i/(count-1),angle=2*Math.PI*p.spring_turns*t;angles.push(angle);
    centers.push([start+t*length,radius*Math.cos(angle),p.axis_height+radius*Math.sin(angle)]);
  }
  for(let i=0;i<count;i++){
    const before=centers[Math.max(0,i-1)],after=centers[Math.min(count-1,i+1)];
    const tangent=after.map((v,j)=>v-before[j]),norm=Math.hypot(...tangent);
    const [tx,ty,tz]=tangent.map(v=>v/norm),c=Math.cos(angles[i]),s=Math.sin(angles[i]);
    const radial=[0,c,s],side=[ty*s-tz*c,-tx*s,tx*c];
    for(let j=0;j<sides;j++){
      const phi=j*2*Math.PI/sides;
      positions.push(...centers[i].map((v,k)=>v+wire*(Math.cos(phi)*radial[k]+Math.sin(phi)*side[k])));
      if(i<count-1){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
    }
  }
  positions.push(...centers[0],...centers[count-1]);
  for(let j=0;j<sides;j++)indices.push(count*sides,(j+1)%sides,j,count*sides+1,(count-1)*sides+j,(count-1)*sides+(j+1)%sides);
  return {positions,indices};
}

export function exportParts(data,stroke) {
  return data.parts.map(part=>part.name==='spring'?{...part,...springGeometry(data.parameters,stroke)}:{...part});
}
