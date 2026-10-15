const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const fresh=require('./fresh.cjs');
const root=path.resolve(__dirname,'../../..'),base=process.env.SITE_URL||'http://127.0.0.1:4000';
(async()=>{
  const {catalogue}=await import(pathToFileURL(path.join(root,'src/legacy_library/catalogue.mjs')).href);
  assert(!process.env.MODEL_KEY||Object.hasOwn(catalogue,process.env.MODEL_KEY),'Unknown MODEL_KEY');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const compactFailures=[];
  try{
    const check=await browser.newContext();await fresh(check.request,base,root);await check.close();
    for(const [key,definition]of Object.entries(catalogue)){
      if(process.env.MODEL_KEY&&key!==process.env.MODEL_KEY)continue;
      const page=await browser.newPage({viewport:{width:320,height:700},isMobile:true,hasTouch:true});
      await page.goto(`${base}/parametric-models/${definition.slug}/`);
      await page.waitForFunction(()=>['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state),null,{timeout:180000});
      assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'ready',await page.locator('#legacyError').textContent());
      async function layout(){return page.evaluate(()=>{
        const panel=document.querySelector('#legacyWorkbench aside'),basic=document.querySelector('#legacyParameters>.cad-basic'),r=panel.getBoundingClientRect(),b=basic.getBoundingClientRect(),canvas=document.getElementById('legacyCanvas').getBoundingClientRect();
        const overflow=[...panel.querySelectorAll('label,summary,h1,input,select')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>r.right+1).map(e=>e.id||e.textContent);
        return{basicFits:b.bottom<=r.bottom+1,panel:[r.width,r.height],basicBottom:b.bottom,panelBottom:r.bottom,scroll:panel.scrollHeight-panel.clientHeight,canvas:[canvas.width,canvas.height],overflow,rootBottom:document.getElementById('legacyWorkbench').getBoundingClientRect().bottom};
      });}
      for(const [name,viewport]of [['320',{width:320,height:700}],['390',{width:390,height:844}],['landscape',{width:844,height:390}]]){
        await page.setViewportSize(viewport);await page.waitForTimeout(200);const dimensions=await layout();
        if(name!=='landscape'&&!dimensions.basicFits)compactFailures.push({key,viewport:name,...dimensions});
        assert.deepEqual(dimensions.overflow,[]);assert(dimensions.canvas[1]>=150);assert(dimensions.rootBottom<=viewport.height+1);
        for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:path.join(root,`output/legacy-library/${key}-${name}-${theme}.png`)});}
        await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(200);
        assert.equal(await page.locator('.cad-app #cadModel').count(),1);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
        const full=await layout();assert(full.rootBottom<=viewport.height+1);await page.locator('.cad-fullscreen-button').click();await page.waitForTimeout(100);
        console.log(JSON.stringify({key,viewport:name,...dimensions}));
      }
      await page.close();
    }
    assert.deepEqual(compactFailures,[],'essential controls must fit without scrolling');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
