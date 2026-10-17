const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.join(root,'output/legacy-library/profile-presets');
async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:110000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
}
async function show(page,key){
  await page.locator(`[data-parameter=${key}]`).evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
}
async function chart(page){
  const canvas=page.locator('[data-parameter=depth_taper_curve] .legacy-profile-preview canvas');
  const pixels=PNG.sync.read(await canvas.screenshot());let lo=pixels.width,hi=-1;
  for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++){
    const i=(y*pixels.width+x)*4,r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    if((g>r*1.35&&b>r*1.15)||(r>g*1.3&&g>b*1.2)){lo=Math.min(lo,x);hi=Math.max(hi,x);}
  }
  assert(hi-lo>pixels.width*.65,'Short lower grip is compressed by the upper grip scale');
}
(async()=>{
  await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,acceptDownloads:true});await fresh(context.request,base,root);
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied=text}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/parametric-models/depth-taper-hangboard/?slot_count=1&slot_depth_y=10&upper_slot_depth_y=24&back_wall_y=0');await ready(page);
    await show(page,'depth_taper_curve');assert.equal(await page.locator('#legacy-depth_taper_curve-preset').inputValue(),'flat');
    assert.equal(await page.locator('#legacy-attachment_method').inputValue(),'rope_groove');
    assert.equal(await page.locator('#legacy-slot_width_1').getAttribute('max'),'120');
    assert.equal(await page.locator('[data-parameter=depth_taper_curve] .legacy-profile-custom').getAttribute('open'),null);
    await chart(page);await page.screenshot({path:path.join(output,'mono-preset-desktop-light.png')});
    const before=await page.evaluate(async()=> (await import('/src/cad-ui.mjs')).cameraState('#legacyWorkbench'));
    await page.locator('#legacy-depth_taper_curve-preset').selectOption('dished');
    assert.equal(await page.locator('#legacy-depth_taper_amount_mm').inputValue(),'1');
    assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
    await show(page,'width_taper_curve');await page.locator('#legacy-width_taper_curve-preset').selectOption('domed');
    assert.equal(await page.locator('#legacy-width_taper_amount_mm').inputValue(),'0.75');
    assert(await page.locator('#legacyStl').isDisabled());await page.locator('#legacyBuild').click();await ready(page);
    const after=await page.evaluate(async()=> (await import('/src/cad-ui.mjs')).cameraState('#legacyWorkbench'));
    for(const key of ['position','target','quaternion','zoom'])assert([].concat(after[key]).every((value,i)=>Math.abs(value-[].concat(before[key])[i])<1e-8),'Rebuild moved camera '+key);
    await page.locator('#legacyCopy').click();const shared=await page.evaluate(()=>__copied),url=new URL(shared);
    assert(url.searchParams.get('depth_taper_curve').includes('0.5,0.5'));assert.equal(url.searchParams.get('depth_taper_amount_mm'),'1');
    await page.goto(shared);await ready(page);await show(page,'depth_taper_curve');
    assert.equal(await page.locator('#legacy-depth_taper_curve-preset').inputValue(),'dished');
    assert.equal(await page.locator('#legacy-width_taper_curve-preset').inputValue(),'domed');
    const custom=page.locator('[data-parameter=depth_taper_curve] .legacy-profile-custom');
    await custom.evaluate(e=>e.open=true);
    const handle=custom.locator('[data-kind=handle][data-index="2"]');await handle.waitFor({state:'visible'});await handle.focus();await handle.press('ArrowUp');
    assert.equal(await page.locator('#legacy-depth_taper_curve-preset').inputValue(),'custom');
    const changed=await page.locator('#legacy-depth_taper_curve').inputValue();
    await custom.evaluate(e=>e.open=false);assert.equal(await page.locator('#legacy-depth_taper_curve').inputValue(),changed);
    await page.locator('#legacyParameters details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
    for(const [label,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(viewport);await show(page,'depth_taper_curve');await page.waitForTimeout(100);await chart(page);
      for(const theme of ['light','dark']){
        await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        await page.screenshot({path:path.join(output,label+'-'+theme+'.png')});
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.locator('#legacy-slot_count').tap();const entry=page.locator('.cad-number-entry input');await entry.waitFor({state:'visible'});
    assert.equal(await entry.getAttribute('inputmode'),'numeric');await entry.fill('2');await page.getByRole('button',{name:'OK',exact:true}).click();
    assert.equal(await page.locator('#legacy-slot_count').inputValue(),'2');assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
    assert.deepEqual(errors,[]);console.log('PASS: mono chart framing, presets, manual builds, camera stability, saved links, custom keyboard editing, shared numeric entry and responsive light/dark');await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
