// Adapted from the frozen r6 baseline plus the 2026-10-17 controls-only patch.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertLayout,setSimulatedHidden,sources,bulkSources}=require('./qa-runtime.cjs');

runSuite('audio-mix',{mixer:1},async({page,snapshot,input,setPlaying,moduleUrls,output})=>{
  const state=async()=>(await snapshot()).audio;
  const assertMuted=async({noContext=false}={})=>{
    const s=await state();assert.equal(s.enabled,false);assert.equal(s.running,false);
    assert.equal(await page.locator('#audio-enabled').isChecked(),false);
    if(noContext)assert.equal(s.contextCreated,false);
  };
  const assertStopped=async()=>{
    const before=await state();assert.equal(before.running,false);assert.equal(before.turboModulated,false);
    await page.waitForTimeout(180);const after=await state();
    assert.deepEqual(after.scheduled,before.scheduled);assert.deepEqual(after.issueScheduled,before.issueScheduled);
  };
  await assertMuted({noContext:true});assert.equal(await page.locator('.audio-source input:checked').count(),0);
  assert.equal(await page.locator('#sound-panel').evaluate(element=>element.open),true,'mixer=1 must only open the panel');
  await page.locator('#sound-panel').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#audio-level-number-valves').inputValue(),'30');
  assert.equal(await page.locator('#audio-level-number-combustion').inputValue(),'100');
  await page.locator('#audio-profile').selectOption('issue');let s=await state();
  assert.equal(s.mix.valves.character,'issue');assert(s.mix.valves.level>.3);
  await assertMuted({noContext:true});assert.equal(await page.locator('.audio-source input:checked').count(),0);
  await input('audio-strength-number',0);assert.equal((await state()).mix.valves.level,.3);
  await input('audio-strength',100);assert.equal(await page.locator('#audio-strength-number').inputValue(),'100');
  await page.locator('#audio-issue-source').selectOption('rotating');s=await state();
  assert.equal(s.mix.valves.character,'normal');assert.equal(s.mix.rotating.character,'issue');
  await input('audio-level-number-combustion',25);assert.equal(await page.locator('#audio-level-combustion').inputValue(),'25');
  assert.equal(await page.locator('#audio-profile').inputValue(),'custom');assert.equal((await state()).mix.combustion.level,.25);
  await page.locator('#audio-character-injection').selectOption('issue');assert.equal((await state()).mix.injection.character,'issue');
  for(const id of sources){
    await page.locator(`[data-source="${id}"]`).check();await assertMuted({noContext:true});
    assert((await state()).sources.includes(id));
    await page.locator(`[data-source="${id}"]`).uncheck();await assertMuted({noContext:true});
  }
  const turbo=page.locator('[data-source="turbo"]'),bulk=page.locator('#audio-all');
  await bulk.check();assert.equal(await page.locator('.audio-source input:checked').count(),6);
  assert.equal(await turbo.isChecked(),false);
  assert.deepEqual([...(await state()).sources].sort(),[...bulkSources].sort());await assertMuted({noContext:true});
  for(const profile of ['normal','issue','custom']){
    await page.locator('#audio-profile').selectOption(profile);await assertMuted({noContext:true});
    assert.equal(await page.locator('.audio-source input:checked').count(),6,'Profiles must not change source gates');
    assert.equal(await turbo.isChecked(),false,'Presets must not opt into turbo');
  }
  await turbo.check();assert.equal(await bulk.isChecked(),true);assert.equal(await bulk.evaluate(element=>element.indeterminate),false);
  await bulk.uncheck();assert.deepEqual((await state()).sources,['turbo']);
  assert.equal(await turbo.isChecked(),true);assert.equal(await bulk.evaluate(element=>element.indeterminate),false);
  await bulk.check();assert.equal((await state()).sources.length,7);await assertMuted({noContext:true});
  await turbo.uncheck();assert.equal((await state()).sources.length,6);assert.equal(await bulk.isChecked(),true);
  await page.locator('[data-source="combustion"]').uncheck();assert.equal(await bulk.evaluate(element=>element.indeterminate),true);
  await bulk.check();assert.equal((await state()).sources.length,6);assert.equal(await turbo.isChecked(),false);
  await bulk.uncheck();assert.deepEqual((await state()).sources,[]);await assertMuted({noContext:true});
  await bulk.check();await page.locator('#audio-profile').selectOption('normal');
  await page.locator('#audio-enabled').check();await page.waitForFunction(()=>window.engineInspection.snapshot().audio.contextCreated);
  assert.equal((await state()).running,false);await setPlaying(true);await page.waitForTimeout(150);
  assert.equal((await state()).running,true);assert(!(await state()).sources.includes('turbo'));
  for(const id of sources){
    const before=(await state()).sourceGains;
    for(const percent of [0,175]){
      await input('audio-level-number-'+id,percent);await page.waitForTimeout(180);const gains=(await state()).sourceGains;
      assert(Math.abs(gains[id]-percent/100)<.002,`${id} level did not reach its real gain bus`);
      for(const other of sources.filter(source=>source!==id))assert(Math.abs(gains[other]-before[other])<.002,`${id} edit changed ${other} bus`);
    }
    await page.locator('#audio-profile').selectOption('normal');await page.waitForTimeout(180);
  }
  for(const id of sources.filter(id=>id!=='turbo')){
    await page.locator(`[data-source="${id}"]`).uncheck();const before=(await state()).scheduled[id]||0;
    await page.waitForTimeout(220);assert.equal((await state()).scheduled[id]||0,before,`${id} gate did not stop scheduling`);
    await page.locator(`[data-source="${id}"]`).check();
  }
  await turbo.check();await page.locator('#audio-character-turbo').selectOption('issue');assert((await state()).turboModulated);
  await page.locator('[data-source="turbo"]').uncheck();assert.equal((await state()).turboModulated,false);
  await page.locator('[data-source="turbo"]').check();assert((await state()).turboModulated);
  await page.locator('#audio-profile').selectOption('normal');assert.equal((await state()).turboModulated,false);
  assert.equal((await state()).mix.combustion.level,1);assert.equal((await state()).enabled,true);
  await page.locator('#audio-character-turbo').selectOption('issue');
  await setPlaying(false);assert.equal((await state()).enabled,true);await assertStopped();
  await setPlaying(true);assert.equal((await state()).running,true);assert((await state()).turboModulated);
  await page.locator('#audio-enabled').uncheck();await assertMuted();await assertStopped();
  await setPlaying(false);await setPlaying(true);await page.locator('#audio-profile').selectOption('issue');
  await assertMuted();await assertStopped();
  await page.locator('#audio-enabled').check();assert.equal((await state()).running,true);
  await page.locator('#audio-character-turbo').selectOption('issue');assert((await state()).turboModulated);
  const gatesBefore=(await state()).sources;
  try{
    await setSimulatedHidden(page,true);await assertMuted();await assertStopped();
  }finally{await setSimulatedHidden(page,false);}
  await assertMuted();assert.deepEqual((await state()).sources,gatesBefore);
  await setPlaying(false);await setPlaying(true);await page.locator('#audio-profile').selectOption('normal');
  await assertMuted();await assertStopped();
  await page.locator('#audio-enabled').check();assert.equal((await state()).running,true);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert.equal((await state()).enabled,false);await assertStopped();
  await page.locator('#audio-enabled').uncheck();await assertMuted();await setPlaying(false);
  const rendered=await page.evaluate(async url=>{
    const {cue,noiseSamples}=await import(url);
    const render=async(source,character,level)=>{
      const c=new OfflineAudioContext(1,12000,48000),noise=c.createBuffer(1,48000,48000);noise.copyToChannel(noiseSamples(48000),0);
      const bus=c.createGain();bus.gain.value=level;bus.connect(c.destination);
      cue(c,bus,noise,{source,cylinder:2,angle:0},.01,1,{character,severity:1});
      const pcm=(await c.startRendering()).getChannelData(0);let sum=0,peak=0;
      for(const x of pcm){if(!Number.isFinite(x))throw new Error('Non-finite cue PCM');sum+=x*x;peak=Math.max(peak,Math.abs(x));}
      return {pcm,rms:Math.sqrt(sum/pcm.length),peak};
    };
    const comparisons=[];
    for(const source of ['combustion','injection','valves','intake','exhaust','rotating']){
      const a=await render(source,'normal',1),b=await render(source,'issue',1);let difference=0;
      for(let i=0;i<a.pcm.length;i++)difference+=(a.pcm[i]-b.pcm[i])**2;
      comparisons.push({source,normalRms:a.rms,issueRms:b.rms,difference,peak:b.peak});
    }
    const low=await render('valves','normal',.25),high=await render('valves','normal',1),zero=await render('valves','issue',0);
    return {comparisons,levelRatio:high.rms/low.rms,zeroRms:zero.rms};
  },moduleUrls.audio);
  assert(Math.abs(rendered.levelRatio-4)<.001);assert.equal(rendered.zeroRms,0);
  for(const c of rendered.comparisons){assert(c.normalRms>0&&c.issueRms>0&&c.difference>1e-6);assert(c.peak<1);}
  await page.locator('#audio-profile').selectOption('issue');await page.locator('#audio-issue-source').selectOption('valves');
  await page.locator('#audio-profile').scrollIntoViewIfNeeded();await assertLayout(page);
  await page.screenshot({path:path.join(output,'desktop_audio_mixer.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#audio-profile').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);await assertLayout(page);await page.screenshot({path:path.join(output,'mobile_audio_mixer.png')});
  return {offByDefault:true,unequalNormalMix:true,presetsAndSourceGatesDoNotEnableAudio:true,bulkOnlyChangesSixNonTurboGates:true,
    bulkExcludesTurbo:true,bulkPreservesExplicitTurbo:true,bulkCheckedAndPartialIgnoreTurbo:true,
    perSourceLevelsAndCharacters:true,allSevenActualGainBusesChecked:true,sourceGatesStopScheduling:true,turboModulationStops:true,
    pauseAndMuteStopScheduling:true,playAndPresetsDoNotAutoUnmute:true,visibilityHandlerMutesWithoutAutoUnmute:true,
    visibilityTest:'simulated DOM visibilitychange, not OS tab occlusion',pagehideHandlerStopsAudio:true,
    pagehideTest:'simulated PageTransitionEvent, not navigation or BFCache',offlinePcm:rendered,desktopMobileLayout:true,faultDiagnosisValidated:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
