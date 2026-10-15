import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {meta} from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
import {defaults} from '../../../src/legacy_library/catalogue.mjs';

const source=await readFile(new URL('../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js',import.meta.url),'utf8');
const math=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {resolvedHangboardParameters,attachmentDimensions,depthProfileSections,makeWidthProfile,liftedPlatformHeights,buildSectionProfiles,roundedHalfBoundary,boundedProfileTangents};').toString('base64'));
const binomial=(n,i)=>{let result=1;for(let j=1;j<=i;j++)result=result*(n-j+1)/j;return result;};
const basis=(n,i,t)=>i<0||i>n?0:binomial(n,i)*t**i*(1-t)**(n-i);
const derivative=(n,i,t)=>n*(basis(n-1,i-1,t)-basis(n-1,i,t));
const length=a=>Math.hypot(...a),distance=(a,b)=>length(a.map((v,i)=>v-b[i]));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function samplePatch(curve,segment,sign,u,v){
  const a=[0,0,0],du=[0,0,0],dv=[0,0,0];let weight=0,wu=0,wv=0;
  const n=curve.points.length-1,m=segment.points.length-1;
  for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){
    const pole=[curve.points[i].x+(curve.sideBlend?.[i]??0)*(segment.sideBlend?.[j]??0),segment.points[j].x,curve.points[i].z+(curve.capAt===i?0:sign*segment.points[j].y)];
    const w=(curve.weights?.[i]??1)*(segment.weights?.[j]??1),b=basis(n,i,u)*basis(m,j,v)*w,bU=derivative(n,i,u)*basis(m,j,v)*w,bV=basis(n,i,u)*derivative(m,j,v)*w;
    weight+=b;wu+=bU;wv+=bV;
    for(let axis=0;axis<3;axis++){a[axis]+=b*pole[axis];du[axis]+=bU*pole[axis];dv[axis]+=bV*pole[axis];}
  }
  const point=a.map(value=>value/weight),tu=du.map((value,i)=>(value-point[i]*wu)/weight),tv=dv.map((value,i)=>(value-point[i]*wv)/weight),normal=cross(tu,tv),scale=length(normal);
  return {point,normal:normal.map(value=>value/scale),scale};
}
export function boundaryData(values={}){
  const p=math.resolvedHangboardParameters({...defaults(meta),...values}),dimensions=math.attachmentDimensions(p);
  const zoneWidths=Array.from({length:p.slot_count},(_,i)=>p['slot_width_'+(i+1)]),widthProfile=math.makeWidthProfile(p.width_taper_curve,p.width_taper_amount_mm),sections=math.depthProfileSections(p);
  const baseRiserHeights=math.liftedPlatformHeights(Array.from({length:p.slot_count},(_,i)=>p['riser_height_'+(i+1)]),sections,widthProfile);
  const sectionProfiles=math.buildSectionProfiles({slotX0:dimensions.sideWallX,slotZ0:dimensions.slotZ0,slotHeight:dimensions.slotHeight,zoneWidths,baseRiserHeights,mirrorRisers:p.risers_on_both_sides>=0.5,depthSections:sections,widthProfile});
  const splitZ=dimensions.slotZ0+(Math.max(...sectionProfiles.flatMap(s=>s.bottomOffsets))+widthProfile.maxDelta+dimensions.slotHeight-Math.max(...sectionProfiles.flatMap(s=>s.topOffsets))-(p.risers_on_both_sides>=0.5?widthProfile.maxDelta:0))/2;
  const d={...dimensions,slotX0:dimensions.sideWallX,zoneWidths,widthProfile,baseRiserHeights,splitZ};
  return {params:p,dimensions,d,lower:math.roundedHalfBoundary(p,d,'lower'),upper:math.roundedHalfBoundary(p,d,'upper')};
}
const near=(a,b,message)=>assert(distance(a,b)<1e-6,message+' gap '+distance(a,b));
function tangent(a,b,message){
  assert(a.scale>1e-9&&b.scale>1e-9,message+' has a degenerate tangent');
  const dot=Math.abs(a.normal.reduce((sum,value,i)=>sum+value*b.normal[i],0));
  assert(1-dot<1e-7,message+' normal mismatch '+(1-dot));
}
const scenarios={
  default:{},
  reported:{width_taper_curve:'0,1|0.392202,0.87|0.598624,0.87|1,1',depth_taper_curve:'0,1|0.327982,1.070472|1,1',riser_fillet_r:2},
  unequal:{slot_depth_y:16,upper_slot_depth_y:32},
  shortStep:{riser_height_1:12,riser_height_2:14,riser_height_3:12},
  narrow:{slot_width_1:6,slot_width_2:6,slot_width_3:6,slot_width_4:6},
  six:{slot_count:6,riser_height_5:5,riser_height_6:12},
  single:{slot_count:1},
  oneSided:{risers_on_both_sides:0},
  tightOneSided:{risers_on_both_sides:0,slot_clearance_between_surfaces:4,riser_height_1:40},
  smallRadius:{riser_fillet_r:1},
  largeRadius:{riser_fillet_r:7},
  unevenSpline:{width_taper_curve:'0,1|0.01,1.001|0.1,1.4|0.8,1.45|1,1',depth_taper_curve:'0,1|0.04,1.001|0.15,1.4|0.8,1.45|1,1'}
};
for(const [name,values]of Object.entries(scenarios))test(name+': joined patches and front/back faces are tangent',()=>{
  const data=boundaryData(values);
  for(const side of ['lower','upper']){
    const {floor,segments,sign}=data[side];
    for(let i=0;i+1<floor.length;i++)for(let j=1;j<segments.length;j++)for(const t of [.05,.25,.5,.75,.95]){
      const a=samplePatch(floor[i],segments[j],sign,1,t),b=samplePatch(floor[i+1],segments[j],sign,0,t);
      near(a.point,b.point,`${side} XZ ${i}/${j}`);tangent(a,b,`${side} XZ ${i}/${j}`);
    }
    for(const [i,curve]of floor.entries()){
      for(let j=1;j+1<segments.length;j++)for(const t of [.1,.5,.9]){
        const a=samplePatch(curve,segments[j],sign,t,1),b=samplePatch(curve,segments[j+1],sign,t,0);
        near(a.point,b.point,`${side} Y ${i}/${j}`);tangent(a,b,`${side} Y ${i}/${j}`);
      }
      for(const [segment,v]of [[segments[1],0],[segments.at(-1),1]])for(const t of [.1,.5,.9]){
        const point=samplePatch(curve,segment,sign,t,v);
        assert(point.scale>1e-9,`${side} front/back degenerate patch ${i}`);
        assert(1-Math.abs(point.normal[1])<1e-7,`${side} patch ${i} does not join the front/back plane tangentially`);
      }
    }
    for(const [curve,index,u]of [[floor[0],0,0],[floor.at(-1),floor.at(-1).points.length-1,1]]){
      const point=curve.points[index],blend=curve.sideBlend[index],wall={points:[point,{x:point.x,z:data.d.splitZ}],sideBlend:[blend,blend],capAt:1};
      assert(Math.abs(blend)>0,'Inner-side-wall blend must be present');
      for(const segment of segments.slice(1))for(const t of [.1,.5,.9]){
        const a=samplePatch(curve,segment,sign,u,t),b=samplePatch(wall,segment,sign,0,t);
        near(a.point,b.point,side+' inner side wall');tangent(a,b,side+' inner side wall');
      }
      for(const [segment,v]of [[segments[1],0],[segments.at(-1),1]])for(const t of [.1,.5,.9]){
        const sample=samplePatch(wall,segment,sign,t,v);
        assert(sample.scale>1e-9);assert(1-Math.abs(sample.normal[1])<1e-7,'Inner side wall must be tangent to front/back face');
      }
    }
  }
});

test('unrounded step corners remain deliberately unblended',()=>{
  const data=boundaryData({slot_fillet_r:0});
  assert(data.lower.floor.every(curve=>curve.sideBlend.every(value=>value===0)));
});

test('per-node slopes are bounded against both neighbouring spans',()=>{
  const points=[{x:0,y:1},{x:.01,y:1.001},{x:.1,y:1.4},{x:.8,y:1.45},{x:1,y:1}];
  const slopes=math.boundedProfileTangents(points);
  assert.equal(slopes[0],0);assert.equal(slopes.at(-1),0);
  for(let i=1;i+1<points.length;i++)for(const j of [i-1,i+1]){
    const secant=(points[j].y-points[i].y)/(points[j].x-points[i].x);
    assert(Math.abs(slopes[i])<=3*Math.abs(secant)+1e-10);
  }
});
