import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const id='vw_t4_update_2026-10-20',release='release-2026-10-20';
const bundle=process.env.T4_SNAPSHOT||'F:/param_cad/website_model_assets/'+id;
const snapshot=JSON.parse(await fs.readFile(path.join(bundle,'SNAPSHOT.json'),'utf8'));
assert.equal(snapshot.id,id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=new Map();
let total=0;
for(const record of snapshot.files){
  assert(!records.has(record.path),'Duplicate snapshot record');
  const target=path.resolve(bundle,record.path);
  assert(target.startsWith(path.resolve(bundle)+path.sep),'Snapshot path escapes bundle');
  const bytes=await fs.readFile(target);
  assert.equal(bytes.length,record.bytes,record.path);assert.equal(hash(bytes),record.sha256,record.path);
  records.set(record.path,record);total+=bytes.length;
}
assert.equal(total,snapshot.bytes);
console.log(`Verified ${records.size} frozen files / ${total} bytes before import.`);

async function immutable(destination,bytes){
  const target=path.join(root,destination);
  await fs.mkdir(path.dirname(target),{recursive:true});
  try{assert.equal(hash(await fs.readFile(target)),hash(bytes),'Refusing to replace changed file: '+destination);}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(target,bytes,{flag:'wx'});}
}
async function copy(source,destination,transform){
  const record=records.get(source);assert(record,source);
  let bytes=await fs.readFile(path.join(bundle,source));
  assert.equal(hash(bytes),record.sha256,source);
  if(transform)bytes=await transform(bytes);
  await immutable(destination,bytes);
  return {source,path:destination,bytes:bytes.length,sha256:hash(bytes),
    ...(transform?{source_bytes:record.bytes,source_sha256:record.sha256,
      publication_transform:'Remove local archive path and loopback preview URL from component provenance; geometry and other ZIP entry bytes unchanged.'}:{})};
}
const runtime=[];
for(const name of ['kinematics','cycle','flow','audio','audio_profiles','audio_issues','rpm_reference',
  'drivetrain','pulley_marks','audio_transport','turbo_response','inspection','service'])
  runtime.push(await copy(`vw_t4_abl_engine/app/static/${name}.mjs`,`src/t4-engine/${release}/${name}.mjs`));

const models=[
  ['', 'vw-t4-engine/r9','vw_t4_abl_engine_v0',9,271],
  ['powertrain/','vw-t4-powertrain/r13','vw_t4_abl_powertrain_v1',13,400],
  ['vehicle/','vw-t4-vehicle/r13','vw_t4_swb_mechanics_context_v1',13,435]
];
for(const [folder,directory,model,revision,count]of models){
  const prefix='vw_t4_abl_engine/generated/'+folder,destination='assets/models/'+directory;
  const files=[];
  const candidates=snapshot.files.filter(record=>record.path.startsWith(prefix)&&
    /^(?:parts\/[a-z0-9_-]+\.stl|[a-z_]+\.(?:json|csv|svg|md)|engine_assembly\.(?:glb|step)|engine_parts\.zip)$/.test(record.path.slice(prefix.length)));
  const references=prefix+'component_references.json',publicReferences=destination+'/component_references.json';
  files.push(await copy(references,publicReferences,bytes=>{
    const ledger=JSON.parse(bytes);
    for(const asset of ledger.assets){delete asset.user_supplied_archive;delete asset.local_reference_preview;}
    return Buffer.from(JSON.stringify(ledger,null,2)+'\n');
  }));
  for(const record of candidates){
    if(record.path===references)continue;
    const relative=record.path.slice(prefix.length);
    files.push(await copy(record.path,destination+'/'+relative,relative==='engine_parts.zip'?()=>
      execFileSync(process.env.PYTHON||'python',['-B',fileURLToPath(new URL('./public-zip.py',import.meta.url)),
        path.join(bundle,record.path),path.join(root,publicReferences)],{maxBuffer:128*1024*1024}):null));
  }
  const manifest=JSON.parse(await fs.readFile(path.join(root,destination,'manifest.json'),'utf8'));
  assert.equal(manifest.model,model);assert.equal(manifest.model_revision,revision);
  assert.equal(manifest.parts.length,count);assert.equal(manifest.part_count,count);
  assert.equal(manifest.rotation_convention.crank_sign,-1);
  assert.equal(files.filter(record=>record.path.includes('/parts/')).length,count);
  const publication={snapshot:id,viewer_revision:release,model,model_revision:revision,part_count:count,
    dependencies:{three:'0.180.0','lucide-static':'0.468.0'},original_design_copyright:'Santeri Hukari',
    geometry_license:'No redistribution licence selected',files:[...files,...runtime]};
  await immutable(destination+'/publication.json',Buffer.from(JSON.stringify(publication,null,2)+'\n'));
  await immutable(destination+'/NOTICE.txt',Buffer.from(`Copyright Santeri Hukari.\n\nOriginal estimated T4 reference geometry, ${id}. No new redistribution licence is granted.\nThis is not OEM CAD, verified fitment, a repair procedure or a diagnostic/acoustic model.\nCandidate manufacturer/retailer references do not identify the fitted vehicle or fasteners.\nNo verified tightening procedures; unknown specifications remain unpublished.\nCapture plans are not captured scans.\nNo external research-only Bosch VE model, reference photographs or manuals are included.\nPublic provenance and ZIP metadata omit local archive paths and loopback preview URLs;\npublication.json records source and public hashes for these two derived files.\nAll geometry and every other ZIP entry remain byte-identical to the frozen snapshot.\nThree.js 0.180.0 is MIT; Lucide Static 0.468.0 is ISC. Dependency licences are\nretained in assets/cad/coffee-filter/three/LICENSE and assets/cad/t4-engine/LUCIDE-LICENSE.\n`));
  console.log(`${destination}: ${count} exact parts, ${files.length} assets, ${runtime.length} frozen modules.`);
}
console.log('Historical r6/r7/r8 releases and runtimes were not touched. No authoring server or restricted reference model imported.');
