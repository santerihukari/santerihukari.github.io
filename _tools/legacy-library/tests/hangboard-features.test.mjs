import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {featureCases,profile} from './hangboard-profile.mjs';
import {meta,build} from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
import {defaults} from '../../../src/legacy_library/catalogue.mjs';
import {validate,modelLink,readLink,visible} from '../../../src/legacy_library/parameters.mjs';

const source=await readFile(new URL('../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js',import.meta.url),'utf8');
const math=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {makeWidthProfile,addWidthProfileToPrimitives,computeRequiredSlotHeight,centralEyeletPlacement,perimeterRopePlacement,attachmentDimensions,internalEyeletGeometry,liftedPlatformHeights,roundedDepthCurve,roundedDepthEditorData,roundedDepthErrors,evaluateRationalCurve,integratedRailLayout};').toString('base64'));
const parameters={...defaults(meta),depth_profile_version:1,back_wall_y:4,attachment_method:'diamond',width_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',depth_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',width_taper_amount_mm:3,depth_taper_amount_mm:10,slot_fillet_r:2};
const uiSource=await readFile(new URL('../../../src/ui.js',import.meta.url),'utf8');
const originalUi=await import('data:text/javascript;base64,'+Buffer.from(uiSource+'\nexport {normalizeCurvePoints,evaluateCurveSpline};').toString('base64'));
test('attachment selectors, old links and per-finger profile remain valid and shareable',()=>{
  assert.equal(parameters.attachment_method,'diamond');assert.equal(parameters.rope_diameter,6);
  assert.equal(readLink(meta,new URL('https://example.invalid/?make_holes=0')).make_holes,0);
  assert.equal(readLink(meta,new URL('https://example.invalid/')).attachment_method,'rope_groove');
  assert.equal(readLink(meta,new URL('https://example.invalid/?depth_profile_version=2')).attachment_method,'diamond');
  for(const change of Object.values(featureCases)){
    const values={...parameters,...change};assert(validate(meta,values).valid);
    const url=modelLink('unlevel_hangboard_depth_taper',meta,values,'https://example.invalid/parametric-models/depth-taper-hangboard/');
    assert.deepEqual(readLink(meta,new URL(url)),values);
  }
  const field=key=>meta.params.find(param=>param.key===key);
  assert(visible(field('width_taper_curve'),parameters));
  assert(!visible(field('rope_diameter'),parameters));
  assert(visible(field('rope_diameter'),{...parameters,attachment_method:'rope_groove'}));
  assert(!visible(field('hole_width_x'),{...parameters,attachment_method:'rope_groove'}));
  assert(visible(field('attachment_side'),{...parameters,attachment_method:'single_point'}));
  assert(!visible(field('attachment_side'),{...parameters,attachment_method:'single_point',make_holes:0}));
});
test('width curve uses exact cubic boundaries, anchored ends and bounded tangents',()=>{
  const p=math.makeWidthProfile('0,1|0.25,1.2|0.5,0.9|0.75,1.1|1,1',3);
  assert(p.active);assert.equal(p.segments.length,4);
  assert.equal(p.segments[0][0].z,0);assert.equal(p.segments[0][1].z,0);
  assert.equal(p.segments.at(-1)[2].z,0);assert.equal(p.segments.at(-1)[3].z,0);
  for(const segment of p.segments)for(const point of segment)assert(point.z>=p.minDelta-1e-10&&point.z<=p.maxDelta+1e-10);
  assert(!math.makeWidthProfile(parameters.width_taper_curve,3).active);
  assert(!math.makeWidthProfile('0,1|0.5,1.3|1,1',0).active);
  assert(!validate(meta,{...parameters,width_taper_curve:'0,0.9|1,1'}).valid);
  assert.throws(()=>math.makeWidthProfile('0,1.1|1,1',3),/start and end/);
});

test('slot count is integral; finger measurements use numeric inputs with millimetre precision',()=>{
  const field=key=>meta.params.find(p=>p.key===key);
  assert.equal(field('slot_count').input,'number');assert.equal(field('slot_count').step,1);
  for(const n of [1,6])assert(validate(meta,{...parameters,slot_count:n}).valid);
  for(const n of [0,7,2.5])assert(!validate(meta,{...parameters,slot_count:n}).valid);
  for(const key of ['slot_width_1','riser_height_1','slot_width_6','riser_height_6']){
    assert.equal(field(key).input,'number');assert.equal(field(key).step,0.001);
    assert(validate(meta,{...parameters,[key]:12.345}).valid);
    assert(!validate(meta,{...parameters,[key]:12.3456}).valid);
  }
});

test('upper and lower grip depths are independent and old links preserve equal depths',()=>{
  assert.equal(readLink(meta,new URL('https://example.invalid/?slot_depth_y=36')).upper_slot_depth_y,36);
  const p={...parameters,slot_depth_y:16,upper_slot_depth_y:32};
  const link=modelLink('unlevel_hangboard_depth_taper',meta,p,'https://example.invalid/');
  assert.deepEqual(readLink(meta,new URL(link)),p);
  assert.equal(math.attachmentDimensions(p).blockDepthY,36);
  assert.equal(math.attachmentDimensions({...p,slot_depth_y:32,upper_slot_depth_y:16}).blockDepthY,36);
  assert.match(meta.params.find(p=>p.key==='base_slot_height').hint,/no effect/);
});

test('perimeter route has broad crowns, integrated covered sides and central half-channel windows',()=>{
  const p={...parameters,attachment_method:'rope_groove'},d=math.attachmentDimensions(p),route=math.perimeterRopePlacement(p,d);
  assert.equal(route.centre,12);assert.equal(route.primitives.filter(p=>p.kind==='arc').length,6);
  assert(route.crownRadius>d.blockWidthX/2&&route.crownRadius<150);
  assert.equal(parameters.back_wall_y,4);assert.equal(d.sideWallX,8);assert.equal(d.blockWidthX,90);
  assert(d.capBottom>0&&d.capTop>0,'The curved silhouette must not eat into the requested finger shell');
  assert(visible(meta.params.find(p=>p.key==='rope_side_wall_x'),p));assert(!visible(meta.params.find(p=>p.key==='side_wall_x'),p));
  assert.equal(readLink(meta,new URL('https://example.invalid/?attachment_method=rope_groove&side_wall_x=14')).rope_side_wall_x,14);
  const rail=math.integratedRailLayout(p,d,route);
  assert.equal(rail.extent,6.4);assert.equal(rail.spans.length,7);
  assert(Math.abs((rail.windowTop-rail.windowBottom)/(route.sideTop-route.sideBottom)-0.4)<1e-10);
  for(const span of rail.spans){assert(span.z.at(-1)>span.z[0]);assert(span.e.every(e=>e>=0&&e<=rail.extent));}
  for(const z of rail.coveredCentres)assert(z>route.sideBottom&&z<route.sideTop);
  assert.equal(rail.spans[3].e[0],0);
  assert.equal(math.perimeterRopePlacement({...p,rope_depth_offset_mm:8},d).centre,20);
  assert(!validate(meta,{...p,rope_depth_offset_mm:-10}).valid);
  assert(!validate(meta,{...p,rope_side_wall_x:4}).valid);
  assert(validate(meta,{...p,make_holes:0,rope_depth_offset_mm:-10}).valid,'Disabling rope features retains the oval body but does not require unused ear clearance');
});
test('default depth profiles have exact radius arcs and a bounded tangent middle',()=>{
  const p={...defaults(meta),depth_taper_curve:'0,1.1|0.3,0.85|0.7,1.2|1,0.95'};
  assert.equal(p.depth_profile_version,3);
  for(const side of ['lower','upper']){
    const curve=math.roundedDepthCurve(p,side),r=p.riser_fillet_r;
    assert.equal(curve.innerStart,r);assert.equal(curve.innerEnd,curve.depth-r);
    assert.equal(curve.fixed.length,6);assert.equal(curve.handles.length,4);
    const front=curve.segments[0],back=curve.segments.at(-1);
    assert.equal(front.kind,'arc');assert.equal(back.kind,'arc');
    for(const [segment,centre]of [[front,curve.fixed[2]],[back,curve.fixed[5]]])for(let i=0;i<=20;i++){
      const point=math.evaluateRationalCurve(segment,i/20);
      assert(Math.abs(Math.hypot(point.x-centre.x,point.y-centre.y)-r)<1e-10);
    }
    const middle=curve.segments.slice(1,-1);
    assert.equal(middle[0].points[0].y,middle[0].points[1].y);
    assert.equal(middle.at(-1).points.at(-1).y,middle.at(-1).points.at(-2).y);
    for(const segment of middle){
      const lo=Math.min(segment.points[0].y,segment.points.at(-1).y),hi=Math.max(segment.points[0].y,segment.points.at(-1).y);
      assert(segment.points.every(point=>point.y>=lo-1e-10&&point.y<=hi+1e-10));
    }
  }
  assert.equal(math.roundedDepthEditorData({...p,depth_profile_version:1}).enabled,false);
  assert(validate(meta,{...p,riser_fillet_r:7}).valid);
  assert(!validate(meta,{...p,riser_fillet_r:8}).valid,'Nominal shell guard applies before CAD');
  assert(!validate(meta,{...p,slot_depth_y:8,riser_fillet_r:4}).valid);
  assert(!validate(meta,{...p,depth_taper_curve:'0.1,1|1,1'}).valid);
  assert(!validate(meta,{...p,depth_taper_curve:'0,1|0.9,1'}).valid);
  assert(!validate(meta,{...p,depth_taper_curve:'0,1|0.5,1|0.5001,1.2|1,1'}).valid);
  assert(validate(meta,{...p,depth_taper_curve:'0,1|0.5,1|0.5001,1|1,1'}).valid);
  assert(!validate(meta,{...p,depth_taper_curve:'0,1|0.1,1|0.2,1|0.3,1|0.4,1|0.5,1|0.6,1|0.7,1|1,1'}).valid);
});
test('same width profile repeats at different finger widths and mirrors without reversing left/right',()=>{
  const p=math.makeWidthProfile('0,1|0.25,1.2|1,1',3);
  const lines=[{kind:'line',p0:{x:0,z:10},p1:{x:16,z:10}},{kind:'line',p0:{x:20,z:22},p1:{x:40,z:22}},
    {kind:'line',p0:{x:16,z:60},p1:{x:0,z:60}}];
  const result=math.addWidthProfileToPrimitives(lines,p,true);
  assert.equal(result.length,6);assert(result.every(pr=>pr.kind==='bezier'));
  assert.equal(result[0].poles.at(-1).x,4);assert.equal(result[2].poles.at(-1).x,25);
  assert.equal(result[0].poles.at(-1).z-10,result[2].poles.at(-1).z-22);
  assert.equal(result.at(-1).poles[0].x,4);assert.equal(result.at(-1).poles[0].z,60-p.segments[0].at(-1).z);
  assert.equal(math.addWidthProfileToPrimitives([lines[2]],p,false)[0],lines[2]);
});
test('negative profiles lift only platforms that would cross the base, preserving their curve',()=>{
  const flat=math.makeWidthProfile('0,1|1,1',3),hollow=math.makeWidthProfile('0,1|0.5,0.87|1,1',3);
  const zero=[{delta:0}],depth=[{delta:0},{delta:-0.5},{delta:1}];
  assert.deepEqual(math.liftedPlatformHeights([12,20,12,0],zero,flat),[12,20,12,0]);
  const raised=math.liftedPlatformHeights([12,20,12,0],zero,hollow);
  assert.deepEqual(raised.slice(0,3),[12,20,12]);assert(Math.abs(raised[3]-0.78)<1e-10);
  const combined=math.liftedPlatformHeights([0,0.2,2],depth,hollow);
  for(const h of combined)for(const section of depth)assert(h+section.delta+hollow.minDelta>=-1e-10);
  assert.equal(combined[2],2);
  const deep=math.makeWidthProfile('0,1|0.5,0.5|1,1',8);
  assert.deepEqual(math.liftedPlatformHeights([12,20,12,0],zero,deep),[12,20,12,8]);
  assert.equal(math.computeRequiredSlotHeight({baseSlotHeight:8,slotClearanceBetweenSurfaces:20,baseRiserHeights:[1],mirrorRisers:true,depthSections:[{delta:0},{delta:-1}],widthProfile:flat}),22);
});
test('eyelet defaults track finger depth; depth offset and thickness are validated and shared',()=>{
  const p={...parameters,attachment_method:'single_point'};
  assert.deepEqual(math.centralEyeletPlacement(p),{centre:12,thickness:10,y0:7,y1:17,minOffset:-6,maxOffset:10});
  assert.equal(math.centralEyeletPlacement({...p,upper_slot_depth_y:40}).centre,20);
  assert.equal(math.centralEyeletPlacement({...p,slot_depth_y:40},'bottom').centre,20);
  const moved={...p,eyelet_depth_offset_mm:8,eyelet_thickness_mm:8};
  assert.equal(math.centralEyeletPlacement(moved).centre,20);assert(validate(meta,moved).valid);
  const link=modelLink('unlevel_hangboard_depth_taper',meta,moved,'https://example.invalid/');
  assert.deepEqual(readLink(meta,new URL(link)),moved);
  for(const offset of [-7,11]){
    const bad={...p,eyelet_depth_offset_mm:offset};
    assert(!validate(meta,bad).valid);assert.match(validate(meta,bad).errors.eyelet_depth_offset_mm,/between -6.0 and 10.0/);
    assert.throws(()=>build({},bad),/depth offset/);
  }
  assert(validate(meta,{...p,top_wall_z:4}).valid,'A thin outer wall can receive a local crown instead of obstructing the grip');
  assert(validate(meta,{...p,top_wall_z:4,attachment_side:'bottom'}).valid);
  assert(validate(meta,{...p,top_wall_z:4,attachment_side:'both'}).valid);
});
test('original-library width editor matches analytic Bezier profile and keeps endpoints fixed',()=>{
  const points=[{x:0,y:1},{x:0.25,y:1.2},{x:0.5,y:0.9},{x:0.75,y:1.1},{x:1,y:1}];
  const field=meta.params.find(param=>param.key==='width_taper_curve');
  const profile=math.makeWidthProfile(points.map(p=>p.x+','+p.y).join('|'),3);
  for(let i=0;i<=100;i++){
    const t=i/100,index=Math.min(3,Math.floor(t*4)),u=(t-index/4)*4;
    const c=profile.segments[index],delta=c[0].z*(1-u)**3+3*c[1].z*(1-u)**2*u+3*c[2].z*(1-u)*u*u+c[3].z*u**3;
    assert(Math.abs((originalUi.evaluateCurveSpline(points,t,field)-1)*6-delta)<1e-10);
  }
  const moved=originalUi.normalizeCurvePoints([{x:0,y:0.7},{x:1,y:1.3}],field);
  assert.deepEqual(moved,[{x:0,y:1},{x:1,y:1}]);
});
test('published reference STL is read-only and hash guarded',async()=>{
  const file=await readFile(new URL('../../../assets/stl/portable-hangboard-12mm-20mm-wood-inserts.stl',import.meta.url));
  assert.equal(createHash('sha256').update(file).digest('hex'),'e1735f61ca79151f41468cf436432e5b9a27fe1f8793a6a215278014fa31b9bc');
});

const summary=[],folder=new URL('../../../output/legacy-library/hangboard-profile/',import.meta.url);
for(const name of Object.keys(featureCases)){
  if(process.env.PROFILE_CASE&&!process.env.PROFILE_CASE.split(',').includes(name))continue;
  test(`${name}: real OCCT geometry, routing and STL export`,{timeout:190000},async()=>{
    await profile('current',name,180000);
    const result=JSON.parse(await readFile(new URL(`current-${name}.json`,folder)));
    assert(result.analyticVolume>0);assert(result.mesh.triangles>0);
    assert.equal(result.brepValid,true,'The CAD boundary representation must be valid');
    assert.equal(result.solids,1,'Attachment/shape must remain one connected solid');
    if(result.params.attachment_method==='rope_groove'&&result.params.make_holes>=0.5){
      const rims=result.events.find(event=>event.family==='roundRopeChannelMouths'&&event.radius===0.5);
      assert(rims,'Covered rope mouths must receive actual CAD fillets');
      assert.equal(rims.generatedPerContour.length,8,'Round both mouths of all four covered channel sections');
      assert(rims.generatedPerContour.every(count=>count>0),'Every mouth must generate fillet faces');
    }
    for(const probe of result.probes)assert.equal(probe.actual,probe.expected,JSON.stringify(probe));
    if(name.startsWith('rope')&&result.params.make_holes>=0.5)assert(result.warnings.some(warning=>warning.includes('Experimental perimeter')));
    if(name==='rope')assert(!result.warnings.some(warning=>warning.includes('retaining-ear')),'Default ear lofts must build without transition warnings');
    assert(!result.warnings.some(warning=>warning.startsWith('Depth taper pushes')),'Negative profiles lift the platform instead of clipping it');
    if(name==='reportedCurve')assert(!result.warnings.some(warning=>/rolling-ball fillet failed|No .*slot-profile edges/.test(warning)),'The exact reported combination must retain front/back rounding');
    if(name.startsWith('eyelet'))assert(!result.warnings.some(warning=>warning.includes('rim rounding')));
    if(name.startsWith('eyelet')){
      const d=math.attachmentDimensions(result.params);
      const selected=result.params.attachment_side==='both'?['top','bottom']:[result.params.attachment_side];
      const bounds=selected.map(side=>math.internalEyeletGeometry(result.params,d,side).outerZ);
      assert(result.mesh.min[2]>=Math.min(0,...bounds)-0.01);assert(result.mesh.max[2]<=Math.max(d.blockHeightZ,...bounds)+0.01);
      assert(result.mesh.min[0]>-0.01);assert(result.mesh.max[0]<d.blockWidthX+0.01);
    }
    summary.push({name,geometryMs:result.geometryMs,previewMs:result.previewMs,solids:result.solids,triangles:result.mesh.triangles,probes:result.probes});
    await writeFile(new URL('features.json',folder),JSON.stringify(summary,null,2));
  });
}
