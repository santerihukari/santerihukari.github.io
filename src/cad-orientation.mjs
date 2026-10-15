// World axes in camera space, using the inverse camera quaternion.
export function projectedAxes({x,y,z,w}) {
  return [
    {name:'x', x:1-2*(y*y+z*z), y:2*(x*y-w*z), z:2*(x*z+w*y)},
    {name:'y', x:2*(x*y+w*z), y:1-2*(x*x+z*z), z:2*(y*z-w*x)},
    {name:'z', x:2*(x*z-w*y), y:2*(y*z+w*x), z:1-2*(x*x+y*y)}
  ];
}

export function createCoordinateIndicator(viewport, camera, controls) {
  const native=viewport.querySelector('#coordinate-indicator');
  if(native){native.classList.add('cad-coordinate-indicator-native');return native;}
  const existing=viewport.querySelector('.cad-coordinate-indicator');
  if(existing)return existing;
  const ns='http://www.w3.org/2000/svg';
  const widget=document.createElement('div');widget.className='cad-coordinate-indicator';
  widget.setAttribute('role','img');widget.setAttribute('aria-label','Coordinate axes: red X, green Y, blue Z. Model units: millimetres.');
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
  const groups=new Map();
  for(const name of ['x','y','z']){
    const group=document.createElementNS(ns,'g');group.dataset.axis=name;
    const line=document.createElementNS(ns,'line'),label=document.createElementNS(ns,'text');label.textContent=name.toUpperCase();
    group.append(line,label);svg.append(group);groups.set(name,group);
  }
  const origin=document.createElementNS(ns,'circle');origin.setAttribute('cx','50');origin.setAttribute('cy','46');origin.setAttribute('r','2');svg.append(origin);
  const units=document.createElementNS(ns,'text');units.classList.add('cad-coordinate-units');units.setAttribute('x','50');units.setAttribute('y','94');units.textContent='XYZ / mm';svg.append(units);
  widget.append(svg);viewport.append(widget);
  function update(){
    for(const axis of projectedAxes(camera.quaternion).sort((a,b)=>a.z-b.z)){
      const group=groups.get(axis.name),line=group.querySelector('line'),label=group.querySelector('text');
      const headOn=Math.hypot(axis.x,axis.y)<.12;
      for(const [key,value]of Object.entries({x1:50,y1:46,x2:50+axis.x*28,y2:46-axis.y*28}))line.setAttribute(key,value);
      label.setAttribute('x',headOn?62:50+axis.x*38);label.setAttribute('y',headOn?38:46-axis.y*38);
      group.style.opacity=axis.z<-.1?'.6':'1';svg.insertBefore(group,origin);
    }
  }
  controls.addEventListener('change',update);update();
  return widget;
}
