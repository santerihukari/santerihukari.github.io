import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),asset=path=>new URL('assets/models/vw-t4-engine/r6/'+path,root);
const json=async url=>JSON.parse(await readFile(url,'utf8'));

test('the published reference remains the verified engine-only r6 snapshot',async()=>{
  const publication=await json(asset('publication.json')),manifest=await json(asset('manifest.json'));
  assert.equal(publication.snapshot,'vw_t4_engine_reference_2026-10-17_r6');
  assert.equal(publication.controls_patch,'vw_t4_engine_controls_2026-10-17');
  assert.equal(publication.model_revision,6);assert.equal(publication.part_count,271);
  assert.equal(manifest.model_revision,6);assert.equal(manifest.parts.length,271);
  assert.equal(new Set(manifest.parts.map(part=>part.id)).size,271);
  assert.deepEqual(manifest.parameters,await json(asset('params.json')));
  assert.equal(manifest.parameters.timing_cover,false);
  const parts=await readdir(asset('parts/'));assert.equal(parts.length,271);
  assert.deepEqual(parts.sort(),manifest.parts.map(part=>part.id+'.stl').sort());
  for(const file of publication.files){
    const bytes=await readFile(new URL(file.path,root));assert.equal(bytes.length,file.bytes,file.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
  }
});

test('the static adapter removes local regeneration contracts and retains explicit warnings',async()=>{
  const app=await readFile(new URL('src/t4-engine/app.mjs',root),'utf8'),html=await readFile(new URL('_includes/t4-engine.html',root),'utf8');
  assert(!/\/api\/|\/model-files\/|\/download\/default|8770|localhost|127\.0\.0\.1/.test(app));
  assert(!/id="apply"|id="reset"|name="timing_cover"|<form/.test(html));
  for(const text of ['Estimated geometry','Illustrative flow / no CFD','Synthetic cues / not measured engine sound','No acoustic prediction','crank-zero reference pose'])assert(html.includes(text),text);
  for(const id of ['audio-enabled','audio-all','flow'])assert(!new RegExp(`id="${id}"[^>]*checked`).test(html),id+' must start off');
  assert(html.includes("'/assets/icons/download.svg' | relative_url"));
  assert(/id="cutaway"[^>]*checked/.test(html));
  assert(app.includes("./live1/drivetrain.mjs"));
  assert(html.includes('id="engine-load"')&&html.includes('id="assembly-variant"'));
});

for(const [directory,revision,count,model]of [['vw-t4-engine/r7',7,271,'vw_t4_abl_engine_v0'],['vw-t4-powertrain/r8',8,398,'vw_t4_abl_powertrain_v1']]){
  test(directory+' is a matched immutable model set with the frozen live1 runtime',async()=>{
    const base=new URL('assets/models/'+directory+'/',root),publication=await json(new URL('publication.json',base)),manifest=await json(new URL('manifest.json',base));
    assert.equal(publication.snapshot,'vw_t4_powertrain_update_2026-10-17_r8_live1');
    assert.equal(publication.viewer_revision,'live1');assert.equal(publication.part_count,count);
    assert.equal(manifest.model,model);assert.equal(manifest.model_revision,revision);assert.equal(manifest.part_count,count);
    assert.equal(new Set(manifest.parts.map(part=>part.id)).size,count);assert.equal(manifest.rotation_convention.crank_sign,-1);
    assert.deepEqual(manifest.parameters,await json(new URL('params.json',base)));
    assert.deepEqual((await readdir(new URL('parts/',base))).sort(),manifest.parts.map(part=>part.id+'.stl').sort());
    assert.equal(publication.files.filter(file=>file.path.startsWith('src/t4-engine/live1/')).length,11);
    for(const file of publication.files){
      const bytes=await readFile(new URL(file.path,root));assert.equal(bytes.length,file.bytes,file.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
    }
    const glb=await readFile(new URL('engine_assembly.glb',base));
    const document=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());assert.equal(document.meshes.length,count);
    if(revision===8){
      assert.equal(manifest.engine_geometry_revision,7);assert.equal(manifest.powertrain_revision,1);
      assert.deepEqual(manifest.powertrain,await json(new URL('powertrain_reference.json',base)));
      assert.deepEqual(manifest.powertrain.geometry_parameters,await json(new URL('powertrain_params.json',base)));
    }
  });
}
