import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {settings,section,baseMesh,contactRegions,buildMesh,meta,mounting} from '../../src/climbing_hold/model.mjs';
import {meshMetrics} from '../../src/legacy_library/tessellate.mjs';
import {validate,readLink,modelLink} from '../../src/legacy_library/parameters.mjs';
import {getModel} from '../../src/parametric-catalogue.mjs';
import {binarySTL} from '../../src/drone_frame/exports.mjs';
import {BOLT,seatDimensions,boltPlacement} from '../../src/climbing_hold/hardware.mjs';
import createManifold from '../../assets/cad/coffee-filter/manifold/manifold.js';

const api=await createManifold();api.setup();
const output=new URL('../../output/climbing-hold/',import.meta.url);await mkdir(output,{recursive:true});
const solidFor=mesh=>api.Manifold.ofMesh(new api.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices}));

test('STL labels identify the hold without changing the existing drone header',()=>{
  const mesh={positions:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2])};
  const header=title=>new TextDecoder().decode(new Uint8Array(binarySTL(mesh,title),0,80)).replace(/\0+$/,'');
  assert.equal(header(undefined),'Santeri Hukari - parametric drone frame - millimetres');
  assert.equal(header('Crimp climbing hold'),'Santeri Hukari - Crimp climbing hold - millimetres');
});

test('new library model has jagged layers, editable M10 seat, three smaller seats and complete links',()=>{
  const p=settings(),definition=getModel('crimp_hold');
  assert.equal(p.surface_texture,'layer-random-jagged');assert.equal(p.texture_layer_height,.2);
  assert.equal(p.bolt_clearance,11);assert.equal(p.bolt_head_diameter,22.8);assert.equal(p.bolt_angle,90);
  assert.equal(mounting(p).length,4);
  const declared=new Set([...definition.basic,...definition.groups.flatMap(([,keys])=>keys)]);
  assert.deepEqual(declared,new Set(meta.params.map(param=>param.key)));
  for(const base of ['https://example.invalid/','https://example.invalid/project/']){
    const url=modelLink('crimp_hold',meta,p,base,new URL('src/legacy_library/parameters.mjs',base).href);
    assert.equal(new URL(url).pathname,new URL('parametric-models/crimp-hold/',base).pathname);
    assert.deepEqual(readLink(meta,new URL(url)),p);
  }
});

test('IKH M10x40 seats use the actual 22.4 mm head and include the head in overall length',()=>{
  const p=settings(),hole=mounting(p)[0],seat=seatDimensions(hole),position=boltPlacement(hole);
  assert.equal(BOLT.head,22.4);assert.equal(BOLT.headHeight,6.2);assert.equal(BOLT.pitch,1.5);assert.equal(BOLT.hex,6);
  assert(Math.abs(seat.countersink_depth_mm-5.9)<1e-10);
  assert(Math.abs(seat.mouth_from_wall_mm-15.9)<1e-10);
  assert(Math.abs(position.head_top_from_wall_mm-15.7)<1e-10);
  assert(Math.abs(position.projection_behind_hold_mm-24.3)<1e-10);
  assert.equal(position.wall_and_tnut_engagement_verified,false);
  assert.equal(boltPlacement({...hole,head:20.4}),null);
  assert.equal(boltPlacement({...hole,angle:85}),null);
});

test('obsolete prototype links update the undersized head; new custom clearances round-trip',()=>{
  const old=new URL('https://example.invalid/parametric-models/crimp-hold/?bolt_head_diameter=20.4&screw_clearance=5.4&incut_angle=20');
  const updated=readLink(meta,old);assert.equal(updated.bolt_head_diameter,22.8);assert.equal(updated.screw_clearance,5.5);assert.equal(updated.incut_angle,20);
  const custom={...settings(),screw_clearance:5.4};
  assert.deepEqual(readLink(meta,new URL(modelLink('crimp_hold',meta,custom,old.href))),custom);
});

test('the lip arc is tangent to both the incut shelf and the elliptical front',()=>{
  for(const change of [{},{incut_angle:0},{incut_angle:25,edge_radius:3},{projection:42,grip_depth:26}]){
    const p=settings(change),s=section(p),r=p.edge_radius,normal=[-Math.sin(p.incut_angle*Math.PI/180),Math.cos(p.incut_angle*Math.PI/180)];
    for(let i=0;i<2;i++)assert(Math.abs(s.lineEnd[i]-s.circle[i]-r*normal[i])<1e-9);
    const e=s.ellipse(s.ellipseStart),delta=e.map((v,i)=>v-s.circle[i]);
    assert(Math.abs(Math.hypot(...delta)-r)<1e-9);
    const tangent=[p.projection*Math.cos(s.ellipseStart),-p.height/2*Math.sin(s.ellipseStart)];
    assert(Math.abs(delta[0]*tangent[0]+delta[1]*tangent[1])<1e-9);
    assert(s.lineEnd[0]>5);
  }
});

test('invalid and incompatible hardware/body combinations fail before generation',()=>{
  for(const change of [{width:NaN},{grip_depth:32,projection:28},{edge_radius:8,grip_depth:12},{screw_web:9,height:58,projection:28,grip_depth:18},{screw_count:4},{bolt_head_diameter:20.4}]){
    assert(!validate(meta,{...settings(),...change}).valid,JSON.stringify(change));
  }
});

for(const [name,change]of Object.entries({smooth:{surface_texture:'none'},default:{},wide:{width:120,grip_depth:24,incut_angle:20,texture_layer_height:.28},twoScrews:{screw_count:2,surface_texture:'none',bolt_head_diameter:22.8},roundedGrain:{surface_texture:'fine-stone',incut_angle:0}})){
  test(name+': one closed hold, flat back, actual mounting cuts and protected seats',{timeout:180000},async()=>{
    const p=settings(change),result=await buildMesh(p),base=solidFor(baseMesh(p)),solid=solidFor(result.mesh);
    try{
      assert.equal(base.status(),'NoError');assert.equal(solid.status(),'NoError');
      const parts=solid.decompose();assert.equal(parts.length,1);parts.forEach(part=>part.delete());
      const metrics=meshMetrics(result.mesh);assert(metrics.volume>0);assert(metrics.volume<base.volume());
      assert.equal(metrics.max[1],0);assert.equal(metrics.min[0],-p.width/2);assert.equal(metrics.max[0],p.width/2);
      assert.equal(result.report.copyright,'Santeri Hukari');assert.equal(result.report.structural_status,'NOT VALIDATED');
      for(const hole of mounting(p)){
        const tube=api.Manifold.cylinder(p.projection+2,hole.bore/2-.05,hole.bore/2-.05,96),turned=tube.rotate([90,0,0]),at=turned.translate([hole.x,1,hole.z]),intersection=api.Manifold.intersection(solid,at);
        assert(intersection.volume()<1e-5,'A bore is obstructed');intersection.delete();at.delete();turned.delete();tube.delete();
      }
      const hole=mounting(p)[0],placement=boltPlacement(hole);
      const shaft=api.Manifold.cylinder(BOLT.length-BOLT.headHeight,BOLT.diameter/2,BOLT.diameter/2,96),shaftTurn=shaft.rotate([90,0,0]);
      const shaftAt=shaftTurn.translate([hole.x,-placement.tip_from_wall_mm,hole.z]);
      const head=api.Manifold.cylinder(BOLT.headHeight,BOLT.diameter/2,BOLT.head/2,96),headTurn=head.rotate([90,0,0]);
      const headAt=headTurn.translate([hole.x,-placement.head_bottom_from_wall_mm,hole.z]),bolt=api.Manifold.union(shaftAt,headAt),collision=api.Manifold.intersection(solid,bolt);
      try{assert(collision.volume()<1e-4,'The actual M10x40 head/shaft intersects the hold at its nominal seated position');}
      finally{[collision,bolt,headAt,headTurn,head,shaftAt,shaftTurn,shaft].forEach(part=>part.delete());}
      if(name==='default'){
        const region=contactRegions(p)[0],s=section(p),positions=result.mesh.positions;let lip=0,sides=0;
        for(let i=0;i<positions.length;i+=3){
          const x=positions[i],y=positions[i+1],z=positions[i+2],scale=Math.sqrt(Math.max(0,1-(2*x/p.width)**2));
          const lift=z-region.height(x,y);
          if(!(lift>.2))continue;
          const depth=-y/scale;
          if(Math.abs(x)<10&&depth>s.lineEnd[0]&&depth<s.ellipse(s.ellipseStart)[0])lip++;
          if(Math.abs(x)>p.width*.32&&Math.abs(x)<p.width*.45)sides++;
        }
        assert(lip>100,'Jagged relief missing from the rounded grip lip');assert(sides>100,'Jagged relief missing from curved sides');
        assert.equal(result.report.texture.print_rear_y_mm,0);assert.equal(result.report.texture.print_layer_axis,'-Y');
        assert(result.report.texture.maximum_applied_relief_mm>.7);
      }
      await writeFile(new URL(name+'.stl',output),new Uint8Array(binarySTL(result.mesh,'crimp climbing hold')));
      await writeFile(new URL(name+'.json',output),JSON.stringify({...result.report,metrics}));
      console.log(`${name}: ${metrics.triangles} triangles, ${Math.round(metrics.volume)} mm3`);
    }finally{solid.delete();base.delete();}
  });
}
