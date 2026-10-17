import * as THREE from 'three';
import {flowState} from './cycle.mjs';

export const flowColors={air:'#29a9de',fuel:'#e5bb32',exhaust:'#a27cba',burn:'#ed784b'};

export class EngineFlow{
  constructor(scene){this.root=new THREE.Group();scene.add(this.root);this.routes=[];this.chambers=[];this.enabled=false;this.snapshot={visible:false};}
  dispose(){
    this.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    this.root.clear();this.routes=[];this.chambers=[];
  }
  build(p,reference){
    this.dispose();this.p=p;this.reference=reference;
    for(const path of reference.paths){
      const curve=new THREE.CatmullRomCurve3(path.points_mm.map(v=>new THREE.Vector3(...v)),false,'centripetal');
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(70)),
        new THREE.LineBasicMaterial({color:flowColors[path.kind],transparent:true,opacity:.28,depthTest:false,depthWrite:false}));
      line.renderOrder=25;this.root.add(line);
      const count=path.kind==='burn'?7:16,positions=new Float32Array(count*3);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:flowColors[path.kind],
        size:path.kind==='burn'?5:4.5,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
      particles.frustumCulled=false;particles.renderOrder=30;this.root.add(particles);
      this.routes.push({path,curve,line,particles,count,positions});
    }
    for(const cylinder of reference.cylinders){
      const geometry=new THREE.CylinderGeometry(1,1,1,28,1,true);geometry.rotateX(Math.PI/2);
      const chamber=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:flowColors.air,
        transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
      const faceGeometry=new THREE.PlaneGeometry(2,1);faceGeometry.rotateX(Math.PI/2);
      const cutFace=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({color:flowColors.air,
        transparent:true,opacity:.25,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
      cutFace.renderOrder=26;this.root.add(chamber,cutFace);this.chambers.push({cylinder,chamber,cutFace});
    }
  }
  update(angle,{enabled,cylinder=0,layers={},exploded=false,isolated=false,cutaway=false,settings=this.reference?.cycle_settings}){
    this.enabled=enabled;this.root.visible=enabled&&!exploded&&!isolated;
    if(!this.reference||!this.root.visible){this.snapshot={visible:false,particleCount:0};return;}
    const states=[1,2,3,4].map(i=>flowState(this.p,i,angle,settings));
    const point=new THREE.Vector3();let particleCount=0,checksum=0;
    for(const item of this.routes){
      const {path,curve,line,particles,count,positions}=item;
      const key=path.kind==='air'?'air':path.kind==='fuel'?'fuel':path.kind==='burn'?'burn':'exhaust';
      const gate=path.cylinder?states[path.cylinder-1][key]:Math.max(...states.map(s=>s[key]));
      const focused=!cylinder||!path.cylinder||path.cylinder===cylinder;
      const layer=layers[path.kind]!==false;
      line.visible=focused&&layer;particles.visible=focused&&layer&&gate>.005;
      if(!particles.visible)continue;
      particles.material.opacity=Math.min(1,.25+.75*gate);
      for(let i=0;i<count;i++){
        const t=((angle/120+i/count)%1+1)%1;
        curve.getPointAt(t,point);positions[i*3]=point.x;positions[i*3+1]=point.y;positions[i*3+2]=point.z;
        checksum+=point.x*(i+1)+point.y+point.z;
      }
      particles.geometry.attributes.position.needsUpdate=true;particleCount+=count;
    }
    for(const {cylinder:spec,chamber,cutFace} of this.chambers){
      const s=states[spec.cylinder-1],bottom=s.pinZ+this.p.piston_compression_height+.15;
      const height=Math.max(.1,spec.chamber_top_z_mm-bottom);
      chamber.visible=layers.chamber!==false&&(!cylinder||spec.cylinder===cylinder);
      chamber.position.set(spec.x_mm,0,bottom+height/2);chamber.scale.set(this.p.bore/2-2,this.p.bore/2-2,height);
      chamber.material.color.set(s.burn>.01?flowColors.burn:s.gas==='products'?flowColors.exhaust:flowColors.air);
      chamber.material.opacity=s.burn>.01?.3:.15+s.compressed*.1;
      cutFace.visible=chamber.visible&&cutaway;
      cutFace.position.set(spec.x_mm,.5,bottom+height/2);cutFace.scale.set(this.p.bore/2-2,1,height);
      cutFace.material.color.copy(chamber.material.color);cutFace.material.opacity=chamber.material.opacity+.13;
    }
    this.snapshot={visible:true,particleCount,checksum,states:states.map(s=>({local:s.local,air:s.air,fuel:s.fuel,burn:s.burn,exhaust:s.exhaust}))};
  }
}
