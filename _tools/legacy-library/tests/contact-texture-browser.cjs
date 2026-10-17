const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const aggressive=process.env.TEXTURE_SET==='aggressive',preset=aggressive?'layer-random-waves':'fine-stone';
const output=path.join(root,'output/legacy-library/textures',aggressive?'browser-aggressive':'browser');
async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:150000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
}
const camera=page=>page.evaluate(async()=> (await import('/src/cad-ui.mjs')).cameraState('#legacyWorkbench'));
(async()=>{
  await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});await fresh(context.request,base,root);
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied=text}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/parametric-models/depth-taper-hangboard/'+(aggressive?'?slot_count=1&slot_width_1=30':''));await ready(page);
    const baseMetrics=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),before=await camera(page);
    await page.locator('[data-parameter=surface_texture]').evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    assert.equal(await page.locator('#legacy-surface_texture option').count(),24);
    assert(await page.locator('[data-parameter=texture_layer_height]').isHidden());
    await page.locator('#legacy-surface_texture').selectOption(preset);assert(await page.locator('#legacyStl').isDisabled());
    if(aggressive){assert(await page.locator('[data-parameter=texture_layer_height]').isVisible());assert.equal(await page.locator('#legacy-texture_layer_height').inputValue(),'0.2');}
    await page.locator('#legacyBuild').click();await ready(page);
    const after=await camera(page);for(const key of ['position','target','quaternion','zoom'])assert([].concat(after[key]).every((value,i)=>Math.abs(value-[].concat(before[key])[i])<1e-8),'Texture moved the camera');
    const data=await page.evaluate(()=>{
      const controller=document.getElementById('legacyWorkbench').legacyController;
      return {metrics:controller.metrics,timings:controller.timings,physical:[...controller.viewer.objects.values()].every(mesh=>!mesh.material.map&&!mesh.material.normalMap&&!mesh.material.bumpMap&&!mesh.material.displacementMap)};
    });
    assert(data.metrics.triangles>baseMetrics.triangles);assert(data.metrics.volume>baseMetrics.volume);assert(data.timings.geometry_ms<1000,'Texture-only changes rebuilt the base CAD');assert(data.physical);
    await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
    for(const format of ['Stl','Glb']){
      const pending=page.waitForEvent('download');await page.locator('#legacy'+format).click();const download=await pending;
      assert.equal(download.suggestedFilename(),`depth-taper-hangboard--${preset}${aggressive?'--0.20mm-layers':''}.${format.toLowerCase()}`);
      await download.saveAs(path.join(output,preset+'.'+format.toLowerCase()));assert.equal(await download.failure(),null);await ready(page);
    }
    await page.locator('#legacyDownloads').evaluate(e=>e.open=false);
    for(const [label,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(size);await page.waitForTimeout(100);
      for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.screenshot({path:path.join(output,label+'-'+theme+'.png')});}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const pixels=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let colored=0;
      for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+1]>pixels.data[i]*1.2&&pixels.data[i+2]>pixels.data[i]*1.15)colored++;
      assert(colored>100,'Blank physical model');
      if(label!=='desktop'){assert(Math.abs((await page.locator('#legacyCanvas').boundingBox()).height-size.height/2)<1);await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(100);assert(await page.locator('#legacyWorkbench aside').isHidden());await page.locator('.cad-fullscreen-button').click();}
    }
    await page.locator('#legacyCopy').click();const shared=await page.evaluate(()=>__copied);assert.equal(new URL(shared).searchParams.get('surface_texture'),preset);
    if(aggressive)assert.equal(Number(new URL(shared).searchParams.get('texture_layer_height')),0.2);
    await page.goto(shared);await ready(page);assert.equal(await page.locator('#legacy-surface_texture').inputValue(),preset);
    await page.locator('[data-parameter=surface_texture]').evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    await page.locator('#legacy-surface_texture').selectOption('none');await page.locator('#legacyBuild').click();await ready(page);
    assert(await page.locator('[data-parameter=texture_layer_height]').isHidden());
    const smooth=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics);assert.equal(smooth.triangles,baseMetrics.triangles);assert(Math.abs(smooth.volume-baseMetrics.volume)<0.001);
    assert.deepEqual(errors,[]);console.log(`PASS (${preset}): physical relief, no texture maps, cached CAD, camera, STL/GLB, links, Smooth restoration and responsive/fullscreen views`);await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
