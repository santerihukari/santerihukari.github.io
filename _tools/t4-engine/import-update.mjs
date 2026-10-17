import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const id='vw_t4_powertrain_update_2026-10-17_r8_live1';
const bundle='F:/param_cad/website_model_assets/'+id;
const snapshot=JSON.parse(await fs.readFile(path.join(bundle,'SNAPSHOT.json'),'utf8'));
assert.equal(snapshot.id,id);
assert.deepEqual(snapshot.dependencies,{three:'0.180.0','lucide-static':'0.468.0'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=new Map(snapshot.files.map(record=>[record.path,record]));
async function checked(source){
  const record=records.get(source);assert(record,source);
  assert(!source.split('/').includes('..'));
  const bytes=await fs.readFile(path.join(bundle,source));
  assert.equal(bytes.length,record.bytes,source);assert.equal(hash(bytes),record.sha256,source);
  return bytes;
}
for(const record of snapshot.files)await checked(record.path);
async function immutable(destination,bytes){
  const target=path.join(root,destination);await fs.mkdir(path.dirname(target),{recursive:true});
  try{assert.equal(hash(await fs.readFile(target)),hash(bytes),'Refusing to replace changed file: '+destination);}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(target,bytes,{flag:'wx'});}
}
async function copy(source,destination){
  const bytes=await checked(source);await immutable(destination,bytes);
  const record=records.get(source);return{source,path:destination,bytes:record.bytes,sha256:record.sha256};
}
const runtime=[];
for(const name of ['kinematics','cycle','flow','audio','audio_profiles','audio_issues','rpm_reference','drivetrain','pulley_marks','audio_transport','turbo_response'])
  runtime.push(await copy(`vw_t4_abl_engine/app/static/${name}.mjs`,`src/t4-engine/live1/${name}.mjs`));
for(const [name,destination]of [['three','assets/cad/coffee-filter/three/LICENSE'],['lucide-static','assets/cad/t4-engine/LUCIDE-LICENSE']])
  assert.equal(hash(await fs.readFile(path.join(root,destination))),hash(await checked(`dependency_notices/${name}/LICENSE`)),name+' licence differs');

for(const model of snapshot.models){
  const directory=model.revision===7?'assets/models/vw-t4-engine/r7':'assets/models/vw-t4-powertrain/r8';
  const prefix=`vw_t4_abl_engine/${model.directory}/`,files=[];
  for(const record of snapshot.files){
    if(!record.path.startsWith(prefix))continue;
    const relative=record.path.slice(prefix.length);
    if(relative.startsWith('powertrain/'))continue;
    assert(/^(parts\/[a-z0-9_-]+\.stl|[a-z_]+\.(json|csv|svg)|engine_assembly\.(glb|step)|engine_parts\.zip)$/.test(relative),relative);
    files.push(await copy(record.path,`${directory}/${relative}`));
  }
  const manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8'));
  assert.equal(manifest.model,model.model);assert.equal(manifest.model_revision,model.revision);
  assert.equal(manifest.parts.length,model.parts);assert.equal(manifest.rotation_convention.crank_sign,-1);
  const publication={snapshot:id,viewer_revision:'live1',model:model.model,model_revision:model.revision,part_count:model.parts,
    dependencies:snapshot.dependencies,original_design_copyright:'Santeri Hukari',geometry_license:'No redistribution licence selected',files:[...files,...runtime]};
  await immutable(`${directory}/publication.json`,Buffer.from(JSON.stringify(publication,null,2)+'\n'));
  console.log(`${directory}: ${model.parts} parts, ${files.length} native assets, ${runtime.length} runtime modules verified.`);
}
console.log(`Verified all ${snapshot.files.length} bundle records. r6 assets and runtime were not touched.`);
