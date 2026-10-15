const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),output=path.join(root,'output/legacy-library/rebuild');
const base=process.env.SITE_URL||'http://127.0.0.1:4000';
const route='/parametric-models/depth-taper-hangboard/';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stalledCurve='0,1|0.5,1.1|1,1';
async function edit(page,key,value){await page.locator(`#legacy-${key}`).evaluate((e,value)=>{
  for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
  e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));
},value);}
async function ready(page){await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:100000});assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());}
const pose=page=>page.evaluate(()=>{const v=document.getElementById('legacyWorkbench').legacyController.viewer;return{position:v.camera.position.toArray(),target:v.controls.target.toArray(),zoom:v.camera.zoom};});
function samePose(actual,expected){for(const key of Object.keys(expected)){const a=[].concat(actual[key]),b=[].concat(expected[key]);assert(a.every((v,i)=>Math.abs(v-b[i])<1e-6),'Rebuild changed camera '+key);}}
async function pixels(page,name){
  await page.screenshot({path:path.join(output,name+'.png')});
  const png=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let count=0;
  for(let i=0;i<png.data.length;i+=4)if(png.data[i+1]>png.data[i]*1.25&&png.data[i+2]>png.data[i]*1.2&&png.data[i+1]>50)count++;
  assert(count>60,'The unchanged full model must remain rendered');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const tools=await page.locator('.coffee-actions').evaluate(e=>{
    const box=e.closest('.viewport').getBoundingClientRect();
    return [...e.querySelectorAll(':scope>button,:scope>details')].filter(n=>n.getClientRects().length).every(n=>{const r=n.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom;});
  });assert(tools,'Model actions overflow the preview');
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    await fresh(context.request,base,root);
    await context.addInitScript(()=>{
      const NativeWorker=Worker;window.__jobs=[];window.__stops=0;
      window.Worker=class extends NativeWorker{
        postMessage(data,...rest){window.__jobs.push({type:data.type,id:data.id,revision:data.revision});return super.postMessage(data,...rest);}
        terminate(){window.__stops++;return super.terminate();}
      };
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});
    });
    // A never-finishing request proves recovery independently of CAD operation speed.
    await context.route('**/src/legacy_library/worker.mjs',async route=>{
      const body=await fs.readFile(path.join(root,'src/legacy_library/worker.mjs'),'utf8');
      await route.fulfill({contentType:'text/javascript',body:body+`\nconst actual=self.onmessage;self.onmessage=event=>{const d=event.data;if(d.type==='build'&&(d.params.depth_taper_curve===${JSON.stringify(stalledCurve)}||d.params.width===131)){self.postMessage({id:d.id,revision:d.revision,type:'progress',stage:'geometry'});return;}return actual(event);};`});
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+route);await ready(page);await pause(300);
    assert(await page.locator('#legacyBuild').isVisible());assert(await page.locator('#legacyBuild').isDisabled());
    const before=await pose(page),initial=await page.evaluate(()=>__jobs.length);
    await edit(page,'depth_taper_curve',stalledCurve);await edit(page,'slot_depth_y',25);await pause(900);
    assert.equal(await page.evaluate(()=>__jobs.length),initial,'Manual edits started a build');
    assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
    assert(await page.locator('#legacyStl').isDisabled());assert(await page.locator('#legacyGlb').isDisabled());
    assert(!(await page.locator('#legacyCopy').isDisabled()));await page.locator('#legacyCopy').click();
    const link=new URL(await page.evaluate(()=>__copied));assert.equal(link.searchParams.get('depth_taper_curve'),stalledCurve);assert.equal(link.searchParams.get('slot_depth_y'),'25');
    await page.locator('#legacyBuild').click();await pause(2200);
    assert.match(await page.locator('#legacyStatus').textContent(),/Building geometry \(\d+s\)/);
    assert(!(await page.locator('#legacyCopy').isDisabled()),'Sharing valid pending parameters should work');
    const stops=await page.evaluate(()=>__stops);
    await edit(page,'depth_taper_curve','0,1|0.5,1|1,1');
    assert.equal(await page.evaluate(()=>__stops),stops+1,'Obsolete worker was not terminated');
    assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
    await pause(700);assert.equal(await page.evaluate(()=>__jobs.length),initial+1,'New manual edit auto-built');
    await page.locator('#legacyBuild').click();await ready(page);
    samePose(await pose(page),before);
    assert.equal(await page.locator('#legacy-slot_depth_y').inputValue(),'25');
    const timing=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.timings);assert(timing.geometry_ms>=0&&timing.preview_ms>=0);
    console.log('PASS manual batching, active-build cancellation, current-parameter links, progress, current geometry and camera');
    // A real curved build with explicit zero-rounding settings exercises the exact builder without expensive rolling-ball blends.
    await edit(page,'depth_taper_curve','0,1|0.5,1.02|1,1');
    for(const key of ['slot_fillet_r','riser_fillet_r','outer_fillet_r'])await edit(page,key,0);
    await page.locator('#legacyBuild').click();await ready(page);
    samePose(await pose(page),before);
    for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:700}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(150);
      await page.locator('#legacyParameters details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
      for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await pixels(page,`${viewport.width}-${theme}`);}
    }
    await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
    for(const format of ['Stl','Glb']){
      const event=page.waitForEvent('download');await page.locator('#legacy'+format).click();const file=await event;
      await file.saveAs(path.join(output,`curved.${format.toLowerCase()}`));assert.equal(await file.failure(),null);
    }
    console.log('PASS actual curved CAD build, STL/GLB downloads and desktop/mobile light/dark pixels');
    await page.goto(base+'/parametric-models/grid-organizer/');await ready(page);
    assert(await page.locator('#legacyBuild').isHidden());
    await edit(page,'width',131);await page.waitForFunction(()=>__jobs.some(j=>j.type==='build'&&j.revision===1));
    await edit(page,'width',132);await ready(page);
    assert.equal(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics.max[0]),132);
    console.log('PASS automatic model cancels a stuck previous revision and builds only the latest parameters');
    assert.deepEqual(errors,[]);await context.close();
    const early=await browser.newContext();await early.route('**/src/legacy_library/worker.mjs',async route=>{
      const body=await fs.readFile(path.join(root,'src/legacy_library/worker.mjs'),'utf8');
      await route.fulfill({contentType:'text/javascript',body:body+'\nconst actual=self.onmessage;self.onmessage=e=>{if(e.data.id!==1)return actual(e);};'});
    });
    const loading=await early.newPage();await loading.goto(base+route);
    await loading.waitForFunction(()=>document.getElementById('legacyWorkbench').legacyController);
    await loading.locator('#legacyReset').click();await ready(loading);
    console.log('PASS reset can recover even before the first model finishes loading');await early.close();
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,timing,errors},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
