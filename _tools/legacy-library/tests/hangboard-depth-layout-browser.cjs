const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const runtime=path.resolve(path.dirname(process.execPath),'../node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const {PNG}=require(path.join(runtime,'pngjs'));
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const fixture=process.env.DEPTH_BROWSER_CASE||'rope';
const output=path.join(root,'output/legacy-library/depth-layout/browser',fixture==='rope'?'':fixture);
async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:110000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
}
async function edit(page,key,value){
  await page.locator('#legacy-'+key).evaluate((e,value)=>{
    if(e.type==='checkbox')e.checked=Boolean(Number(value));else e.value=String(value);
    e.dispatchEvent(new Event(e.tagName==='SELECT'||e.type==='checkbox'?'change':'input',{bubbles:true}));
  },value);
}
const camera=page=>page.evaluate(async()=> (await import('/src/cad-ui.mjs')).cameraState('#legacyWorkbench'));
async function capture(page,name){
  const bytes=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let colored=0;
  for(let i=0;i<bytes.data.length;i+=4)if(bytes.data[i+1]>bytes.data[i]*1.2&&bytes.data[i+2]>bytes.data[i]*1.15)colored++;
  assert(colored>100,'Blank model canvas');await page.screenshot({path:path.join(output,name+'.png')});
}
(async()=>{
  await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const provenance=await fresh(context.request,base,root),expected=JSON.parse(await fs.readFile(path.join(root,'output/legacy-library/depth-layout',fixture+'.json')));
    assert.equal(expected.sourceHash,provenance.files['src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js']);
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/parametric-models/depth-taper-hangboard/');await ready(page);
    assert.equal(await page.locator('#legacy-depth_profile_version').inputValue(),'3');assert.equal(await page.locator('#legacy-back_wall_y').inputValue(),'2');
    assert.equal(await page.locator('#legacy-back_wall_y').getAttribute('min'),'0');
    const before=await camera(page);
    for(const [key,value]of Object.entries(expected.params))if(await page.locator('#legacy-'+key).count())await edit(page,key,value);
    assert(await page.locator('#legacyStl').isDisabled());assert(await page.locator('#legacyGlb').isDisabled());
    await page.locator('#legacyBuild').click();await ready(page);
    const after=await camera(page);
    for(const key of ['position','target','quaternion','zoom'])assert([].concat(after[key]).every((value,i)=>Math.abs(value-[].concat(before[key])[i])<1e-8),'Rebuild changed camera '+key);
    const profiles=await page.evaluate(()=>{
      const controller=document.getElementById('legacyWorkbench').legacyController;
      return controller.meta.params.find(p=>p.key==='depth_taper_curve').roundedProfile(controller.params).profiles;
    });
    for(const profile of profiles){
      const back=profile.segments.at(-1),end=back.points.at(-1).y,tangent=back.points[0].y;
      assert.equal(Math.sign(end-tangent),expected.params.back_wall_y===0?-1:1,'Rear rounding has the wrong direction');
      assert.equal(profile.fixed[4].y,end,'Editor endpoint disagrees with geometry');
    }
    const editor=page.locator('.legacy-depth-editor').first();
    await editor.evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    await editor.screenshot({path:path.join(output,'depth-profile.png')});
    const metrics=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics);
    for(const key of ['min','max'])for(let i=0;i<3;i++)assert(Math.abs(metrics[key][i]-expected.metrics[key][i])<0.001);
    assert(Math.abs(metrics.volume-expected.metrics.volume)/expected.metrics.volume<0.0001);
    await page.locator('#legacy-rope_position_percent').evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    assert.equal(await page.locator('#legacy-rope_position_percent').isVisible(),expected.params.attachment_method==='rope_groove');assert(await page.locator('#legacy-rope_depth_offset_mm').isHidden());
    assert.equal(await page.locator('#legacy-rope_position_percent').inputValue(),'50');
    await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
    for(const format of ['Stl','Glb']){
      const pending=page.waitForEvent('download');await page.locator('#legacy'+format).click();const download=await pending;
      await download.saveAs(path.join(output,fixture+'.'+format.toLowerCase()));assert.equal(await download.failure(),null);await ready(page);
    }
    await page.locator('#legacyDownloads').evaluate(e=>e.open=false);
    await page.locator('#legacyParameters details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
    await page.locator('[data-view=side]').click();await capture(page,'side-light');await page.locator('[data-view=iso]').click();
    for(const [label,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(size);await page.waitForTimeout(200);
      for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await capture(page,label+'-'+theme);}
      if(label!=='desktop'){
        assert(Math.abs((await page.locator('#legacyCanvas').boundingBox()).height-size.height/2)<1);
        await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(250);
        assert(await page.locator('#legacyWorkbench aside').isHidden());assert(Math.abs((await page.locator('#legacyCanvas').boundingBox()).height-size.height)<1);
        await capture(page,label+'-fullscreen');await page.locator('.cad-fullscreen-button').click();
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.locator('#legacyCopy').click();const shared=await page.evaluate(()=>__copied),url=new URL(shared);
    assert.equal(url.searchParams.get('rope_position_percent'),'50');assert.equal(url.searchParams.get('back_wall_y'),String(expected.params.back_wall_y));assert.equal(url.searchParams.get('depth_profile_version'),'3');
    await page.goto(shared);await ready(page);
    for(const key of ['slot_depth_y','upper_slot_depth_y'])assert.equal(await page.locator('#legacy-'+key).inputValue(),String(expected.params[key]));
    assert.equal(await page.locator('#legacy-back_wall_y').inputValue(),String(expected.params.back_wall_y));
    await edit(page,expected.params.attachment_method==='rope_groove'?'rope_position_percent':'back_wall_y',expected.params.attachment_method==='rope_groove'?0:-1);
    assert(await page.locator('#legacyBuild').isDisabled());assert(await page.locator('#legacyStl').isDisabled());
    assert.deepEqual(errors,[]);console.log('PASS manual regeneration, no camera reset, percentage controls, native mesh agreement, STL/GLB, parameter links and desktop/mobile light/dark/fullscreen');
    await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
