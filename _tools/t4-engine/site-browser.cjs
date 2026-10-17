const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const root=path.resolve(__dirname,'../..'),output=path.join(root,'output/t4-engine');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const models=[{key:'default',name:'engine',directory:'vw-t4-engine/r7',revision:7,parts:271,part:'crankshaft'},
  {key:'powertrain',name:'powertrain',directory:'vw-t4-powertrain/r8',revision:8,parts:398,part:'drive_rim_left'}];
async function run(){
  const url=process.env.ENGINE_URL||'http://127.0.0.1:4000/tools/t4-engine/',site=new URL('../../',url).href;
  const label=process.env.QA_LABEL||'update-site',browser=await chromium.launch({headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--mute-audio']});
  await fs.mkdir(output,{recursive:true});const report={url,models:[],errors:[]};
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    const ready=async page=>{await page.waitForFunction(()=>document.querySelector('#t4Engine')?.dataset.state!=='loading');
      assert.equal(await page.locator('#t4Engine').getAttribute('data-state'),'ready',await page.locator('#error').textContent());};
    const modelUrl=model=>{const target=new URL(url);if(model.key==='powertrain')target.searchParams.set('assembly','powertrain');else target.searchParams.delete('assembly');return target.href;};
    async function pixels(page){
      const png=PNG.sync.read(await page.locator('#viewport>canvas:not(#axis-indicator)').screenshot());let colored=0,checksum=0;
      for(let i=0;i<png.data.length;i+=16){if(Math.max(...png.data.subarray(i,i+3))-Math.min(...png.data.subarray(i,i+3))>14)colored++;checksum=(checksum+png.data[i]*(i%101+1))%1000000007;}
      return{colored,checksum};
    }
    async function layout(page){
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
      const problems=await page.locator('.motion,.rpm-control,.drive-row,.drive-split').evaluateAll(rows=>{
        const issues=[];
        for(const row of rows){
          if(!row.getClientRects().length)continue;
          const parent=row.getBoundingClientRect(),children=[...row.children].filter(child=>child.getClientRects().length).map(child=>child.getBoundingClientRect());
          if(children.some(rect=>rect.left<parent.left-1||rect.right>parent.right+1))issues.push(row.className+' child outside row');
          for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
            const a=children[i],b=children[j];if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)issues.push(row.className+' overlapping controls');
          }
        }return issues;
      });assert.deepEqual(problems,[]);
    }
    for(const model of models){
      const page=await context.newPage(),errors=[],failures=[],requests=[];
      page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      page.on('request',request=>requests.push({url:request.url(),method:request.method()}));page.on('response',response=>{if(response.status()>=400)failures.push(response.url());});
      await page.goto(modelUrl(model));await ready(page);const snapshot=()=>page.evaluate(()=>window.engineInspection.snapshot());
      const initial=await snapshot(),manifest=JSON.parse(await fs.readFile(path.join(root,'assets/models',model.directory,'manifest.json'),'utf8'));
      assert.equal(initial.partCount,model.parts);assert.equal(initial.snapshotRevision,model.revision);assert.equal(initial.timingCover,false);assert.equal(initial.cutaway,true);
      assert.deepEqual(initial.partIds.sort(),manifest.parts.map(part=>part.id).sort());assert.equal(initial.audio.contextCreated,false);assert.equal(initial.audio.enabled,false);assert.equal(initial.playing,false);
      assert.equal(await page.locator('.audio-source input:checked').count(),0);assert.equal(await page.locator('#geometry-fields input,#drive-geometry-fields input,#apply,[name=timing_cover]').count(),0);
      assert(!requests.some(request=>/\.(step|zip|stl)(?:\?|$)/.test(request.url)),'Exports fetched before request');
      const glbs=requests.filter(request=>request.url.endsWith('.glb'));assert.equal(glbs.length,1);assert.equal(glbs[0].url,new URL('assets/models/'+model.directory+'/engine_assembly.glb',site).href);
      for(const file of ['src/t4-engine/app.mjs','src/t4-engine/bootstrap.mjs','assets/css/modules/t4-engine.css']){
        const response=await context.request.get(new URL(file,site).href);assert.equal(response.status(),200);
        assert.equal(hash(await response.body()),hash(await fs.readFile(path.join(root,file))),file+' served stale');
      }
      assert((await pixels(page)).colored>500,'Blank canvas');await page.locator('#play').click();await page.waitForTimeout(300);
      const before=await snapshot(),first=await pixels(page);await page.waitForTimeout(300);const after=await snapshot(),second=await pixels(page);
      assert.notEqual(before.angle,after.angle);assert.notDeepEqual(before.pistonMatrices,after.pistonMatrices);assert.notEqual(first.checksum,second.checksum);
      for(const key of ['camera','target'])assert(Math.hypot(...before[key].map((value,i)=>value-after[key][i]))<1e-6,'Animation moved '+key);
      await page.locator('#play').click();assert.equal((await context.request.get(await page.locator('#play img').getAttribute('src'))).status(),200);
      for(const view of ['timing','fuel','top','iso']){await page.locator(`[data-view=${view}]`).click();assert((await pixels(page)).colored>200);}
      await page.locator('#part-search').fill(model.part);await page.locator(`[data-part=${model.part}] button`).click();await page.locator('#isolate').check();
      const publication=JSON.parse(await fs.readFile(path.join(root,'assets/models',model.directory,'publication.json'),'utf8'));
      for(const [id,file]of [['glb','engine_assembly.glb'],['step','engine_assembly.step'],['zip','engine_parts.zip'],['part','parts/'+model.part+'.stl']]){
        assert.equal(await page.locator('#download-'+id).getAttribute('href'),new URL('assets/models/'+model.directory+'/'+file,site).href);
        const pending=page.waitForEvent('download');await page.locator('#download-'+id).click();const download=await pending;
        const destination=path.join(output,label+'-'+model.name+'-'+path.basename(file));await download.saveAs(destination);assert.equal(await download.failure(),null);
        assert.equal(hash(await fs.readFile(destination)),publication.files.find(item=>item.path.endsWith('/'+file)).sha256);
      }
      await page.locator('#show-all').click();await page.locator('#part-search').fill('');await page.reload();await ready(page);
      for(const [size,width,height]of [['desktop',1440,1000],['mobile',390,844],['narrow',320,700],['landscape',844,390]]){
        await page.setViewportSize({width,height});await page.locator('#fit').click();await page.waitForTimeout(100);await layout(page);
        for(const theme of ['light','dark']){
          await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.waitForTimeout(100);assert((await pixels(page)).colored>200,'Blank '+model.name+' '+size+' '+theme);
          await page.screenshot({path:path.join(output,label+'-'+model.name+'-'+size+'-'+theme+'.png')});
        }
      }
      if(process.env.WRITE_PREVIEW==='1'&&model.key==='powertrain'){
        await page.reload();await ready(page);await page.setViewportSize({width:1600,height:1400});await page.evaluate(()=>{
          document.documentElement.dataset.theme='light';const workbench=document.querySelector('.engine-workbench');workbench.style.gridTemplateColumns='244px 960px 274px';workbench.style.height='1200px';
          const viewport=document.getElementById('viewport');viewport.style.flex='none';viewport.style.height='720px';
        });await page.locator('#fit').click();await page.waitForTimeout(200);
        await page.locator('#viewport>canvas:not(#axis-indicator)').screenshot({path:path.join(root,'assets/images/project-previews/vw-t4-engine.png')});
      }
      assert(!requests.some(request=>request.method!=='GET'||/\/api\/|\/model-files\/|:8770|\/download\/default\//.test(request.url)),'Local-service request remains');assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
      report.models.push({model:model.name,revision:model.revision,parts:model.parts,allMappings:true,lazyMatchingDownloads:true,animatedPixels:true,cameraStable:true,desktopMobileThemes:true,controlLayout:true});await page.close();
    }
    const statePage=await context.newPage();await statePage.goto(modelUrl(models[1]));await ready(statePage);
    await statePage.locator('#drive-gear').selectOption('4');await statePage.locator('#drive-clutch-number').fill('63');await statePage.locator('#drive-bias-number').fill('25');await statePage.locator('#rpm').fill('1735');await statePage.locator('#cutaway').uncheck();
    await statePage.locator('#assembly-variant').selectOption('default');await ready(statePage);assert.equal(await statePage.locator('#cutaway').isChecked(),false);assert.equal(await statePage.locator('#rpm').inputValue(),'1735');assert(!new URL(statePage.url()).searchParams.has('assembly'));
    await statePage.locator('#assembly-variant').selectOption('powertrain');await ready(statePage);const restored=await statePage.evaluate(()=>window.engineInspection.snapshot());
    assert.deepEqual(restored.driveState,{gear:'4',engagement:.63,bias:.25});assert.equal(restored.cutaway,false);assert.equal(restored.audio.enabled,false);assert.equal(restored.playing,false);assert.equal(new URL(statePage.url()).searchParams.get('assembly'),'powertrain');await statePage.close();
    const errorPage=await context.newPage();await errorPage.route('**/vw-t4-powertrain/r8/engine_assembly.glb',route=>route.fulfill({status:503,body:'Unavailable'}));
    await errorPage.goto(modelUrl(models[1]));await errorPage.locator('#t4Engine[data-state=error]').waitFor();assert(await errorPage.locator('#error').isVisible());assert.equal(await errorPage.locator('#download-glb').getAttribute('href'),null);
    await errorPage.locator('#assembly-variant').selectOption('default');await ready(errorPage);await errorPage.close();
    const fallback=await context.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
    await fallback.goto(url);await fallback.locator('#t4Engine[data-state=error]').waitFor();assert(await fallback.locator('#error').isVisible());await fallback.close();
    const project=await context.newPage();await project.goto(new URL('projects/volkswagen-t4-repairs/',site).href);assert(await project.locator(`main a[href="${new URL('projects/vw-t4-engine-simulation/',site).pathname}"]`).count()>0);
    const preview=project.locator('main .work-row__image[src$="vw-t4-engine.png"]');assert.equal(await preview.count(),1);await preview.scrollIntoViewIfNeeded();await preview.evaluate(image=>image.decode());assert.equal(await preview.evaluate(image=>image.naturalWidth),960);await project.close();
    Object.assign(report,{retainedSettings:true,modelQueryAndReload:true,loadErrorRecovery:true,webglFallback:true,projectPreview:true});await fs.writeFile(path.join(output,label+'-report.json'),JSON.stringify(report,null,2));await context.close();
    console.log('PASS: r7/r8 mappings, immutable downloads, lazy models, pixels, themes, layouts, retained settings, direct URLs and error recovery at '+url);
  }finally{await browser.close();}
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
