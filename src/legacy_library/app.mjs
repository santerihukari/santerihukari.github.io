import {getModel, defaults} from '../parametric-catalogue.mjs';
import {validate, readLink, modelLink} from './parameters.mjs';
import {createForm} from './form.mjs';
import {createViewer, save} from '../cad-viewer.mjs';
import {registerViewer} from '../cad-ui.mjs';
import {createWorkerClient, cancelled} from './worker-client.mjs';

const root = document.getElementById('legacyWorkbench');
if (root) main().catch(error => {
  root.dataset.state = 'error';
  const banner = document.getElementById('legacyError'); banner.hidden=false; banner.textContent=error.message;
});

async function main() {
  const key=root.dataset.model, definition=getModel(key), model=await definition.load(), meta=model.meta;
  const $=id=>root.querySelector(`#${id}`), status=$('legacyStatus'), error=$('legacyError');
  $('legacyTitle').textContent=definition.title;
  $('legacyDescription').textContent=definition.purpose;
  $('legacyValidation').textContent=definition.validation;
  const viewer=createViewer($('legacyCanvas'),undefined,{projection:'orthographic'}); registerViewer(root,viewer);
  function height(){
    const viewport=window.visualViewport;
    const available=(viewport?.height||innerHeight)+(viewport?.offsetTop||0)-root.getBoundingClientRect().top-8;
    const value=`${Math.max(180,Math.floor(available))}px`;
    if(root.style.getPropertyValue('--coffee-height')!==value)root.style.setProperty('--coffee-height',value);
  }
  height();window.addEventListener('resize',height,{passive:true});
  window.visualViewport?.addEventListener('resize',height,{passive:true});
  window.visualViewport?.addEventListener('scroll',height,{passive:true});
  document.addEventListener('fullscreenchange',height);
  const layoutObserver=new ResizeObserver(height);
  for(const node of [root,document.querySelector('.site-header, .standard-site-header'),document.querySelector('.cad-model-picker')])if(node)layoutObserver.observe(node);
  let values=readLink(meta,new URL(location.href)), form, revision=0, builtRevision=-1, metrics=null, timings=null, timer, frameNext=true, job=null;
  const manual=definition.manualUpdate;
  $('legacyBuild').hidden=!manual;
  const client=createWorkerClient(()=>new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'}),{
    timeoutMs:definition.buildTimeoutMs,
    onProgress(message){if(job&&message.revision===revision&&job.revision===revision){job.stage=message.stage;paintProgress(job);}}
  });
  const request=(type,params,rev)=>client.request({type,key,params,revision:rev});
  function gate(){
    const ready=root.dataset.state==='ready'&&builtRevision===revision,valid=validate(meta,values).valid;
    for(const name of ['legacyStl','legacyGlb'])$(name).disabled=!ready;
    $('legacyCopy').disabled=!valid;
    $('legacyBuild').disabled=!valid||job?.revision===revision||(ready&&builtRevision===revision);
    root.dataset.revision=revision;root.dataset.builtRevision=builtRevision;
  }
  function state(name,message,problem=''){root.dataset.state=name;status.textContent=message;error.hidden=!problem;error.textContent=problem;gate();}
  function mount(){form?.destroy();form=createForm($('legacyParameters'),definition,meta,values,changed);}
  function checked(){const result=validate(meta,values);form.errors(result.errors);return result;}
  function paintProgress(current){
    if(job!==current||current.revision!==revision)return;
    const labels={loading:'Loading CAD engine',geometry:'Building geometry',preview:'Preparing preview',texture:'Applying printable texture'},elapsed=Math.floor((performance.now()-current.started)/1000);
    state('building',(labels[current.stage]||'Building model')+(elapsed>=2?` (${elapsed}s)`:''));
  }
  function interrupt(){
    clearTimeout(timer);
    if(job){clearInterval(job.clock);job=null;}
    if(client.active)client.cancel();
  }
  function changed(){
    revision++;interrupt();const result=checked();
    if(!result.valid){state('invalid','Invalid parameters',Object.values(result.errors)[0]);return;}
    state(manual?'pending':'building',manual?'Changes pending - select Update':'Waiting to build');
    if(!manual)timer=setTimeout(build,500);
  }
  async function build(){
    clearTimeout(timer);if(job?.revision===revision)return;
    const result=checked();if(!result.valid){state('invalid','Invalid parameters',Object.values(result.errors)[0]);return;}
    interrupt();
    const requested=revision,current={revision:requested,stage:'loading',started:performance.now()};job=current;
    paintProgress(current);current.clock=setInterval(()=>paintProgress(current),1000);
    try{
      const data=await request('build',result.params,requested);
      if(requested!==revision||job!==current)return;
      viewer.setParts([{name:key,label:definition.title,color:'#168b85',mesh:data.mesh}]);
      if(frameNext){viewer.fit();frameNext=false;}
      metrics=data.metrics;timings=data.timings;builtRevision=requested;
      const warnings=$('legacyWarnings'); warnings.hidden=!data.warnings?.length;
      $('legacyWarningText').textContent=(data.warnings||[]).join('\n');
      $('legacyDimensions').textContent=data.metrics.max.map((v,i)=>(v-data.metrics.min[i]).toFixed(1)).join(' x ')+' mm';
      state('ready',data.warnings?.length?'Ready with warnings':'Ready');history.replaceState(null,'',modelLink(key,meta,result.params,location.href));
    }catch(problem){if(requested===revision&&!cancelled(problem))state('error','Build failed',`Model build failed: ${problem.message}`);}
    finally{clearInterval(current.clock);if(job===current){job=null;gate();}}
  }
  $('legacyReset').addEventListener('click',()=>{revision++;interrupt();values=defaults(meta);frameNext=true;mount();build();});
  $('legacyBuild').addEventListener('click',build);
  $('legacyFit').addEventListener('click',()=>viewer.fit());
  for(const button of root.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{viewer.fit(button.dataset.view);for(const b of root.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));});
  $('legacyCopy').addEventListener('click',async()=>{
    if($('legacyCopy').disabled)return;
    const url=modelLink(key,meta,values,location.href);
    try{await navigator.clipboard.writeText(url);$('legacyCopyStatus').textContent='Model link copied';}
    catch{$('legacyLinkValue').value=url;$('legacyLinkDialog').showModal();$('legacyLinkValue').select();}
  });
  async function download(format){
    if(builtRevision!==revision||root.dataset.state!=='ready')return;
    const exporting=revision, params=checked();if(!params.valid)return;
    state('building','Exporting');
    try{
      const bytes=format==='stl'?(await request('stl',params.params,exporting)).bytes:await viewer.glb({model:key,parameters:params.params,validation:definition.validation});
      if(revision!==exporting)return;
      let suffix=params.params.surface_texture&&params.params.surface_texture!=='none'?'--'+params.params.surface_texture:'';
      if(params.params.surface_texture?.startsWith('layer-'))suffix+=`--${Number(params.params.texture_layer_height).toFixed(2)}mm-layers`;
      save(bytes,`${definition.slug}${suffix}.${format}`,format==='stl'?'model/stl':'model/gltf-binary');state('ready','Ready');
    }catch(problem){if(revision===exporting&&!cancelled(problem))state('error','Export failed',problem.message);}
  }
  $('legacyStl').addEventListener('click',()=>download('stl'));$('legacyGlb').addEventListener('click',()=>download('glb'));
  root.legacyController={viewer,meta,definition,key,get params(){return {...values};},get metrics(){return metrics;},get timings(){return timings;},get revision(){return revision;},build,download};
  window.addEventListener('pagehide',event=>{if(!event.persisted){interrupt();client.cancel();}});
  mount();gate();await build();
}
