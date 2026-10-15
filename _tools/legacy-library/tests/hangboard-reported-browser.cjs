const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
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
async function capture(page,name){
  await page.locator('#legacyParameters details').evaluateAll(nodes=>nodes.forEach(e=>e.open=false));
  await page.waitForTimeout(150);await page.screenshot({path:path.join(output,name+'.png')});
  const png=PNG.sync.read(await page.locator('#legacyCanvas').screenshot());let pixels=0;
  for(let i=0;i<png.data.length;i+=4)if(png.data[i+1]>png.data[i]*1.25&&png.data[i+2]>png.data[i]*1.2&&png.data[i+1]>50)pixels++;
  assert(pixels>60,'The curved model must be visible');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('legacyWorkbench').getBoundingClientRect().bottom<=innerHeight+2));
}
function sameGeometry(actual,expected){
  for(const key of ['min','max'])for(let axis=0;axis<3;axis++)assert(Math.abs(actual[key][axis]-expected[key][axis])<0.0001,'Changed '+key+' bound');
  // OCCT may triangulate sewn rational faces differently in Node and Chromium.
  // Solid probes are checked natively; each browser STL/GLB pair is compared independently.
  assert(actual.triangles>0);
  assert(Math.abs(actual.volume-expected.volume)/expected.volume<0.00001,'Changed mesh volume');
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const {featureCases}=await import(pathToFileURL(path.join(__dirname,'hangboard-profile.mjs')));
  const name=process.env.HANGBOARD_CASE||'roundedCurve';
  assert(Object.hasOwn(featureCases,name),'Unknown hangboard feature case');
  const params=featureCases[name],url=new URL(base+'/parametric-models/depth-taper-hangboard/');
  for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const expected=JSON.parse(await fs.readFile(path.join(root,`output/legacy-library/hangboard-profile/current-${name}.json`)));
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const provenance=await fresh(context.request,base,root);
    assert.equal(expected.sourceHash,provenance.files['src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js'],'Regenerate the native fixture first');
    await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url.href);await ready(page);
    sameGeometry(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),expected.mesh);
    const warnings=await page.locator('#legacyWarningText').textContent();
    assert(!/Depth taper pushes|rolling-ball fillet failed|No .*slot-profile edges/.test(warnings),warnings);
    if(params.attachment_method==='rope_groove')assert(warnings.includes('Experimental perimeter'));
    assert.match(await page.locator('#legacy-width_taper_amount_mm-hint').textContent(),/lifts automatically/);
    await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
    for(const format of ['Stl','Glb']){
      const wait=page.waitForEvent('download');await page.locator('#legacy'+format).click();const file=await wait;
      await file.saveAs(path.join(output,name+'.'+format.toLowerCase()));assert.equal(await file.failure(),null);await ready(page);
    }
    await page.locator('#legacyDownloads').evaluate(e=>e.open=false);
    await page.locator('[data-view=front]').click();await capture(page,name+'-front-light');
    await page.locator('[data-view=iso]').click();
    for(const [viewportName,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]){
      await page.setViewportSize(size);
      for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await capture(page,name+'-'+viewportName+'-'+theme);}
    }
    await page.locator('#legacyCopy').click();const shared=await page.evaluate(()=>__copied);
    for(const [key,value]of Object.entries(params))assert.equal(new URL(shared).searchParams.get(key),String(value));
    await page.goto(shared);await ready(page);
    sameGeometry(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics),expected.mesh);
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS '+name+': exact curves, automatic lift, front/back rounding, current STL/GLB downloads, share restoration and desktop/mobile light/dark views');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
