import test from 'node:test';
import assert from 'node:assert/strict';
import {PATTERNS,textureOffset,layerWave,patternFor} from '../../../src/legacy_library/texture-patterns.mjs';
import {texturedMesh,contactHeight,withContactTextures,validateTexturedMesh,textureSTL} from '../../../src/legacy_library/contact-texture.mjs';
import * as model from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
import {defaults,getModel} from '../../../src/legacy_library/catalogue.mjs';
import {modelLink,readLink,validate,visible} from '../../../src/legacy_library/parameters.mjs';

const region={side:'lower',sign:1,originX:0,x0:0,x1:12,y0:0,y1:10,z0:2,z1:2,
  curves:[{points:[{x:0,z:2},{x:12,z:2}]}],profile:{depth:10,radius:0,rearDirection:-1,segments:[{kind:'line',points:[{x:0,y:0},{x:10,y:0}]}]}};
const slab={positions:new Float32Array([0,0,0,12,0,0,12,10,0,0,10,0,0,0,2,12,0,2,12,10,2,0,10,2]),
  indices:new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7])};
test('existing presets plus eight aggressive textures have deterministic relief and boundary fades',()=>{
  assert.equal(PATTERNS.length,24);assert.equal(PATTERNS.filter(pattern=>pattern.aggressive).length,8);
  for(const pattern of PATTERNS){
    let lo=Infinity,hi=-Infinity;
    for(let y=0;y<12;y+=0.25)for(let x=0;x<18;x+=0.25){const value=textureOffset(pattern,x,y,2);lo=Math.min(lo,value);hi=Math.max(hi,value);assert.equal(textureOffset(pattern,x,y,2),value);}
    assert.equal(Math.abs(textureOffset(pattern,3,7,-1)),0);
    if(pattern.slug==='none')assert.equal(hi-lo,0);else assert(hi-lo>Math.abs(pattern.height)*0.4);
  }
});
test('no texture leaves the exact original mesh and byte buffers untouched',()=>{
  assert.equal(texturedMesh(slab,[region],'none').mesh,slab);
});
test('adaptive shared-edge splitting keeps a closed solid and roughens only contact geometry',async()=>{
  for(const slug of ['fine-stone','blunt-cones','shallow-dimples']){
    const result=texturedMesh(slab,[region],slug);await validateTexturedMesh(result.mesh);
    assert(result.report.affected_vertices.lower>100);assert.equal(result.report.affected_vertices.upper,0);
    assert(result.mesh.indices.length>slab.indices.length);
    const p=result.mesh.positions;
    for(let i=0;i<p.length;i+=3){
      if(p[i]===0||p[i]===12||p[i+1]===0||p[i+1]===10||p[i+2]===0)assert([0,2].includes(p[i+2]),'Protected boundary changed');
      if(slug==='shallow-dimples'&&p[i+2]!==0)assert(p[i+2]<=2);
    }
    const bytes=textureSTL(result.mesh),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(view.getUint32(80,true),result.mesh.indices.length/3);
  }
});
test('contact descriptions follow lower/upper profiles, including no-back rear rounding',()=>{
  for(const back of [0,2]){
    const values={...defaults(model.meta),back_wall_y:back},regions=model.contactTextureRegions(values);
    assert(regions.some(region=>region.side==='lower'));assert(regions.some(region=>region.side==='upper'));
    for(const region of regions){
      const x=(region.x0+region.x1)/2;
      const r=values.riser_fillet_r,y=region.y1-r;
      const tangent=contactHeight(region,x,y),rear=contactHeight(region,x,region.y1);
      assert.equal(Math.sign((rear-tangent)*region.sign),back===0?-1:1);
    }
  }
});
test('new-library-only presets preserve original defaults and serialize into model links',async()=>{
  const loaded=await getModel('unlevel_hangboard_depth_taper').load();assert.equal(loaded.build,model.build);
  assert(!model.meta.params.some(field=>field.key==='surface_texture'));
  assert.equal(loaded.meta.params.find(field=>field.key==='surface_texture').options.length,24);
  const layer=loaded.meta.params.find(field=>field.key==='texture_layer_height');assert.equal(layer.default,0.2);
  assert(visible(layer,{surface_texture:'layer-random-waves'}));assert(visible(layer,{surface_texture:'layer-random-jagged'}));assert(!visible(layer,{surface_texture:'fine-stone'}));
  for(const pattern of PATTERNS){
    const values={...defaults(loaded.meta),surface_texture:pattern.slug};assert(validate(loaded.meta,values).valid);
    const url=modelLink('unlevel_hangboard_depth_taper',loaded.meta,values,'https://example.invalid/');assert.deepEqual(readLink(loaded.meta,new URL(url)),values);
  }
  const legacy=withContactTextures(model);assert(!validate(legacy.meta,{...defaults(legacy.meta),depth_profile_version:2,surface_texture:'fine-stone'}).valid);
});

test('layer centres use independent random functions rather than one correlated 2D noise field',()=>{
  const pattern=patternFor('layer-random-waves'),a=[],b=[];
  for(let layer=0;layer<80;layer++)for(let cell=0;cell<80;cell++){
    const x=cell*0.8+0.3;a.push(layerWave(x,layer));b.push(layerWave(x,layer+1));
    assert(Math.abs(pattern.profile(x,0,{printHeight:(layer+0.5)*0.2,layerHeight:0.2})-layerWave(x,layer))<1e-12);
  }
  const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length,ma=mean(a),mb=mean(b);
  let cov=0,aa=0,bb=0;for(let i=0;i<a.length;i++){cov+=(a[i]-ma)*(b[i]-mb);aa+=(a[i]-ma)**2;bb+=(b[i]-mb)**2;}
  assert(Math.abs(cov/Math.sqrt(aa*bb))<0.08);
});

test('0.20 mm print-layer centres are present in the actual closed mesh',async()=>{
  const result=texturedMesh(slab,[region],'layer-random-waves',{texture_layer_height:0.2});await validateTexturedMesh(result.mesh);
  assert.equal(result.report.layer_sample_step_mm,0.1);assert.equal(result.report.print_layer_axis,'-Y');
  let matches=0;const p=result.mesh.positions;
  for(let i=0;i<p.length;i+=3){
    const x=p[i],y=p[i+1],z=p[i+2],layer=Math.round((10-y)/0.2-0.5);
    if(x<2||x>10||y<2||y>8||z<1||Math.abs(y-(10-(layer+0.5)*0.2))>1e-5)continue;
    assert(Math.abs(z-(2+0.6*layerWave(x,layer)))<1e-4);matches++;
  }
  assert(matches>100);
  assert.throws(()=>texturedMesh(slab,[region],'layer-random-waves',{texture_layer_height:0}),/height/);
});

test('pointed forms have no flat tip and triangular faces retain linear sharp sides',()=>{
  const cone=patternFor('sharp-cones');assert.equal(cone.profile(0,0),1);assert(cone.profile(0.05,0)<1);assert.equal(cone.profile(0.84,0),0);
  const triangle=patternFor('alternating-triangles');assert(Math.abs(triangle.profile(0.8,0.8)-1)<1e-12);
  assert(Math.abs(triangle.profile(1.6,1.6)-0.45)<1e-12);
  const a=triangle.profile(0.2,0.7),b=triangle.profile(0.3,0.7),c=triangle.profile(0.4,0.7);assert(Math.abs(a+c-2*b)<1e-12);
});
