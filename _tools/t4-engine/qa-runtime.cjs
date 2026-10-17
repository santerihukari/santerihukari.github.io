const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const sources=['combustion','injection','valves','intake','exhaust','rotating','turbo'];
const bulkSources=sources.filter(source=>source!=='turbo');

// SITE_URL includes the Jekyll base prefix; ENGINE_URL can override the complete tool URL.
function resolveUrls(env=process.env){
  const siteUrl=new URL(env.SITE_URL||'http://127.0.0.1:4000/');
  if(!siteUrl.pathname.endsWith('/'))siteUrl.pathname+='/';
  const engineUrl=new URL(env.ENGINE_URL||'tools/t4-engine/',siteUrl);
  if(!engineUrl.pathname.endsWith('/'))engineUrl.pathname+='/';
  assert(['http:','https:'].includes(engineUrl.protocol),'ENGINE_URL must be an HTTP(S) URL');
  assert(engineUrl.pathname.endsWith('/tools/t4-engine/'),'ENGINE_URL must end in /tools/t4-engine/');
  const baseUrl=new URL('../../',engineUrl);
  const moduleUrls=Object.fromEntries(['kinematics','cycle','flow','audio','audio_profiles','audio_issues','rpm_reference'].map(name=>
    [name,new URL(`src/t4-engine/${name}.mjs`,baseUrl).href]));
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

function classifyRequestFailures(events,resources,glbUrl){
  const failures=[],completedTransferCancellations=[];
  for(const event of events){
    const matches=resources.filter(resource=>resource.name===event.url);
    const resource=matches[0];
    // Chromium 147 reports this completed Three.js stream as aborted after all frozen bytes arrive.
    if(event.url===glbUrl&&event.error==='net::ERR_ABORTED'&&event.resourceType==='fetch'&&matches.length===1&&
      events.filter(other=>other.url===event.url).length===1&&resource.responseStatus===200&&
      resource.encodedBodySize===9744448&&resource.decodedBodySize===9744448){
      completedTransferCancellations.push({...event,evidence:resource});
    }else failures.push(event);
  }
  return {failures,completedTransferCancellations};
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

async function runSuite(name,query,test){
  const {engineUrl,baseUrl,moduleUrls}=resolveUrls();
  for(const [key,value] of Object.entries(query))engineUrl.searchParams.set(key,String(value));
  const prefix=baseUrl.pathname.split('/').filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g,'_')||'root';
  const output=path.join(root,'output/t4-engine',prefix,name);
  fs.mkdirSync(output,{recursive:true});
  const errors=[],networkErrors=[],legacyRequests=[];
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
      if(url.port==='8770'||url.protocol==='file:'||/\/(?:api|model-files|download\/default)(?:\/|$)/.test(url.pathname))legacyRequests.push(request.url());
      if(/\/(?:src\/t4-engine|assets\/(?:models\/vw-t4-engine|cad\/t4-engine))\//.test(url.pathname)&&
        (url.origin!==baseUrl.origin||!url.pathname.startsWith(baseUrl.pathname)))legacyRequests.push(request.url());
    });
    page.on('requestfailed',request=>networkErrors.push({url:request.url(),resourceType:request.resourceType(),error:request.failure()?.errorText}));
    page.on('response',response=>{if(response.status()>=400)networkErrors.push({url:response.url(),status:response.status()});});
    const waitForReady=async response=>{
      assert(response?.ok(),`Engine page failed: ${response?.status()} ${engineUrl.href}`);
      await page.locator('#t4Engine[data-state="ready"]').waitFor({timeout:60000});
      await page.waitForFunction(()=>{
        const s=window.engineInspection?.snapshot();
        return s?.partCount===271&&s.pistonMatrices?.length===4&&document.querySelectorAll('.audio-source input').length===7;
      },null,{timeout:60000});
      const reference=await page.evaluate(()=>window.engineInspection.snapshot());
      assert.equal(reference.buildId,'reference-r6');assert.equal(reference.snapshotRevision,6);
    };
    await waitForReady(await page.goto(engineUrl.href,{waitUntil:'domcontentloaded'}));
    let checkpoint=0,navigations=1;const completedTransferCancellations=[];
    const auditNetwork=async()=>{
      const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(resource=>({
        name:resource.name,responseStatus:resource.responseStatus,encodedBodySize:resource.encodedBodySize,
        decodedBodySize:resource.decodedBodySize,transferSize:resource.transferSize})));
      const classified=classifyRequestFailures(networkErrors.slice(checkpoint),resources,
        new URL('assets/models/vw-t4-engine/r6/engine_assembly.glb',baseUrl).href);
      assert.deepEqual(legacyRequests,[],'Legacy route or escaped nested-prefix request');
      assert.deepEqual(classified.failures,[],'Failed or incomplete browser requests');assert.deepEqual(errors,[],'Browser errors');
      completedTransferCancellations.push(...classified.completedTransferCancellations.map(event=>({...event,navigation:navigations})));
      checkpoint=networkErrors.length;
    };
    const reload=async()=>{
      await auditNetwork();navigations++;
      await waitForReady(await page.reload({waitUntil:'domcontentloaded'}));
    };
    const snapshot=()=>page.evaluate(()=>window.engineInspection.snapshot());
    const input=(id,value,event='input')=>page.locator('#'+id).evaluate((element,{value,event})=>{
      element.value=value;element.dispatchEvent(new Event(event,{bubbles:true}));
    },{value:String(value),event});
    const setPlaying=async playing=>{if((await snapshot()).playing!==playing)await page.locator('#play').click();};
    const openSound=async()=>{if(!await page.locator('#sound-panel').evaluate(element=>element.open))await page.locator('#sound-panel summary').click();};
    const report=await test({page,snapshot,input,setPlaying,openSound,reload,moduleUrls,output,engineUrl:engineUrl.href});
    await auditNetwork();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({suite:name,executedAt:new Date().toISOString(),engineUrl:engineUrl.href,moduleUrls,
      headless:true,mutedChromium:true,navigations,...report,consoleErrors:errors,networkErrors:[],rawNetworkEvents:networkErrors,
      completedTransferCancellations,legacyRequests,
      acousticRealismValidated:false},null,2)+'\n');
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

module.exports={resolveUrls,classifyRequestFailures,runSuite,assertCameraStable,assertLayout,setSimulatedHidden,sources,bulkSources};

if(require.main===module){
  assert.equal(process.argv[2],'--self-test','Usage: node qa-runtime.cjs --self-test');
  for(const env of [{},{SITE_URL:'http://127.0.0.1:4000/nested-test/'},
    {ENGINE_URL:'http://127.0.0.1:4000/nested-test/tools/t4-engine/'},
    {SITE_URL:'http://127.0.0.1:4000/nested-test',ENGINE_URL:'tools/t4-engine/?mixer=1'},
    {ENGINE_URL:'/nested-test/tools/t4-engine/'}]){
    const resolved=resolveUrls(env),prefix=Object.keys(env).length?'/nested-test/':'/';
    assert.equal(resolved.engineUrl.pathname,prefix+'tools/t4-engine/');
    for(const [name,url] of Object.entries(resolved.moduleUrls))assert.equal(new URL(url).pathname,prefix+`src/t4-engine/${name}.mjs`);
  }
  assert.throws(()=>resolveUrls({ENGINE_URL:'file:///tools/t4-engine/'}));
  assert.throws(()=>resolveUrls({ENGINE_URL:'http://127.0.0.1:4000/wrong/'}));
  const url='http://127.0.0.1:4000/assets/models/vw-t4-engine/r6/engine_assembly.glb';
  const event={url,resourceType:'fetch',error:'net::ERR_ABORTED'};
  const resource={name:url,responseStatus:200,encodedBodySize:9744448,decodedBodySize:9744448};
  assert.equal(classifyRequestFailures([event],[resource],url).completedTransferCancellations.length,1);
  for(const resources of [[],[{...resource,responseStatus:404}],[{...resource,decodedBodySize:9744447}],
    [{...resource,encodedBodySize:0}],[resource,resource]])assert.equal(classifyRequestFailures([event],resources,url).failures.length,1);
  for(const failure of [{...event,error:'net::ERR_FAILED'},{...event,resourceType:'document'},{...event,url:url+'?other=1'}]){
    assert.equal(classifyRequestFailures([failure],[resource],url).failures.length,1);
  }
  assert.equal(classifyRequestFailures([event,event],[resource],url).failures.length,2);
  const pose={camera:[1,2,3],target:[4,5,6]};assertCameraStable(pose,pose);
  assert.throws(()=>assertCameraStable({...pose,camera:[1,2,3.01]},pose));
  console.log('QA helper checks passed: default/nested URLs, module prefixes, exact completed-GLB exception and camera movement detection.');
}
