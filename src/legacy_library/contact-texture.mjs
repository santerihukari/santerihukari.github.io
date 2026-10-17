import {PATTERNS,patternFor,textureOffset,TEXTURE_SEED} from './texture-patterns.mjs';
import {binarySTL} from '../drone_frame/exports.mjs';
export const TEXTURE_STEP=0.25;
const LIMIT=2000000,TOLERANCE=0.15;

export function withContactTextures(model) {
  const param={key:'surface_texture',label:'Finger-contact texture',type:'select',default:'none',
    description:'Physical relief included in STL and GLB. Aggressive presets have sharp edges and untested skin comfort.',
    options:PATTERNS.map(pattern=>({value:pattern.slug,label:(pattern.aggressive?'Aggressive: ':'')+(pattern.height?`${pattern.name} (${Math.abs(pattern.height).toFixed(2)} mm${pattern.height<0?' deep':''})`:pattern.name),description:pattern.notes}))};
  const layer={key:'texture_layer_height',label:'Texture layer height (mm)',min:0.1,max:0.4,step:0.01,default:0.2,
    input:'number',visibleIf:{key:'surface_texture',op:'in',value:PATTERNS.filter(pattern=>pattern.layered).map(pattern=>pattern.slug)},
    hint:'Back against the bed (model Y). Match layer height and first layer in the slicer; avoid variable layers for this test. Fine bands may not reproduce exactly with every toolpath.'};
  return {...model,meta:{...model.meta,params:[...model.meta.params,param,layer],validate(values){
    const errors={...model.meta.validate?.(values)};
    if(values.surface_texture!=='none'&&values.depth_profile_version<3)errors.surface_texture='Textures require the current profile definition. Reset the model before selecting a texture.';
    return errors;
  }}};
}

function bezier(points,t,key) {
  if(points.length===2)return points[0][key]*(1-t)+points[1][key]*t;
  return points[0][key]*(1-t)**3+3*points[1][key]*(1-t)**2*t+3*points[2][key]*(1-t)*t*t+points[3][key]*t**3;
}
export function contactHeight(region,x,y) {
  if(region.height)return region.height(x,y);
  const curve=region.curves.find(curve=>x>=curve.points[0].x-1e-8&&x<=curve.points.at(-1).x+1e-8);
  if(!curve)return NaN;
  const t=Math.max(0,Math.min(1,(x-curve.points[0].x)/(curve.points.at(-1).x-curve.points[0].x)));
  const z=bezier(curve.points,t,'z'),local=y-region.y0,profile=region.profile;
  const segment=profile.segments.find(segment=>local<=segment.points.at(-1).x+1e-8)||profile.segments.at(-1);
  let depth;
  if(segment.kind==='arc'){
    const first=profile.segments[0],front=segment===first,r=profile.radius;
    if(front){const end=segment.points.at(-1).y;depth=end-r+Math.sqrt(Math.max(0,r*r-(local-r)**2));}
    else{const start=segment.points[0].y,delta=local-(profile.depth-r);depth=start+profile.rearDirection*(r-Math.sqrt(Math.max(0,r*r-delta*delta)));}
  }else{
    const start=segment.points[0].x,end=segment.points.at(-1).x;
    depth=bezier(segment.points,Math.max(0,Math.min(1,(local-start)/(end-start))),'y');
  }
  return z+region.sign*depth;
}

function hit(regions,x,y,z) {
  for(const region of regions){
    if(x<region.x0||x>region.x1||y<region.y0||y>region.y1||z<region.z0-TOLERANCE||z>region.z1+TOLERANCE)continue;
    if(Math.abs(contactHeight(region,x,y)-z)<=TOLERANCE)return region;
  }
  return null;
}

function weld(mesh) {
  const positions=[],indices=new Uint32Array(mesh.indices.length),vertices=new Map(),remap=new Uint32Array(mesh.positions.length/3);
  for(let i=0;i<remap.length;i++){
    const point=Array.from(mesh.positions.subarray(i*3,i*3+3)),key=point.map(value=>Math.round(value*1e5)).join(',');
    if(!vertices.has(key)){vertices.set(key,positions.length/3);positions.push(...point);}
    remap[i]=vertices.get(key);
  }
  const clean=[];
  for(let i=0;i<indices.length;i+=3){const a=remap[mesh.indices[i]],b=remap[mesh.indices[i+1]],c=remap[mesh.indices[i+2]];if(a!==b&&b!==c&&c!==a)clean.push(a,b,c);}
  return {positions,indices:clean};
}

export function texturedMesh(mesh,regions,slug,settings={}) {
  if(slug==='none')return {mesh,report:null};
  const pattern=patternFor(slug),data=weld(mesh),p=data.positions;
  const layerHeight=Number(settings.texture_layer_height??0.2);
  if(pattern.layered&&(!Number.isFinite(layerHeight)||layerHeight<0.1||layerHeight>0.4))throw new Error('Texture layer height must be between 0.10 and 0.40 mm.');
  let rear=-Infinity;for(let i=1;i<p.length;i+=3)rear=Math.max(rear,p[i]);
  const stepY=pattern.layered?layerHeight/2:TEXTURE_STEP,anchor=rear-layerHeight/2;
  const cutPlane=(a,b)=>{
    const low=Math.min(a,b),high=Math.max(a,b),epsilon=1e-5,index=Math.floor((low-anchor+epsilon)/stepY)+1;
    if(anchor+index*stepY>=high-epsilon)return null;
    const nearest=anchor+Math.round(((a+b)/2-anchor)/stepY)*stepY;
    return Math.max(anchor+index*stepY,Math.min(anchor+(Math.ceil((high-anchor-epsilon)/stepY)-1)*stepY,nearest));
  };
  let indices=data.indices,passes=0;
  const edgeKey=(a,b)=>Math.min(a,b)*LIMIT+Math.max(a,b);
  for(;passes<14;passes++){
    const split=new Map();
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i],b=indices[i+1],c=indices[i+2];
      const x=(p[a*3]+p[b*3]+p[c*3])/3,y=(p[a*3+1]+p[b*3+1]+p[c*3+1])/3,z=(p[a*3+2]+p[b*3+2]+p[c*3+2])/3;
      if(!hit(regions,x,y,z))continue;
      for(const [u,v]of [[a,b],[b,c],[c,a]]){
        const dx=p[u*3]-p[v*3],dy=p[u*3+1]-p[v*3+1];
        const needsSplit=pattern.layered?Math.abs(dx)>TEXTURE_STEP*1.001||cutPlane(p[u*3+1],p[v*3+1])!==null:Math.hypot(dx,dy)>TEXTURE_STEP*1.001;
        if(needsSplit)split.set(edgeKey(u,v),-1);
      }
    }
    if(!split.size)break;
    const next=[];
    const midpoint=(a,b)=>{
      const key=edgeKey(a,b);if(!split.has(key))return -1;
      if(split.get(key)<0){
        const index=p.length/3;if(index>=LIMIT)throw new Error('Texture mesh is too large. Increase texture layer height or reduce platform width/count.');
        const cut=pattern.layered?cutPlane(p[a*3+1],p[b*3+1]):null,t=cut===null?0.5:(cut-p[a*3+1])/(p[b*3+1]-p[a*3+1]);
        if(!pattern.layered)p.push((p[a*3]+p[b*3])/2,(p[a*3+1]+p[b*3+1])/2,(p[a*3+2]+p[b*3+2])/2);
        else p.push(p[a*3]+(p[b*3]-p[a*3])*t,p[a*3+1]+(p[b*3+1]-p[a*3+1])*t,p[a*3+2]+(p[b*3+2]-p[a*3+2])*t);
        split.set(key,index);
      }
      return split.get(key);
    };
    for(let i=0;i<indices.length;i+=3){
      const [a,b,c]=indices.slice(i,i+3),ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a),mask=(ab>=0?1:0)|(bc>=0?2:0)|(ca>=0?4:0);
      if(mask===0)next.push(a,b,c);
      else if(mask===1)next.push(a,ab,c,ab,b,c);
      else if(mask===2)next.push(b,bc,a,bc,c,a);
      else if(mask===4)next.push(c,ca,b,ca,a,b);
      else if(mask===3)next.push(b,bc,ab,a,ab,c,ab,bc,c);
      else if(mask===5)next.push(a,ab,ca,b,c,ab,ab,c,ca);
      else if(mask===6)next.push(c,ca,bc,a,b,ca,ca,b,bc);
      else next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    }
    indices=next;
  }
  if(passes===14)throw new Error('Texture subdivision did not converge. Reduce the platform dimensions.');
  const positions=new Float32Array(p),affected={lower:0,upper:0};let maximum=0;
  for(let i=0;i<p.length;i+=3){
    const region=hit(regions,p[i],p[i+1],p[i+2]);if(!region)continue;
    const distance=(region.edgeDistance?region.edgeDistance(p[i],p[i+1]):Math.min(p[i]-region.x0,region.x1-p[i],p[i+1]-region.y0,region.y1-p[i+1]))-0.3;
    const offset=textureOffset(pattern,p[i]-region.originX,p[i+1]-region.y0,distance,{printHeight:rear-p[i+1],layerHeight});
    positions[i+2]+=region.sign*offset;
    if(Math.abs(offset)>1e-6){affected[region.side]++;maximum=Math.max(maximum,Math.abs(offset));}
  }
  if(!affected.lower&&!affected.upper)throw new Error('The finger surfaces are too narrow for this texture. Increase slot width/depth or reduce the edge radii.');
  return {mesh:{positions,indices:new Uint32Array(indices)},report:{pattern:slug,nominal_relief_mm:pattern.height,maximum_applied_relief_mm:maximum,mesh_step_mm:TEXTURE_STEP,seed:TEXTURE_SEED,affected_vertices:affected,
    ...(pattern.layered?{print_layer_axis:'-Y',print_rear_y_mm:rear,layer_height_mm:layerHeight,layer_sample_step_mm:stepY}:{}),aggressive:Boolean(pattern.aggressive)}};
}

let manifold;
export async function validateTexturedMesh(mesh) {
  manifold||=import('../../assets/cad/coffee-filter/manifold/manifold.js').then(async({default:create})=>{const module=await create();module.setup();return module;});
  const module=await manifold,solid=module.Manifold.ofMesh(new module.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices}));
  try{
    if(solid.status()!=='NoError')throw new Error('Texturing requires a closed base mesh. Try the current default geometry or another grip configuration.');
    const pieces=solid.decompose();try{if(pieces.length!==1||solid.volume()<=0)throw new Error('Texture produced a disconnected or empty mesh.');}finally{pieces.forEach(piece=>piece.delete());}
  }finally{solid.delete();}
}

export function textureSTL(mesh) {
  const bytes=binarySTL(mesh),header=new Uint8Array(bytes,0,80);header.fill(0);
  header.set(new TextEncoder().encode('Santeri Hukari - hangboard physical contact texture - millimetres'));
  return new Uint8Array(bytes);
}
