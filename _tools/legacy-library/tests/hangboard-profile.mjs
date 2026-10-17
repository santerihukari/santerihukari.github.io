import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import {tessellate, meshMetrics} from '../../../src/legacy_library/tessellate.mjs';

export const referenceCommit = 'ff1bb183e55759ab167e8a7d55427cdb0cd1ef77';
const modelPath = 'src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = new URL('../../../output/legacy-library/hangboard-profile/', import.meta.url);
export const cases = {
  default: {},
  curved: {depth_taper_curve:'0,1|0.25,1.05|0.5,1.1|0.75,1.05|1,1'},
  arch: {depth_taper_curve:'0,1|0.5,1.1|1,1'},
  slope: {depth_taper_curve:'0,1|1,1.1'},
  unrounded: {depth_taper_curve:'0,1|0.5,1.1|1,1',slot_fillet_r:0,riser_fillet_r:0,outer_fillet_r:0},
  oneSided: {risers_on_both_sides:0, make_holes:0},
  zeroFuzzy: {boolean_fuzzy:0},
  sixSlots: {slot_count:6,riser_height_4:5,riser_height_5:12,riser_height_6:5,outer_fillet_r:3,riser_fillet_r:1},
};
const legacyFeatureCases = {
  rope: {attachment_method:'rope_groove'},
  ropeOffset: {attachment_method:'rope_groove',rope_depth_offset_mm:8},
  ropeBodyOnly: {attachment_method:'rope_groove',make_holes:0},
  upperDeep: {slot_depth_y:16,upper_slot_depth_y:32},
  lowerDeep: {slot_depth_y:32,upper_slot_depth_y:16},
  unequalCurved: {slot_depth_y:16,upper_slot_depth_y:32,depth_taper_curve:'0,1|0.5,1.03|1,1',riser_fillet_r:0},
  eyeletTop: {attachment_method:'single_point',attachment_side:'top'},
  eyeletBottom: {attachment_method:'single_point',attachment_side:'bottom'},
  eyeletBoth: {attachment_method:'single_point',attachment_side:'both'},
  eyeletOffset: {attachment_method:'single_point',attachment_side:'both',eyelet_depth_offset_mm:8},
  eyeletOneSlot: {attachment_method:'single_point',attachment_side:'top',slot_count:1,riser_height_1:0},
  eyeletOneRaised: {attachment_method:'single_point',attachment_side:'top',slot_count:1},
  eyeletSixSlots: {attachment_method:'single_point',attachment_side:'both',slot_count:6},
  widthRaised: {width_taper_curve:'0,1|0.5,1.15|1,1'},
  widthHollow: {width_taper_curve:'0,1|0.5,0.85|1,1'},
  widthDepth: {width_taper_curve:'0,1|0.5,1.1|1,1',depth_taper_curve:'0,1|0.5,1.05|1,1'},
  widthRope: {width_taper_curve:'0,1|0.5,1.15|1,1',attachment_method:'rope_groove'},
  widthProbe: {width_taper_curve:'0,1|0.5,1.15|1,1',slot_fillet_r:0,riser_fillet_r:0,outer_fillet_r:0},
  reportedCurve: {attachment_method:'rope_groove',riser_fillet_r:2,
    width_taper_curve:'0,1|0.392202,0.87|0.598624,0.87|1,1',
    depth_taper_curve:'0,1|0.327982,1.070472|1,1'},
  liftProbe: {attachment_method:'rope_groove',riser_fillet_r:0,slot_fillet_r:0,outer_fillet_r:0,
    width_taper_curve:'0,1|0.392202,0.87|0.598624,0.87|1,1',
    depth_taper_curve:'0,1|0.327982,1.070472|1,1'},
  depthBelowBase: {slot_count:1,riser_height_1:0,riser_fillet_r:0,slot_fillet_r:0,outer_fillet_r:0,
    depth_taper_curve:'0,1|0.5,0.75|1,1',depth_taper_amount_mm:2},
  eyeletHollow: {attachment_method:'single_point',attachment_side:'both',width_taper_curve:'0,1|0.5,0.87|1,1'},
};
const frozenFeatureCases={...Object.fromEntries(Object.entries(legacyFeatureCases).map(([key,values])=>[key,{depth_profile_version:1,...values}])),
  roundedDefault:{depth_profile_version:2},
  roundedRope:{depth_profile_version:2,attachment_method:'rope_groove'},
  roundedCurve:{depth_profile_version:2,...legacyFeatureCases.reportedCurve},
  roundedUnequal:{depth_profile_version:2,slot_depth_y:16,upper_slot_depth_y:32},
  roundedEyelet:{depth_profile_version:2,attachment_method:'single_point',attachment_side:'both'},
  roundedOneSided:{depth_profile_version:2,risers_on_both_sides:0},
  roundedSmall:{depth_profile_version:2,riser_fillet_r:1},
  roundedLarge:{depth_profile_version:2,riser_fillet_r:7},
  roundedNegative:{depth_profile_version:2,slot_count:1,riser_height_1:0,depth_taper_curve:'0,1|0.5,0.85|1,1'},
  roundedRopeOffset:{depth_profile_version:2,attachment_method:'rope_groove',rope_depth_offset_mm:8},
  roundedRopeBodyOnly:{depth_profile_version:2,attachment_method:'rope_groove',make_holes:0},
  roundedRopeUnrounded:{depth_profile_version:2,attachment_method:'rope_groove',outer_fillet_r:0},
  roundedTightOneSided:{depth_profile_version:2,risers_on_both_sides:0,slot_clearance_between_surfaces:4,riser_height_1:40},
  roundedSix:{depth_profile_version:2,slot_count:6},
  roundedShortStep:{depth_profile_version:2,riser_height_2:14},
  roundedTightCorners:{depth_profile_version:2,slot_width_1:6,slot_width_2:6,slot_width_3:6,slot_width_4:6,slot_fillet_r:8},
  roundedUnevenSpline:{depth_profile_version:2,width_taper_curve:'0,1|0.01,1.001|0.1,1.4|0.8,1.45|1,1',depth_taper_curve:'0,1|0.04,1.001|0.15,1.4|0.8,1.45|1,1'}
};
export const featureCases=Object.fromEntries(Object.entries(frozenFeatureCases).map(([name,values])=>[name,{back_wall_y:4,...values}]));
const hash = value => createHash('sha256').update(value).digest('hex');

async function runChild(variant, name) {
  let source = variant === 'reference'
    ? execFileSync('git', ['show', `${referenceCommit}:${modelPath}`], {cwd:root, encoding:'utf8'})
    : await readFile(new URL('../../../' + modelPath, import.meta.url), 'utf8');
  const sourceHash = hash(source);
  const stack = [], events = [], counts = {edgeProperties:0,edgeBounds:0};
  globalThis.__hangboardStage = (name, enter) => enter ? stack.push(name) : stack.pop();
  const functions = [...source.matchAll(/^function (\w+)\(/gm)].map(match => match[1]);
  source += '\n' + functions.map(name => `{const original=${name};${name}=function(...args){globalThis.__hangboardStage('${name}',true);const started=performance.now();try{const result=original(...args);globalThis.__hangboardShape?.('${name}',args[0],result);return result;}finally{globalThis.__hangboardStage('${name}',false);globalThis.__hangboardTiming('${name}',performance.now()-started);}};}`).join('\n');
  globalThis.__hangboardShape=(name,oc,shape)=>{
    if(!process.env.HANGBOARD_STAGES||!['shapePerimeterBody','requiredEdgeFillet','makeRailWall','addIntegratedSideRails','booleanCutAdaptive','booleanFuseAdaptive'].includes(name))return;
    const check=new oc.BRepCheck_Analyzer(shape,true,false),explorer=new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_SOLID,oc.TopAbs_ShapeEnum.TopAbs_SHAPE),solids=[];
    try{
      while(explorer.More()){
        const solid=explorer.Current(),properties=new oc.GProp_GProps_1();
        try{oc.BRepGProp.VolumeProperties_1(solid,properties,false,false,false);solids.push(properties.Mass());}finally{properties.delete();solid.delete();}
        explorer.Next();
      }
      const event={phase:'shape',name,valid:check.IsValid_2(),solids};events.push(event);
      process.stdout.write(JSON.stringify(event)+'\n');
    }finally{check.delete();explorer.delete();}
  };
  globalThis.__hangboardTiming = (name, ms) => {
    if (ms > 50) events.push({name,ms});
  };
  const expose=variant==='current'?'\nexport {perimeterRopePlacement,perimeterEdgeRadius,attachmentDimensions,internalEyeletGeometry,parseCurvePoints,evaluateCurve,curveValueToUnitDelta,integratedRailLayout,roundedDepthCurve,roundedDepthValue,liftedPlatformHeights,depthProfileSections,makeWidthProfile,roundedHalfBoundary};':'';
  const model = await import('data:text/javascript;base64,' + Buffer.from(source+expose).toString('base64'));
  const directory = new URL('../../../assets/occt/', import.meta.url);
  const factorySource = await readFile(new URL('opencascade.full.js', directory), 'utf8');
  const factory = new Function('require','__dirname',factorySource.replace(/export default Module;\s*$/, 'return Module;'))(createRequire(import.meta.url),fileURLToPath(directory));
  const loading = performance.now();
  const oc = withProgressCompatibility(await factory({wasmBinary:await readFile(new URL('opencascade.full.wasm',directory))}));
  const loadingMs = performance.now()-loading;
  const measure = oc.BRepGProp.LinearProperties, bounds = oc.BRepBndLib.Add;
  oc.BRepGProp.LinearProperties = (...args) => {counts.edgeProperties++;return measure(...args);};
  oc.BRepBndLib.Add = (...args) => {counts.edgeBounds++;return bounds(...args);};
  for (const name of Object.keys(oc).filter(name=>/^BRepAlgoAPI_(Cut|Fuse)_|^BRepFilletAPI_MakeFillet$/.test(name))) {
    const target = oc[name];
    oc[name] = new Proxy(target, {construct(target,args) {
      const started=performance.now(), instance=Reflect.construct(target,args);
      events.push({name:name+'.constructor',stage:stack.at(-1),ms:performance.now()-started});
      const build=instance.Build.bind(instance);
      let radius, selection=0;
      if(instance.Add_2){const add=instance.Add_2.bind(instance);instance.Add_2=(r,edge)=>{radius=r;selection++;return add(r,edge);};}
      instance.Build=(...args)=>{
        const started=performance.now(),stage=stack.at(-1);
        process.stdout.write(JSON.stringify({phase:'start',name:name+'.Build',stage})+'\n');
        try{return build(...args);}finally{
          const generatedPerContour=[];
          if(selection&&instance.IsDone())for(let contour=1;contour<=instance.NbContours();contour++){
            let count=0;
            for(let i=1;i<=instance.NbEdges(contour);i++){
              const edge=instance.Edge(contour,i),faces=instance.Generated(edge);
              try{count+=faces.Size();}finally{faces.delete();edge.delete();}
            }
            generatedPerContour.push(count);
          }
          const event={name:name+'.Build',stage,family:stack.at(-2),ms:performance.now()-started,...(selection?{radius,selection,generatedPerContour}:{})};events.push(event);
          process.stdout.write(JSON.stringify(event)+'\n');
        }
      };
      return instance;
    }});
  }
  const warnings=[], warn=console.warn;
  console.warn=(...args)=>warnings.push(args.map(String).join(' '));
  const params={...Object.fromEntries(model.meta.params.map(param=>[param.key,param.default])),attachment_method:'diamond',width_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',depth_taper_curve:'0,1|0.25,1|0.5,1|0.75,1|1,1',width_taper_amount_mm:3,depth_taper_amount_mm:10,slot_fillet_r:2,...(Object.hasOwn(cases,name)?{back_wall_y:20,depth_profile_version:1}:{}),...(cases[name]||featureCases[name])};
  const started=performance.now();
  const shape=model.build(oc,params);
  const geometryMs=performance.now()-started;
  const checker=new oc.BRepCheck_Analyzer(shape,true,false),brepValid=checker.IsValid_2();checker.delete();
  const meshStarted=performance.now();
  const mesh=tessellate(oc,shape,model.meta.tessellation);
  const previewMs=performance.now()-meshStarted;
  const properties=new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape,properties,false,false,false);
  const result={variant,name,sourceHash,params,metadata:model.meta,loadingMs,geometryMs,previewMs,brepValid,analyticVolume:properties.Mass(),mesh:meshMetrics(mesh),positionsHash:hash(mesh.positions),indicesHash:hash(mesh.indices),warnings,counts,events};
  if (Object.hasOwn(featureCases,name)) {
    const checks=[];
    const probe=(label,x,y,z,inside)=>{
      const point=new oc.gp_Pnt_3(x,y,z), classifier=new oc.BRepClass3d_SolidClassifier_3(shape,point,1e-6);
      try {
        const state=classifier.State(),actual=state===oc.TopAbs_State.TopAbs_IN?'inside':state===oc.TopAbs_State.TopAbs_OUT?'outside':'boundary/unknown';
        checks.push({label,point:[x,y,z],expected:inside?'inside':'outside',actual});
      }finally{classifier.delete();point.delete();}
    };
    if(['ropeBodyOnly','roundedRopeBodyOnly'].includes(name)) {
      const d=model.attachmentDimensions(params),w=d.blockWidthX,h=d.blockHeightZ;
      const route=model.perimeterRopePlacement(params,d),x=w/4,crown=route.crownRadius-Math.sqrt(route.crownRadius**2-(w/4)**2);
      for(const y of [3,d.blockDepthY/2,d.blockDepthY-2]){
        probe('body-only bottom outside Y='+y,x,y,crown-0.25,false);
        probe('body-only bottom material Y='+y,x,y,crown+0.25,true);
        probe('body-only top outside Y='+y,x,y,h-crown+0.25,false);
        probe('body-only top material Y='+y,x,y,h-crown-0.25,true);
        probe('body-only side without groove Y='+y,0.5,y,h/2,true);
      }
    }
    if(['rope','ropeOffset','roundedRope','roundedRopeOffset','roundedRopeUnrounded','roundedCurve'].includes(name)) {
      const d=model.attachmentDimensions(params),w=d.blockWidthX,h=d.blockHeightZ;
      const y=(params.slot_depth_y+params.upper_slot_depth_y)/4+params.rope_depth_offset_mm;
      for(const [label,x,z] of [['left',0,h/2],['right',w,h/2],['top',w/2,h],['bottom',w/2,0]])probe(label+' groove',x,y,z,false);
      for(const [label,x,z] of [['left',6.4,h/2],['right',w-6.4,h/2],['top',w/2,h-6.4],['bottom',w/2,6.4]])probe(label+' remaining wall',x,y,z,true);
      const route=model.perimeterRopePlacement(params,d),rail=model.integratedRailLayout(params,d,route);
      const outer=model.perimeterEdgeRadius(params,d,route),q=Math.SQRT1_2;
      if(outer>0.05)for(const [end,py]of [['front',outer*(1-q)],['back',d.blockDepthY-outer*(1-q)]]){
        for(const [label,z,sign]of [['top',h-outer*(1-q),-1],['bottom',outer*(1-q),1]]){
          probe(label+' '+end+' complete oval rounding material',w/2,py,z+sign*0.03,true);
          probe(label+' '+end+' complete oval rounding removed',w/2,py,z-sign*0.03,false);
        }
        for(const [side,x,sign]of [['left',outer*(1-q),1],['right',w-outer*(1-q),-1]]){
          probe(side+' '+end+' window edge rounding material',x+sign*0.03,py,h/2,true);
          probe(side+' '+end+' window edge rounding removed',x-sign*0.03,py,h/2,false);
        }
      }
      for(const [side,x]of [['left',0],['right',w]]){
        const sign=x===0?-1:1;
        for(const [i,z]of rail.coveredCentres.entries()){
          probe(side+' covered channel '+i+' open bore',x,y,z,false);
          probe(side+' covered channel '+i+' outer wall',x+sign*(rail.extent-0.5),y,z,true);
          probe(side+' covered channel '+i+' fused root',x-sign*4,y+4,z,true);
          for(const py of [2,d.blockDepthY-2])probe(side+' covered wall '+i+' full-depth shoulder Y='+py,x+sign*0.5,py,z,true);
        }
        probe(side+' middle window exposes outer half',x+sign*2,y,h/2,false);
        probe(side+' middle window retained inner seat',x-sign*4.5,y,h/2,true);
      }
      const x=w/4,crown=route.crownRadius-Math.sqrt(route.crownRadius**2-(w/4)**2),r=(params.rope_diameter+params.rope_clearance)/2;
      probe('bottom curved contact open',x,y,crown+r-0.2,false);probe('bottom curved contact material',x,y,crown+r+0.2,true);
      probe('top curved contact open',x,y,h-crown-r+0.2,false);probe('top curved contact material',x,y,h-crown-r-0.2,true);
      for(const py of [3,d.blockDepthY-2]){
        probe('whole body bottom rounded outside groove Y='+py,x,py,crown-0.25,false);
        probe('whole body bottom material Y='+py,x,py,crown+0.25,true);
        probe('whole body top rounded outside groove Y='+py,x,py,h-crown+0.25,false);
        probe('whole body top material Y='+py,x,py,h-crown-0.25,true);
      }
      for(const offset of [-1,1]){
        probe('left rounded groove lip '+offset,0.15,y+offset*(r+0.2),h/2,false);
        probe('left rounded groove shoulder '+offset,0.15,y+offset*(r+0.9),h/2,true);
        probe('right rounded groove lip '+offset,w-0.15,y+offset*(r+0.2),h/2,false);
        probe('top rounded groove lip '+offset,w/2,y+offset*(r+0.2),h-0.15,false);
        probe('bottom rounded groove lip '+offset,w/2,y+offset*(r+0.2),0.15,false);
      }
      probe('old left hole filled',d.sideWallX/2,d.blockDepthY-2,h/2,true);probe('old right hole filled',w-d.sideWallX/2,d.blockDepthY-2,h/2,true);
    }
    if(['upperDeep','lowerDeep','unequalCurved'].includes(name)){
      probe('lower front cavity',47,10,34,false);probe('upper front cavity',47,10,46,false);
      probe('lower independent rear wall',47,24,34,params.slot_depth_y<24);
      probe('upper independent rear wall',47,24,46,params.upper_slot_depth_y<24);
      const rear=Math.max(params.slot_depth_y,params.upper_slot_depth_y)+2;
      probe('lower retained back wall',47,rear,34,true);probe('upper retained back wall',47,rear,46,true);
    }
    if(name.startsWith('eyelet')) {
      const sides=params.attachment_side==='both'?['top','bottom']:[params.attachment_side];
      const d=model.attachmentDimensions(params);
      for(const side of sides){
        const placement=model.internalEyeletGeometry(params,d,side),{z,centre:y}=placement;
        const x=d.blockWidthX/2;
        for(const py of [0.5,placement.y0/2,y,(placement.y1+d.blockDepthY)/2,d.blockDepthY-0.5])probe(side+' continuous open rope passage Y='+py,x,py,z,false);
        probe(side+' eyelet material',x+6.4,y,z,true);probe(side+' root joins body',x,y,placement.rootZ+(side==='top'?0.75:-0.75),true);
        probe(side+' widened loft root',x+15,2.5,side==='top'?d.blockHeightZ-7:7,true);
        const r=(params.rope_diameter+params.rope_clearance)/2;
        probe(side+' narrow throat material',x+r+0.7,y,z,true);
        probe(side+' flared entry removes material',x+r+0.7,0.5,z,false);
        probe(side+' flared exit removes material',x+r+0.7,d.blockDepthY-0.5,z,false);
        const outZ=placement.outerZ+(side==='top'?-0.5:0.5);
        probe(side+' recess opens toward pull at front',x,placement.y0/2,outZ,false);
        probe(side+' recess opens toward pull at back',x,(placement.y1+d.blockDepthY)/2,outZ,false);
        probe(side+' load bearing bridge retained at requested Y',x,y,outZ,true);
        if(name==='eyeletOneSlot'){
          probe('local reinforcement when no pinky platform is available',x,y,z+r+2,true);
          probe('only upper grip remains unobstructed',x,y,d.blockHeightZ-params.top_wall_z-0.5,false);
        }
      }
    }
    if(name==='widthProbe') {
      let x=18;
      for(let i=1;i<=4;i++){
        const width=params['slot_width_'+i], base=params['riser_height_'+i],centre=x+width/2;
        probe('finger '+i+' below lower surface',centre,12,10+base+0.9-0.05,true);
        probe('finger '+i+' above lower surface',centre,12,10+base+0.9+0.05,false);
        probe('finger '+i+' below upper surface',centre,12,81.8-10-base-0.9-0.05,false);
        probe('finger '+i+' above upper surface',centre,12,81.8-10-base-0.9+0.05,true);
        x+=width;
      }
    }
    if(name==='liftProbe'||name==='depthBelowBase'){
      const d=model.attachmentDimensions(params),last=params.slot_count;
      let x=d.sideWallX;for(let i=1;i<last;i++)x+=params['slot_width_'+i];x+=params['slot_width_'+last]/2;
      const delta=params.depth_taper_amount_mm*model.curveValueToUnitDelta(model.evaluateCurve(model.parseCurvePoints(params.depth_taper_curve),0.5));
      const z=d.slotZ0+(name==='depthBelowBase'?0:delta);
      probe('lifted lower surface material',x,12,z-0.05,true);probe('lifted lower surface opening',x,12,z+0.05,false);
      probe('lifted upper surface opening',x,12,d.blockHeightZ-z-0.05,false);probe('lifted upper surface material',x,12,d.blockHeightZ-z+0.05,true);
    }
    if(name.startsWith('rounded')){
      const d=model.attachmentDimensions(params),radius=params.riser_fillet_r;
      const sections=model.depthProfileSections(params),heights=model.liftedPlatformHeights(Array.from({length:params.slot_count},(_,i)=>params['riser_height_'+(i+1)]),sections,model.makeWidthProfile(params.width_taper_curve,params.width_taper_amount_mm));
      const x=d.sideWallX+params.slot_width_1/2;
      const width=model.makeWidthProfile(params.width_taper_curve,params.width_taper_amount_mm);
      const segment=width.segments.find(segment=>0.5<=segment.at(-1).x),t=(0.5-segment[0].x)/(segment.at(-1).x-segment[0].x);
      const widthOffset=segment[0].z*(1-t)**3+3*segment[1].z*(1-t)**2*t+3*segment[2].z*(1-t)*t*t+segment[3].z*t**3;
      // Probe both sides of each exact YZ circular boundary, away from XZ step blends.
      for(const side of ['lower','upper']){
        const curve=model.roundedDepthCurve(params,side),sign=side==='lower'?1:-1;
        const base=side==='lower'?d.slotZ0:d.slotZ0+d.slotHeight;
        const riser=side==='upper'&&params.risers_on_both_sides<0.5?0:heights[0]+widthOffset;
        for(const [end,y]of [['front',radius*(1-Math.SQRT1_2)],['back',curve.depth-radius+radius*Math.SQRT1_2]]){
          const offset=model.roundedDepthValue(params,side,y),z=base+sign*(riser+offset);
          probe(side+' '+end+' requested-radius material',x,y,z-sign*0.05,true);
          probe(side+' '+end+' requested-radius opening',x,y,z+sign*0.05,false);
        }
      }
      const lowerMax=Math.max(...heights)+Math.max(...sections.map(s=>s.delta))+width.maxDelta,upperMax=params.risers_on_both_sides>=0.5?lowerMax:0;
      const definition={...d,slotX0:d.sideWallX,zoneWidths:Array.from({length:params.slot_count},(_,i)=>params['slot_width_'+(i+1)]),baseRiserHeights:heights,widthProfile:width,splitZ:d.slotZ0+(lowerMax+d.slotHeight-upperMax)/2};
      for(const side of ['lower','upper']){
        const boundary=model.roundedHalfBoundary(params,definition,side),sign=side==='lower'?1:-1;
        const first=boundary.profile.handles[0].y,last=boundary.profile.handles.at(-1).y,depth=boundary.profile.depth;
        for(const [label,curve,index]of [['left',boundary.floor[0],0],['right',boundary.floor.at(-1),boundary.floor.at(-1).points.length-1]]){
          const point=curve.points[index],blend=curve.sideBlend[index];
          if(Math.abs(blend)<1e-7)continue;
          for(const [end,f,y,offset]of [['front',1-Math.SQRT1_2,radius*(1-Math.SQRT1_2),first-radius*(1-Math.SQRT1_2)],['back',-(1-Math.SQRT1_2),depth-radius+radius*Math.SQRT1_2,last+radius*(1-Math.SQRT1_2)]]){
            const x=point.x+blend*f,z=(point.z+sign*offset+definition.splitZ)/2,direction=Math.sign(blend);
            probe(`${side} ${label} inner wall ${end} material`,x+direction*0.02,y,z,true);
            probe(`${side} ${label} inner wall ${end} opening`,x-direction*0.02,y,z,false);
          }
        }
        for(const [i,curve]of boundary.floor.entries()){
          if(curve.points.length!==2||Math.abs(curve.points[0].x-curve.points[1].x)>1e-7||Math.abs(curve.sideBlend[0])<1e-7)continue;
          for(const theta of [Math.PI/8,Math.PI/4,3*Math.PI/8])for(const end of ['front','back']){
            const f=end==='front'?1-Math.sin(theta):-(1-Math.cos(theta));
            const y=end==='front'?radius*(1-Math.cos(theta)):depth-radius+radius*Math.sin(theta);
            const x=curve.points[0].x+curve.sideBlend[0]*f,z=(curve.points[0].z+curve.points[1].z)/2+sign*(end==='front'?first-radius*f:last-radius*f);
            const towardSolid=Math.sign(curve.sideBlend[0]);
            probe(`${side} riser ${i} ${end} blend material ${theta}`,x+towardSolid*0.02,y,z,true);
            probe(`${side} riser ${i} ${end} blend opening ${theta}`,x-towardSolid*0.02,y,z,false);
          }
        }
      }
    }
    result.probes=checks;
    const solids=new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_SOLID,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    result.solids=0;try{while(solids.More()){result.solids++;solids.Next();}}finally{solids.delete();}
  }
  const writer=new oc.StlAPI_Writer(),progress=oc.createProgressRange();
  writer.SetASCIIMode?.(false);assert(writer.Write(shape,'/profile.stl',progress));
  await mkdir(output,{recursive:true});
  const stl=oc.FS.readFile('/profile.stl');result.stlHash=hash(stl);
  await writeFile(new URL(`${variant}-${name}.stl`,output),stl);
  await writeFile(new URL(`${variant}-${name}.json`,output),JSON.stringify(result,null,2));
  console.warn=warn;properties.delete();progress.delete();writer.delete();shape.delete();
  console.log('RESULT '+JSON.stringify({...result,metadata:undefined,events:undefined}));
}

export async function profile(variant,name,timeout=180000) {
  assert(['reference','current'].includes(variant));
  assert(Object.hasOwn(cases,name)||Object.hasOwn(featureCases,name));
  await mkdir(output,{recursive:true});
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--child',variant,name],{cwd:root,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(new Error(`${variant}/${name} exceeded ${timeout/1000}s; last phase: ${stdout.slice(-1800)}`));},timeout);
    child.stdout.on('data',bytes=>{stdout+=bytes;if(process.env.PROFILE_VERBOSE==='1')process.stdout.write(bytes);});
    child.stderr.on('data',bytes=>{stderr+=bytes;});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0)return reject(new Error(`${variant}/${name} exited ${code}: ${stderr.slice(-3000)}`));
      try{resolve(JSON.parse(stdout.split('\n').find(line=>line.startsWith('RESULT ')).slice(7)));}catch(error){reject(error);}
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2]==='--child') {
    try {await runChild(process.argv[3],process.argv[4]);}
    catch(error){console.error('CAD profile failed:',error?.message||String(error));process.exitCode=1;}
  }
  else if (process.argv[2]) await profile(process.argv[2],process.argv[3]||'default',Number(process.env.PROFILE_TIMEOUT)||180000);
}
