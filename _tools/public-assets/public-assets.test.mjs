import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolvePublicAsset} from '../../src/public-assets.mjs';
const require=createRequire(import.meta.url),{allowed}=require('./manage.cjs');
const root=new URL('../../',import.meta.url),json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));

test('public URLs resolve at root and nested paths without redirecting unrelated resources',()=>{
  const manifest={origin:'https://assets.example.com',files:{'assets/models/example.glb':{key:'v1/hash/example.glb'}}};
  for(const prefix of ['','/nested-test']){
    const site='https://example.com'+prefix+'/';
    assert.equal(resolvePublicAsset(prefix+'/assets/models/example.glb?x=1#part',manifest,site),'https://assets.example.com/v1/hash/example.glb?x=1#part');
    for(const input of ['https://other.example/assets/models/example.glb',prefix+'/assets/models/unknown.glb',prefix+'/src/model.mjs'])
      assert.equal(resolvePublicAsset(input,manifest,site),new URL(input,site).href);
  }
});

test('upload allowlist excludes originals, private material and T4 CAD/history',()=>{
  for(const path of ['assets/originals/photo.jpg','Photos/event/photo.jpg','assets/photos/full/photo.jpg',
    'assets/models/vw-t4-engine/r9/engine_assembly.step','assets/models/vw-t4-engine/r9/engine_parts.zip',
    'assets/models/vw-t4-engine/r9/parts/crankshaft.stl','assets/models/vw-t4-engine/r7/engine_assembly.glb',
    'assets/cad/private/secret.glb','assets/cad/air-damper/password.txt'])assert.equal(allowed(path,10000000),false,path);
  assert(allowed('assets/models/vw-t4-engine/r9/engine_assembly.glb',10000000));
  assert(allowed('assets/models/photogrammetry/srk-boulder/srk_photo_textured.glb',10000000));
});

test('Git does not track migrated payloads or retired T4 asset sets',async()=>{
  const manifest=await json('_data/public_assets.json');
  const paths=[...Object.keys(manifest.files),'assets/models/vw-t4-engine/r6','assets/models/vw-t4-engine/r7','assets/models/vw-t4-powertrain/r8'];
  assert.equal(execFileSync('git',['ls-files','--',...paths],{cwd:fileURLToPath(root),encoding:'utf8'}).trim(),'');
});

async function walk(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())files.push(...await walk(url));else files.push(url);
  }
  return files;
}
test('built site publishes no migrated duplicates or unnecessary T4 geometry',async()=>{
  const manifest=await json('_data/public_assets.json'),site=new URL('_site/',root);
  for(const [file,entry]of Object.entries(manifest.files))assert(allowed(file,entry.bytes),'Unapproved remote asset: '+file);
  for(const path of ['vw-t4-engine/r9','vw-t4-powertrain/r13','vw-t4-vehicle/r13'])
    assert(manifest.files[`assets/models/${path}/engine_assembly.glb`],'Missing active T4 viewer model');
  const library=await readFile(new URL('projects/photogrammetry/index.html',site),'utf8');
  const embedded=JSON.parse(library.match(/<script id="model-library-manifest" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for(const entry of embedded.projects.flatMap(project=>project.entries))assert(manifest.files[entry.model.url.replace(/^\//,'')],'Missing boulder model: '+entry.title);
  for(const file of Object.keys(manifest.files))await assert.rejects(stat(new URL(file,site)),{code:'ENOENT'},file);
  for(const path of ['assets/models/vw-t4-engine/r6','assets/models/vw-t4-engine/r7','assets/models/vw-t4-powertrain/r8'])
    await assert.rejects(stat(new URL(path,site)),{code:'ENOENT'},path);
  const files=await walk(new URL('assets/models/',site));
  assert(!files.some(file=>/\/vw-t4-[^/]+\/.*\.(stl|step|zip|glb)$/.test(file.pathname)),'T4 must use only the migrated viewer GLBs');
  for(const path of ['vw-t4-engine/r9','vw-t4-powertrain/r13','vw-t4-vehicle/r13'])
    for(const file of ['manifest.json','params.json','service_catalogue.json','component_references.json','NOTICE.txt'])
      assert((await stat(new URL(`assets/models/${path}/${file}`,site))).size>0);
  const page=await readFile(new URL('tools/t4-engine/index.html',site),'utf8');
  assert(!/id="download-(glb|step|zip|part)"/.test(page));
  assert(page.includes('public-asset-manifest'));
  const stl=await readFile(new URL('stl/index.html',site),'utf8');
  for(const [file,entry]of Object.entries(manifest.files).filter(([file])=>file.startsWith('assets/stl/')))
    assert(stl.includes(manifest.origin+'/'+entry.key),file);
  let size=0;for(const file of await walk(site))size+=(await stat(file)).size;
  assert(size<1000000000,`Site exceeds the conservative 1 GB budget: ${size}`);
  console.log(`Built site: ${size} bytes; ${Object.keys(manifest.files).length} assets external.`);
});
