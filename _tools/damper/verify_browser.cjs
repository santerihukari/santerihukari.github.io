const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');

const root=path.resolve(__dirname,'../..'),qa=path.join(root,'output/damper');
const base=process.env.DAMPER_URL||'http://127.0.0.1:4000';
const route='/parametric-models/cabinet-air-damper/';
const chrome=process.env.CHROMIUM_PATH||'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={checks:[],screenshots:[],errors:[],resource_failures:[]};
function passed(name,details={}){report.checks.push({name,...details});console.log(`PASS ${name}`);}

async function canvas(page,name){
  const bytes=await page.locator('#damperCanvas').screenshot({path:path.join(qa,`${name}-canvas.png`)});
  const png=PNG.sync.read(bytes),background=Array.from(png.data.subarray(0,3));let pixels=0;
  for(let y=60;y<png.height-48;y++)for(let x=8;x<png.width-8;x++){
    const offset=(y*png.width+x)*4;
    if(background.reduce((sum,value,index)=>sum+Math.abs(png.data[offset+index]-value),0)>45)pixels++;
  }
  assert(png.width>200&&png.height>=90,'Canvas has usable dimensions');assert(pixels>1500,'Canvas must contain rendered model pixels');
  const screenshot=path.join(qa,`${name}.png`);await page.screenshot({path:screenshot,fullPage:true});
  report.screenshots.push({name,width:png.width,height:png.height,model_pixels:pixels});return hash(bytes);
}
async function input(page,id,value){await page.locator(id).evaluate((element,value)=>{element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function download(page,button,name){
  await page.locator('#damperDownloads').evaluate(element=>element.open=true);
  const ready=page.waitForEvent('download');await page.locator(button).click();const item=await ready;
  assert.equal(await item.failure(),null);await item.saveAs(path.join(qa,name));
}
async function layout(page){
  const issues=await page.evaluate(()=>{
    const root=document.getElementById('damperWorkbench'),canvas=document.getElementById('damperCanvas').getBoundingClientRect(),issues=[];
    if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Page horizontal overflow');
    for(const element of root.querySelectorAll('.coffee-floating-actions button,.coffee-view-controls button')){
      if(!element.getClientRects().length)continue;
      const rect=element.getBoundingClientRect();
      if(rect.left<canvas.left-1||rect.right>canvas.right+1||rect.top<canvas.top-1||rect.bottom>canvas.bottom+1)issues.push('Tool outside canvas');
      if(element.scrollWidth>element.clientWidth+1)issues.push('Clipped button label');
    }
    for(const element of root.querySelectorAll('.damper-part-row'))if(element.scrollWidth>element.clientWidth+1)issues.push('Overflowing part row');
    return issues;
  });assert.deepEqual(issues,[]);
}
async function main(){
  await fs.mkdir(qa,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await context.addInitScript(()=>{
      const state={buffers:new Set(),programs:new Set()};window.__damperGPU=state;
      for(const type of [WebGLRenderingContext,WebGL2RenderingContext])for(const [create,remove,objects] of [['createBuffer','deleteBuffer',state.buffers],['createProgram','deleteProgram',state.programs]]){
        const originalCreate=type.prototype[create],originalDelete=type.prototype[remove];
        type.prototype[create]=function(...args){const object=originalCreate.apply(this,args);if(object)objects.add(object);return object;};
        type.prototype[remove]=function(object){objects.delete(object);return originalDelete.call(this,object);};
      }
    });
    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))report.resource_failures.push({url:response.url(),status:response.status()});});
    await page.goto(base+route,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.getElementById('damperStatus')?.textContent==='Fixed V1');
    assert.equal(await page.locator('#damperParts .damper-part-row').count(),16);
    assert.equal(await page.locator('#damperPrintPart option').count(),9);
    assert.equal(await page.locator('#damperPlay').getAttribute('aria-label'),'Play motion');
    assert.equal(await page.locator('#damperError').isVisible(),false);
    assert.match(await page.locator('#damperDetails').textContent(),/CAD bore 20.40 mm; piston 19.70 mm/);
    assert.match(await page.locator('#damperDetails').textContent(),/Front cap and rod unchanged/);
    assert.match(await page.locator('#damperDetails').textContent(),/not yet verified/);
    passed('Fixed revision loaded; 16 named objects and 9 print designs');
    assert.equal(await page.locator('input[type=color]').count(),0);
    assert.deepEqual(await page.locator('aside .cad-options').evaluateAll(nodes=>nodes.filter(e=>!e.hidden).map(e=>e.open)),[false,false]);
    await page.evaluate(()=>document.documentElement.dataset.theme='light');await sleep(100);await layout(page);
    const initial=await canvas(page,'desktop-light');
    for(const view of ['front','top','side','iso']){await page.locator(`[data-cad-view=${view}]`).click();await sleep(150);await canvas(page,`desktop-${view}`);}
    passed('Camera presets render and fit the desktop viewport');
    const box=await page.locator('#damperCanvas').boundingBox();
    await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.68,box.y+box.height*.55,{steps:8});await page.mouse.up();await sleep(150);
    assert.notEqual(await canvas(page,'desktop-orbit'),initial);passed('Orbit interaction changes rendered view');
    await page.locator('aside details').evaluateAll(nodes=>nodes.forEach(e=>e.open=true));
    await page.locator('[data-part=front_pin_left]').click();assert.equal(await page.locator('#damperPrintPart').inputValue(),'front_cap_pin');
    assert.match(await page.locator('#damperQuantity').textContent(),/Print 2/);passed('Instance selection resolves the correct print file and quantity');
    await input(page,'#damperStrokeNumber',17);assert.equal(await page.locator('#damperStroke').inputValue(),'17');
    assert.match(await page.locator('#damperMetrics').textContent(),/11.0 mm/);
    await input(page,'#damperStroke',20);assert.equal(await page.locator('#damperStrokeNumber').inputValue(),'20.0');
    await input(page,'#damperStrokeNumber',99);assert.equal(await page.locator('#damperStrokeNumber').inputValue(),'20.0');
    await page.locator('#damperStrokeNumber').fill('');assert.equal(await page.locator('#damperStrokeNumber').getAttribute('aria-invalid'),'true');
    await input(page,'#damperStrokeNumber',0);passed('Paired travel controls, clamp and blank-input handling');
    await page.locator('#damperPlay').click();assert.equal(await page.locator('#damperPlay').getAttribute('aria-label'),'Pause motion');
    await sleep(450);assert(Number(await page.locator('#damperStroke').inputValue())>0);
    await page.locator('#damperPlay').click();const paused=await page.locator('#damperStroke').inputValue();await sleep(150);assert.equal(await page.locator('#damperStroke').inputValue(),paused);
    passed('Icon playback moves the model and pauses exactly');
    await page.locator('#damperReset').click();await page.locator('#damperSection').check();await page.locator('#damperAir').check();
    await input(page,'#damperStrokeNumber',17);await canvas(page,'desktop-section-air');
    const memory=()=>page.evaluate(()=>({buffers:window.__damperGPU.buffers.size,programs:window.__damperGPU.programs.size}));
    await page.evaluate(async()=>{for(let i=0;i<2;i++){for(const id of ['damperSection','damperAir','damperReferences']){const e=document.getElementById(id);e.checked=!e.checked;e.dispatchEvent(new Event('change'));}await new Promise(requestAnimationFrame);}});
    const before=await memory();
    await page.evaluate(async()=>{for(let i=0;i<40;i++){for(const id of ['damperSection','damperAir','damperReferences']){const e=document.getElementById(id);e.checked=!e.checked;e.dispatchEvent(new Event('change'));}await new Promise(requestAnimationFrame);}});
    const after=await memory();assert.equal(after.buffers,before.buffers);assert.equal(after.programs,before.programs);
    passed('40 section/air/reference toggles retain stable GPU resources',{before,after});
    const housing=page.locator('#damperParts [aria-label="Show housing"]');await housing.uncheck();assert.equal(await housing.isChecked(),false);await housing.check();
    await page.locator('#damperReferences').uncheck();await canvas(page,'desktop-no-references');
    passed('Fixed part colors, independent visibility and spring/tape controls');
    const data=JSON.parse(await fs.readFile(path.join(root,'assets/cad/air-damper/model.json'),'utf8'));
    for(const item of data.print_manifest){
      await page.locator('#damperDownloads').evaluate(element=>element.open=true);
      await page.locator('#damperPrintPart').selectOption(item.part);await download(page,'#damperSTL',item.file);
      assert.equal(hash(await fs.readFile(path.join(qa,item.file))),hash(await fs.readFile(path.join(root,'assets/cad/air-damper',item.file))));
    }
    await download(page,'#damperZIP','print-set.zip');passed('All nine downloaded STLs match source bytes; kit ZIP downloads');
    await page.locator('#damperDownloads').evaluate(element=>element.open=false);
    await page.locator('#damperSection').check();await page.locator('#damperAir').check();await input(page,'#damperExplode',15);
    for(const stroke of [0,17,20]){await input(page,'#damperStrokeNumber',stroke);await download(page,'#damperGLB',`stroke-${stroke}.glb`);}
    passed('Current-stroke GLBs downloaded with cutaway/explosion/references hidden');
    await page.locator('#damperDownloads').evaluate(element=>element.open=false);
    await page.locator('#damperReset').click();await page.evaluate(()=>document.documentElement.dataset.theme='dark');await sleep(150);await layout(page);await canvas(page,'desktop-dark');
    for(const viewport of [{width:390,height:844},{width:320,height:740}]){
      await page.setViewportSize(viewport);await sleep(200);await layout(page);await canvas(page,`mobile-${viewport.width}-dark`);
      await page.evaluate(()=>document.documentElement.dataset.theme='light');await sleep(100);await canvas(page,`mobile-${viewport.width}-light`);
      await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    }
    passed('Light/dark desktop and 390/320 px mobile layouts; nonblank model pixels');
    await page.setViewportSize({width:844,height:390});
    await page.evaluate(()=>{window.scrollTo(0,0);window.dispatchEvent(new Event('resize'));});await sleep(200);
    await page.locator('[data-cad-view=iso]').click();await layout(page);await canvas(page,'landscape-844-dark');
    const landscape=await page.evaluate(()=>{
      const root=document.getElementById('damperWorkbench').getBoundingClientRect(),canvas=document.getElementById('damperCanvas').getBoundingClientRect(),panel=document.querySelector('#damperWorkbench .coffee-controls');
      return {bottom:root.bottom,height:root.height,canvas_height:canvas.height,panel_height:panel.clientHeight,scrollable:panel.scrollHeight>panel.clientHeight};
    });
    assert(landscape.bottom<=390&&landscape.height>=180&&landscape.canvas_height>=90&&landscape.panel_height>=90&&landscape.scrollable);
    await page.locator('#damperPlay').click();await sleep(150);await page.locator('#damperPlay').click();
    await page.locator('#damperWarning').scrollIntoViewIfNeeded();assert(await page.locator('#damperWarning').isVisible());
    passed('844x390 landscape fits available height with usable canvas/sidebar',{...landscape});
    const scaled=await page.evaluate(async()=>{
      const {createViewer}=await import('/src/cad-viewer.mjs');
      const holder=document.createElement('div');holder.style.cssText='width:200px;height:200px;position:fixed;left:-1000px;background:#fff';document.body.append(holder);
      const canvas=document.createElement('canvas');holder.append(canvas);
      const viewer=createViewer(canvas),part={name:'scale-test',color:'#ffffff',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]};
      viewer.setParts([part]);viewer.objects.get(part.name).scale.x=.5;
      const bytes=await viewer.glb({},[{...part}],()=>[0,0,0]);const size=new DataView(bytes).getUint32(12,true);
      const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,size)));
      const node=gltf.nodes.find(node=>node.name==='scale-test');return node.scale?.[0]??node.matrix?.[0];
    });assert.equal(scaled,.5);passed('Shared GLB exporter retains native mesh scale');
    const prefix='/damper-qa-prefix';
    await context.route(base+prefix+'/**',async request=>{
      const url=new URL(request.request().url()),response=await context.request.get(base+url.pathname.slice(prefix.length));
      let body=await response.body();
      if((response.headers()['content-type']||'').includes('text/html'))body=Buffer.from(body.toString().replace(/((?:src|href)=["'])\//g,`$1${prefix}/`).replace(/"\/(assets|src)\//g,`"${prefix}/$1/`));
      await request.fulfill({response,body});
    });
    await page.goto(base+prefix+route,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('damperStatus')?.textContent==='Fixed V1');
    await canvas(page,'mobile-prefixed-route');passed('Served-prefix imports/assets work without localhost CAD calls');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.resource_failures,[]);
    await fs.writeFile(path.join(qa,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`PASS ${report.checks.length} browser groups; report: ${path.join(qa,'browser-report.json')}`);
  }finally{await browser.close();}
}
main().catch(async error=>{console.error(error);report.failure=error.stack;await fs.mkdir(qa,{recursive:true});await fs.writeFile(path.join(qa,'browser-failure.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=1;});
