const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const runtime = path.resolve(path.dirname(process.execPath), '../node_modules');
const {chromium} = require(path.join(runtime, 'playwright'));
const {PNG} = require(path.join(runtime, 'pngjs'));
const fresh = require('./fresh.cjs');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'output/legacy-library/hangboard-profile/browser');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const route = '/parametric-models/depth-taper-hangboard/';
const file = 'src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
const curve = '0,1|0.5,1.1|1,1';

async function ready(page) {
  await page.waitForFunction(() => ['ready','error','invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state), null, {timeout:100000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'), 'ready', await page.locator('#legacyError').textContent());
}
const diagnostics = page => page.evaluate(() => {
  const c = document.getElementById('legacyWorkbench').legacyController;
  return {metrics:c.metrics,timings:c.timings,params:c.params};
});
const pose = page => page.evaluate(() => {
  const v = document.getElementById('legacyWorkbench').legacyController.viewer;
  return {position:v.camera.position.toArray(),target:v.controls.target.toArray(),zoom:v.camera.zoom};
});
function samePose(actual,expected) {
  for(const key of Object.keys(expected)) {
    const a=[].concat(actual[key]),b=[].concat(expected[key]);
    assert(a.every((value,i)=>Math.abs(value-b[i])<1e-6),'Changing depth profile reframed camera '+key);
  }
}
async function edit(page, key, value) {
  await page.locator('#legacy-'+key).evaluate((input, value) => {
    for (let p=input.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true;
    input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));
  }, value);
}
async function screenshot(page, name) {
  await page.locator('#legacyParameters details').evaluateAll(nodes => nodes.forEach(e => e.open=false));
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(output,name+'.png')});
  const png = PNG.sync.read(await page.locator('#legacyCanvas').screenshot());
  let model=0;
  for(let i=0;i<png.data.length;i+=4) if(png.data[i+1]>png.data[i]*1.25 && png.data[i+2]>png.data[i]*1.2 && png.data[i+1]>50) model++;
  assert(model>60,'Model is not visible');
  const fits = await page.evaluate(() => {
    const r=document.getElementById('legacyWorkbench').getBoundingClientRect();
    return document.documentElement.scrollWidth<=innerWidth && r.bottom<=innerHeight+2;
  });
  assert(fits,'Workbench overflows the viewport');
}
(async () => {
  await fs.mkdir(output,{recursive:true});
  const reference = execFileSync('git',['show','ff1bb183e55759ab167e8a7d55427cdb0cd1ef77:'+file],{cwd:root});
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const results = {};
  try {
    for (const variant of ['reference','optimized']) {
      const context = await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
      await fresh(context.request,base,root);
      if(variant==='reference') await context.route('**/'+file,route=>route.fulfill({body:reference,contentType:'text/javascript'}));
      await context.addInitScript(() => Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}}));
      const page = await context.newPage(), errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+route+'?back_wall_y=20&depth_profile_version=1'); await ready(page);
      const first = await diagnostics(page);
      // A fresh worker loads once; subsequent parameter updates keep that kernel.
      await page.waitForTimeout(200); const camera = await pose(page);
      await edit(page,'depth_taper_curve',curve);
      await page.waitForTimeout(700);
      assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'),'pending');
      assert(await page.locator('#legacyStl').isDisabled());
      assert(!(await page.locator('#legacyCopy').isDisabled()));
      await page.locator('#legacyCopy').click();
      assert.equal(new URL(await page.evaluate(()=>__copied)).searchParams.get('depth_taper_curve'),curve);
      await page.locator('#legacyBuild').click(); await ready(page);
      samePose(await pose(page),camera);
      const curved = await diagnostics(page);
      for(const key of ['slot_fillet_r','riser_fillet_r','outer_fillet_r']) assert.equal(curved.params[key],first.params[key]);
      results[variant]={first,curved};
      if(variant==='optimized') {
        assert.deepEqual(curved.metrics,results.reference.curved.metrics,'Browser mesh metrics changed');
        for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:700}]]) {
          await page.setViewportSize(viewport);
          for(const theme of ['light','dark']) {
            await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
            await screenshot(page,name+'-'+theme);
          }
        }
        await page.setViewportSize({width:1440,height:900});
        await page.locator('#legacyDownloads').evaluate(e=>e.open=true);
        for(const format of ['Stl','Glb']) {
          const event=page.waitForEvent('download');await page.locator('#legacy'+format).click();
          const download=await event;await download.saveAs(path.join(output,'curved.'+format.toLowerCase()));
          assert.equal(await download.failure(),null);await ready(page);
        }
      }
      assert.deepEqual(errors,[]);await context.close();
    }
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({passed:true,reference:results.reference.curved.timings,optimized:results.optimized.curved.timings}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
