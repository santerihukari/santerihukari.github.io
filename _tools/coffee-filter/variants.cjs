const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'output/coffee-filter/variants');
const base=process.env.SITE_URL||'http://127.0.0.1:4000';
async function ready(page){await page.waitForFunction(()=>document.getElementById('modelStatus')?.textContent==='Ready',null,{timeout:30000});}
async function download(page,id,name){await page.locator('#coffeeDownloads').evaluate(e=>e.open=true);const pending=page.waitForEvent('download');await page.locator('#'+id).click();const item=await pending;await item.saveAs(path.join(output,name));return fs.readFile(path.join(output,name));}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const parameters=await import(pathToFileURL(path.join(root,'src/coffee_filter/parameters.mjs'))),links=await import(pathToFileURL(path.join(root,'src/coffee_filter/model-link.mjs')));
  const {buildHolder}=await import(pathToFileURL(path.join(root,'src/coffee_filter/geometry.mjs')));
  const {default:create}=await import(pathToFileURL(path.join(root,'assets/cad/coffee-filter/manifold/manifold.js')));
  const module=await create();module.setup();
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}}));
    const manifest=[];
    for(const layout of ['symmetric','side_rest','side_rest_right'])for(const profile of ['measured','right_angle']){
      const values={...parameters.selectProfile(parameters.selectLayout(parameters.defaults,layout),profile),mounting:'free_standing'};
      const fixture=buildHolder(module,values),name=`${layout}-${profile}`;
      await page.goto(links.createModelLink(`${base}/parametric-models/`,values));await ready(page);
      const bytes=await download(page,'downloadStl',`${name}.stl`);assert.equal(bytes.length,84+bytes.readUInt32LE(80)*50);
      await download(page,'downloadGlb',`${name}.glb`);
      await page.locator('#copyModelLink').click();const copy=await page.evaluate(()=>window.__copied);
      assert.deepEqual(links.readModelLink(copy).parameters,values);assert.equal(links.readModelLink(copy).preview.density,200/17);
      manifest.push({name,parameters:values,bounds:fixture.bounds,volume:fixture.volume});
      await page.screenshot({path:path.join(output,`${name}.png`)});
      console.log(`PASS ${name}: browser STL/GLB, full parameter link, 20-sheet preview`);
    }
    await fs.writeFile(path.join(output,'expected.json'),JSON.stringify(manifest,null,2));
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
