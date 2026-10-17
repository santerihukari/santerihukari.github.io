const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const runtime=path.resolve(path.dirname(process.execPath),'../node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const {PNG}=require(path.join(runtime,'pngjs'));
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.join(root,'output/legacy-library/hangboard-attachments/browser');
async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:100000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
}
async function edit(page,key,value){await page.locator('#legacy-'+key).evaluate((input,value)=>{
  for(let p=input.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
  input.value=String(value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));
},value);}
const pose=page=>page.evaluate(()=>{const v=document.getElementById('legacyWorkbench').legacyController.viewer;return{position:v.camera.position.toArray(),target:v.controls.target.toArray(),zoom:v.camera.zoom};});
function samePose(actual,expected){for(const key of Object.keys(expected)){const a=[].concat(actual[key]),b=[].concat(expected[key]);assert(a.every((v,i)=>Math.abs(v-b[i])<1e-6),'Parameters changed camera '+key);}}
async function build(page){const camera=await pose(page);await page.locator('#legacyBuild').click();await ready(page);samePose(await pose(page),camera);}
async function exportPair(page,name){
  await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
  for(const format of ['Stl','Glb']){const wait=page.waitForEvent('download');await page.locator('#legacy'+format).click();const file=await wait;await file.saveAs(path.join(output,name+'.'+format.toLowerCase()));assert.equal(await file.failure(),null);await ready(page);}
  await page.locator('#legacyDownloads').evaluate(e=>e.open=false);
}
async function capture(page,name){
  await page.locator('#legacyParameters details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
  await page.waitForTimeout(150);await page.screenshot({path:path.join(output,name+'.png')});
  const png=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let count=0;
  for(let i=0;i<png.data.length;i+=4)if(png.data[i+1]>png.data[i]*1.25&&png.data[i+2]>png.data[i]*1.2&&png.data[i+1]>50)count++;
  assert(count>60,'Model is blank');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('legacyWorkbench').getBoundingClientRect().bottom<=innerHeight+2));
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    await fresh(context.request,base,root);
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/parametric-models/depth-taper-hangboard/?attachment_method=rope_groove&depth_profile_version=1');await ready(page);
    assert.equal(await page.locator('#legacy-rope_side_wall_x').inputValue(),'8');assert.equal(await page.locator('#legacy-back_wall_y').inputValue(),'4');
    assert(await page.locator('[data-parameter=side_wall_x]').isHidden());
    assert.equal(await page.locator('[data-parameter=slot_count] input[type=range]').count(),0);
    assert.equal(await page.locator('#legacy-slot_count').getAttribute('step'),'1');
    assert.equal(await page.locator('#legacy-slot_count').getAttribute('min'),'1');assert.equal(await page.locator('#legacy-slot_count').getAttribute('max'),'6');
    assert(await page.locator('#legacy-upper_slot_depth_y').isVisible());assert(await page.locator('#legacy-slot_depth_y').isVisible());
    assert(await page.locator('#legacy-slot_clearance_between_surfaces-hint').isVisible());assert(await page.locator('#legacy-base_slot_height').isHidden());
    for(const key of ['slot_width_1','riser_height_1']){
      assert.equal(await page.locator(`[data-parameter=${key}] input[type=range]`).count(),0);
      assert.equal(await page.locator('#legacy-'+key).getAttribute('step'),'0.001');
    }
    await edit(page,'slot_count',2.5);assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'invalid');assert(await page.locator('#legacyBuild').isDisabled());
    await edit(page,'slot_count',4);await edit(page,'slot_width_1',19.1234);assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'invalid');
    await edit(page,'slot_width_1',19.123);await page.locator('#legacyCopy').click();assert.equal(new URL(await page.evaluate(()=>__copied)).searchParams.get('slot_width_1'),'19.123');await edit(page,'slot_width_1',19);
    assert.equal(await page.locator('#legacy-rope_diameter').inputValue(),'6');
    await edit(page,'attachment_method','rope_groove');assert(await page.locator('#legacy-rope_diameter').isVisible());assert(await page.locator('[data-parameter=hole_width_x]').isHidden());await build(page);
    await exportPair(page,'rope');await page.locator('#legacyFit').click();await capture(page,'rope-desktop-light');
    await page.locator('[data-view=front]').click();await capture(page,'rope-front-light');await page.locator('[data-view=iso]').click();
    if(process.env.ONLY_ROPE){
      for(const view of ['side','top']){await page.locator('[data-view='+view+']').click();await capture(page,'rope-'+view+'-light');}
      await page.locator('[data-view=iso]').click();
      for(const [name,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
        await page.setViewportSize(size);
        for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await capture(page,'rope-'+name+'-'+theme);}
      }
      assert.deepEqual(errors,[]);await context.close();console.log('PASS current rope controls, stable camera, STL/GLB exports, front/side/top sections and responsive light/dark views');return;
    }
    for(const side of ['top','bottom','both']){
      await edit(page,'attachment_method','single_point');await edit(page,'attachment_side',side);await build(page);
      assert(await page.locator('#legacy-attachment_side').isVisible());assert(await page.locator('[data-parameter=rope_bend_radius]').isHidden());
      const expected=JSON.parse(await fs.readFile(path.join(root,'output/legacy-library/hangboard-profile/current-eyelet'+side[0].toUpperCase()+side.slice(1)+'.json')));
      const metrics=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics);
      assert.deepEqual(metrics,expected.mesh);console.log('PASS central attachment '+side);
    }
    await exportPair(page,'eyeletBoth');await page.locator('#legacyFit').click();await capture(page,'eyelet-desktop-light');
    assert.equal(await page.locator('#legacy-eyelet_depth_offset_mm').inputValue(),'0');
    await edit(page,'eyelet_depth_offset_mm',27);assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'invalid');assert(await page.locator('#legacyBuild').isDisabled());
    await edit(page,'eyelet_depth_offset_mm',8);await build(page);
    const shifted=JSON.parse(await fs.readFile(path.join(root,'output/legacy-library/hangboard-profile/current-eyeletOffset.json')));
    assert.deepEqual(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),shifted.mesh);
    await exportPair(page,'eyeletOffset');await page.locator('#legacyCopy').click();const eyeletLink=await page.evaluate(()=>__copied);
    assert.equal(new URL(eyeletLink).searchParams.get('eyelet_depth_offset_mm'),'8');
    await page.goto(eyeletLink);await ready(page);assert.equal(await page.locator('#legacy-eyelet_depth_offset_mm').inputValue(),'8');
    await edit(page,'attachment_method','rope_groove');
    await edit(page,'width_taper_curve','0,1|0.5,1.15|1,1');
    assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
    await page.locator('[data-parameter=width_taper_curve] .legacy-profile-custom').evaluate(e=>e.open=true);
    const curve=page.locator('[data-parameter=width_taper_curve] .legacy-profile-custom canvas');await curve.waitFor({state:'visible'});const box=await curve.boundingBox();
    // End anchors cannot be dragged away from their baseline.
    await page.mouse.move(box.x+12,box.y+8+(1.5-1)*(box.height-20));await page.mouse.down();await page.mouse.move(box.x+12,box.y+12,{steps:3});await page.mouse.up();
    assert((await page.locator('#legacy-width_taper_curve').inputValue()).startsWith('0,1|'));
    await edit(page,'width_taper_curve','0,1|0.5,1.15|1,1');await build(page);
    await exportPair(page,'widthRope');
    await page.locator('#legacyCopy').click();const link=await page.evaluate(()=>__copied),shared=new URL(link);
    assert.equal(shared.searchParams.get('attachment_method'),'rope_groove');assert.equal(shared.searchParams.get('width_taper_curve'),'0,1|0.5,1.15|1,1');
    await page.goto(link);await ready(page);assert.equal(await page.locator('#legacy-width_taper_curve').inputValue(),'0,1|0.5,1.15|1,1');
    for(const [name,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(size);
      for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await capture(page,'width-rope-'+name+'-'+theme);}
    }
    await page.setViewportSize({width:1440,height:900});
    await edit(page,'attachment_method','diamond');await edit(page,'width_taper_curve','0,1|0.5,1.1|1,1');await edit(page,'depth_taper_curve','0,1|0.5,1.05|1,1');await build(page);await exportPair(page,'widthDepth');
    await edit(page,'width_taper_curve','0,1|1,1');await edit(page,'depth_taper_curve','0,1|1,1');
    await edit(page,'slot_depth_y',16);await edit(page,'upper_slot_depth_y',32);await build(page);
    const independent=JSON.parse(await fs.readFile(path.join(root,'output/legacy-library/hangboard-profile/current-upperDeep.json')));
    assert.deepEqual(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),independent.mesh);
    await exportPair(page,'upperDeep');
    await page.locator('#legacyCopy').click();const depthLink=await page.evaluate(()=>__copied);assert.equal(new URL(depthLink).searchParams.get('upper_slot_depth_y'),'32');
    await page.goto(depthLink);await ready(page);assert.equal(await page.locator('#legacy-slot_depth_y').inputValue(),'16');assert.equal(await page.locator('#legacy-upper_slot_depth_y').inputValue(),'32');
    await page.goto(base+'/parametric-models/depth-taper-hangboard/?attachment_method=single_point&slot_count=1&riser_height_1=0&depth_profile_version=1');await ready(page);
    const one=JSON.parse(await fs.readFile(path.join(root,'output/legacy-library/hangboard-profile/current-eyeletOneSlot.json')));
    assert.deepEqual(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),one.mesh);
    await exportPair(page,'eyeletOneSlot');await capture(page,'eyelet-single-platform-light');
    assert.deepEqual(errors,[]);await context.close();console.log('PASS attachment depth offsets, validation, numeric-only controls, independent depths, single-platform reinforcement, manual updates, stable camera, share restoration, seven STL/GLB pairs and responsive light/dark views');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
