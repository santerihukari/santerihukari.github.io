const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {resolveUrls,canvasPixels,assertModelState,assertCameraStable}=require('./qa-runtime.cjs');
const {chromium,firefox}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const browserName=process.env.T4_BROWSER||'chromium',{engineUrl,baseUrl}=resolveUrls();
const output=path.resolve(__dirname,'../../output/t4-engine/startup'),checks=[];

async function run(){
  await fs.mkdir(output,{recursive:true});
  const browser=await (browserName==='firefox'?firefox:chromium).launch({headless:true,...(browserName==='firefox'?{}:{
    executablePath:'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--mute-audio']})});
  try{
    for(const [width,height]of [[390,844],[844,390]]){
      const context=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:2,
        ...(browserName==='chromium'?{isMobile:true}:{})});
      const staleRequests=[],errors=[],responses=[];
      // Emulate a warm cache containing the pre-update unversioned scripts.
      await context.route(url=>url.pathname.endsWith('/src/t4-engine/bootstrap.mjs')&&!url.search,
        route=>{staleRequests.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:"await import('./app.mjs');"});});
      await context.route(url=>url.pathname.endsWith('/src/t4-engine/app.mjs')&&!url.search,
        route=>{staleRequests.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:"document.getElementById('download-glb').removeAttribute('href');"});});
      try{
        for(const variant of ['powertrain','default','vehicle']){
          const page=await context.newPage(),url=new URL(engineUrl);url.searchParams.delete('assembly');
          if(variant!=='powertrain')url.searchParams.set('assembly',variant==='default'?'engine':variant);
          page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
          page.on('response',response=>{if(response.status()>=400)responses.push({url:response.url(),status:response.status()});});
          await page.goto(url.href);await page.locator('#t4Engine[data-state=ready]').waitFor({timeout:60000});
          const state=await page.evaluate(()=>window.engineInspection.snapshot());assertModelState(state,variant);
          assert.equal(state.audio.contextCreated,false);assert.equal(state.mode,'parts');
          assert.equal(await page.locator('#assembly-variant').inputValue(),variant);
          const version=await page.locator('script[src*="/src/t4-engine/bootstrap.mjs"]').evaluate(script=>new URL(script.src).searchParams.get('v'));
          assert.match(version,/^\d+$/);
          assert.equal(await page.locator('link[href*="/assets/css/modules/t4-engine.css"]').evaluate(link=>new URL(link.href).searchParams.get('v')),version);
          const imports=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
          assert(imports.includes(new URL(`src/t4-engine/app.mjs?v=${version}`,baseUrl).href),'App did not inherit the page build version');
          assert.equal(await page.locator('#catalogue-downloads a[href]').count(),4);
          assert((await canvasPixels(page)).contrast>200,'Blank mobile model');
          const canvas=page.locator('#viewport>canvas:not(#axis-indicator)');
          if(browserName==='chromium')assert.equal(await canvas.evaluate(element=>getComputedStyle(element).webkitTapHighlightColor),'rgba(0, 0, 0, 0)','Native tap flash still covers the canvas');
          const bounds=await canvas.boundingBox();let selected=null;
          for(const [x,y]of [[.5,.5],[.5,.6],[.4,.5],[.6,.5],[.5,.4],[.3,.5],[.7,.5]]){
            await page.touchscreen.tap(bounds.x+bounds.width*x,bounds.y+bounds.height*y);
            selected=await page.evaluate(()=>window.engineInspection.snapshot().selected);if(selected)break;
          }
          assert(selected,'Touch did not select a model component');
          assertCameraStable(await page.evaluate(()=>window.engineInspection.snapshot()),state);
          assert.equal(await page.locator('.part-row.selected').count(),1);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
          await page.screenshot({path:path.join(output,`${browserName}-${width}-${height}-${variant}.png`)});
          checks.push({width,height,variant,version,mobileFirst:true,staleScriptsBypassed:true,touchSelectsPart:true,selected});await page.close();
        }
        assert.deepEqual(staleRequests,[]);assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
      }finally{await context.close();}
    }
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    try{
      const page=await context.newPage(),url=new URL(engineUrl);url.searchParams.set('assembly','powertrain');url.searchParams.set('part','alternator');
      const isEnginePage=routeUrl=>routeUrl.pathname===engineUrl.pathname;
      const oldMarkup=async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('data-ui-schema="2"','')});};
      await page.route(isEnginePage,oldMarkup);
      await page.goto(url.href);await page.locator('#t4Engine[data-state=error]').waitFor();
      assert.match(await page.locator('#error').innerText(),/page has been updated/);
      assert.doesNotMatch(await page.locator('#error').innerText(),/WebGL/);
      const reload=page.locator('#error a').filter({hasText:'Reload viewer'}),target=new URL(await reload.getAttribute('href'));
      assert.equal(target.searchParams.get('assembly'),'powertrain');assert.equal(target.searchParams.get('part'),'alternator');assert(target.searchParams.has('viewer-update'));
      assert.equal(await page.locator('#error a').filter({hasText:'Project notes'}).getAttribute('href'),new URL('projects/vw-t4-engine-simulation/',baseUrl).href);
      await page.unroute(isEnginePage,oldMarkup);
      await reload.click();await page.locator('#t4Engine[data-state=ready]').waitFor({timeout:60000});
      assert.equal(await page.evaluate(()=>window.engineInspection.snapshot().selected),'alternator');
      checks.push({staleMarkupNotice:true,reloadRecovers:true,parametersPreserved:true});
      await page.close();
      const noWebGL=await context.newPage();await noWebGL.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
      await noWebGL.goto(engineUrl.href);await noWebGL.locator('#t4Engine[data-state=error]').waitFor();
      assert.match(await noWebGL.locator('#error').innerText(),/requires WebGL/);assert.equal(await noWebGL.locator('#error a').count(),2);
      checks.push({webGLFallbackIsSpecific:true});await noWebGL.close();
    }finally{await context.close();}
    await fs.writeFile(path.join(output,`${browserName}-report.json`),JSON.stringify({browser:browserName,url:engineUrl.href,checks,physicalDeviceTested:false},null,2));
    console.log(`Mobile startup passed (${browserName}): three assemblies, portrait/landscape, stale-script bypass, stale-markup recovery and WebGL fallback.`);
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
