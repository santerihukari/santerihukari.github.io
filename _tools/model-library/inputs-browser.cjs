const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const base=process.env.SITE_URL||'http://127.0.0.1:4000';
const output=path.resolve(__dirname,'../../output/model-library/inputs');
async function swipe(page,selector,dx,dy){
  const box=await page.locator(selector).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(200);
}
async function fixture(context){
  const page=await context.newPage();await page.goto(base);
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="${base}/assets/css/modules/cad-ui.css"><style>
    *{box-sizing:border-box}body{margin:0;padding:20px;font-family:Arial}#fixture{--coffee-bg:#f4f5f5;--coffee-panel:white;--coffee-line:#ccc;--coffee-fg:#111;--coffee-accent:#167d79}
    aside{height:330px;overflow:auto;border:1px solid #ccc}label{display:block;padding:14px}input[type=range]{width:180px;height:44px}input[type=number]{width:76px;height:44px}#filler{height:1000px}</style></head>
    <body><section id="fixture" class="cad-workbench"><aside><label>Depth <input id="range" type="range" min="0" max="100" value="50" step="any"><input id="number" type="number" inputmode="decimal" min="0" max="100" value="50" step="any"></label><div id="filler"></div></aside></section></body></html>`);
  await page.evaluate(async()=>{
    const {setupCadInputs}=await import('/src/cad-inputs.mjs');setupCadInputs(document.getElementById('fixture'));
    const number=document.getElementById('number'),range=document.getElementById('range');
    range.addEventListener('input',()=>number.value=range.value);number.addEventListener('input',()=>range.value=number.value);
  });return page;
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try{
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page=await fixture(mobile),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.locator('#number').tap();await page.locator('.cad-number-dialog').waitFor({state:'visible'});
    const entry=page.locator('.cad-number-entry input');
    assert.equal(await entry.getAttribute('inputmode'),'decimal');assert.equal(await entry.getAttribute('enterkeyhint'),'done');
    assert.deepEqual(await entry.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,2]);
    await page.keyboard.insertText('7.5');assert.equal(await entry.inputValue(),'7.5');await entry.press('Enter');
    assert.equal(await page.locator('#number').inputValue(),'7.5');assert(await page.locator('.cad-number-dialog').isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement?.type==='number'),false);
    await page.locator('#number').tap();await entry.fill('101');await page.getByRole('button',{name:'OK',exact:true}).click();
    assert(await page.locator('.cad-number-dialog').isVisible());assert.equal(await page.locator('#number').inputValue(),'7.5');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('#number').tap();await entry.fill('12,5');await page.getByRole('button',{name:'OK',exact:true}).click();
    assert.equal(await page.locator('#number').inputValue(),'12.5');
    await page.evaluate(()=>{document.getElementById('range').value=50;document.getElementById('number').value=50;document.getElementById('number').focus();});
    await swipe(page,'#range',2,-120);
    assert.equal(await page.locator('#range').inputValue(),'50','Vertical swipe changed slider');
    assert.equal(await page.locator('#number').inputValue(),'50');
    assert(await page.locator('aside').evaluate(e=>e.scrollTop)>40,'Vertical gesture did not scroll');
    assert.equal(await page.evaluate(()=>document.activeElement?.type==='number'),false,'Slider retained numeric focus');
    await page.locator('aside').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(200);
    await swipe(page,'#range',55,1);
    assert(Number(await page.locator('#range').inputValue())>70,'Horizontal gesture did not adjust slider');
    assert.equal(await page.locator('aside').evaluate(e=>e.scrollTop),0);
    assert.equal(await page.evaluate(()=>document.activeElement?.type==='number'),false);
    await page.locator('#number').focus();
    await page.locator('#range').tap({position:{x:15,y:22}});
    assert(Number(await page.locator('#range').inputValue())<10,'A deliberate tap must still set a range value');
    assert.equal(await page.evaluate(()=>document.activeElement?.type==='number'),false);
    const valueBeforeScroll=await page.locator('#number').inputValue();
    await swipe(page,'#number',1,-120);
    assert.equal(await page.locator('#number').inputValue(),valueBeforeScroll);
    assert(await page.locator('.cad-number-dialog').isHidden(),'Scrolling over a numeric field opened the editor');
    await page.locator('aside').evaluate(e=>e.scrollTop=0);
    await page.locator('#number').tap();await page.screenshot({path:path.join(output,'number-mobile-light.png')});
    await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(errors,[]);await mobile.close();
    const desktop=await browser.newContext({viewport:{width:1280,height:800}}),mouse=await fixture(desktop);
    await mouse.locator('#number').fill('23');await mouse.locator('#number').press('Enter');assert.equal(await mouse.evaluate(()=>document.activeElement?.type==='number'),false);
    await mouse.locator('#range').focus();await mouse.locator('#range').press('ArrowRight');assert(Number(await mouse.locator('#range').inputValue())>23);
    assert.equal(await mouse.locator('.cad-number-dialog').count(),0);await desktop.close();
    for(const route of ['', 'drone-frame/', 'door-frame-latch/', 'climbing-volumes/', 'cabinet-air-damper/']){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),problems=[];
      page.on('pageerror',error=>problems.push(error.message));await page.goto(base+'/parametric-models/'+route);
      await page.locator('.cad-workbench aside input[type=number]').first().waitFor({state:'attached'});await page.waitForTimeout(250);
      await page.locator('.cad-workbench aside details').evaluateAll(nodes=>nodes.forEach(e=>e.open=true));await page.waitForTimeout(100);
      await page.locator('.cad-workbench aside input[type=number]:visible:not([disabled]):not([readonly])').first().tap();await page.locator('.cad-number-dialog').waitFor({state:'visible'});
      assert.equal(await page.locator('.cad-number-entry input').getAttribute('enterkeyhint'),'done');
      await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(problems,[],route);await context.close();
    }
    console.log('PASS: touch numeric replacement, Done/OK, comma entry, cancel/limits, vertical scroll, horizontal slider, blur and native keyboard controls');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
