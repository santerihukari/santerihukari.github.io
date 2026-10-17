const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const root=path.resolve(__dirname,'../..'),output=path.join(root,'output/t4-engine');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function run(){
  const url=process.env.ENGINE_URL||'http://127.0.0.1:4000/tools/t4-engine/',site=new URL('../../',url).href;
  const label=process.env.QA_LABEL||'site',browser=await chromium.launch({headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--mute-audio']});
  await fs.mkdir(output,{recursive:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
    const errors=[],requests=[],failures=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
    page.on('response',response=>{if(response.status()>=400)failures.push(response.url());});
    const snapshot=()=>page.evaluate(()=>window.engineInspection.snapshot());
    await page.goto(url);await page.waitForFunction(()=>document.querySelector('#t4Engine')?.dataset.state!=='loading');
    assert.equal(await page.locator('#t4Engine').getAttribute('data-state'),'ready',await page.locator('#error').textContent());
    const initial=await snapshot(),manifest=JSON.parse(await fs.readFile(path.join(root,'assets/models/vw-t4-engine/r6/manifest.json'),'utf8'));
    assert.equal(initial.partCount,271);assert.equal(initial.snapshotRevision,6);assert.equal(initial.timingCover,false);
    assert.deepEqual(initial.partIds.sort(),manifest.parts.map(part=>part.id).sort());
    assert.equal(initial.audio.contextCreated,false);assert.equal(initial.audio.enabled,false);
    assert.equal(await page.locator('#geometry-fields input,#apply,[name=timing_cover]').count(),0);
    assert(!requests.some(request=>/\.(step|zip|stl)(?:\?|$)/.test(request.url)),'Heavy exports loaded before a download was requested');
    const publication=JSON.parse(await fs.readFile(path.join(root,'assets/models/vw-t4-engine/r6/publication.json'),'utf8'));
    for(const file of publication.files){
      const local=await fs.readFile(path.join(root,file.path));assert.equal(hash(local),file.sha256,file.path+' frozen hash');
    }
    for(const file of ['src/t4-engine/app.mjs','src/t4-engine/bootstrap.mjs','assets/css/modules/t4-engine.css']){
      const response=await context.request.get(new URL(file,site).href);assert.equal(response.status(),200);
      assert.equal(hash(await response.body()),hash(await fs.readFile(path.join(root,file))),file+' served stale');
    }
    async function pixels(){
      const png=PNG.sync.read(await page.locator('#viewport>canvas:not(#axis-indicator)').screenshot());let colored=0,checksum=0;
      for(let i=0;i<png.data.length;i+=16){if(Math.max(...png.data.subarray(i,i+3))-Math.min(...png.data.subarray(i,i+3))>14)colored++;checksum=(checksum+png.data[i]*(i%101+1))%1000000007;}
      return{colored,checksum};
    }
    assert((await pixels()).colored>1000,'Blank engine canvas');
    await page.locator('#cutaway').check();await page.locator('#play').click();await page.waitForTimeout(500);
    const before=await snapshot(),first=await pixels();await page.waitForTimeout(450);const after=await snapshot(),second=await pixels();
    assert.notEqual(before.angle,after.angle);assert.notDeepEqual(before.pistonMatrices,after.pistonMatrices);assert.notEqual(first.checksum,second.checksum);
    for(const key of ['camera','target'])assert(Math.hypot(...before[key].map((value,i)=>value-after[key][i]))<1e-6,'Animation moved '+key);await page.locator('#play').click();
    const dynamic=await page.locator('#play img').getAttribute('src');assert.equal((await context.request.get(dynamic)).status(),200);
    for(const view of ['timing','fuel','top','iso']){await page.locator(`[data-view=${view}]`).click();assert((await pixels()).colored>200);}
    await page.locator('#part-search').fill('crankshaft');await page.locator('[data-part=crankshaft] button').click();
    await page.locator('#isolate').check();assert.match(await page.locator('#selection-name').textContent(),/Crankshaft/);
    const downloads=[['glb','engine_assembly.glb'],['step','engine_assembly.step'],['zip','engine_parts.zip'],['part','parts/crankshaft.stl']];
    for(const [id,file]of downloads){
      const href=await page.locator('#download-'+id).getAttribute('href');assert.equal(href,new URL('assets/models/vw-t4-engine/r6/'+file,site).href);
      const pending=page.waitForEvent('download');await page.locator('#download-'+id).click();const download=await pending;
      const destination=path.join(output,label+'-'+path.basename(file));await download.saveAs(destination);assert.equal(await download.failure(),null);
      const expected=publication.files.find(item=>item.path.endsWith('/'+file));assert.equal(hash(await fs.readFile(destination)),expected.sha256);
    }
    await page.locator('#show-all').click();await page.locator('#part-search').fill('');
    await page.locator('#interfaces').check();await page.locator('#labels').check();
    if(process.env.WRITE_PREVIEW==='1'){
      await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>{
        document.documentElement.dataset.theme='light';
        const workbench=document.querySelector('.engine-workbench');workbench.style.gridTemplateColumns='244px 960px 274px';workbench.style.height='950px';
        const viewport=document.getElementById('viewport');viewport.style.flex='none';viewport.style.height='720px';
      });
      await page.locator('#labels').uncheck();await page.locator('#interfaces').uncheck();await page.locator('#fit').click();
      await page.locator('#viewport').evaluate(element=>element.querySelector('#labels-overlay').style.display='none');
      await page.waitForTimeout(200);
      await page.locator('#viewport>canvas:not(#axis-indicator)').screenshot({path:path.join(root,'assets/images/project-previews/vw-t4-engine.png')});
      await page.reload();await page.waitForFunction(()=>document.querySelector('#t4Engine')?.dataset.state==='ready');
    }
    for(const [size,width,height]of [['desktop',1440,1000],['mobile',390,844],['narrow',320,700],['landscape',844,390]]){
      await page.setViewportSize({width,height});await page.locator('#fit').click();await page.waitForTimeout(100);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),size+' overflows horizontally');
      for(const theme of ['light','dark']){
        await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.waitForTimeout(100);
        assert((await pixels()).colored>250,'Blank '+size+' '+theme+' model');
        await page.screenshot({path:path.join(output,label+'-'+size+'-'+theme+'.png')});
      }
    }
    const errorPage=await context.newPage();
    await errorPage.route('**/engine_assembly.glb',route=>route.fulfill({status:503,body:'Unavailable'}));
    await errorPage.goto(url);await errorPage.waitForFunction(()=>document.querySelector('#t4Engine')?.dataset.state==='error');
    assert(await errorPage.locator('#error').isVisible());assert.equal(await errorPage.locator('#download-glb').getAttribute('href'),null);await errorPage.close();
    const fallback=await context.newPage();await fallback.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};
    });
    await fallback.goto(url);await fallback.waitForFunction(()=>document.querySelector('#t4Engine')?.dataset.state==='error');assert(await fallback.locator('#error').isVisible());await fallback.close();
    const projectPage=await context.newPage();
    for(const [route,link]of [['projects/volkswagen-t4-repairs/','projects/vw-t4-engine-simulation/'],['projects/vw-t4-engine-simulation/','tools/t4-engine/'],['projects/parametric-cad/','parametric-models/crimp-hold/']]){
      const response=await projectPage.goto(new URL(route,site).href);assert.equal(response.status(),200);
      assert(await projectPage.locator(`main a[href="${new URL(link,site).pathname}"]`).count()>0,'Missing project link '+link);
      if(route.includes('volkswagen-t4')){
        const preview=projectPage.locator('main .work-row__image[src$="vw-t4-engine.png"]');assert.equal(await preview.count(),1);
        await preview.scrollIntoViewIfNeeded();await preview.evaluate(image=>image.decode());assert.equal(await preview.evaluate(image=>image.naturalWidth),960);
        for(const width of [1440,390]){await projectPage.setViewportSize({width,height:1000});assert(await projectPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
      }
    }
    const crimp=await projectPage.goto(new URL('parametric-models/crimp-hold/',site).href);assert.equal(crimp.status(),200);
    assert.equal(await projectPage.locator('select option[value$="/parametric-models/crimp-hold/"]').count(),1);await projectPage.close();
    assert(!requests.some(request=>request.method!=='GET'||/\/api\/|\/model-files\/|:8770|\/download\/default\//.test(request.url)),'A local-service request remains');
    assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,label+'-report.json'),JSON.stringify({url,parts:271,immutableDownloads:true,allPartMappings:true,readOnlyGeometry:true,
      desktopMobileThemes:true,animatedCanvas:true,cameraStable:true,webglFallback:true,loadError:true,noLocalApi:true,errors},null,2));
    await context.close();console.log('PASS: frozen assets, all 271 IDs, lazy matching exports, animation, camera, desktop/mobile themes and error states at '+url);
  }finally{await browser.close();}
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
