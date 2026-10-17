// Adapted for the immutable r8_live1 runtime; fixed reference geometry resets by page reload.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout,bulkSources}=require('./qa-runtime.cjs');

runSuite('rpm-controls',{mixer:1},async({page,snapshot,input,setPlaying,reload,output})=>{
  const pair=async rpm=>{
    assert.equal((await snapshot()).nominalRpm,rpm);
    for(const id of ['rpm','rpm-slider'])assert.equal(await page.locator('#'+id).inputValue(),String(rpm));
  };
  const orders=async rpm=>{
    const values=await page.locator('#orders .order-row').evaluateAll(rows=>rows.map(row=>row.lastElementChild.textContent));
    assert.deepEqual(values,[.5,1,2,4].map(order=>`${(rpm/60*order).toFixed(2)} Hz`));
  };
  for(const id of ['rpm','rpm-slider']){
    for(const [attribute,value] of Object.entries({min:'300',max:'5000',step:'1'}))assert.equal(await page.locator('#'+id).getAttribute(attribute),value);
  }
  await pair(850);assert.equal((await snapshot()).visualRpm,17);await orders(850);
  assert.equal((await snapshot()).audio.enabled,false);assert.equal((await snapshot()).audio.contextCreated,false);
  assert.equal(await page.locator('.audio-source input:checked').count(),0);
  const camera=await snapshot();
  await input('rpm-slider',2500);await pair(2500);assert.equal((await snapshot()).visualRpm,50);await orders(2500);
  await input('rpm',1735);await pair(1735);await orders(1735);
  await input('rpm',6000);assert.equal((await snapshot()).nominalRpm,1735);assert.equal(await page.locator('#rpm-slider').inputValue(),'1735');
  await page.locator('#speed').selectOption('.05');assert.equal((await snapshot()).visualRpm,86.75);
  for(const invalid of ['',299,5001,1735.5]){
    await input('rpm',invalid);assert.equal((await snapshot()).nominalRpm,1735);
    assert.equal((await snapshot()).visualRpm,86.75);assert.equal(await page.locator('#rpm-slider').inputValue(),'1735');
    await orders(1735);await input('rpm',invalid,'change');await pair(1735);
  }
  for(const rpm of [300,5000]){await input('rpm-slider',rpm);await pair(rpm);}
  await input('rpm-slider',3700);assert.equal(await page.locator('#rpm-band').textContent(),'Rated power reference');
  assert(await page.locator('[data-rpm-guide="power"]').evaluate(element=>element.classList.contains('active')));
  await input('rpm-slider',2500);
  for(const id of ['driving','torque'])assert(await page.locator(`[data-rpm-guide="${id}"]`).evaluate(element=>element.classList.contains('active')));
  for(const id of ['idle','driving'])assert.equal(await page.locator(`[data-rpm-guide="${id}"]`).getAttribute('href'),null);
  for(const id of ['torque','power'])assert.equal(new URL(await page.locator(`[data-rpm-guide="${id}"]`).getAttribute('href')).protocol,'https:');
  await page.locator('#speed').selectOption('.02');await setPlaying(true);
  await page.waitForTimeout(100);const angle=(await snapshot()).absoluteAngle;
  await input('rpm-slider',2000);await page.waitForTimeout(80);
  assert((await snapshot()).absoluteAngle>angle);assert.equal((await snapshot()).visualRpm,40);
  assertCameraStable(await snapshot(),camera);await setPlaying(false);
  await page.locator('#sound-panel').scrollIntoViewIfNeeded();
  const bulk=page.locator('#audio-all'),turbo=page.locator('[data-source="turbo"]');
  assert.match(await bulk.locator('..').textContent(),/All except turbo/i);
  await bulk.check();let s=await snapshot();assert.deepEqual([...s.audio.sources].sort(),[...bulkSources].sort());
  assert(!s.audio.sources.includes('turbo'));assert.equal(s.audio.contextCreated,false);
  await turbo.check();assert.equal(await bulk.isChecked(),true);
  await bulk.uncheck();assert.deepEqual((await snapshot()).audio.sources,['turbo']);
  assert.equal(await bulk.evaluate(element=>element.indeterminate),false);
  await bulk.check();assert.equal((await snapshot()).audio.sources.length,7);
  await turbo.uncheck();assert.equal((await snapshot()).audio.sources.length,6);assert.equal(await bulk.isChecked(),true);
  await page.locator('[data-source="combustion"]').uncheck();assert.equal(await bulk.evaluate(element=>element.indeterminate),true);
  await bulk.check();assert.equal((await snapshot()).audio.contextCreated,false);
  await page.locator('#audio-enabled').check();await page.waitForFunction(()=>window.engineInspection.snapshot().audio.contextCreated);
  await setPlaying(true);await page.waitForTimeout(100);assert(!(await snapshot()).audio.sources.includes('turbo'));
  assert.equal((await snapshot()).audio.rpm,2000);
  const transport=(await snapshot()).audio;
  await input('rpm-slider',1735);assert.equal((await snapshot()).audio.rpm,1735);
  assert.equal((await snapshot()).audio.transportStarts,transport.transportStarts,'Live RPM edits must retain the transport');
  await page.locator('#audio-rate').selectOption('playback');assert.equal((await snapshot()).audio.rpm,34.7);
  await input('rpm','');assert.equal((await snapshot()).nominalRpm,1735);assert.equal((await snapshot()).audio.rpm,34.7);
  await page.locator('#speed').selectOption('.05');assert.equal((await snapshot()).audio.rpm,86.75);
  await input('rpm','','change');await pair(1735);
  await input('rpm',2500);await pair(2500);assert.equal((await snapshot()).audio.rpm,125);
  await page.locator('#audio-rate').selectOption('engine');assert.equal((await snapshot()).audio.rpm,2500);
  await input('rpm',6000);assert.equal((await snapshot()).audio.rpm,2500);
  await input('rpm',6000,'change');await pair(2500);await orders(2500);
  await turbo.check();await page.locator('#audio-character-turbo').selectOption('issue');assert((await snapshot()).audio.turboModulated);
  await turbo.uncheck();assert.equal((await snapshot()).audio.turboModulated,false);
  await page.locator('#audio-enabled').uncheck();await setPlaying(false);await bulk.uncheck();
  await reload();await pair(850);
  s=await snapshot();assert.equal(s.visualRpm,17);assert.equal(s.audio.enabled,false);assert.equal(s.audio.contextCreated,false);
  assert.deepEqual(s.audio.sources,[]);assert.equal(s.audio.running,false);assert.equal(s.playing,false);
  assert.equal(await page.locator('#audio-enabled').isChecked(),false);await orders(850);
  await input('rpm-slider',2500);
  const layout=async()=>{
    await assertLayout(page);
    const fits=await page.locator('.rpm-control').evaluate(element=>{
      const bounds=element.getBoundingClientRect(),range=element.querySelector('input[type=range]').getBoundingClientRect(),
        number=element.querySelector('input[type=number]').getBoundingClientRect();
      return range.right<=number.left&&number.right<=bounds.right&&range.left>=bounds.left&&range.width>50;
    });assert(fits,'RPM control overlaps or overflows');
    const colored=await page.evaluate(()=>{
      const source=document.querySelector('#viewport>canvas:not(#axis-indicator)'),copy=document.createElement('canvas');
      if(!source||source.width===0||source.height===0)return 0;
      copy.width=source.width;copy.height=source.height;const context=copy.getContext('2d');context.drawImage(source,0,0);
      const pixels=context.getImageData(0,0,copy.width,copy.height).data;let count=0;
      for(let i=0;i<pixels.length;i+=16)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>35)count++;
      return count;
    });assert(colored>100,'Engine canvas is blank');return colored;
  };
  await page.locator('#rpm-slider').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  const desktopColoredPixels=await layout();await page.screenshot({path:path.join(output,'desktop_rpm_controls.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#rpm-slider').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  const mobileColoredPixels=await layout();await page.screenshot({path:path.join(output,'mobile_rpm_controls.png')});
  return {pairedRpmInputs:true,integerValuePreserved:true,invalidEditKeepsLastCommittedRpm:true,reloadSynchronizesInputs:true,
    cameraStable:true,livePlaybackAndOrdersUpdated:true,liveAudioUsesCanonicalRpm:true,engineAndPlaybackAudioRatesUpdated:true,
    bulkExcludesTurbo:true,bulkPreservesExplicitTurbo:true,turboManualOptInWorks:true,audioStillOffByDefault:true,
    reloadStartsMutedWithNoAudioContext:true,desktopMobileNonblank:true,desktopColoredPixels,mobileColoredPixels,
    layoutFits:true,rpmGuidesAreNotSafeLimits:true};
}).catch(error=>{console.error(error);process.exitCode=1;});
