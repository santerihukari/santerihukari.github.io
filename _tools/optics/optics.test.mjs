import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../assets/cad/coffee-filter/three/examples/jsm/libs/fflate.module.js';

const root=new URL('../../',import.meta.url),asset=new URL('assets/optics/',root);
const json=async url=>JSON.parse(await readFile(url,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('self-hosted numerical runtime matches its pinned hashes and package lock',async()=>{
 const manifest=await json(new URL('runtime-manifest.json',asset));assert.equal(manifest.version,'314.0.7');let total=0;
 const runtime=new URL(`runtime/${manifest.version}/`,asset),lock=await json(new URL('pyodide-lock.json',runtime));
 assert.deepEqual(Object.keys(lock.packages).sort(),['numpy','scipy']);
 for(const [name,record]of Object.entries(manifest.files)){
  const bytes=await readFile(new URL(name,runtime));assert.equal(bytes.length,record.bytes,name);assert.equal(hash(bytes),record.sha256,name);assert(bytes.length<100000000);total+=bytes.length;
 }
 for(const [name,entry]of Object.entries(lock.packages)){assert.equal(entry.version,manifest.packages[name]);assert.equal(entry.sha256,manifest.files[entry.file_name].sha256);}
 assert(total<40000000,'Review runtime size growth');
});

test('physics archive contains only the approved numerical closure and notices',async()=>{
 const manifest=await json(new URL('physics-manifest.json',asset)),bytes=await readFile(new URL('physics.zip',asset));
 assert.equal(hash(bytes),manifest.bundle.sha256);const files=unzipSync(bytes);
 assert.deepEqual(Object.keys(files).sort(),Object.keys(manifest.files).sort());
 for(const [name,data]of Object.entries(files)){
  assert(!name.includes('..')&&!name.includes('\\'));assert(/^(optics\.py|deps\/(raytracing|rayoptics|anytree|transforms3d)\/.*\.py|licenses\/[^/]+\.txt)$/.test(name),name);
  assert.equal(hash(data),manifest.files[name].sha256,name);
 }
 for(const name of ['RayTracing-MIT.txt','RayOptics-BSD-3-Clause.txt','AnyTree-Apache-2.0.txt','Transforms3d-BSD.txt','Transforms3d-AUTHORS.txt','CPython.txt','NOTICE.txt'])
  assert((await stat(new URL('licenses/'+name,asset))).size>0,name);
});

test('public app uses a bounded browser worker, not the retained local server',async()=>{
 const app=await readFile(new URL('app.js',asset),'utf8'),worker=await readFile(new URL('physics-worker.mjs',asset),'utf8');
 assert(!app.includes('/api/'));assert(!/127\.0\.0\.1|localhost/.test(app));
 assert(app.includes('engine.calculate(settings,controller.signal)'));assert(worker.includes("job?.type!=='simulate'"));
 assert(worker.includes("json.loads(input_json)"));assert(worker.includes("crypto.subtle.digest('SHA-256'"));
});

test('built Jekyll site exposes the demo and its Portfolio record without private files',async()=>{
 const site=new URL('_site/',root),page=await readFile(new URL('tools/optics/index.html',site),'utf8'),portfolio=await readFile(new URL('projects/index.html',site),'utf8');
 assert(page.includes('/assets/optics/app.js'));assert(page.includes('EXPERIMENTAL'));assert(!page.includes('PRIVATE PROTOTYPE'));assert(portfolio.includes('Optics Lab'));
 for(const name of ['physics.zip','physics-manifest.json','defaults.json','browser-bootstrap.py','physics-worker.mjs','runtime/314.0.7/pyodide.asm.wasm']){
  assert.equal(hash(await readFile(new URL('assets/optics/'+name,site))),hash(await readFile(new URL(name,asset))),name);
 }
 for(const name of ['output/optics-lab/server.py','_tools/optics/fixtures.py','output/optics-site/fixtures.json'])await assert.rejects(stat(new URL(name,site)),{code:'ENOENT'});
 assert((await stat(new URL('assets/images/project-previews/optics-lab.png',site))).size>10000);
});

test('public optics asset folder does not grow into an environment or data dump',async()=>{
 let total=0;
 async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())await walk(url);else{assert(!/\.(cr3|jpg|jpeg|mp4|wav|gcode|step|ply|pt|pyc)$/i.test(entry.name),entry.name);total+=(await stat(url)).size;}}}
 await walk(asset);assert(total<40000000,'Review public optics payload growth');
});
