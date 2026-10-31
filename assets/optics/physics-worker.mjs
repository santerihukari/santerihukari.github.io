import {loadPyodide} from './runtime/314.0.7/pyodide.mjs';

const root=new URL('./',import.meta.url),version=new URL(import.meta.url).searchParams.get('v');
const asset=path=>{const url=new URL(path,root);if(version)url.searchParams.set('v',version);return url;};
const progress=message=>self.postMessage({type:'progress',message});
let queued=null,running=false;

async function textFile(path){const r=await fetch(asset(path));if(!r.ok)throw Error(`Could not load ${path} (${r.status})`);return r.text();}
const ready=(async()=>{
  progress('Loading browser Python runtime...');
  const py=await loadPyodide({indexURL:new URL('runtime/314.0.7/',root).href});
  progress('Loading NumPy and SciPy...');
  await py.loadPackage(['numpy','scipy'],{messageCallback:message=>progress(message)});
  progress('Loading optical models...');
  const manifest=JSON.parse(await textFile('physics-manifest.json'));
  const response=await fetch(asset('physics.zip'));if(!response.ok)throw Error('Could not load optical model bundle');
  const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==manifest.bundle.sha256)throw Error('Optical model checksum mismatch. Reload the page to update cached files.');
  py.unpackArchive(bytes,'zip',{extractDir:'/optics'});
  py.runPython(await textFile('browser-bootstrap.py'));
  progress('Calculating optics...');return py;
})();
// Keep initialization failures handled even before a calculation is queued.
ready.catch(()=>{});

async function pump(){
  if(running)return;running=true;
  try{
    const py=await ready;
    while(queued){
      const job=queued;queued=null;
      try{
        py.globals.set('input_json',JSON.stringify(job.settings));
        const result=JSON.parse(py.runPython('json.dumps(calculate(json.loads(input_json)), allow_nan=False)'));
        self.postMessage({type:'result',id:job.id,result});
      }catch(error){self.postMessage({type:'error',id:job.id,message:error.message});}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }catch(error){if(queued){self.postMessage({type:'error',id:queued.id,message:error.message});queued=null;}}
  finally{running=false;}
}

self.onmessage=event=>{
  const job=event.data;
  if(job?.type!=='simulate'||!Number.isSafeInteger(job.id))return;
  if(queued)self.postMessage({type:'superseded',id:queued.id});
  queued=job;pump();
};
