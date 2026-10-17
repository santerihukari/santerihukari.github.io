// Adapted from the immutable 2026-10-17 r6 website handoff; fixed geometry only.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout}=require('./qa-runtime.cjs');

runSuite('cycle',{},async({page,snapshot,input,setPlaying,openSound,moduleUrls,output})=>{
  let state=await snapshot();assert.equal(state.visualRpm,17);assert.equal(state.audio.enabled,false);
  assert.equal(state.audio.contextCreated,false);assert.equal(await page.locator('.audio-source input:checked').count(),0);
  assert.equal(await page.locator('#flow').isChecked(),false);
  const camera=state;
  await page.locator('#flow').check();await input('crank-angle',450);state=await snapshot();
  assert.equal(await page.locator('#cutaway').isChecked(),true);
  assertCameraStable(state,camera);
  assert(state.flow.visible&&state.flow.particleCount>30);assert(state.flow.states[0].air>.5);assert.equal(state.flow.states[0].fuel,0);
  const checksum=state.flow.checksum;await input('crank-angle',460);assert.notEqual((await snapshot()).flow.checksum,checksum);
  await input('crank-angle',715);assert((await snapshot()).flow.states[0].fuel>0);
  await input('crank-angle',30);assert((await snapshot()).flow.states[0].burn>0);
  await page.locator('#flow-cylinder').selectOption('1');
  for(const layer of ['air','fuel','exhaust','burn','chamber'])await page.locator('#flow-'+layer).uncheck();
  assert.equal((await snapshot()).flow.particleCount,0);
  for(const layer of ['air','fuel','exhaust','burn','chamber'])await page.locator('#flow-'+layer).check();
  await page.locator('#flow-cylinder').selectOption('0');await input('explode',.4);assert.equal((await snapshot()).flow.visible,false);
  await input('explode',0);assert((await snapshot()).flow.visible);
  await page.locator('#isolate').check();assert.equal((await snapshot()).flow.visible,false);
  await page.locator('#isolate').uncheck();assert((await snapshot()).flow.visible);
  await input('rpm',900);await page.locator('#speed').selectOption('1');await setPlaying(true);
  const before=await page.evaluate(()=>({s:window.engineInspection.snapshot(),t:performance.now()}));
  await page.waitForTimeout(650);
  const after=await page.evaluate(()=>({s:window.engineInspection.snapshot(),t:performance.now()}));
  const expected=(after.t-before.t)/1000*900*6,actual=after.s.absoluteAngle-before.s.absoluteAngle;
  assert(Math.abs(actual-expected)/expected<.1,'Visual RPM does not match elapsed-time clock');
  const stall=await page.evaluate(async()=>{
    const a=window.engineInspection.snapshot().absoluteAngle,t=performance.now();while(performance.now()-t<260){}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return window.engineInspection.snapshot().absoluteAngle-a;
  });assert(stall>1000,'Frame stalls still clamp elapsed crank motion');
  await setPlaying(false);const paused=(await snapshot()).absoluteAngle;await page.waitForTimeout(120);
  assert.equal((await snapshot()).absoluteAngle,paused);
  await page.locator('#speed').selectOption('.02');await openSound();
  await page.locator('[data-source="combustion"]').check();
  assert.equal((await snapshot()).audio.contextCreated,false,'Source selection must not create an AudioContext');
  await page.locator('#audio-enabled').check();
  await page.waitForFunction(()=>window.engineInspection.snapshot().audio.contextCreated);
  assert.equal((await snapshot()).audio.running,false);
  await setPlaying(true);await page.waitForTimeout(150);const a=(await snapshot()).audio;
  await page.waitForTimeout(1000);const b=(await snapshot()).audio;
  const eventRate=((b.scheduled.combustion||0)-(a.scheduled.combustion||0))/(b.contextTime-a.contextTime);
  assert(Math.abs(eventRate-30)<8,'Combustion cues are not at nominal engine RPM');
  assert.equal((await snapshot()).visualRpm,18);assert.equal(b.rpm,900);
  await page.locator('#audio-rate').selectOption('playback');assert.equal((await snapshot()).audio.rpm,18);
  const playbackStart=(await snapshot()).audio;await page.waitForTimeout(1600);const playbackEnd=(await snapshot()).audio;
  assert((playbackEnd.scheduled.combustion||0)-(playbackStart.scheduled.combustion||0)<=2,'Playback audio retained nominal event cadence');
  await page.locator('#audio-enabled').uncheck();assert.equal((await snapshot()).audio.running,false);
  const stopped={...(await snapshot()).audio.scheduled};await page.waitForTimeout(180);
  assert.deepEqual((await snapshot()).audio.scheduled,stopped);await setPlaying(false);await setPlaying(true);
  assert.equal((await snapshot()).audio.enabled,false);assert.equal((await snapshot()).audio.running,false);
  await setPlaying(false);
  const pcm=await page.evaluate(async url=>{
    const {cue,noiseSamples}=await import(url),context=new OfflineAudioContext(1,48000,48000);
    const noise=context.createBuffer(1,48000,48000);noise.copyToChannel(noiseSamples(48000),0);
    cue(context,context.destination,noise,{source:'combustion',cylinder:1,angle:0},.02,.2);
    const data=(await context.startRendering()).getChannelData(0);let peak=0,sum=0;
    for(const value of data){if(!Number.isFinite(value))throw new Error('Non-finite cue PCM');peak=Math.max(peak,Math.abs(value));sum+=value*value;}
    return {peak,rms:Math.sqrt(sum/data.length)};
  },moduleUrls.audio);assert(pcm.rms>1e-5&&pcm.peak<1,'Synthetic cue PCM is silent, invalid or clipped');
  await input('crank-angle',450);await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'desktop_flow_audio.png')});await assertLayout(page);
  await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();await page.waitForTimeout(300);
  await assertLayout(page);await page.screenshot({path:path.join(output,'mobile_flow.png')});
  return {mutedByDefault:true,noInitialAudioContext:true,flowLayersAndValveGates:true,flowParticlesMove:true,
    flowHiddenWhenExplodedOrIsolated:true,flowPreservesCamera:true,visualRpmRatio:actual/expected,frameStallAngle:stall,
    combustionCueRateHz:eventRate,nominalAudioIndependentOfSlowMotion:true,playbackAudioRateSupported:true,
    audioStopsOnMute:true,playDoesNotAutoUnmute:true,offlinePcm:pcm,desktopMobileNoHorizontalOverflow:true,cfdValidated:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
