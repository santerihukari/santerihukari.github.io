import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {sensorFootprint,sensorDofRegion} from './field-of-view.mjs';

const colors=[0x78b6f2,0xf2ad78,0xb1cf85];
const descriptions={
  lens:['Lens','Focal length describes optical power. The glass models refract at real spherical surfaces; the ideal model is a zero-thickness phase plane.'],
  stop:['Aperture / entrance pupil','Here the iris is at the front vertex. Nominal f-number is effective focal length divided by entrance-pupil diameter. A clear lens edge can limit the opening further.'],
  sensor:['Sensor plane','Light is sampled here. Focus moves this plane in the prototype. Width and height determine crop; pixel pitch determines sampling.'],
  principal:['Principal point','Where the optical axis intersects the sensor in this centered-lens model. Sensor shift moves this point relative to the pixel grid. It is not a focal point.'],
  planes:['Principal planes H and H\u2032','Reference planes of the equivalent first-order lens. Object and image distances for thick lenses cannot generally be measured from the glass center.'],
  focus:['First-order focus plane','The visible patch is clipped to the full sensor field of view. The flat object-space plane forms its paraxial image at the sensor. Real lens designs can have a curved best-focus surface; that field curvature is not calculated here.'],
  target:['Scene target','Range is measured from the entrance-pupil centre. Moving a target changes its range along a fixed direction; X/Y angles change that direction. Focus uses axial depth. Physical target size stays fixed, and the other targets and focus do not move.'],
  focal:['Focal point','An on-axis collimated bundle focuses here in the first-order model. Focal length is not the distance to a subject.']};

export class OpticalViewer{
  constructor(canvas,labelLayer,world,sensorCanvas,onSelect){
    this.canvas=canvas;this.labels=labelLayer;this.world=world;this.sensorCanvas=sensorCanvas;this.onSelect=onSelect;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight('#e4f0ff','#3a4043',2.2));
    const light=new THREE.DirectionalLight('#fff1dc',3);light.position.set(80,140,160);this.scene.add(light);
    this.camera=new THREE.PerspectiveCamera(38,1,.05,10000);this.camera.position.set(160,125,340);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(-45,0,0);this.controls.enableDamping=true;this.controls.dampingFactor=.09;
    this.group=new THREE.Group();this.scene.add(this.group);this.mode='system';this.animated=false;this.data=null;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.hover=null;
    this.texture=new THREE.CanvasTexture(sensorCanvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.center.set(.5,.5);
    this.dots=[];this.labelData=[];this.clickables=[];this.fieldBounds=[];
    let down=null;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
    canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)this.pick(e,true);down=null;});
    canvas.addEventListener('pointermove',e=>this.pick(e,false));canvas.addEventListener('pointerleave',()=>this.highlight(null));
    new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.resize();
  }
  resize(){const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  clear(){
    this.highlight(null);
    this.group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map&&m.map!==this.texture)m.map.dispose();m.dispose();}});
    this.group.clear();this.labels.innerHTML='';this.dots=[];this.labelData=[];this.clickables=[];this.fieldBounds=[];
  }
  point(x,y,z){
    if(this.mode==='system'&&z<0){const depth=-60*Math.log1p(-z/150),scale=depth/z;return new THREE.Vector3(depth,y*scale,-x*scale);}
    return new THREE.Vector3(z,y,-x);
  }
  add(mesh,kind){this.group.add(mesh);if(kind){mesh.userData.kind=kind;this.clickables.push(mesh);}return mesh;}
  label(text,point,note=''){
    const el=document.createElement('div');el.className='world-label';el.textContent=text;
    if(note){const sub=document.createElement('em');sub.textContent=note;el.append(sub);}this.labels.append(el);this.labelData.push({el,point});
  }
  line(points,color,opacity=1){
    const g=new THREE.BufferGeometry().setFromPoints(points);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));this.add(l);return l;
  }
  marker(point,color,kind,size=1.3){const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,12,8),new THREE.MeshBasicMaterial({color}));mesh.position.copy(point);return this.add(mesh,kind);}
  fieldMesh(corners,indices,opacity){
    const points=corners.map(c=>this.point(...c));this.fieldBounds.push(...points);
    const geometry=new THREE.BufferGeometry().setFromPoints(points);geometry.setIndex(indices);geometry.computeVertexNormals();
    return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xabc8b5,opacity,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  }
  update(data){this.data=data;if(this.mode==='scene'){this.clear();return;}this.rebuild();}
  rebuild(){
    if(!this.data)return;this.clear();const d=this.data,p=d.settings;
    this.scene.background=new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--viewer').trim());
    const size=Math.max(20,d.clear_diameter),lensRadius=d.clear_diameter/2;
    const farthest=Math.max(...d.targets.map(t=>t.distance));
    this.line([new THREE.Vector3(this.mode==='system'?this.point(0,0,-farthest).x-25:-p.focal*1.8,0,0),new THREE.Vector3(Math.max(d.sensor_z,d.back_focal_z)+20,0,0)],0x84919a,.3);
    if(!d.surfaces.length){
      const disc=new THREE.Mesh(new THREE.CircleGeometry(lensRadius,64),new THREE.MeshBasicMaterial({color:0x77b8d7,opacity:.20,transparent:true,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.y=Math.PI/2;this.add(disc,'lens');
      const ring=new THREE.Mesh(new THREE.TorusGeometry(lensRadius,.5,8,64),new THREE.MeshStandardMaterial({color:0x83c0dc,metalness:.3,roughness:.4}));ring.rotation.y=Math.PI/2;this.add(ring,'lens');
    }else{
      for(let i=0;i<d.surfaces.length-1;i++){
        const front=d.surfaces[i],back=d.surfaces[i+1];const profile=[];
        const sag=(r,a)=>r-Math.sign(r)*Math.sqrt(Math.max(0,r*r-a*a));
        for(let j=0;j<=40;j++){const a=lensRadius*j/40;profile.push(new THREE.Vector2(a,front.z+sag(front.radius,a)));}
        for(let j=40;j>=0;j--){const a=lensRadius*j/40;profile.push(new THREE.Vector2(a,back.z+sag(back.radius,a)));}
        const glass=new THREE.Mesh(new THREE.LatheGeometry(profile,72),new THREE.MeshPhysicalMaterial({color:i?0xe2c8a2:0x8bc6d8,transparent:true,opacity:.35,side:THREE.DoubleSide,roughness:.12,metalness:.1,depthWrite:false}));glass.rotation.z=-Math.PI/2;this.add(glass,'lens');
        for(const sign of [-1,1])this.line(profile.slice(0,41).map(q=>new THREE.Vector3(q.y,sign*q.x,0)),i?0xc9a77f:0x79bfd7,.7);
      }
    }
    this.label(p.model==='ideal'?'Ideal lens':p.model==='singlet'?'N-BK7':'Cemented doublet',new THREE.Vector3(d.glass_length/2,lensRadius+4,0),`${d.efl.toFixed(1)} mm EFL`);
    const iris=new THREE.Shape();iris.absarc(0,0,Math.max(lensRadius+2,d.aperture/2+3),0,2*Math.PI,false);
    const opening=new THREE.Path();
    if(p.blades){for(let i=0;i<=p.blades;i++){const angle=-2*Math.PI*i/p.blades,x=d.aperture/2*Math.cos(angle),y=d.aperture/2*Math.sin(angle);if(i===0)opening.moveTo(x,y);else opening.lineTo(x,y);}}else opening.absarc(0,0,d.aperture/2,0,2*Math.PI,true);
    iris.holes.push(opening);
    const stop=new THREE.Mesh(new THREE.ShapeGeometry(iris,72),new THREE.MeshStandardMaterial({color:0x60696e,metalness:.45,roughness:.4,side:THREE.DoubleSide}));stop.rotation.y=Math.PI/2;stop.position.x=-.25;this.add(stop,'stop');
    if(p.blades){
      const points=[];for(let i=0;i<=p.blades;i++){const a=2*Math.PI*i/p.blades;points.push(new THREE.Vector3(-.4,d.aperture/2*Math.sin(a),-d.aperture/2*Math.cos(a)));}this.line(points,0xe5c9a8);
    }
    const sensor=new THREE.Mesh(new THREE.PlaneGeometry(p.sensorW,p.sensorH),new THREE.MeshBasicMaterial({map:this.texture,side:THREE.DoubleSide}));sensor.rotation.y=Math.PI/2;sensor.position.set(d.sensor_z,p.shiftY,-p.shiftX);this.texture.rotation=p.upright?Math.PI:0;this.add(sensor,'sensor');
    const outline=[];for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]])outline.push(new THREE.Vector3(d.sensor_z,p.shiftY+y*p.sensorH/2,-p.shiftX-x*p.sensorW/2));this.line(outline,0xafb8c0);
    this.label('Sensor',new THREE.Vector3(d.sensor_z,p.shiftY-p.sensorH/2-5,-p.shiftX),`${p.sensorW} \u00d7 ${p.sensorH} mm`);
    const pp=new THREE.Vector3(d.sensor_z+.15,0,0);this.marker(pp,0xf6be76,'principal',.8);
    this.line([pp.clone().add(new THREE.Vector3(0,-2,0)),pp.clone().add(new THREE.Vector3(0,2,0))],0xffffff);
    this.line([pp.clone().add(new THREE.Vector3(0,0,-2)),pp.clone().add(new THREE.Vector3(0,0,2))],0xffffff);
    if(this.mode==='bench'){
      for(const [name,z] of [['H',d.principal_planes.front],['H\u2032',d.principal_planes.back]]){
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(size*1.2,size*1.2),new THREE.MeshBasicMaterial({color:0xb49fe1,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}));plane.rotation.y=Math.PI/2;plane.position.x=z;this.add(plane,'planes');
        this.line([new THREE.Vector3(z,-size*.6,0),new THREE.Vector3(z,size*.6,0)],0xa998ce,.55);this.label(name,new THREE.Vector3(z,-size*.65,0));
      }
      for(const [name,z] of [['F',d.front_focal_z],['F\u2032',d.back_focal_z]]){this.marker(new THREE.Vector3(z,0,0),0xd7c694,'focal',.7);this.label(name,new THREE.Vector3(z,4,0));}
    }
    if(this.mode==='system'){
      for(const [i,t] of d.targets.entries()){
        const point=this.point(t.x,t.y,-t.distance);const marker=this.marker(point,colors[i],'target',2.1);marker.userData.target=i;
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(24,30),new THREE.MeshBasicMaterial({color:colors[i],opacity:.065,transparent:true,side:THREE.DoubleSide,depthWrite:false}));plane.rotation.y=Math.PI/2;plane.position.copy(point);plane.userData.target=i;this.add(plane,'target');
        this.label(t.name,point.clone().add(new THREE.Vector3(0,19,0)),`${(t.radial_distance/1000).toFixed(2)} m radial`);
      }
      if(d.effective_focus_m){
        const corners=sensorFootprint(d,d.effective_focus_m*1000),plane=this.fieldMesh(corners,[0,1,2,0,2,3],.08);plane.userData.opticalCorners=corners;this.add(plane,'focus');
        const edge=corners.map(c=>this.point(...c));this.line([...edge,edge[0]],0xabc8b5,.28);
        this.label('First-order focus plane',edge[2].clone().add(edge[3]).multiplyScalar(.5).add(new THREE.Vector3(0,-8,0)),`${d.effective_focus_m.toFixed(2)} m axial`);
      }
      const region=sensorDofRegion(d);
      if(region){
        const corners=[...region.near,...region.far],indices=[0,1,2,0,2,3];
        if(!region.unbounded)indices.push(4,6,5,4,7,6);
        for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,j+4,i,j+4,i+4);}
        const volume=this.fieldMesh(corners,indices,.045);volume.userData={kind:'dof',region};this.add(volume);
        const a=region.near.map(c=>this.point(...c)),b=region.far.map(c=>this.point(...c));
        this.line([...a,a[0]],0xabc8b5,.2);if(!region.unbounded)this.line([...b,b[0]],0xabc8b5,.2);
        for(let i=0;i<4;i++)this.line([a[i],b[i]],0xabc8b5,.16);
        if(region.unbounded)this.label('DOF continues to infinity',b[2].clone().add(b[3]).multiplyScalar(.5).add(new THREE.Vector3(0,-8,0)),'Open end is a display cutoff');
      }
      if(d.focus_state==='infinity')this.label('Focus at infinity',new THREE.Vector3(-245,Math.max(45,...this.fieldBounds.map(q=>q.y))+8,0),'No finite focus plane');
    }
    if(p.rays){for(const ray of d.rays){
      let source=ray.points;
      if(this.mode==='bench'&&source.length>1){const z=-p.focal*1.6,a=source[0],b=source[1],k=(z-a[2])/(b[2]-a[2]);source=[[a[0]+k*(b[0]-a[0]),a[1]+k*(b[1]-a[1]),z],...source.slice(1)];}
      const points=source.map(q=>this.point(...q));const c=p.rgb&&d.surfaces.length?(ray.wavelength<500?0x70aaff:ray.wavelength>600?0xf29b83:0xa7d693):colors[ray.target];
      this.line(points,ray.passed?c:0x777777,ray.passed?.46:.18);
      if(this.dots.length<25&&ray.passed){const dot=this.marker(points[0],c,null,.45);this.dots.push({dot,points});}
    }}
  }
  setMode(mode){this.mode=mode;if(mode==='scene'){this.clear();}else this.rebuild();this.fit();}
  fit(){
    if(!this.data)return;const d=this.data;
    if(this.mode==='scene'){
      const box=new THREE.Box3();for(const t of this.world.targets)box.expandByObject(t.root);box.expandByPoint(new THREE.Vector3(0,0,0));
      const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z*.65);
      this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(span*.7,span*.5,span*1.25));this.camera.near=.01;this.camera.far=2000;
    }else{
      const box=new THREE.Box3();for(const t of d.targets)box.expandByPoint(this.point(t.x,t.y,-t.distance));box.expandByPoint(new THREE.Vector3(d.sensor_z,0,0));
      if(this.mode==='system')for(const point of this.fieldBounds)box.expandByPoint(point);
      const size=box.getSize(new THREE.Vector3());
      const center=this.mode==='bench'?new THREE.Vector3(d.sensor_z*.42,0,0):box.getCenter(new THREE.Vector3());
      const span=this.mode==='bench'?Math.max(d.sensor_z+d.efl*.8,d.clear_diameter*1.8):Math.max(340,size.x*1.25,size.z*1.7);
      const factor=Math.max(1,1/this.camera.aspect*1.2);this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(span*.35,span*.28,span*1.18).multiplyScalar(factor));this.camera.near=.05;this.camera.far=10000;
    }
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  highlight(object){
    if(this.hover===object)return;
    for(const item of [this.hover,object])if(item){const mats=Array.isArray(item.material)?item.material:[item.material];for(const m of mats)if(m?.emissive)m.emissive.setHex(item===object?0x183244:0x000000);}
    this.hover=object;this.canvas.style.cursor=object?'pointer':'grab';
  }
  pick(event,click){
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.mode==='scene'?this.raycaster.intersectObjects(this.world.targets.map(t=>t.panel)):this.raycaster.intersectObjects(this.clickables);
    const object=hits[0]?.object;this.highlight(object||null);
    if(click&&object){const kind=this.mode==='scene'?'target':object.userData.kind;const info=descriptions[kind];if(info)this.onSelect(info,object.userData.target);}
  }
  frame(t){
    this.controls.update();
    if(this.mode!=='scene'){
      for(const {dot,points} of this.dots){dot.visible=this.animated;if(!this.animated)continue;const f=(t*.0002)%1,scaled=f*(points.length-1),i=Math.min(points.length-2,Math.floor(scaled));dot.position.copy(points[i]).lerp(points[i+1],scaled-i);}
      const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
      const occupied=[];
      for(const label of this.labelData){
        const v=label.point.clone().project(this.camera),visible=v.z>-1&&v.z<1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.93;label.el.hidden=!visible;if(!visible)continue;
        const width=label.el.offsetWidth,height=label.el.offsetHeight;
        const left=Math.max(width/2+5,Math.min(w-width/2-5,(v.x*.5+.5)*w));
        const original=(-v.y*.5+.5)*h;let placed=false;
        for(const offset of [0,-20,20,-40,40,-60,60]){
          const top=Math.max(65+height,Math.min(h-85,original+offset));
          const box={l:left-width/2-3,r:left+width/2+3,t:top-height-3,b:top+3};
          if(occupied.some(o=>box.l<o.r&&box.r>o.l&&box.t<o.b&&box.b>o.t))continue;
          occupied.push(box);label.el.style.left=`${left}px`;label.el.style.top=`${top}px`;placed=true;break;
        }
        label.el.hidden=!placed;
      }
      this.renderer.render(this.scene,this.camera);
    }else this.renderer.render(this.world.scene,this.camera);
  }
}
