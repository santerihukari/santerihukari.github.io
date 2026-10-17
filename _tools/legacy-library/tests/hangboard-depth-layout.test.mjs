import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import {tessellate,meshMetrics} from '../../../src/legacy_library/tessellate.mjs';
import {readLink,modelLink,validate} from '../../../src/legacy_library/parameters.mjs';

const source=await readFile(new URL('../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js',import.meta.url),'utf8');
const model=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {resolvedHangboardParameters,gripDepthIntervals,gripDepthLayout,depthEnvelopePoint,attachmentDimensions,roundedDepthCurve,evaluateRationalCurve,roundedDepthValue,makeWidthProfile,liftedPlatformHeights,depthProfileSections};').toString('base64'));
const p=values=>model.resolvedHangboardParameters({attachment_method:'diamond',width_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',depth_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',width_taper_amount_mm:3,depth_taper_amount_mm:10,slot_fillet_r:2,...values});

test('grips align the same proportional rope plane, including the 20/10 mm example',()=>{
  for(const fraction of [25,50,75])for(const [lower,upper]of [[10,20],[20,10],[24,24]]){
    const values=p({slot_depth_y:lower,upper_slot_depth_y:upper,rope_position_percent:fraction});
    const layout=model.gripDepthIntervals(values);
    for(const grip of [layout.lower,layout.upper]){
      assert(Math.abs((layout.centre-grip.start)/grip.depth-fraction/100)<1e-12);
      assert.equal(grip.end-grip.start,grip.depth);
    }
    if(lower===10&&upper===20&&fraction===50){assert.deepEqual(layout.lower,{depth:10,start:5,end:15});assert.deepEqual(layout.upper,{depth:20,start:0,end:20});}
  }
});

test('normal back-wall offset stays 2 mm and loft endpoints join the 10 mm lands smoothly',()=>{
  const values=p({slot_depth_y:10,upper_slot_depth_y:20}),d=model.attachmentDimensions(values),layout=model.gripDepthLayout(values,d);
  assert.equal(values.back_wall_y,2);assert.equal(values.depth_transition_land_mm,10);assert(layout.z1-layout.z0>=10-1e-8);
  for(let i=0;i<=100;i++){
    const z=layout.z0+(layout.z1-layout.z0)*i/100,inner=model.depthEnvelopePoint(layout,{...values,back_wall_y:0},z,true),outer=model.depthEnvelopePoint(layout,values,z,true);
    assert(Math.abs(Math.hypot(outer.y-inner.y,outer.z-inner.z)-2)<1e-10);
  }
  for(const [z,back,front]of [[layout.z0,15,5],[layout.z1,20,0]]){
    assert(Math.abs(model.depthEnvelopePoint(layout,values,z,true).y-back-2)<1e-9);
    assert.equal(model.depthEnvelopePoint(layout,values,z).y,front);
    const nearby=model.depthEnvelopePoint(layout,values,z+(z===layout.z0?1e-4:-1e-4),true);
    assert(Math.abs(nearby.y-back-2)<1e-9);
  }
});

test('old absolute offsets migrate to visible percentages and new links restore exactly',()=>{
  const values=readLink(model.meta,new URL('https://example.invalid/?attachment_method=rope_groove&rope_depth_offset_mm=3'));
  assert.equal(values.rope_position_percent,62.5);assert.equal(values.rope_depth_offset_mm,0);assert(validate(model.meta,values).valid);
  const link=modelLink('unlevel_hangboard_depth_taper',model.meta,values,'https://example.invalid/');assert.deepEqual(readLink(model.meta,new URL(link)),values);
  const legacy=readLink(model.meta,new URL('https://example.invalid/?depth_profile_version=2&rope_depth_offset_mm=3'));
  assert.equal(legacy.rope_depth_offset_mm,3);assert.equal(legacy.back_wall_y,4);
  for(const percentage of [0,100])assert(!validate(model.meta,p({attachment_method:'rope_groove',rope_position_percent:percentage})).valid);
});

test('a strongly crowned depth spline cannot cross either transition cap',()=>{
  const values=p({slot_count:1,riser_height_1:0,slot_depth_y:16,upper_slot_depth_y:32,depth_taper_curve:'0,1|0.5,1.5|1,1',depth_taper_amount_mm:30});
  const d=model.attachmentDimensions(values),layout=model.gripDepthLayout(values,d);
  assert(layout.z0>=d.slotZ0+30+10);assert(layout.z1<=d.slotZ0+d.slotHeight-30-10);
  assert(layout.z1-layout.z0>=10);
});

test('zero back wall is explicit, shareable and does not change the 2 mm default',()=>{
  assert.equal(model.meta.params.find(field=>field.key==='back_wall_y').min,0);
  assert.equal(p({}).back_wall_y,2);
  const values=p({back_wall_y:0,slot_depth_y:10,upper_slot_depth_y:20});
  assert(validate(model.meta,values).valid);
  const link=modelLink('unlevel_hangboard_depth_taper',model.meta,values,'https://example.invalid/');
  assert.equal(readLink(model.meta,new URL(link)).back_wall_y,0);
  assert(!validate(model.meta,p({back_wall_y:-1})).valid);
  for(const version of [1,2])assert.match(model.meta.validate(p({back_wall_y:0,depth_profile_version:version})).back_wall_y,/current model geometry/);
  const layout=model.gripDepthLayout(values,model.attachmentDimensions(values));
  for(let i=0;i<=10;i++){
    const t=i/10,z=layout.z0+(layout.z1-layout.z0)*t,point=model.depthEnvelopePoint(layout,values,z,true);
    assert.equal(point.z,z);
    assert(Math.abs(point.y-(layout.lower.end+(layout.upper.end-layout.lower.end)*t*t*t*(10-15*t+6*t*t)))<1e-10);
  }
});

test('without backing the rear depth arc rounds outwards like the front, including editor handles',()=>{
  for(const curve of ['0,1|1,1','0,0.9|0.5,1.1|1,1.05'])for(const side of ['lower','upper']){
    const values=p({back_wall_y:0,depth_taper_curve:curve,slot_depth_y:16,upper_slot_depth_y:32});
    const profile=model.roundedDepthCurve(values,side),front=profile.segments[0],rear=profile.segments.at(-1),r=values.riser_fillet_r;
    const first=front.points.at(-1).y,last=rear.points[0].y;
    assert.equal(front.points[0].y,first-r);assert.equal(rear.points.at(-1).y,last-r);
    assert.equal(profile.fixed[4].y,last-r);assert.equal(profile.fixed[5].y,last-r);
    for(let i=0;i<=20;i++){
      const a=model.evaluateRationalCurve(front,i/20),b=model.evaluateRationalCurve(rear,1-i/20);
      assert(Math.abs(a.x-(profile.depth-b.x))<1e-10);
      assert(Math.abs((a.y-first)-(b.y-last))<1e-10);
    }
    const backed=model.roundedDepthCurve({...values,back_wall_y:2},side);
    assert.equal(backed.segments.at(-1).points.at(-1).y,last+r);
  }
  const editor=model.meta.params.find(field=>field.key==='depth_taper_curve').roundedProfile({back_wall_y:'0'});
  for(const profile of editor.profiles)assert.equal(profile.segments.at(-1).points.at(-1).y,-4,'Typed numeric inputs use the same profile as generated geometry');
});

const directory=new URL('../../../assets/occt/',import.meta.url),factorySource=await readFile(new URL('opencascade.full.js',directory),'utf8');
const factory=new Function('require','__dirname',factorySource.replace(/export default Module;\s*$/,'return Module;'))(createRequire(import.meta.url),fileURLToPath(directory));
let kernel;
const cases={
  upperDeep:{slot_depth_y:10,upper_slot_depth_y:20,make_holes:0,outer_fillet_r:0},
  lowerDeep:{slot_depth_y:32,upper_slot_depth_y:16,make_holes:0},
  rope:{slot_depth_y:10,upper_slot_depth_y:20,attachment_method:'rope_groove'},
  ropeQuarter:{slot_depth_y:24,upper_slot_depth_y:40,rope_position_percent:35,attachment_method:'rope_groove'},
  curved:{slot_depth_y:16,upper_slot_depth_y:32,make_holes:0,width_taper_curve:'0,1|0.5,0.87|1,1',depth_taper_curve:'0,1|0.5,1.05|1,1'},
  unequalBody:{slot_depth_y:16,upper_slot_depth_y:32,make_holes:0},
  diamond:{slot_depth_y:16,upper_slot_depth_y:32},
  strongCrown:{slot_count:1,riser_height_1:0,slot_depth_y:16,upper_slot_depth_y:32,make_holes:0,outer_fillet_r:0,depth_taper_curve:'0,1|0.5,1.5|1,1',depth_taper_amount_mm:30},
  eyelet:{slot_depth_y:16,upper_slot_depth_y:32,attachment_method:'single_point',attachment_side:'both'},
  oneSided:{slot_depth_y:20,upper_slot_depth_y:10,risers_on_both_sides:0,make_holes:0},
  equal:{make_holes:0},
  openEqual:{back_wall_y:0,make_holes:0},
  openDiamond:{back_wall_y:0},
  openUpper:{back_wall_y:0,slot_depth_y:10,upper_slot_depth_y:20,make_holes:0},
  openLower:{back_wall_y:0,slot_depth_y:20,upper_slot_depth_y:10,make_holes:0},
  openRope:{back_wall_y:0,slot_depth_y:10,upper_slot_depth_y:20,attachment_method:'rope_groove'},
  openEyelet:{back_wall_y:0,slot_depth_y:16,upper_slot_depth_y:32,attachment_method:'single_point',attachment_side:'both'},
  newDefault:Object.fromEntries(model.meta.params.map(field=>[field.key,field.default])),
  wideFlat80:{...Object.fromEntries(model.meta.params.map(field=>[field.key,field.default])),slot_count:1,slot_width_1:80,riser_height_1:0,width_taper_curve:'0,1|1,1',depth_taper_curve:'0,1|1,1'},
  wideFlat120:{...Object.fromEntries(model.meta.params.map(field=>[field.key,field.default])),slot_count:1,slot_width_1:120,riser_height_1:2,back_wall_y:0,width_taper_curve:'0,1|1,1'},
  monoMixed:{...Object.fromEntries(model.meta.params.map(field=>[field.key,field.default])),slot_count:1,slot_depth_y:10,upper_slot_depth_y:24,back_wall_y:0,depth_taper_curve:'0,1|0.25,0.75|0.5,0.5|0.75,0.75|1,1',width_taper_curve:'0,1|0.25,1.25|0.5,1.5|0.75,1.25|1,1'}
};
const output=new URL('../../../output/legacy-library/depth-layout/',import.meta.url);
await mkdir(output,{recursive:true});
for(const [name,change]of Object.entries(cases)){
  if(process.env.DEPTH_CASE&&!process.env.DEPTH_CASE.split(',').includes(name))continue;
  test(name+': exact lofted solid, requested back wall, connected BRep and STL',{timeout:180000},async()=>{
    kernel||=withProgressCompatibility(await factory({wasmBinary:await readFile(new URL('opencascade.full.wasm',directory))}));
    const oc=kernel,values=p(change),dimensions=model.attachmentDimensions(values),layout=model.gripDepthLayout(values,dimensions);
    assert(validate(model.meta,values).valid,JSON.stringify(validate(model.meta,values).errors));
    console.log('BUILD '+name);const started=performance.now(),warnings=[],warn=console.warn;let shape;
    try{console.warn=(...parts)=>warnings.push(parts.join(' '));shape=model.build(oc,values);}finally{console.warn=warn;}
    try{
      const checker=new oc.BRepCheck_Analyzer(shape,true,false);try{assert(checker.IsValid_2(),'BRep must be valid');}finally{checker.delete();}
      const explorer=new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_SOLID,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);let solids=0;
      try{while(explorer.More()){solids++;explorer.Next();}}finally{explorer.delete();}assert.equal(solids,1);
      const probes=[];
      const probe=(point,inside)=>{
        const location=new oc.gp_Pnt_3(...point),classifier=new oc.BRepClass3d_SolidClassifier_3(shape,location,1e-6);
        try{probes.push({point,inside,actual:classifier.State()===oc.TopAbs_State.TopAbs_IN});}finally{classifier.delete();location.delete();}
      };
      const x=dimensions.sideWallX+Array.from({length:values.slot_count},(_,i)=>values['slot_width_'+(i+1)]).reduce((a,b)=>a+b,0)/2;
      if(values.slot_depth_y!==values.upper_slot_depth_y){
        for(const z of [layout.z0-5,...Array.from({length:9},(_,i)=>layout.z0+(layout.z1-layout.z0)*(i+1)/10),layout.z1+5]){
          const inner=model.depthEnvelopePoint(layout,{...values,back_wall_y:0},z,true),unit=model.depthEnvelopePoint(layout,{...values,back_wall_y:1},z,true);
          const ny=unit.y-inner.y,nz=unit.z-inner.z;
          const distances=values.back_wall_y===0?[[-1,false],[-0.05,false],[0.05,false],[1,false]]
            :[[-0.05,false],[0.05,true],[values.back_wall_y-0.05,true],[values.back_wall_y+0.05,false]];
          for(const [distance,inside]of distances)probe([x,inner.y+distance*ny,z+distance*nz],inside);
        }
      }else if(values.back_wall_y===0){
        for(const y of [values.slot_depth_y-1,values.slot_depth_y-0.05,values.slot_depth_y+0.05,values.slot_depth_y+1])probe([x,y,dimensions.slotZ0+dimensions.slotHeight/2],false);
      }
      if(values.back_wall_y===0){
        // Removing the rear must not remove either grip or the connecting sides.
        for(const grip of [layout.lower,layout.upper]){
          const z=grip===layout.lower?dimensions.slotZ0-2:dimensions.slotZ0+dimensions.slotHeight+2;
          probe([dimensions.sideWallX+values.slot_width_1/4,(grip.start+grip.end)/2,z],true);
        }
        const sideFraction=values.make_holes>=0.5&&values.attachment_method==='diamond'?0.2:0.5;
        probe([dimensions.sideWallX*sideFraction,layout.centre,dimensions.slotZ0+dimensions.slotHeight/2],true);
        const r=values.riser_fillet_r,fingerX=dimensions.sideWallX+values.slot_width_1/2;
        const width=model.makeWidthProfile(values.width_taper_curve,values.width_taper_amount_mm);
        const heights=model.liftedPlatformHeights(Array.from({length:values.slot_count},(_,i)=>values['riser_height_'+(i+1)]),model.depthProfileSections(values),width);
        const segment=width.segments.find(points=>points.at(-1).x>=0.5),t=(0.5-segment[0].x)/(segment.at(-1).x-segment[0].x);
        const widthDelta=segment.reduce((sum,point,i)=>sum+[1,3,3,1][i]*(1-t)**(3-i)*t**i*point.z,0);
        for(const [side,grip]of [['lower',layout.lower],['upper',layout.upper]]){
          const sign=side==='lower'?1:-1,base=side==='lower'?dimensions.slotZ0:dimensions.slotZ0+dimensions.slotHeight;
          for(const y of [grip.start+r/2,grip.end-r/2]){
            const surface=base+sign*(heights[0]+widthDelta+model.roundedDepthValue(values,side,y-grip.start));
            probe([fingerX,y,surface-sign*0.15],true);
            probe([fingerX,y,surface+sign*0.15],false);
          }
        }
      }
      const properties=new oc.GProp_GProps_1();let volume;
      try{oc.BRepGProp.VolumeProperties_1(shape,properties,false,false,false);volume=properties.Mass();}finally{properties.delete();}
      const mesh=tessellate(oc,shape,model.meta.tessellation),metrics=meshMetrics(mesh);
      const filename='/depth-layout-'+name+'.stl',writer=new oc.StlAPI_Writer(),progress=oc.createProgressRange();
      try{writer.SetASCIIMode?.(false);assert(writer.Write(shape,filename,progress));await writeFile(new URL(name+'.stl',output),oc.FS.readFile(filename));}finally{writer.delete();progress.delete();oc.FS.unlink(filename);}
      const result={name,sourceHash:createHash('sha256').update(source).digest('hex'),params:values,dimensions,layout,metrics,analyticVolume:volume,warnings,probes,geometryMs:performance.now()-started};await writeFile(new URL(name+'.json',output),JSON.stringify(result,null,2));
      if(probes.some(probe=>probe.actual!==probe.inside)){
        // OCCT's classifier misclassifies a near-boundary point after the eyelet
        // fuse. Never silently waive it: independently test every exported probe.
        console.log(execFileSync(process.env.PYTHON||'python',[fileURLToPath(new URL('./inspect_depth_layout.py',import.meta.url)),'--case',name],{encoding:'utf8'}).trim());
      }
      console.log('PASS '+name+' '+Math.round(result.geometryMs)+'ms '+metrics.triangles+' triangles');
    }finally{shape.delete();}
  });
}
