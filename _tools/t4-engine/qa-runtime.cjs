const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const sources=['combustion','injection','valves','intake','exhaust','rotating','turbo'];
const bulkSources=sources.filter(source=>source!=='turbo');
const runtimeModules=['kinematics','cycle','flow','audio','audio_profiles','audio_issues','rpm_reference',
  'drivetrain','audio_transport','turbo_response','pulley_marks'];
const modelSets={
  default:{directory:'assets/models/vw-t4-engine/r7/',buildId:'reference-r7',revision:7,parts:271,glbBytes:9744448},
  powertrain:{directory:'assets/models/vw-t4-powertrain/r8/',buildId:'powertrain-r8',revision:8,parts:398,glbBytes:12313064},
};

// SITE_URL includes the Jekyll base prefix; ENGINE_URL can override the complete tool URL.
function resolveUrls(env=process.env){
  const siteUrl=new URL(env.SITE_URL||'http://127.0.0.1:4000/');
  if(!siteUrl.pathname.endsWith('/'))siteUrl.pathname+='/';
  const engineUrl=new URL(env.ENGINE_URL||'tools/t4-engine/',siteUrl);
  if(!engineUrl.pathname.endsWith('/'))engineUrl.pathname+='/';
  assert(['http:','https:'].includes(engineUrl.protocol),'ENGINE_URL must be an HTTP(S) URL');
  assert(engineUrl.pathname.endsWith('/tools/t4-engine/'),'ENGINE_URL must end in /tools/t4-engine/');
  const baseUrl=new URL('../../',engineUrl);
  const moduleUrls=Object.fromEntries(runtimeModules.map(name=>
    [name,new URL(`src/t4-engine/live1/${name}.mjs`,baseUrl).href]));
  return {engineUrl,baseUrl,moduleUrls};
}

function loadChromium(){
  const modulePath=process.argv[2]||process.env.PLAYWRIGHT_MODULE||
    path.resolve(path.dirname(process.execPath),'../node_modules/playwright');
  return require(modulePath).chromium;
}

function assertCameraStable(actual,expected){
  for(const key of ['camera','target']){
    assert.equal(actual[key].length,expected[key].length);
    for(let i=0;i<actual[key].length;i++)assert(Math.abs(actual[key][i]-expected[key][i])<1e-6,`${key} moved during runtime control edit`);
  }
}

function classifyRequestFailures(events,resources,activeAsset){
  const failures=[],completedTransferCancellations=[];
  for(const event of events){
    const matches=resources.filter(resource=>resource.name===event.url);
    const resource=matches[0];
    // Chromium 147 reports this completed Three.js stream as aborted after all frozen bytes arrive.
    if(event.url===activeAsset.url&&event.error==='net::ERR_ABORTED'&&event.resourceType==='fetch'&&matches.length===1&&
      events.filter(other=>other.url===event.url).length===1&&resource.responseStatus===200&&
      resource.encodedBodySize===activeAsset.bytes&&resource.decodedBodySize===activeAsset.bytes){
      completedTransferCancellations.push({...event,evidence:resource});
    }else failures.push(event);
  }
  return {failures,completedTransferCancellations};
}

function assertModelState(state,variant){
  const model=modelSets[variant];assert(model,`Unknown assembly: ${variant}`);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,model.directory,'manifest.json'),'utf8'));
  assert.equal(state.partCount,model.parts);assert.equal(state.buildId,model.buildId);
  assert.equal(state.snapshotRevision,model.revision);assert.equal(state.referencePoseExports,true);
  assert.equal(state.powertrain,variant==='powertrain');
  assert.equal(state.timingCover,false);assert.equal(state.pistonMatrices.length,4);
  assert.deepEqual([...state.partIds].sort(),manifest.parts.map(part=>part.id).sort(),'Every active GLB part must map exactly once');
  assert.equal(new Set(state.partIds).size,model.parts);
  for(const hook of ['cutaway','pulleyMarks','motionMatrices','cylinderStates','driveState','drivePhases','driveRates','driveReadout','driveMatrices']){
    assert(Object.hasOwn(state,hook),`Missing source inspection hook: ${hook}`);
  }
  return manifest;
}

async function canvasPixels(page){
  return page.evaluate(async()=>{
    // A view change or resize can clear WebGL before the next painted frame.
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    const source=document.querySelector('#t4Engine #viewport>canvas:not(#axis-indicator)'),copy=document.createElement('canvas');
    if(!source||!source.width||!source.height)return {color:0,checksum:0};
    copy.width=source.width;copy.height=source.height;const context=copy.getContext('2d');context.drawImage(source,0,0);
    const data=context.getImageData(0,0,copy.width,copy.height).data;let color=0,contrast=0,checksum=0;
    const background=[data[0],data[1],data[2]];
    for(let i=0;i<data.length;i+=16){
      if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>30)color++;
      if(Math.abs(data[i]-background[0])+Math.abs(data[i+1]-background[1])+Math.abs(data[i+2]-background[2])>90)contrast++;
      checksum=(checksum+data[i]*(i%101+1))%1000000007;
    }
    return {color,contrast,checksum};
  });
}

async function assertLayout(page){
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
  const overlaps=await page.locator('.audio-setting:not([hidden]), .audio-channel-head').evaluateAll(rows=>
    rows.filter(row=>{
      const [label,control]=row.children;
      if(!label||!control||!row.getClientRects().length)return false;
      const range=document.createRange();range.selectNodeContents(label);
      const b=control.getBoundingClientRect();
      return [...range.getClientRects()].some(a=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1);
    }).map(row=>row.id||row.textContent.trim()));
  assert.deepEqual(overlaps,[],'Sound labels overlap their controls');
}

// Dispatch the visibility handler deterministically: headless tab focus is not an OS visibility test.
async function setSimulatedHidden(page,hidden){
  await page.evaluate(hidden=>{
    if(hidden){
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
    }else{
      delete document.hidden;delete document.visibilityState;
    }
    document.dispatchEvent(new Event('visibilitychange'));
  },hidden);
}

async function runSuite(name,query,test,{initialize}={}){
  const {engineUrl,baseUrl,moduleUrls}=resolveUrls();
  for(const [key,value] of Object.entries(query))engineUrl.searchParams.set(key,String(value));
  const prefix=baseUrl.pathname.split('/').filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g,'_')||'root';
  const output=path.join(root,'output/t4-engine',prefix,name);
  fs.mkdirSync(output,{recursive:true});
  const errors=[],networkErrors=[],legacyRequests=[],requests=[];
  let browser,page;
  try{
    browser=await loadChromium().launch({headless:true,executablePath:process.argv[3]||
      process.env.CHROMIUM_PATH||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||
      'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--mute-audio']});
    page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('request',request=>{
      const url=new URL(request.url());
      requests.push({url:request.url(),method:request.method()});
      if(request.method()!=='GET'||url.port==='8770'||url.protocol==='file:'||/\/(?:api|model-files|download)(?:\/|$)/.test(url.pathname)||
        url.pathname.startsWith(baseUrl.pathname+'icons/')||url.pathname.startsWith('/icons/'))legacyRequests.push(request.url());
      if(/\/(?:src\/t4-engine|assets\/(?:models\/vw-t4-(?:engine|powertrain)|cad\/t4-engine))\//.test(url.pathname)&&
        (url.origin!==baseUrl.origin||!url.pathname.startsWith(baseUrl.pathname)))legacyRequests.push(request.url());
    });
    page.on('requestfailed',request=>networkErrors.push({url:request.url(),resourceType:request.resourceType(),error:request.failure()?.errorText}));
    page.on('response',response=>{if(response.status()>=400)networkErrors.push({url:response.url(),status:response.status()});});
    if(initialize)await initialize(page);
    const requestedVariant=url=>new URL(url).searchParams.get('assembly')==='powertrain'?'powertrain':'default';
    const waitForReady=async (variant,checkModules=true)=>{
      await page.locator('#t4Engine[data-state="ready"]').waitFor({timeout:60000});
      await page.waitForFunction(({parts,buildId})=>{
        const s=window.engineInspection?.snapshot();
        return s?.partCount===parts&&s.buildId===buildId&&s.pistonMatrices?.length===4&&document.querySelectorAll('#t4Engine .audio-source input').length===7;
      },{parts:modelSets[variant].parts,buildId:modelSets[variant].buildId},{timeout:60000});
      const reference=await page.evaluate(()=>window.engineInspection.snapshot());
      assertModelState(reference,variant);
      if(checkModules){
        const loaded=await page.evaluate(()=>performance.getEntriesByType('resource').map(resource=>resource.name));
        for(const url of Object.values(moduleUrls))assert(loaded.includes(url),`Runtime module was not imported: ${url}`);
        assert(!loaded.some(url=>/\/src\/t4-engine\/(?!live1\/)(?:kinematics|cycle|flow|audio(?:_profiles|_issues|_transport)?|rpm_reference|drivetrain|turbo_response|pulley_marks)\.mjs(?:\?|$)/.test(url)),
          'Live app imported historical root runtime modules');
      }
    };
    const response=await page.goto(engineUrl.href,{waitUntil:'domcontentloaded'});
    assert(response?.ok(),`Engine page failed: ${response?.status()} ${engineUrl.href}`);
    await waitForReady(requestedVariant(engineUrl.href));
    assert(!requests.some(request=>/\.(?:step|zip|stl)(?:\?|$)/.test(request.url)),'Heavy exports loaded before explicit download');
    let checkpoint=0,navigations=1;const completedTransferCancellations=[];
    const auditNetwork=async()=>{
      const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(resource=>({
        name:resource.name,responseStatus:resource.responseStatus,encodedBodySize:resource.encodedBodySize,
        decodedBodySize:resource.decodedBodySize,transferSize:resource.transferSize})));
      const state=await page.evaluate(()=>window.engineInspection.snapshot());
      const model=modelSets[state.powertrain?'powertrain':'default'];
      const classified=classifyRequestFailures(networkErrors.slice(checkpoint),resources,
        {url:new URL(model.directory+'engine_assembly.glb',baseUrl).href,bytes:model.glbBytes});
      assert.deepEqual(legacyRequests,[],'Legacy route or escaped nested-prefix request');
      assert.deepEqual(classified.failures,[],'Failed or incomplete browser requests');assert.deepEqual(errors,[],'Browser errors');
      completedTransferCancellations.push(...classified.completedTransferCancellations.map(event=>({...event,navigation:navigations})));
      checkpoint=networkErrors.length;
    };
    const reload=async()=>{
      await auditNetwork();navigations++;
      const response=await page.reload({waitUntil:'domcontentloaded'});assert(response?.ok(),'Engine reload failed');
      await waitForReady(requestedVariant(page.url()));
    };
    const snapshot=()=>page.evaluate(()=>window.engineInspection.snapshot());
    const input=(id,value,event='input')=>page.locator('#'+id).evaluate((element,{value,event})=>{
      element.value=value;element.dispatchEvent(new Event(event,{bubbles:true}));
    },{value:String(value),event});
    const setPlaying=async playing=>{if((await snapshot()).playing!==playing)await page.locator('#play').click();};
    const openSound=async()=>{if(!await page.locator('#sound-panel').evaluate(element=>element.open))await page.locator('#sound-panel summary').click();};
    const selectAssembly=async variant=>{
      await auditNetwork();
      await page.evaluate(()=>performance.clearResourceTimings());
      await page.locator('#assembly-variant').selectOption(variant);
      await waitForReady(variant,false);
      await page.locator('#assembly-variant').waitFor({state:'visible'});
      assert.equal(await page.locator('#assembly-variant').isEnabled(),true);
      const state=await snapshot();assert.equal(state.playing,false);assert.equal(state.audio.running,false);
      return state;
    };
    const navigateAssembly=async variant=>{
      await auditNetwork();navigations++;
      const url=new URL(engineUrl);if(variant==='powertrain')url.searchParams.set('assembly','powertrain');else url.searchParams.delete('assembly');
      const response=await page.goto(url.href,{waitUntil:'domcontentloaded'});assert(response?.ok(),'Engine navigation failed');
      await waitForReady(variant);return snapshot();
    };
    const assetUrl=(variant,file)=>new URL(modelSets[variant].directory+file,baseUrl).href;
    const manifest=variant=>JSON.parse(fs.readFileSync(path.join(root,modelSets[variant].directory,'manifest.json'),'utf8'));
    const report=await test({page,snapshot,input,setPlaying,openSound,reload,selectAssembly,navigateAssembly,assetUrl,manifest,
      moduleUrls,baseUrl:baseUrl.href,output,engineUrl:engineUrl.href});
    await auditNetwork();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({suite:name,executedAt:new Date().toISOString(),engineUrl:engineUrl.href,moduleUrls,
      headless:true,mutedChromium:true,navigations,...report,consoleErrors:errors,networkErrors:[],rawNetworkEvents:networkErrors,
      completedTransferCancellations,legacyRequests,noLocalApiCalls:true,
      physicalFitValidated:false,acousticRealismValidated:false},null,2)+'\n');
    for(const file of ['failure.json','failure.png'])fs.rmSync(path.join(output,file),{force:true});
    console.log(`${name} passed: ${engineUrl.href}\nReport: ${path.join(output,'report.json')}`);
  }catch(error){
    fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({engineUrl:engineUrl.href,error:error.stack||String(error),
      consoleErrors:errors,networkErrors,legacyRequests},null,2)+'\n');
    if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    throw error;
  }finally{
    if(browser)await browser.close();
  }
}

module.exports={resolveUrls,classifyRequestFailures,runSuite,assertModelState,assertCameraStable,assertLayout,canvasPixels,setSimulatedHidden,sources,bulkSources};

if(require.main===module){
  assert.equal(process.argv[2],'--self-test','Usage: node qa-runtime.cjs --self-test');
  for(const env of [{},{SITE_URL:'http://127.0.0.1:4000/nested-test/'},
    {ENGINE_URL:'http://127.0.0.1:4000/nested-test/tools/t4-engine/'},
    {SITE_URL:'http://127.0.0.1:4000/nested-test',ENGINE_URL:'tools/t4-engine/?mixer=1'},
    {ENGINE_URL:'/nested-test/tools/t4-engine/'},
    {ENGINE_URL:'http://127.0.0.1:4000/nested-test/tools/t4-engine/?assembly=powertrain&mixer=1&flow=1'}]){
    const resolved=resolveUrls(env),prefix=Object.keys(env).length?'/nested-test/':'/';
    assert.equal(resolved.engineUrl.pathname,prefix+'tools/t4-engine/');
    assert.equal(Object.keys(resolved.moduleUrls).length,11);
    for(const [name,url] of Object.entries(resolved.moduleUrls))assert.equal(new URL(url).pathname,prefix+`src/t4-engine/live1/${name}.mjs`);
    if(env.ENGINE_URL?.includes('assembly='))assert.equal(resolved.engineUrl.search,'?assembly=powertrain&mixer=1&flow=1');
  }
  assert.throws(()=>resolveUrls({ENGINE_URL:'file:///tools/t4-engine/'}));
  assert.throws(()=>resolveUrls({ENGINE_URL:'http://127.0.0.1:4000/wrong/'}));
  for(const model of Object.values(modelSets)){
  const url='http://127.0.0.1:4000/'+model.directory+'engine_assembly.glb',asset={url,bytes:model.glbBytes};
  const event={url,resourceType:'fetch',error:'net::ERR_ABORTED'};
  const resource={name:url,responseStatus:200,encodedBodySize:model.glbBytes,decodedBodySize:model.glbBytes};
  assert.equal(classifyRequestFailures([event],[resource],asset).completedTransferCancellations.length,1);
  for(const resources of [[],[{...resource,responseStatus:404}],[{...resource,responseStatus:206}],
    [{...resource,decodedBodySize:model.glbBytes-1}],[{...resource,encodedBodySize:model.glbBytes-1}],
    [{...resource,encodedBodySize:0}],[resource,resource]])assert.equal(classifyRequestFailures([event],resources,asset).failures.length,1);
  for(const failure of [{...event,error:'net::ERR_FAILED'},{...event,resourceType:'document'},{...event,url:url+'?other=1'}]){
    assert.equal(classifyRequestFailures([failure],[resource],asset).failures.length,1);
  }
  assert.equal(classifyRequestFailures([event],[resource],{...asset,url:url+'?inactive=1'}).failures.length,1);
  assert.equal(classifyRequestFailures([event,event],[resource],asset).failures.length,2);
  }
  const pose={camera:[1,2,3],target:[4,5,6]};assertCameraStable(pose,pose);
  assert.throws(()=>assertCameraStable({...pose,camera:[1,2,3.01]},pose));
  console.log('QA helper checks passed: default/nested URLs, module prefixes, exact completed-GLB exception and camera movement detection.');
}
