const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,canvasPixels}=require('./qa-runtime.cjs');

runSuite('layout',{mode:'parts',assembly:'powertrain'},async({page,snapshot,input,openSound,setPlaying,reload,output})=>{
  const ui=page.locator('#t4Engine'),initial=await snapshot();
  assert.equal(initial.mode,'parts');assert.equal(initial.playing,false);assert.equal(initial.audio.contextCreated,false);
  assert.equal(await ui.locator('#service-tab-motonet').getAttribute('aria-selected'),'true');
  assert.match(await ui.locator('.engine-provenance').innerText(),/my VW T4 1.9 TD.*SWB frame is AI-generated/);
  for(const id of ['play','rpm','drive-controls','flow','cycles','sound-panel','orders','explode'])assert.equal(await ui.locator(`.parameters #${id}`).count(),1,id+' must be in the left panel');
  assert.equal(await ui.locator('.workspace #play,.workspace input[type=range]').count(),0);
  const layouts=[];
  for(const [width,height]of [[1920,1080],[1440,900],[1366,768],[1024,600],[768,1024],[390,844],[320,700],[844,390]]){
    await page.setViewportSize({width,height});
    for(const mode of ['parts','simulate']){
      await ui.locator(`[data-engine-mode=${mode}]`).click();await page.waitForTimeout(100);
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        const bounds=await ui.boundingBox(),view=await ui.locator('#viewport').boundingBox(),workbench=await ui.locator('.engine-workbench').boundingBox();
        assert(bounds.y>=0&&bounds.y+bounds.height<=height+1,`${width}x${height} ${mode}: app exceeds screen`);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
        assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Page needs vertical scrolling');
        if(width>1000){assert(view.height>=workbench.height*.78,'Viewer is not using available height');
          const catalogue=await ui.locator('.inventory').boundingBox();assert(catalogue.width>=315,'Catalogue is too narrow');}
        assert(view.height>=75&&view.width>=200,'Viewer unusable');
        assert((await canvasPixels(page)).contrast>100,'Blank model');
        await page.screenshot({path:path.join(output,`${process.env.T4_BROWSER||'chromium'}-${width}-${height}-${mode}-${theme}.png`)});
      }
      layouts.push({width,height,mode});
    }
    if(width<=1000){
      await ui.locator('[data-engine-panel=catalogue]').click();assert(await ui.locator('.inventory').isVisible());assert(await ui.locator('.parameters').isHidden());
      await ui.locator('[data-engine-panel=controls]').click();assert(await ui.locator('.parameters').isVisible());assert(await ui.locator('.inventory').isHidden());
    }
  }
  await page.setViewportSize({width:1440,height:1000});await ui.locator('[data-engine-mode=parts]').click();
  await ui.locator('#part-search').fill('13-2300');await ui.locator('[data-part=alternator] button').click();
  assert.match(await ui.locator('#service-panel').innerText(),/13-2300/);assert.match(await ui.locator('#service-panel').innerText(),/ZERO fitted matches/);
  const camera=await snapshot();await ui.locator('[data-engine-mode=simulate]').click();assertCameraStable(await snapshot(),camera);
  await openSound();await input('audio-volume',0);await ui.locator('#audio-all').check();await ui.locator('#audio-enabled').check();await setPlaying(true);
  await ui.locator('#flow').check();await page.waitForTimeout(150);assert((await snapshot()).playing);assert((await snapshot()).flow.visible);
  await ui.locator('[data-engine-mode=parts]').click();const stopped=await snapshot();
  assert.equal(stopped.playing,false);assert.equal(stopped.audio.enabled,false);assert.equal(stopped.audio.running,false);assert.equal(stopped.flow.visible,false);
  assertCameraStable(stopped,camera);assert.equal(new URL(page.url()).searchParams.get('mode'),null);
  await ui.locator('[data-engine-mode=simulate]').click();assert.equal((await snapshot()).audio.enabled,false);assert.equal((await snapshot()).playing,false);
  await reload();assert.equal((await snapshot()).mode,'simulate');assert.equal((await snapshot()).audio.enabled,false);
  await ui.locator('#viewer-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  // Native fullscreen can asynchronously replace Firefox's emulated viewport with screen dimensions.
  await page.waitForFunction(()=>{const rect=document.fullscreenElement?.getBoundingClientRect();return rect&&Math.abs(rect.width-innerWidth)<=1&&Math.abs(rect.height-innerHeight)<=1;});
  assert((await canvasPixels(page)).contrast>200);await ui.locator('#viewer-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
  return {layouts,partsDefault:true,motonetDefault:true,controlsOnLeft:true,pageScroll:false,modePreservesCamera:true,partsPausesAndMutes:true,fullscreen:true};
}).catch(error=>{console.error(error);process.exitCode=1;});
