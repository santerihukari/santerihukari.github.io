import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js',import.meta.url),'utf8');
const math=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {railBoundaryProfiles,integratedRailLayout,perimeterRopePlacement,perimeterEdgeRadius,resolvedHangboardParameters,attachmentDimensions};').toString('base64'));
const choose=(n,i)=>{let result=1;for(let j=1;j<=i;j++)result=result*(n-j+1)/j;return result;};
const basis=(n,i,t)=>i<0||i>n?0:choose(n,i)*t**i*(1-t)**(n-i);
function sample(profile,t){
  const n=profile.points.length-1,keys=['x','y','h'],sum=[0,0,0],ds=[0,0,0];let w=0,dw=0;
  profile.points.forEach((p,i)=>{
    const a=basis(n,i,t)*profile.weights[i],b=n*(basis(n-1,i-1,t)-basis(n-1,i,t))*profile.weights[i];
    w+=a;dw+=b;keys.forEach((key,j)=>{sum[j]+=a*p[key];ds[j]+=b*p[key];});
  });
  const point=sum.map(value=>value/w);return {point,tangent:ds.map((value,i)=>(value-point[i]*dw)/w)};
}
const near=(a,b,message)=>assert(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-7,message);
for(const [name,values]of Object.entries({default:{},offset:{rope_depth_offset_mm:8},thin:{slot_depth_y:8,upper_slot_depth_y:8},unrounded:{outer_fillet_r:0}})){
  test(name+': integrated rails preserve the rounded body boundary and tangent joins',()=>{
    const p=math.resolvedHangboardParameters({attachment_method:'rope_groove',...values}),d=math.attachmentDimensions(p),route=math.perimeterRopePlacement(p,d),r=math.perimeterEdgeRadius(p,d,route);
    const profiles=math.railBoundaryProfiles(route.centre,d.blockDepthY,r);
    const first=sample(profiles[0],0),last=sample(profiles.at(-1),1);
    near(first.point,[r,0,0],'front root');near(last.point,[r,d.blockDepthY,0],'back root');
    for(let i=0;i+1<profiles.length;i++){
      const a=sample(profiles[i],1),b=sample(profiles[i+1],0);near(a.point,b.point,'closed profile joint');
      const cross=[a.tangent[1]*b.tangent[2]-a.tangent[2]*b.tangent[1],a.tangent[2]*b.tangent[0]-a.tangent[0]*b.tangent[2],a.tangent[0]*b.tangent[1]-a.tangent[1]*b.tangent[0]];
      assert(Math.hypot(...cross)/(Math.hypot(...a.tangent)*Math.hypot(...b.tangent))<1e-7,'tangent profile joint');
    }
    if(r>0){assert(Math.abs(first.tangent[1])<1e-9);assert(Math.abs(last.tangent[1])<1e-9);}
    for(const profile of profiles)for(let i=0;i<=100;i++){
      const {point:[x,y,h]}=sample(profile,i/100);
      const expected=y<r?r-Math.sqrt(Math.max(0,r*r-(y-r)**2)):y>d.blockDepthY-r?r-Math.sqrt(Math.max(0,r*r-(y-d.blockDepthY+r)**2)):0;
      assert(Math.abs(x-expected)<1e-7,'window must retain the complete circular corner, not a square shoulder');
      assert(h>=-1e-8&&h<=1+1e-8,'rail must expand outward only');
    }
    const spans=math.integratedRailLayout(p,d,route).spans;
    for(let i=0;i+1<spans.length;i++){
      assert.equal(spans[i].z.at(-1),spans[i+1].z[0]);assert.equal(spans[i].e.at(-1),spans[i+1].e[0]);
      assert.equal(spans[i].e.at(-1)-spans[i].e.at(-2),0);assert.equal(spans[i+1].e[1]-spans[i+1].e[0],0);
    }
  });
}
