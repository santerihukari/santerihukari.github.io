const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const runtime=path.resolve(path.dirname(process.execPath),'../node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const sharp=require(path.join(runtime,'sharp'));
const root=path.resolve(__dirname,'../../..');
const base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.join(root,'output/legacy-library');
const modelFilter=process.env.MODEL_KEY;
const fresh=require('./fresh.cjs');

async function ready(page){
  await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:180000});
  const state=await page.locator('#legacyWorkbench').getAttribute('data-state');
  assert.equal(state,'ready',await page.locator('#legacyError').textContent());
  await page.waitForFunction(()=>Boolean(document.getElementById('legacyWorkbench').legacyController));
}
async function camera(page){return page.evaluate(()=>{const {camera,controls}=document.getElementById('legacyWorkbench').legacyController.viewer;return{position:camera.position.toArray(),target:controls.target.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom};});}
async function settle(page){await page.waitForTimeout(400);return camera(page);}
function sameCamera(actual,expected,label){for(const key of Object.keys(expected)){const a=[].concat(actual[key]),b=[].concat(expected[key]);assert(a.every((value,i)=>Math.abs(value-b[i])<1e-5),`${label}: ${key} changed`);}}
async function edit(page,key,value){await page.locator(`#legacy-${key}`).evaluate((input,value)=>{for(let p=input.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;input.value=String(value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));},value);}
async function screenshot(page,name){
  await page.waitForTimeout(150);await page.screenshot({path:path.join(output,`${name}.png`)});
  const buffer=await page.locator('#legacyCanvas').screenshot(),{data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let teal=0;for(let i=0;i<data.length;i+=info.channels)if(data[i+1]>data[i]*1.25&&data[i+2]>data[i]*1.2&&data[i+1]>50)teal++;
  assert(teal>50,`${name}: no visible teal model pixels (${teal})`);
  const layout=await page.evaluate(()=>{const r=document.getElementById('legacyWorkbench').getBoundingClientRect(),c=document.getElementById('legacyCanvas').getBoundingClientRect();return{bottom:r.bottom,right:r.right,width:innerWidth,height:innerHeight,canvas:[c.width,c.height],overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert(!layout.overflow,`${name}: horizontal overflow`);assert(layout.bottom<=layout.height+2,`${name}: workbench exceeds viewport ${JSON.stringify(layout)}`);
  assert(layout.canvas[0]>150&&layout.canvas[1]>120,`${name}: collapsed viewport`);
  return {teal,...layout};
}
async function download(page,format,slug){
  await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
  const waiting=page.waitForEvent('download',{timeout:90000});await page.locator(format==='stl'?'#legacyStl':'#legacyGlb').click();
  const file=await waiting,target=path.join(output,`${slug}.${format}`);await file.saveAs(target);const bytes=await fs.readFile(target);
  assert(bytes.length>84);
  if(format==='glb'){
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
    assert(json.meshes.length>0);assert(json.materials.length>0);assert(json.nodes.some(n=>n.extras?.model));
  }else assert(bytes.subarray(0,80).toString().startsWith('solid')||84+bytes.readUInt32LE(80)*50===bytes.length);
  await ready(page);await page.locator('#legacyDownloads').evaluate(e=>e.open=false);return bytes.length;
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const {catalogue}=await import(pathToFileURL(path.join(root,'src/legacy_library/catalogue.mjs')).href);
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.BROWSER_EXECUTABLE});const results=[];
  try{
    const check=await browser.newContext();await fresh(check.request,base,root);await check.close();
    for(const [key,definition]of Object.entries(catalogue)){
      if(modelFilter&&key!==modelFilter)continue;
      const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
      const page=await context.newPage(),errors=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',response=>{if(response.status()>=400&&!response.url().includes('favicon'))failed.push([response.status(),response.url()]);});
      await page.goto(`${base}/parametric-models/${definition.slug}/`,{waitUntil:'domcontentloaded'});await ready(page);
      const metrics=await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics);
      assert(metrics.triangles>0);assert(metrics.volume>0);
      assert(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.viewer.camera.isOrthographicCamera));
      assert.equal(await page.locator('#legacyWorkbench .cad-coordinate-indicator').count(),1);
      assert.equal(await page.locator('#legacyWorkbench [data-view]').count(),5);
      assert.equal(await page.locator('#cadModel').inputValue(),`/parametric-models/${definition.slug}/`);
      assert.equal(await page.locator('.parametric-libraries [aria-current=page]').textContent(),'New library');
      const captures={};
      for(const [viewportName,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
        await page.setViewportSize(viewport);
        for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);captures[`${viewportName}-${theme}`]=await screenshot(page,`${key}-${viewportName}-${theme}`);}
      }
      await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='light');
      const before=await settle(page);
      await page.locator('#legacyParameters>details').first().evaluate(e=>e.open=true);await page.waitForTimeout(100);sameCamera(await camera(page),before,'fold must not refit');
      await page.locator('#legacyParameters>details').first().evaluate(e=>e.open=false);
      const stl=await download(page,'stl',definition.slug),glb=await download(page,'glb',definition.slug);
      sameCamera(await camera(page),before,'exports must not refit');
      if(key==='organizer'){
        await edit(page,'width','');assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'invalid');assert(await page.locator('#legacyStl').isDisabled());assert(await page.locator('#legacyGlb').isDisabled());
        await edit(page,'width',130);await edit(page,'width',132);assert(await page.locator('#legacyStl').isDisabled());await ready(page);
        assert.equal(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.metrics.max[0]),132);
        sameCamera(await camera(page),before,'parameter edit must not refit');
        const full=page.locator('.cad-fullscreen-button');await full.click();await page.waitForTimeout(250);
        assert.equal(await page.locator('.cad-app #cadModel').count(),1);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
        await full.click();await page.waitForTimeout(200);
        const shared=await page.evaluate(async()=>{const c=document.getElementById('legacyWorkbench').legacyController,{modelLink}=await import('/src/legacy_library/parameters.mjs');return modelLink(c.key,c.meta,c.params,location.href);});
        await page.goto(shared);await ready(page);assert.equal(await page.locator('#legacy-width').inputValue(),'132');
      }
      if(key==='vase_spline'){
        await edit(page,'profile_sides',6);assert.equal(await page.locator('[data-parameter=edge_curve]').evaluate(e=>e.hidden),false);await edit(page,'profile_sides','circle');await ready(page);
        const curve=page.locator('[data-parameter=radius_curve] canvas');await curve.evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});const box=await curve.boundingBox();const previous=await page.locator('#legacy-radius_curve').inputValue();
        await page.mouse.move(box.x+box.width/2,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.58,box.y+box.height*.5,{steps:3});await page.mouse.up();
        assert.notEqual(await page.locator('#legacy-radius_curve').inputValue(),previous);await ready(page);
        await edit(page,'radius_curve','0,35.123456789|0.5,50|1,30');await ready(page);assert.equal(await page.locator('#legacy-radius_curve').inputValue(),'0,35.123456789|0.5,50|1,30');
        await edit(page,'radius_curve','0,NaN|1,30');assert(await page.locator('#legacyStl').isDisabled());
      }
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      results.push({key,metrics,stlBytes:stl,glbBytes:glb,captures});console.log(JSON.stringify({key,status:'passed',triangles:metrics.triangles,stlBytes:stl,glbBytes:glb}));await context.close();
    }
    // Prefix harness serves the actual built bytes under a second path without owning a server/build.
    if(!modelFilter||modelFilter==='organizer'){
      const context=await browser.newContext();await context.route('**/legacy-prefix/**',async route=>{
        const url=new URL(route.request().url()),relative=decodeURIComponent(url.pathname.slice('/legacy-prefix/'.length));
        let file=path.resolve(root,'_site',relative);assert(file.startsWith(path.resolve(root,'_site')+path.sep));
        if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
        const ext=path.extname(file);let body=await fs.readFile(file);
        if(ext==='.html')body=Buffer.from(body.toString().replace(/(["'])\/(?!\/)/g,'$1/legacy-prefix/'));
        await route.fulfill({status:200,body,contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream'});
      });
      const page=await context.newPage();await page.goto(`${base}/legacy-prefix/parametric-models/grid-organizer/`);await ready(page);
      assert(page.url().includes('/legacy-prefix/parametric-models/grid-organizer/'));await context.close();console.log('Prefix worker/kernel/assets and canonical link passed');
    }
    await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(results,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
