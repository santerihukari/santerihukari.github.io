const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const runtime=path.resolve(path.dirname(process.execPath),'../node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const {PNG}=require(path.join(runtime,'pngjs'));
const root=path.resolve(__dirname,'../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.join(root,'output/model-library/orientation');
const models=[
  ['coffee','','coffeeWorkbench','modelCanvas'],['drone','drone-frame/','droneWorkbench','droneCanvas'],
  ['latch','door-frame-latch/','latchWorkbench','latch-viewport canvas'],['volumes','climbing-volumes/','volumeWorkbench','volumeCanvas'],
  ['damper','cabinet-air-damper/','damperWorkbench','damperCanvas'],['hangboard','depth-taper-hangboard/?attachment_method=single_point','legacyWorkbench','legacyCanvas']
];
async function ready(page,id){await page.waitForFunction(id=>{
  if(id==='coffee')return document.getElementById('modelStatus')?.textContent==='Ready';
  if(id==='latch')return window.latchViewer?.valid;
  if(id==='damper')return document.getElementById('damperStatus')?.textContent==='Fixed V1';
  return ['ready'].includes(document.getElementById(id==='drone'?'droneWorkbench':id==='volumes'?'volumeWorkbench':'legacyWorkbench')?.dataset.state);
},id,{timeout:100000});await page.waitForTimeout(250);}
async function axes(page,selector){return page.locator(selector+' line').evaluateAll(nodes=>nodes.map(e=>[e.getAttribute('x2'),e.getAttribute('y2')]));}
async function capture(page,selector,canvas,name){
  const widget=page.locator(selector);assert(await widget.isVisible());
  assert.equal(await widget.locator('text').count(),4);assert.equal(await widget.locator('line').count(),3);
  const bounds=await widget.evaluate(e=>{
    const r=e.getBoundingClientRect(),v=e.closest('.viewport, #latch-viewport').getBoundingClientRect();
    const collision=[...e.parentElement.querySelectorAll('.coffee-toolbar,.coffee-floating-actions,.viewport-bar,.latch-view-toolbar')].filter(n=>n.getClientRects().length).some(n=>{const b=n.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;});
    return{inside:r.left>=v.left&&r.top>=v.top&&r.right<=v.right&&r.bottom<=v.bottom,collision};
  });
  if(!bounds.inside||bounds.collision)await page.screenshot({path:path.join(output,name+'-layout-failed.png')});
  assert(bounds.inside,name+': coordinate widget leaves viewport');assert(!bounds.collision,name+': coordinate widget overlaps controls');
  const image=PNG.sync.read(await page.locator('#'+canvas).screenshot());let colors=0;
  for(let i=0;i<image.data.length;i+=4)if(Math.max(...image.data.subarray(i,i+3))-Math.min(...image.data.subarray(i,i+3))>30)colors++;
  assert(colors>60,name+': blank model');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,name+'.png')});
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    for(const [id,route,workbench,canvas]of models){
      const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/parametric-models/'+route);await ready(page,id);
      const selector='#'+workbench+' '+(id==='latch'?'#coordinate-indicator':'.cad-coordinate-indicator');
      assert.equal(await page.locator('#'+workbench+' .cad-coordinate-indicator, #'+workbench+' #coordinate-indicator').count(),1);
      const previous=await axes(page,selector),box=await page.locator('#'+canvas).boundingBox();
      await page.mouse.move(box.x+box.width*.48,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.6,{steps:10});await page.mouse.up();await page.waitForTimeout(700);
      assert.notDeepEqual(await axes(page,selector),previous,id+': indicator did not follow orbit');
      if(id==='hangboard'){
        assert(await page.evaluate(()=>document.getElementById('legacyWorkbench').legacyController.viewer.camera.isOrthographicCamera));
        for(const view of ['top','front','side','bottom','iso']){await page.locator('#legacyWorkbench [data-view='+view+']').click();assert.equal(await page.locator('#legacyWorkbench [data-view='+view+']').getAttribute('aria-pressed'),'true');}
      }
      for(const [name,size]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}],['landscape',{width:844,height:390}]]){
        await page.setViewportSize(size);await page.waitForTimeout(200);
        for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await capture(page,selector,canvas,id+'-'+name+'-'+theme);}
      }
      await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(250);await capture(page,selector,canvas,id+'-fullscreen');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');await page.locator('.cad-fullscreen-button').click();
      assert.deepEqual(errors,[]);console.log('PASS '+id+': one responsive coordinate widget, live orbit, both themes, fullscreen and visible model');await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
