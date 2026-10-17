const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const runtime=path.resolve(path.dirname(process.execPath),'../node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const {PNG}=require(path.join(runtime,'pngjs'));
const root=path.resolve(__dirname,'../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.join(root,'output/model-library/fullscreen');
const models=[['coffee','','coffeeWorkbench'],['drone','drone-frame/','droneWorkbench'],['latch','door-frame-latch/','latchWorkbench'],['volumes','climbing-volumes/','volumeWorkbench'],['damper','cabinet-air-damper/','damperWorkbench']];
async function ready(page,id){
  await page.waitForFunction(id=>{
    if(id==='coffee')return document.getElementById('modelStatus')?.textContent==='Ready';
    if(id==='latch')return window.latchViewer?.valid;
    if(id==='damper')return document.getElementById('damperStatus')?.textContent==='Fixed V1';
    return document.getElementById(id==='drone'?'droneWorkbench':id==='volumes'?'volumeWorkbench':'legacyWorkbench')?.dataset.state==='ready';
  },id,{timeout:120000});await page.waitForTimeout(300);
}
async function pose(page,id){return page.evaluate(async ({id,base})=>{
  const {cameraState}=await import(base+'/src/cad-ui.mjs');
  return cameraState('#'+id);
},{id,base});}
async function settle(page,id){
  return page.evaluate(async ({id,base})=>{
    const {cameraState}=await import(base+'/src/cad-ui.mjs');let previous=cameraState('#'+id),frames=0;
    for(let i=0;i<600;i++){
      await new Promise(requestAnimationFrame);const next=cameraState('#'+id);
      const same=['position','target','quaternion','zoom'].every(key=>[].concat(next[key]).every((v,j)=>Math.abs(v-[].concat(previous[key])[j])<1e-7));
      frames=same?frames+1:0;previous=next;if(frames>=6)return next;
    }throw Error('Camera inertia did not settle');
  },{id,base});
}
async function interact(page,id,mobile){
  const before=await pose(page,id),box=await page.locator('#'+id+' .cad-view-surface canvas').boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.5;
  if(mobile){
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45*i/8,y:y+25*i/8}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const rotated=await settle(page,id);assert(rotated.quaternion.some((v,i)=>Math.abs(v-before.quaternion[i])>1e-4),'Touch orbit did not move the model');
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y},{x:x+30,y}]});
    for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30-30*i/8,y},{x:x+30+30*i/8,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
    const zoomed=await settle(page,id);assert(Math.abs(zoomed.zoom-rotated.zoom)>1e-4||zoomed.position.some((v,i)=>Math.abs(v-rotated.position[i])>1e-4),'Pinch did not zoom the model');
    return zoomed;
  }
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+25,{steps:8});await page.mouse.up();
  const after=await settle(page,id);assert(after.quaternion.some((v,i)=>Math.abs(v-before.quaternion[i])>1e-4),'Mouse orbit did not move the model');return after;
}
function stable(a,b,label){for(const key of ['position','target','quaternion','zoom']){
  const x=[].concat(a[key]),y=[].concat(b[key]);assert(x.every((v,i)=>Math.abs(v-y[i])<1e-5),label+' changed '+key);
}}
async function geometry(page,id){return page.locator('#'+id).evaluate(root=>{
  const bounds=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const shell=root.closest('.cad-app'),view=root.querySelector('.cad-view-surface'),panel=root.querySelector('.cad-control-region');
  return{mobile:shell.classList.contains('is-mobile'),full:shell.classList.contains('is-full-window'),shell:bounds(shell),view:bounds(view),panel:bounds(panel),window:{width:innerWidth,height:visualViewport?.height||innerHeight},overflow:document.documentElement.scrollWidth-innerWidth};
});}
async function capture(page,id,name){
  const bytes=await page.locator('#'+id+' .cad-view-surface canvas').screenshot(),png=PNG.sync.read(bytes);
  let color=0;for(let i=0;i<png.data.length;i+=4)if(Math.max(png.data[i],png.data[i+1],png.data[i+2])-Math.min(png.data[i],png.data[i+1],png.data[i+2])>25)color++;
  assert(color>60,name+': blank model canvas');
  await page.screenshot({path:path.join(output,name+'.png')});
}
async function defaultMobile(page,id){
  const state=await geometry(page,id);assert(state.mobile&&!state.full);
  assert(Math.abs(state.view.height-state.window.height/2)<=1,'Preview must take half the visible viewport');
  assert(Math.abs(state.panel.y-state.view.bottom)<=1,'Parameters must be below the preview');
  assert(state.panel.height>=159&&state.overflow<=1);
  return state;
}
async function fullscreen(page,id,mobile){
  const state=await geometry(page,id);assert(state.full);assert.equal(state.mobile,mobile);
  assert(Math.abs(state.shell.x)<1&&Math.abs(state.shell.y)<1);
  assert(Math.abs(state.shell.width-state.window.width)<1&&Math.abs(state.shell.height-state.window.height)<1);
  assert(Math.abs(state.view.height-state.window.height)<1&&Math.abs(state.view.y)<1);
  assert(await page.locator('.cad-model-picker').isHidden());
  assert.equal(await page.evaluate(()=>document.fullscreenElement),null,'Fullscreen should fill the browser window, not switch the display mode');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');
  if(mobile){
    assert(await page.locator('#'+id+' aside').isHidden());assert(Math.abs(state.view.width-state.window.width)<1&&Math.abs(state.view.x)<1);
    const visible=await page.locator('#'+id+' button, #'+id+' input, #'+id+' select, #'+id+' summary').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>e.className));
    assert.deepEqual(visible,['cad-fullscreen-button'],'Only the exit button may remain visible on mobile');
  }else{
    assert(await page.locator('#'+id+' aside').isVisible());assert(Math.abs(state.panel.x)<1);assert(Math.abs(state.panel.right-state.view.x)<1);
    assert(Math.abs(state.view.right-state.window.width)<1);
    const overlaps=await page.locator('#'+id+' .cad-fullscreen-button').evaluate(exit=>{
      const a=exit.getBoundingClientRect();return [...exit.parentElement.querySelectorAll('.coffee-toolbar,.latch-actions,.coffee-floating-actions')].filter(e=>e.getClientRects().length).some(e=>{const b=e.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
    });assert(!overlaps,'Exit button overlaps model tools');
  }
  assert(state.overflow<=1);return state;
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const {catalogue}=await import(pathToFileURL(path.join(root,'src/legacy_library/catalogue.mjs')));
  for(const [key,item]of Object.entries(catalogue))models.push([key,item.slug+'/','legacyWorkbench']);
  const selected=process.env.MODEL_ID?models.filter(([key])=>process.env.MODEL_ID.split(',').includes(key)):models;
  assert(selected.length,'Unknown MODEL_ID');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const check=await browser.newContext();
    for(const file of ['src/cad-ui.mjs','assets/css/modules/cad-ui.css','assets/icons/x.svg']){
      const response=await check.request.get(base+'/'+file);assert.equal(response.status(),200);
      const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(await response.body()),hash(await fs.readFile(path.join(root,file))),file+': stale build');
    }await check.close();
    for(const [key,route,id]of selected)for(const mobile of [true,false]){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
      await context.addInitScript(()=>{localStorage.clear();sessionStorage.clear();});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/parametric-models/'+route);await ready(page,key);
      if(mobile){
        await defaultMobile(page,id);
        await page.setViewportSize({width:320,height:700});await page.waitForTimeout(200);await defaultMobile(page,id);
        await capture(page,id,key+'-narrow-default');
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
        const height=(await geometry(page,id)).view.height;
        await page.locator('#'+id+' aside details').first().evaluate(e=>e.open=true);await page.waitForTimeout(150);
        assert.equal((await geometry(page,id)).view.height,height,'Expanded settings must not shrink the preview');
        await page.locator('#'+id+' aside details').first().evaluate(e=>e.open=false);
        await page.evaluate(()=>scrollTo(0,50));await page.waitForTimeout(100);
      }
      const scroll=await page.evaluate(()=>scrollY),before=await pose(page,id);
      for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await capture(page,id,key+'-'+(mobile?'mobile':'desktop')+'-'+theme);}
      await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(350);
      await fullscreen(page,id,mobile);stable(await pose(page,id),before,'Enter fullscreen');
      for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await capture(page,id,key+'-'+(mobile?'mobile':'desktop')+'-'+theme+'-full');}
      await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('.cad-app').contains(document.activeElement)),'Focus escaped fullscreen');
      const locked=await page.evaluate(()=>scrollY),exit=await page.locator('.cad-fullscreen-button').boundingBox();await page.mouse.move(exit.x+exit.width/2,exit.y+exit.height/2);await page.mouse.wheel(0,300);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),locked);
      if(mobile){
        await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await fullscreen(page,id,true);
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
      }
      await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(350);
      assert.equal(await page.locator('.cad-fullscreen-button').getAttribute('aria-pressed'),'false');
      assert(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2,'Page scroll position was not restored');
      stable(await pose(page,id),before,'Exit fullscreen');
      const restored=await pose(page,id);
      assert(restored.projection.every((v,i)=>Math.abs(v-before.projection[i])<1e-5),key+' '+(mobile?'mobile':'desktop')+': fullscreen round trip changed normal framing: '+JSON.stringify({before:before.projection,after:restored.projection}));
      if(mobile){
        await defaultMobile(page,id);
        await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);await defaultMobile(page,id);
        await capture(page,id,key+'-landscape-default');
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
      }
      await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(250);
      let fitted;
      if(key==='organizer'&&!mobile){
        fitted=await page.evaluate(()=>{
          const viewer=document.getElementById('legacyWorkbench').legacyController.viewer,view=document.querySelector('.cad-view-surface');
          viewer.group.scale.setScalar(2);viewer.fit('front');
          return{width:view.clientWidth,height:view.clientHeight,span:viewer.camera.top-viewer.camera.bottom};
        });
      }
      const interacted=await interact(page,id,mobile);await page.keyboard.press('Escape');await page.waitForTimeout(200);
      assert(!await page.locator('.cad-app').evaluate(e=>e.classList.contains('is-full-window')));
      stable(await pose(page,id),interacted,'Exit must preserve user orbit and zoom');
      if(fitted){
        const result=await page.evaluate(()=>{const c=document.getElementById('legacyWorkbench').legacyController.viewer.camera,v=document.querySelector('.cad-view-surface');return{width:v.clientWidth,height:v.clientHeight,span:c.top-c.bottom};});
        const expected=fitted.span*(result.height/fitted.height)/Math.min(result.width/fitted.width,result.height/fitted.height);
        assert(Math.abs(result.span-expected)<1e-5,'Leaving fullscreen discarded the explicit Fit of an enlarged model');
      }
      assert.deepEqual(errors,[]);console.log('PASS '+key+' '+(mobile?'mobile':'desktop')+': preview sizing, fullscreen, framing, focus, scroll restoration, exit and themes');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
