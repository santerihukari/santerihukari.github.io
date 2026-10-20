import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url),json=url=>JSON.parse(readFileSync(url,'utf8'));
for(const [directory,revision,count,nativeFiles] of [['vw-t4-engine/r9',9,271,291],['vw-t4-powertrain/r13',13,400,424],['vw-t4-vehicle/r13',13,435,461]]){
  const prefix=`assets/models/${directory}/`,base=new URL(prefix,root),read=file=>json(new URL(file,base));
  test(`${directory}: matched complete GLB, source identities and local export hashes`,()=>{
    const m=read('manifest.json'),p=read('publication.json');
    assert.equal(p.snapshot,'vw_t4_update_2026-10-20');assert.equal(p.viewer_revision,'release-2026-10-20');
    for(const record of [m,p]){assert.equal(record.model_revision,revision);assert.equal(record.part_count,count);}
    assert.equal(m.parts.length,count);const ids=m.parts.map(part=>part.id).sort();assert.equal(new Set(ids).size,count);
    assert.equal(m.rotation_convention.crank_sign,-1);assert.equal(m.parameters.timing_cover,false);
    assert.deepEqual(m.parameters,read('params.json'));
    assert.deepEqual(readdirSync(new URL('parts/',base)).sort(),ids.map(id=>id+'.stl').sort());
    const glb=readFileSync(new URL('engine_assembly.glb',base));
    assert.equal(glb.subarray(0,4).toString(),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
    assert.equal(glb.readUInt32LE(16),0x4e4f534a);
    const document=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
    const meshNodes=document.nodes.filter(node=>node.mesh!==undefined);
    assert.equal(document.meshes.length,count);assert.equal(meshNodes.length,count);
    assert.deepEqual(meshNodes.map(node=>node.name||document.meshes[node.mesh].name).sort(),ids);
    const files=p.files.filter(file=>file.path.startsWith(prefix));assert.equal(files.length,nativeFiles);
    assert.equal(new Set(p.files.map(file=>file.path)).size,p.files.length);
    const runtime=p.files.filter(file=>file.path.startsWith('src/t4-engine/release-2026-10-20/'));
    assert.equal(runtime.length,13);assert(runtime.some(file=>file.path.endsWith('/inspection.mjs')));assert(runtime.some(file=>file.path.endsWith('/service.mjs')));
    for(const file of p.files){
      assert(!file.path.split('/').includes('..'));assert(!/^(?:[A-Za-z]:|\/)/.test(file.path));
      const bytes=readFileSync(new URL(file.path,root));assert.equal(bytes.length,file.bytes,file.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
    }
    const transformed=files.filter(file=>file.publication_transform);
    assert.deepEqual(transformed.map(file=>file.path.slice(prefix.length)).sort(),['component_references.json','engine_parts.zip']);
    for(const file of transformed){assert.match(file.source_sha256,/^[a-f0-9]{64}$/);assert.notEqual(file.source_sha256,file.sha256);assert(file.source_bytes>0);}
    const ledger=read('component_references.json');assert.equal(ledger.external_meshes_imported,false);assert.equal(ledger.photo_scale_calibrated,false);
    for(const id of ['ovoko_huj1820','aspl_a0006','aspl_s0005']){
      const source=ledger.assets.find(asset=>asset.id===id);assert(source,id);assert.equal(source.photo_informed_cad,true);assert.equal(source.asset_embedded,false);
    }
    for(const source of ledger.assets){assert(!Object.hasOwn(source,'user_supplied_archive'));assert(!Object.hasOwn(source,'local_reference_preview'));}
    const pump=ledger.assets.find(asset=>asset.id==='vascopires_bosch_ve');assert(pump);assert.equal(pump.asset_embedded,false);assert.match(pump.listed_license,/CC BY-NC-ND 4.0/);
    assert(!JSON.stringify(ledger).includes('127.0.0.1:8770'));assert(!JSON.stringify(ledger).includes('F:/param_cad'));
    if(count>271){
      assert.equal(m.engine_geometry_revision,9);assert.equal(m.powertrain_revision,7);
      for(const id of ['drive_engine_backplate','drive_output_extension','drive_shaft_bracket','drive_flange_right'])assert(ids.includes(id),id);
      assert.deepEqual(m.powertrain,read('powertrain_reference.json'));
      assert.deepEqual(m.powertrain.geometry_parameters,read('powertrain_params.json'));
      assert.equal(m.powertrain.measurements_verified,false);
      const starter=read('starter_reference.json');assert.equal(starter.drive_direction,'+X toward flywheel');
      assert.equal(starter.dimensions_verified,false);assert.equal(starter.installed_variant_verified,false);
    }
    if(count===400){const audit=read('interference_report.json');assert.equal(audit.unresolved_count,0);assert.equal(audit.documented_attachment_count,18);}
    if(count===435){
      assert.equal(m.vehicle.parameters.wheelbase,2920);assert.equal(m.vehicle.added_context_parts,35);
      assert.equal(ids.filter(id=>id.startsWith('vehicle_')).length,35);
      for(const flag of ['repair_ready','whole_vehicle_physics_solved','suspension_geometry_solved','engine_and_transmission_layout_verified','installed_engine_tilt_verified'])assert.equal(m.vehicle[flag],false,flag);
    }
  });
}
