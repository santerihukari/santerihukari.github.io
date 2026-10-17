import {PATTERNS} from '../legacy_library/texture-patterns.mjs';
import {texturedMesh} from '../legacy_library/contact-texture.mjs';
import {validate} from '../legacy_library/parameters.mjs';
import {BOLT,WOOD_SCREW,seatDimensions,boltPlacement} from './hardware.mjs';

const rad=Math.PI/180;
const number=(key,label,min,max,step,value,extra={})=>({key,label,min,max,step,default:value,...extra});
export const meta={params:[
  number('width','Hold width (mm)',70,140,1,100),
  number('grip_depth','Grip depth before rounding (mm)',12,32,.5,22),
  number('incut_angle','Incut angle (degrees)',0,30,1,15),
  number('edge_radius','Grip edge radius (mm)',2,8,.25,4),
  number('height','Body height (mm)',58,90,1,66),
  number('projection','Dome projection (mm)',28,50,.5,35),
  {key:'surface_texture',label:'Printable grip texture',type:'select',default:'layer-random-jagged',
    options:PATTERNS.map(p=>({value:p.slug,label:(p.aggressive?'Aggressive: ':'')+p.name})),
    hint:'Real relief on the shelf, rounded lip and curved sides; mounting surfaces remain smooth.'},
  number('texture_layer_height','Texture layer height (mm)',.1,.4,.01,.2,{input:'number',
    visibleIf:{key:'surface_texture',op:'in',value:['layer-random-waves','layer-random-jagged']},
    hint:'Back against the bed (model -Y). Match the first and subsequent slicer layer heights.'}),
  number('bolt_clearance','M10 through-hole diameter (mm)',10.2,12,.1,11,{input:'number'}),
  number('bolt_head_diameter','Bolt head access / seat diameter (mm)',22.4,25,.1,22.8,{input:'number',
    hint:'IKH PUK10040109A: head up to 22.4 mm, 90 degrees, 6 mm hex. Default adds 0.4 mm diametral print allowance; verify after printing.'}),
  number('bolt_angle','Countersink included angle (degrees)',80,100,1,90,{input:'number'}),
  number('bolt_web','Solid web behind bolt seat (mm)',6,16,.5,10,{hint:'The 40 mm bolt includes its head. Seat depth controls the remaining reach into the wall / T-nut; that engagement is not yet verified.'}),
  {key:'screw_count',label:'Smaller screw holes',type:'select',default:3,options:[{value:2,label:'2 side screws'},{value:3,label:'3 screws (sides + lower)'}]},
  number('screw_clearance','Wood-screw clearance diameter (mm)',4.5,6.5,.1,5.5,{input:'number',
    hint:'Provisional 5 mm wood screw + 0.5 mm clearance through the hold, not a pilot hole in the wall. T25 alone does not specify screw dimensions.'}),
  number('screw_head_diameter','Screw head access / seat diameter (mm)',9,12,.1,10.4,{input:'number',
    hint:'Reference: 10 mm countersunk wood-screw head + 0.4 mm trial allowance. Check actual head diameter, ribs and countersink angle.'}),
  number('screw_web','Solid web behind screw seats (mm)',3,9,.5,5.5)
],validate(p){
  const errors={};
  if(p.grip_depth>p.projection*.8)errors.grip_depth='Keep grip depth at or below 80% of the dome projection.';
  if(p.edge_radius>p.grip_depth*.3)errors.edge_radius='The edge radius needs more grip depth.';
  if(!Object.keys(errors).length){
    try{
      const profile=section(p);
      if(profile.lineEnd[0]<5)errors.edge_radius='Rounding consumes the shelf. Increase grip depth or reduce the radius.';
      const holes=mounting(p);
      for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++){
        if(Math.hypot(holes[i].x-holes[j].x,holes[i].z-holes[j].z)<(holes[i].head+holes[j].head)/2+1)
          errors.bolt_head_diameter='Mounting recesses are too close. Increase body height/width, reduce head diameters or use two screw holes.';
      }
      for(const hole of holes){
        const radius=hole.head/2+2.5,depth=seatDimensions(hole).mouth_from_wall_mm;
        for(let i=0;i<48;i++){
          const a=i*Math.PI/24,x=hole.x+radius*Math.cos(a),z=hole.z+radius*Math.sin(a);
          if(!inside(p,profile,x,depth,z)){errors[hole.kind==='bolt'?'bolt_web':'screw_web']='The mounting seat leaves too little surrounding material. Increase body width/height/projection or reduce the seat size/web.';break;}
        }
      }
    }catch(error){errors.edge_radius=error.message;}
  }
  return errors;
},migrateLink(values,search){
  // The first prototype used a smaller DIN head, not this IKH product's head.
  if(search.has('bolt_head_diameter')&&Number(search.get('bolt_head_diameter'))===20.4){
    values.bolt_head_diameter=22.8;
    if(search.has('screw_clearance')&&Number(search.get('screw_clearance'))===5.4)values.screw_clearance=5.5;
  }
  return values;
}};

export function settings(input={}){
  const values={...Object.fromEntries(meta.params.map(p=>[p.key,p.default])),...input},result=validate(meta,values);
  if(!result.valid)throw new Error(Object.values(result.errors)[0]);
  return result.params;
}

// A line cuts an elliptical dome. A true tangent circle rounds the cut's lip.
export function section(p){
  const h=p.height/2,d=p.projection,r=p.edge_radius,a=p.incut_angle*rad;
  const first=Math.asin(p.grip_depth/d),back=h*Math.cos(first)-p.grip_depth*Math.tan(a);
  const normal=[-Math.sin(a),Math.cos(a)];
  const ellipse=t=>[d*Math.sin(t),h*Math.cos(t)];
  const outward=t=>{const y=Math.sin(t)/d,z=Math.cos(t)/h,n=Math.hypot(y,z);return[y/n,z/n];};
  const centre=t=>ellipse(t).map((v,i)=>v-r*outward(t)[i]);
  const f=t=>{const c=centre(t);return normal[0]*c[0]+normal[1]*(c[1]-back)+r;};
  let lo=first,hi=Math.PI/2-.02;
  if(f(hi)>0)throw new Error('The requested lip radius does not fit this dome.');
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}
  const t=(lo+hi)/2,c=centre(t),n=outward(t),q=c.map((v,i)=>v+r*normal[i]);
  const start=Math.atan2(normal[1],normal[0]),end=Math.atan2(n[1],n[0]);
  return {halfHeight:h,back,lineEnd:q,circle:c,ellipseStart:t,arcStart:start,arcEnd:end,
    textureEnd:Math.min(Math.PI/2-.08,t+.32),ellipse};
}

function top(p,s,y){
  if(y<=s.lineEnd[0])return s.back+y*Math.tan(p.incut_angle*rad);
  const end=s.ellipse(s.ellipseStart);
  if(y<end[0])return s.circle[1]+Math.sqrt(Math.max(0,p.edge_radius**2-(y-s.circle[0])**2));
  return s.halfHeight*Math.sqrt(Math.max(0,1-(y/p.projection)**2));
}
function scaleAt(p,x){return Math.sqrt(Math.max(0,1-(2*x/p.width)**2));}
function inside(p,s,x,y,z){
  const scale=scaleAt(p,x);if(scale<1e-6||y<0||y>scale*p.projection)return false;
  const localY=y/scale,low=-s.halfHeight*Math.sqrt(Math.max(0,1-(localY/p.projection)**2));
  return z/scale>=low&&z/scale<=top(p,s,localY);
}

export function mounting(p){
  const holes=[{kind:'bolt',x:0,z:-p.height*.03,bore:p.bolt_clearance,head:p.bolt_head_diameter,angle:p.bolt_angle,web:p.bolt_web},
    ...[-1,1].map(side=>({kind:'screw',x:side*p.width*.32,z:-p.height*.08,bore:p.screw_clearance,head:p.screw_head_diameter,angle:90,web:p.screw_web}))];
  if(p.screw_count===3)holes.push({kind:'screw',x:0,z:-p.height*.35,bore:p.screw_clearance,head:p.screw_head_diameter,angle:90,web:p.screw_web});
  return holes;
}

export function baseMesh(p){
  const s=section(p),outline=[[0,s.back]];
  const append=(point,count)=>{for(let i=1;i<=count;i++)outline.push(point(i/count));};
  append(t=>[s.lineEnd[0]*t,s.back+(s.lineEnd[1]-s.back)*t],Math.ceil(s.lineEnd[0]/.6));
  append(t=>{const a=s.arcStart+(s.arcEnd-s.arcStart)*t;return[s.circle[0]+p.edge_radius*Math.cos(a),s.circle[1]+p.edge_radius*Math.sin(a)];},Math.ceil((s.arcStart-s.arcEnd)*p.edge_radius/.3));
  append(t=>s.ellipse(s.ellipseStart+(Math.PI-s.ellipseStart)*t),Math.ceil((Math.PI-s.ellipseStart)*Math.max(p.projection,s.halfHeight)/.5));
  outline.at(-1)[0]=0;
  const vertices=[-p.width/2,0,0],faces=[],rings=Math.ceil(p.width/.8),count=outline.length;
  for(let i=1;i<rings;i++){
    const angle=-Math.PI/2+Math.PI*i/rings,scale=Math.cos(angle),x=p.width/2*Math.sin(angle);
    for(const [y,z]of outline)vertices.push(x,-scale*y,scale*z);
  }
  const index=(i,j)=>1+(i-1)*count+j;
  for(let j=0;j<count;j++)faces.push(0,index(1,(j+1)%count),index(1,j));
  for(let i=1;i<rings-1;i++)for(let j=0;j<count;j++){
    const k=(j+1)%count,a=index(i,j),b=index(i+1,j),c=index(i+1,k),d=index(i,k);
    faces.push(a,c,b,a,d,c);
  }
  const end=vertices.length/3;vertices.push(p.width/2,0,0);
  for(let j=0;j<count;j++)faces.push(end,index(rings-1,j),index(rings-1,(j+1)%count));
  return {positions:new Float32Array(vertices),indices:new Uint32Array(faces)};
}

export function contactRegions(p){
  const s=section(p),endY=p.projection*Math.sin(s.textureEnd);
  return [{side:'lower',sign:1,originX:-p.width/2,x0:-p.width/2,x1:p.width/2,y0:-p.projection,y1:0,z0:-p.height,z1:p.height,
    height(x,y){const scale=scaleAt(p,x),local=-y/scale;if(scale<1e-6||local<0||local>endY)return NaN;return scale*top(p,s,local);},
    edgeDistance(x,y){const scale=scaleAt(p,x);return Math.min(x+p.width/2,p.width/2-x,-y,scale*endY+y);}
  }];
}

let engine;
async function getEngine(){
  engine||=import('../../assets/cad/coffee-filter/manifold/manifold.js').then(async({default:create})=>{const api=await create();api.setup();return api;});
  return engine;
}

export async function buildMesh(input={},progress=()=>{}){
  const p=settings(input),api=await getEngine(),M=api.Manifold,resources=[];
  const keep=solid=>{resources.push(solid);return solid;};
  try{
    let mesh=baseMesh(p),texture=null;
    if(p.surface_texture!=='none'){
      progress('texture');const result=texturedMesh(mesh,contactRegions(p),p.surface_texture,p);mesh=result.mesh;texture=result.report;
    }
    progress('geometry');
    const raw=keep(M.ofMesh(new api.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices})));
    if(raw.status()!=='NoError')throw new Error('The hold surface is not a closed mesh.');
    const holes=mounting(p),tools=[];
    const cylinder=(h,r1,r2,x,y,z)=>{
      const tool=keep(M.cylinder(h,r1,r2,96)),turned=keep(tool.rotate([90,0,0]));return keep(turned.translate([x,-y,z]));
    };
    // Remove fastener tools after texturing: every seat and bore stays smooth.
    for(const hole of holes){
      const {countersink_depth_mm:depth,mouth_from_wall_mm:mouth}=seatDimensions(hole);
      tools.push(cylinder(p.projection+2,hole.bore/2,hole.bore/2,hole.x,-1,hole.z),
        cylinder(depth,hole.bore/2,hole.head/2,hole.x,hole.web,hole.z),
        cylinder(p.projection+1-mouth,hole.head/2,hole.head/2,hole.x,mouth,hole.z));
    }
    const united=keep(M.union(tools)),solid=keep(raw.subtract(united));
    if(solid.status()!=='NoError'||solid.volume()<=0)throw new Error('The mounting cuts did not produce a valid hold.');
    const pieces=solid.decompose();try{if(pieces.length!==1)throw new Error('The selected parameters split the hold.');}finally{pieces.forEach(part=>part.delete());}
    const final=solid.getMesh(),positions=new Float32Array(final.vertProperties),indices=new Uint32Array(final.triVerts);
    const placement=boltPlacement(holes[0]);
    const warnings=['Unvalidated prototype: no load rating or installation torque is specified. A closed digital mesh does not prove climbing safety. Check the actual bolt head, screw seats and wall hardware.',
      ...(placement?[`M10x40 reference envelope: about ${placement.projection_behind_hold_mm.toFixed(1)} mm projects behind the hold. Wall thickness, T-nut position and engagement remain unverified.`]:['Edited bolt-seat dimensions do not match the specified IKH M10x40 reference.']),
      'Smaller seats assume a 5 mm countersunk wood screw with a 10 mm head and 90-degree cone. T25 specifies the driver only; actual screw dimensions and fit remain unconfirmed.',
      ...(texture?.aggressive?['Sharp texture can abrade skin; inspect the sliced preview and print before any controlled evaluation.']:[]),
      ...(texture?.layer_height_mm?[`Layer bands: ${p.texture_layer_height.toFixed(2)} mm, back against bed (model -Y). Slicer reproduction and grip have not been verified.`]:[])];
    return {mesh:{positions,indices},warnings,report:{copyright:'Santeri Hukari',parameters:p,texture,wall_plane_y_mm:0,print_layer_axis:'-Y',mounting:holes.map(hole=>({...hole,seat:seatDimensions(hole)})),
      hardware:{bolt:BOLT,bolt_placement:placement,wood_screw:WOOD_SCREW},
      volume_mm3:solid.volume(),structural_status:'NOT VALIDATED',grip_rounding:'Tangent circle between planar shelf and elliptical front; curved width caps are textured too.'}};
  }finally{resources.reverse().forEach(solid=>solid.delete());}
}
