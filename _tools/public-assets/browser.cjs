const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {chromium,firefox}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const {manifest,publishedUrl,migrated}=require('./paths.cjs');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'output/public-assets');
const base=(process.env.SITE_URL||'http://127.0.0.1:4000/').replace(/\/?$/,'/');
const url=file=>new URL(file,base).href;
function pixels(buffer){
  const png=PNG.sync.read(buffer),colors=new Set();let contrast=0;
  for(let i=0;i<png.data.length;i+=20){
    colors.add(png.data.subarray(i,i+3).join(','));
    if(Math.abs(png.data[i]-png.data[0])+Math.abs(png.data[i+1]-png.data[1])+Math.abs(png.data[i+2]-png.data[2])>60)contrast++;
  }
  assert(colors.size>50&&contrast>150,`Blank model: ${colors.size} colors/${contrast} contrast pixels`);
  return {colors:colors.size,contrast};
}
async function run(){
  const browserName=process.env.QA_BROWSER||'chromium',browser=await (browserName==='firefox'?firefox:chromium).launch({headless:true,
    ...(browserName==='chromium'?{executablePath:'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'}:{})});
  await fs.mkdir(output,{recursive:true});const errors=[],failures=[],requests=[],report={browser:browserName,base,checks:[]};
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});let page;
  try{
    page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400)failures.push({url:response.url(),status:response.status()});});
    page.on('request',request=>{if(request.url().startsWith(manifest.origin+'/')){requests.push(request.url());assert(migrated(request.url()),'Unlisted remote asset');}});
    async function view(canvas,name){
      for(const [width,height]of [[1440,1000],[390,844]])for(const theme of ['light','dark']){
        await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        await page.waitForTimeout(250);pixels(await page.locator(canvas).screenshot());
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
        await page.screenshot({path:path.join(output,`${browserName}-${name}-${width}-${theme}.png`)});
      }
      await page.setViewportSize({width:1440,height:1000});
    }
    await page.goto(url('projects/photogrammetry/'));assert.equal(requests.length,0,'Models must not preload');
    await page.locator('#projects .project-button').first().waitFor();
    assert.equal(await page.locator('#projects .project-button').count(),6);
    const entries=await page.locator('#projects .project-button__title').allTextContents();
    for(const title of entries){
      await page.locator('#projects .project-button').filter({hasText:title}).click();
      await page.locator('#viewer-actions:not(.hidden)').waitFor();
      assert.equal(await page.locator('#project-title').textContent(),title);
      const image=pixels(await page.locator('#canvas').screenshot());report.checks.push({model:title,pixels:image});console.log('Rendered '+title);
      if(title.includes('SRK')){
        assert.equal(await page.locator('.route-button').count(),18);
        await page.locator('.route-button').first().click();await page.waitForTimeout(600);
        await view('#canvas','srk-routes');
      }
    }
    for(const file of Object.keys(manifest.files).filter(file=>file.startsWith('assets/models/photogrammetry/')))
      assert(requests.includes(publishedUrl(file,base)),file+' did not load');
    await page.goto(url('stl/'));const previews=page.locator('button[data-open]');assert.equal(await previews.count(),6);
    for(let i=0;i<6;i++){
      const preview=previews.nth(i),source=await preview.getAttribute('data-src');assert(migrated(source));
      await preview.click();await page.waitForFunction(()=>document.querySelector('#stl-status')?.textContent.startsWith('Loaded.'));
      pixels(await page.locator('#stl-dialog canvas').screenshot());
      const pending=page.waitForEvent('download');await page.locator('#stl-dl').click();const download=await pending;
      assert.equal(await download.failure(),null);assert.equal(download.suggestedFilename(),await preview.getAttribute('data-name'));
      await download.delete();await page.locator('#stl-close').click();console.log('Previewed and downloaded STL '+(i+1));
    }
    report.checks.push({stlPreviews:6,actualDownloads:6});
    for(const [route,status,ready,canvas,name]of [
      ['drone-frame/','#droneStatus','Ready','#droneCanvas','drone'],
      ['cabinet-air-damper/','#damperStatus','Fixed V1','#damperCanvas','damper']]){
      await page.goto(url('parametric-models/'+route));
      await page.waitForFunction(({status,ready})=>document.querySelector(status)?.textContent===ready,{status,ready});
      await view(canvas,name);report.checks.push({model:name,ready:true});
    }
    await page.goto(url('parametric-models/door-frame-latch/'));
    await page.waitForFunction(()=>window.latchViewer?.valid);
    const closed=await page.locator('#latch-revision').evaluate(element=>{
      const ids=[];for(let node=element.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)ids.push(node.id);return ids.reverse();
    });
    for(const id of closed)await page.locator('#'+id+'>summary').click();
    await page.locator('#latch-revision').selectOption('grip_v2');
    await page.waitForFunction(()=>window.latchViewer?.valid&&document.querySelector('#latch-revision')?.value==='grip_v2');
    await view('#latch-viewport canvas','latch-legacy');report.checks.push({model:'latch-legacy',ready:true});
    assert(requests.some(value=>value===publishedUrl('assets/cad/latch/legacy/model.json',base)));
    assert(requests.some(value=>value===publishedUrl('assets/cad/air-damper/model.json',base)));
    assert(requests.some(value=>value===publishedUrl('assets/cad/drone-frame/references/esp32_s3_wroom1_module.glb',base)));
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    Object.assign(report,{errors,failures,remoteAssets:[...new Set(requests)]});
    await fs.writeFile(path.join(output,`${browserName}-report.json`),JSON.stringify(report,null,2)+'\n');
    for(const name of ['failure.json','failure.png'])await fs.rm(path.join(output,`${browserName}-${name}`),{force:true});
    console.log(`PASS ${browserName}: six photogrammetry models, SRK routes, six STL previews/downloads, drone, damper and historical latch; desktop/mobile light/dark.`);
  }catch(error){
    if(page)await page.screenshot({path:path.join(output,`${browserName}-failure.png`)}).catch(()=>{});
    await fs.writeFile(path.join(output,`${browserName}-failure.json`),JSON.stringify({error:error.stack,errors,failures,requests},null,2));throw error;
  }finally{await context.close();await browser.close();}
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
