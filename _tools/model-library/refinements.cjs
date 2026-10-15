const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.resolve(__dirname,'../../output/model-library/refinements');
const pages=[['coffee','','coffeeWorkbench','modelCanvas'],['drone','drone-frame/','droneWorkbench','droneCanvas'],['latch','door-frame-latch/','latchWorkbench','latch-viewport canvas'],['volumes','climbing-volumes/','volumeWorkbench','volumeCanvas'],['damper','cabinet-air-damper/','damperWorkbench','damperCanvas']];
async function ready(page,id){await page.waitForFunction(id=>{
  if(id==='coffee')return document.getElementById('modelStatus')?.textContent==='Ready';
  if(id==='latch')return window.latchViewer?.valid;
  if(id==='damper')return document.getElementById('damperStatus')?.textContent==='Fixed V1';
  return document.getElementById(id==='drone'?'droneWorkbench':'volumeWorkbench')?.dataset.state==='ready';
},id,{timeout:45000});await page.waitForTimeout(200);}
const panelWidths=(page,root)=>page.locator(`#${root}`).evaluate(e=>{const panel=e.querySelector('aside'),body=panel.querySelector('.cad-panel-content');return [panel.getBoundingClientRect().width,body.getBoundingClientRect().width];});
async function inspection(page,root,canvas){
  const target=page.locator('#'+canvas),rect=await target.boundingBox();
  let point;
  for(const y of [.35,.45,.55,.65]){for(const x of [.3,.4,.5,.6,.7]){
    await page.mouse.move(rect.x+rect.width*x,rect.y+rect.height*y);await page.waitForTimeout(40);
    if(await page.locator('#'+root).getAttribute('data-hovered-component')){point=[rect.x+rect.width*x,rect.y+rect.height*y];break;}
  }if(point)break;}
  assert(point,root+': hover never highlighted a visible component');
  assert.equal(await page.locator(`#${root} .cad-component-label:not([hidden])`).count(),0,'Hover must not show a component name');
  const highlighted=await target.screenshot();
  await page.mouse.move(1,1);await page.waitForTimeout(100);
  assert(!highlighted.equals(await target.screenshot()),'Hover must change rendered pixels');
  await page.mouse.click(...point);await page.mouse.move(1,1);await page.waitForTimeout(100);
  assert(await page.locator('#'+root).getAttribute('data-selected-component'),'Click did not select a component');
  assert.equal(await page.locator(`#${root} .cad-component-label:not([hidden])`).count(),1,'Click must show one object-anchored name');
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    for(const [id,suffix,root,canvas] of pages){
      if(process.env.MODEL_ID&&id!==process.env.MODEL_ID)continue;
      for(const width of [1440,390,320])for(const theme of ['light','dark']){
        const context=await browser.newContext({viewport:{width,height:width===1440?900:width===390?844:700},hasTouch:width<700,isMobile:width<700});
        const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await context.addInitScript(theme=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('theme',theme);},theme);
        await page.goto(`${base}/parametric-models/${suffix}`);await ready(page,id);
        const description=page.locator(`#${root} .cad-description`);
        assert(await description.isVisible(),id+': description must stay visible');
        assert.equal(await description.evaluate(e=>Boolean(e.closest('details'))),false,'Description is folded');
        const notes={coffee:/over a week/,drone:/by hand/,latch:/normal use/,volumes:/not yet been validated/,damper:/prototype/i};
        assert.match(await description.textContent(),notes[id]);
        const widths=await panelWidths(page,root);
        const folds=page.locator(`#${root} aside details.cad-options`);
        const titles=await folds.locator(':scope>summary').allTextContents();assert(!titles.includes('Advanced'),'Vague fold title');
        for(let i=0;i<await folds.count();i++){
          await folds.nth(i).evaluate(e=>e.open=true);await page.waitForTimeout(120);
          assert.deepEqual(await panelWidths(page,root),widths,id+': scrollbar narrowed the panel');
          await folds.nth(i).evaluate(e=>e.open=false);await page.waitForTimeout(120);
        }
        const trigger=page.locator(`#${root} .cad-download-trigger`);assert.equal(await trigger.count(),1);
        assert.equal(await trigger.locator('img').count(),2);
        const icon=await trigger.locator('img').first().getAttribute('src');assert(icon.endsWith('/assets/icons/download.svg'));
        assert.equal(await trigger.getAttribute('aria-label'),'Download options');
        assert.equal(await page.locator(`#${root} .cad-download-file`).count(),id==='coffee'?2:id==='latch'?2:id==='damper'?4:id==='drone'?5:1);
        const badges=await page.locator(`#${root} .cad-format-badge`).allTextContents();assert(badges.every(text=>/^(STL|GLB|JSON|TXT|ZIP|SVG)$/.test(text)));
        if(id==='coffee'){
          assert.equal(await page.locator('[data-layout]').count(),3);assert(await page.locator('#preset').isVisible());assert(await page.locator('#coffeeMounting').isVisible());assert.equal(await page.locator('#paperCount,#paperCountRange').count(),0);
          assert(await page.locator('.coffee-orientation button').evaluateAll(nodes=>nodes.every(e=>e.getBoundingClientRect().height<=32.1)),'Orientation choices should be compact');
          const shades=await page.locator('.coffee-orientation button').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).backgroundColor));assert.notEqual(shades[0],shades[1],'Selected orientation needs a distinct shade');
        }
        if(id==='volumes'){
          assert(await page.locator('#flat_slope_angleNumber').isVisible());
          assert(await page.locator('#brace_reachNumber').isHidden(),'Base radius belongs under size settings');
          assert.equal(await page.locator('#brace_reachNumber').evaluate(e=>e.closest('details').id),'volumeSize');
          let shades=await page.locator('[data-mode]').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).backgroundColor));
          assert.notEqual(shades[0],shades[1],'Selected mounting plane must have a distinct shade');
          await page.locator('[data-mode=corner]').click();await ready(page,id);
          assert.equal(await page.locator('[data-mode=corner]').getAttribute('aria-pressed'),'true');
          assert(await page.locator('#opening_angleNumber').isVisible());
          shades=await page.locator('[data-mode]').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).backgroundColor));
          assert.notEqual(shades[0],shades[1]);
        }
        if(id==='drone'){
          await page.locator('#droneAdvanced').evaluate(e=>e.open=true);
          const nesting=await page.locator('#droneAdvanced').evaluate(e=>{
            const child=e.querySelector('details'),outer=e.getBoundingClientRect(),inner=child.getBoundingClientRect(),style=getComputedStyle(child);
            return{indent:inner.left-outer.left,border:parseFloat(style.borderLeftWidth)};
          });
          assert(nesting.indent>=8&&nesting.border>=2,'Nested settings need visible indentation and guide');
          await page.locator('#droneAdvanced').evaluate(e=>e.open=false);
        }
        await page.screenshot({path:path.join(output,`${id}-${width}-${theme}.png`)});
        if(width===1440&&theme==='light'&&['coffee','volumes','damper'].includes(id))await inspection(page,root,canvas);
        if(width===1440||width===390){
          await page.locator('.cad-fullscreen-button').click();
          await page.waitForFunction(()=>document.fullscreenElement||document.querySelector('.cad-app.is-full-window'));
          await page.waitForTimeout(150);
          const state=await page.evaluate(root=>{const shell=document.querySelector('.cad-app').getBoundingClientRect(),tool=document.getElementById(root).getBoundingClientRect();return {top:shell.top,bottom:shell.bottom,viewport:innerHeight,toolBottom:tool.bottom,overflow:getComputedStyle(document.documentElement).overflowY,scroll:scrollY};},root);
          assert(Math.abs(state.top)<1&&Math.abs(state.bottom-state.viewport)<2&&state.toolBottom<=state.viewport+1,'Fullscreen layout overflows');
          assert.equal(state.overflow,'hidden');
          await page.mouse.move(5,5);await page.mouse.wheel(0,350);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),state.scroll,'Page scrolls in fullscreen');
          await page.screenshot({path:path.join(output,`${id}-${width}-${theme}-fullscreen.png`)});
          await page.locator('.cad-fullscreen-button').click();await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('.cad-app.is-full-window'));
          assert.equal(await page.locator('.cad-fullscreen-button').getAttribute('aria-pressed'),'false');
        }
        assert.deepEqual(errors,[]);await context.close();
        console.log(`PASS ${id} ${width} ${theme}: fixed panel width, named folds, uniform downloads, fullscreen`);
      }
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
