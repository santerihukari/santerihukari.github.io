const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const fresh=require('../legacy-library/tests/fresh.cjs');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'output/climbing-hold/browser'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:120000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
}
const camera=page=>page.evaluate(async()=>(await import('/src/cad-ui.mjs')).cameraState('#legacyWorkbench'));
const sameCamera=(a,b)=>{for(const key of ['position','target','quaternion','zoom'])assert([].concat(a[key]).every((value,i)=>Math.abs(value-[].concat(b[key])[i])<1e-7),'Parameter edit moved the camera');};
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    await fresh(context.request,base,root);
    for(const file of ['src/parametric-catalogue.mjs','src/climbing_hold/model.mjs','src/climbing_hold/hardware.mjs','src/climbing_hold/definition.mjs','src/drone_frame/exports.mjs']){
      const response=await context.request.get(base+'/'+file);assert.equal(response.status(),200);
      const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(await response.body()),hash(await fs.readFile(path.join(root,file))),file+' is stale');
    }
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied=text}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/parametric-models/crimp-hold/?bolt_head_diameter=20.4&screw_clearance=5.4');await ready(page);
    assert.equal(await page.locator('#legacy-bolt_head_diameter').inputValue(),'22.8');
    assert.equal(await page.locator('#legacy-screw_clearance').inputValue(),'5.5');
    assert.equal(new URL(page.url()).searchParams.get('bolt_head_diameter'),'22.8');
    assert.equal(await page.locator('#cadModel').inputValue(),'/parametric-models/crimp-hold/');
    const workbench=page.locator('#legacyWorkbench'),mesh=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics);
    assert(mesh.triangles>100000);assert(await page.locator('#legacyBuild').isVisible());
    const box=await page.locator('#legacyCanvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.waitForTimeout(80);
    assert.equal(await workbench.getAttribute('data-hovered-component'),'crimp_hold');assert(await page.locator('.cad-component-label').isHidden());
    await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);await page.waitForTimeout(80);assert(await page.locator('.cad-component-label').isVisible());
    const before=await camera(page);
    await page.locator('#legacy-incut_angle').fill('20');await page.locator('#legacy-incut_angle').press('Enter');
    assert.equal(await workbench.getAttribute('data-state'),'pending');assert(await page.locator('#legacyStl').isDisabled());
    await page.locator('#legacyBuild').click();await ready(page);sameCamera(await camera(page),before);
    await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.viewer.select(null));await page.mouse.move(4,4);
    await page.locator('#legacyCopy').click();const shared=await page.evaluate(()=>window.__copied);
    assert.equal(new URL(shared).searchParams.get('incut_angle'),'20');assert.equal(new URL(shared).searchParams.get('surface_texture'),'layer-random-jagged');
    await page.locator('#legacyDownloads').evaluate(node=>node.open=true);
    for(const format of ['Stl','Glb']){
      const pending=page.waitForEvent('download');await page.locator('#legacy'+format).click();const download=await pending;
      assert.equal(download.suggestedFilename(),`crimp-hold--layer-random-jagged--0.20mm-layers.${format.toLowerCase()}`);
      await download.saveAs(path.join(output,'crimp.'+format.toLowerCase()));assert.equal(await download.failure(),null);await ready(page);
    }
    await page.locator('#legacyDownloads').evaluate(node=>node.open=false);
    assert((await fs.readFile(path.join(output,'crimp.stl'))).subarray(0,80).toString().includes('Crimp climbing hold'));
    for(const [label,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(size);await page.waitForTimeout(100);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const theme of ['light','dark']){
        await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.waitForTimeout(70);
        await page.screenshot({path:path.join(output,label+'-'+theme+'.png')});
        const pixels=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let colored=0;
        for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+1]>pixels.data[i]*1.2&&pixels.data[i+2]>pixels.data[i]*1.15)colored++;
        assert(colored>500,'Blank or missing hold');
      }
      const pose=await camera(page);await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(80);
      assert(await page.locator('.cad-app').evaluate(node=>node.classList.contains('is-full-window')));
      if(label!=='desktop'){assert(await page.locator('#legacyWorkbench aside').isHidden());assert.equal(Math.round((await page.locator('#legacyCanvas').boundingBox()).height),size.height);}
      else assert(await page.locator('#legacyWorkbench aside').isVisible());
      await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(80);sameCamera(await camera(page),pose);
      if(label!=='desktop')assert(Math.abs((await page.locator('#legacyCanvas').boundingBox()).height-size.height/2)<1);
    }
    await page.goto(shared);await ready(page);assert.equal(await page.locator('#legacy-incut_angle').inputValue(),'20');
    await page.setViewportSize({width:1440,height:900});await page.locator('#legacyReset').click();await ready(page);assert.equal(await page.locator('#legacy-incut_angle').inputValue(),'15');
    await page.screenshot({path:path.join(output,'default-desktop.png')});
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS: crimp rendering, model picker, hover/click, stable camera, manual updates, shares, STL/GLB, reset, light/dark and desktop/mobile/fullscreen');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
