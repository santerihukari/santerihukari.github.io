import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const snapshotRoot='F:/param_cad/website_model_assets/vw_t4_engine_reference_2026-10-17_r6';
const snapshot=JSON.parse(await fs.readFile(path.join(snapshotRoot,'SNAPSHOT.json'),'utf8'));
assert.equal(snapshot.id,'vw_t4_engine_reference_2026-10-17_r6');
assert.equal(snapshot.model_revision,6);assert.equal(snapshot.part_count,271);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inventory=[];
async function copy(relative,destination){
  const record=snapshot.files.find(file=>file.path===relative);assert(record,relative);
  const bytes=await fs.readFile(path.join(snapshotRoot,relative));
  assert.equal(bytes.length,record.bytes);assert.equal(hash(bytes),record.sha256);
  const output=path.join(root,destination);await fs.mkdir(path.dirname(output),{recursive:true});
  try{const existing=await fs.readFile(output);assert.equal(hash(existing),record.sha256,`Refusing to replace changed file: ${destination}`);}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(output,bytes,{flag:'wx'});}
  inventory.push({source:relative,path:destination,bytes:record.bytes,sha256:record.sha256});
}
for(const file of snapshot.files.filter(file=>file.path.startsWith('vw_t4_abl_engine/generated/'))){
  const relative=file.path.slice('vw_t4_abl_engine/generated/'.length);
  assert(!relative.includes('..'));
  await copy(file.path,'assets/models/vw-t4-engine/r6/'+relative);
}
for(const name of ['kinematics','cycle','flow','audio','audio_profiles','audio_issues'])
  await copy(`vw_t4_abl_engine/app/static/${name}.mjs`,`src/t4-engine/${name}.mjs`);
const patchId='vw_t4_engine_controls_2026-10-17',patchRoot=path.join(path.dirname(snapshotRoot),patchId);
for(const name of ['kinematics','cycle','flow','audio','audio_profiles','audio_issues']){
  const baseline=await fs.readFile(path.join(root,`src/t4-engine/${name}.mjs`));
  assert.equal(hash(await fs.readFile(path.join(patchRoot,`vw_t4_abl_engine/app/static/${name}.mjs`))),hash(baseline),name+' controls patch changed a frozen runtime');
}
const rpmSource='vw_t4_abl_engine/app/static/rpm_reference.mjs',rpmPath='src/t4-engine/rpm_reference.mjs';
const rpm=await fs.readFile(path.join(patchRoot,rpmSource));
try{assert.equal(hash(await fs.readFile(path.join(root,rpmPath))),hash(rpm),'Refusing to replace changed RPM module');}
catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(path.join(root,rpmPath),rpm,{flag:'wx'});}
inventory.push({source:rpmSource,patch:patchId,path:rpmPath,bytes:rpm.length,sha256:hash(rpm)});
const vendor='text_keychain/app/node_modules/';
for(const name of ['build/three.module.js','build/three.core.js','examples/jsm/controls/OrbitControls.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js','LICENSE']){
  const record=snapshot.files.find(file=>file.path===vendor+'three/'+name);assert(record,name);
  assert.equal(hash(await fs.readFile(path.join(root,'assets/cad/coffee-filter/three',name))),record.sha256,`Existing Three.js differs: ${name}`);
}
for(const file of snapshot.files.filter(file=>file.path.startsWith(vendor+'lucide-static/icons/')&&!file.path.endsWith('/download.svg')))
  await copy(file.path,'assets/cad/t4-engine/icons/'+path.basename(file.path));
await copy(vendor+'lucide-static/LICENSE','assets/cad/t4-engine/LUCIDE-LICENSE');
const publication={snapshot:snapshot.id,controls_patch:patchId,model_revision:6,part_count:271,dependencies:snapshot.dependencies,
  original_design_copyright:'Santeri Hukari',geometry_license:'No redistribution licence selected',files:inventory};
await fs.writeFile(path.join(root,'assets/models/vw-t4-engine/r6/publication.json'),JSON.stringify(publication,null,2)+'\n');
console.log(`Verified and imported ${inventory.length} frozen assets; original snapshot unchanged.`);
