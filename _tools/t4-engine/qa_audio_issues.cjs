// Adapted for the immutable 2026-10-17 r8_live1 runtime; no local CAD endpoints.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout,sources}=require('./qa-runtime.cjs');

runSuite('audio-issues',{flow:1,mixer:1},async({page,snapshot,input,setPlaying,moduleUrls,output})=>{
  const scenario=async type=>{await page.locator('#audio-profile').selectOption('issue');await page.locator('#audio-issue-source').selectOption(type);};
  const clearSources=async()=>{for(const source of sources)await page.locator(`[data-source="${source}"]`).uncheck();};
  assert.equal((await snapshot()).audio.issue.type,'none');assert.equal((await snapshot()).audio.contextCreated,false);
  assert.equal((await snapshot()).referencePoseExports,true,'Scripted issues do not alter frozen export geometry');
  assert.equal(await page.locator('#flow').isChecked(),true);assert((await snapshot()).flow.visible);
  await page.locator('#sound-panel').scrollIntoViewIfNeeded();
  for(const type of ['piston_valve','piston_bearing','weak_cylinder','cylinder_injector','pump_timing']){
    await scenario(type);const s=await snapshot();assert.equal(s.audio.issue.type,type);
    assert.equal(s.audio.enabled,false);assert.equal(s.audio.contextCreated,false);
    assert.equal(await page.locator('.audio-source input:checked').count(),0);
    for(const cylinder of ['1','2','3','4']){
      await page.locator('#audio-issue-cylinder').selectOption(cylinder);
      assert.equal((await snapshot()).audio.issue.cylinder,Number(cylinder));
    }
    if(type==='pump_timing')await page.locator('#audio-issue-cylinder').selectOption('0');
  }
  assert(await page.locator('#audio-strength').isDisabled());assert(await page.locator('#audio-strength-number').isDisabled());
  await input('audio-timing-number',20);assert.equal(await page.locator('#audio-timing-offset').inputValue(),'20');
  const phases=[0,540,180,360],wrap=value=>((value%720)+720)%720;
  for(const scope of [0,2]){
    await page.locator('#audio-issue-cylinder').selectOption(String(scope));
    for(const offset of [-20,0,20]){
      await input('audio-timing-number',offset);
      assert.equal(await page.locator('#audio-timing-offset').inputValue(),String(offset));
      for(const [index,phase] of phases.entries()){
        const angle=wrap(phase+1+(!scope||scope===index+1?offset:0));
        await input('crank-angle',angle);const s=await snapshot();
        assert(s.flow.states[index].fuel>.99,'Fuel overlay did not follow signed per-cylinder injection settings');
        for(const [other,otherPhase] of phases.entries()){
          const local=wrap(angle-otherPhase),fuelPhase=wrap(local-(-10+(!scope||scope===other+1?offset:0)));
          const expectedFuel=fuelPhase<22?Math.sin(Math.PI*fuelPhase/22):0;
          const expectedBurn=local<65?Math.sin(Math.PI*local/65):0;
          assert(Math.abs(s.flow.states[other].fuel-expectedFuel)<1e-9,'Fuel timing leaked into another cylinder');
          assert(Math.abs(s.flow.states[other].burn-expectedBurn)<1e-9,'Injection timing changed combustion phase');
        }
      }
    }
  }
  await page.locator('#audio-issue-cylinder').selectOption('0');await input('audio-timing-offset',0);
  await input('crank-angle',20);assert((await snapshot()).flow.states.every(c=>c.fuel===0));
  const before=await snapshot();await input('audio-timing-offset',-20);const after=await snapshot();
  assert.equal(after.audio.issue.timingOffset,-20);assert.equal(await page.locator('#audio-timing-number').inputValue(),'-20');
  assertCameraStable(after,before);assert.deepEqual(after.pistonMatrices,before.pistonMatrices);
  await input('audio-level-number-exhaust',40);assert.equal(await page.locator('#audio-profile').inputValue(),'custom');
  assert.equal((await snapshot()).audio.issue.type,'pump_timing');
  await page.locator('#audio-issue-source').selectOption('piston_bearing');
  assert.equal(await page.locator('#audio-profile').inputValue(),'issue');
  assert.equal((await snapshot()).audio.issue.cylinder,1);assert(await page.locator('#audio-timing-row').isHidden());
  await input('rpm',900);await page.locator('#audio-enabled').check();
  await page.waitForFunction(()=>window.engineInspection.snapshot().audio.contextCreated);
  await page.locator('[data-source="valves"]').check();await page.locator('#audio-issue-cylinder').selectOption('2');
  await setPlaying(true);await page.waitForTimeout(300);assert.deepEqual((await snapshot()).audio.issueScheduled,{});
  for(const [type,source,wrong] of [['piston_bearing','rotating','valves'],['piston_valve','valves','rotating']]){
    await setPlaying(false);await clearSources();await scenario(type);
    await input('audio-strength',100);await page.locator('#audio-issue-cylinder').selectOption('2');
    await page.locator(`[data-source="${wrong}"]`).check();await setPlaying(true);
    const gated=(await snapshot()).audio.issueScheduled;await page.waitForTimeout(300);
    assert.deepEqual((await snapshot()).audio.issueScheduled,gated,'A different source gate enabled scripted issues');
    await page.locator(`[data-source="${source}"]`).check();const counts=(await snapshot()).audio.issueScheduled;
    await page.waitForFunction(({key,before})=>(window.engineInspection.snapshot().audio.issueScheduled[key]||0)>before+1,
      {key:`${type}:2`,before:counts[`${type}:2`]||0});
    let s=await snapshot();
    for(const cylinder of [1,3,4])assert.equal(s.audio.issueScheduled[`${type}:${cylinder}`]||0,counts[`${type}:${cylinder}`]||0);
    await input('audio-strength-number',0);const zero=(await snapshot()).audio.issueScheduled;await page.waitForTimeout(300);
    assert.deepEqual((await snapshot()).audio.issueScheduled,zero,'Zero strength retained mechanical issue events');
    await input('audio-strength',100);await page.locator('#audio-issue-cylinder').selectOption('1');
    const selected=(await snapshot()).audio.issueScheduled;
    await page.waitForFunction(({key,before})=>(window.engineInspection.snapshot().audio.issueScheduled[key]||0)>before,
      {key:`${type}:1`,before:selected[`${type}:1`]||0});
    s=await snapshot();assert.equal(s.audio.issueScheduled[`${type}:2`],selected[`${type}:2`]);
    await page.locator(`[data-source="${source}"]`).uncheck();const stopped=(await snapshot()).audio.issueScheduled;
    await page.waitForTimeout(200);assert.deepEqual((await snapshot()).audio.issueScheduled,stopped);
  }
  await page.locator('[data-source="valves"]').check();await page.locator('#audio-enabled').uncheck();
  assert.equal((await snapshot()).audio.running,false);const stopped=(await snapshot()).audio.issueScheduled;
  await page.waitForTimeout(160);assert.deepEqual((await snapshot()).audio.issueScheduled,stopped);
  await setPlaying(false);await setPlaying(true);assert.equal((await snapshot()).audio.enabled,false);
  await setPlaying(false);await clearSources();
  await page.locator('#audio-profile').selectOption('normal');assert.equal((await snapshot()).audio.issue.type,'none');
  assert(await page.locator('#audio-cylinder-row').isHidden());assert(await page.locator('#audio-timing-row').isHidden());
  const pcm=await page.evaluate(async urls=>{
    const {cue,noiseSamples}=await import(urls.audio),{issueTreatment}=await import(urls.audio_issues);
    const render=async(event,issue)=>{
      const c=new OfflineAudioContext(1,12000,48000),noise=c.createBuffer(1,48000,48000);noise.copyToChannel(noiseSamples(48000),0);
      const treatment=issueTreatment(event,issue);cue(c,c.destination,noise,event,.02,treatment.level,treatment);
      const samples=(await c.startRendering()).getChannelData(0);let sum=0,peak=0;
      for(const value of samples){if(!Number.isFinite(value))throw new Error('Non-finite issue PCM');sum+=value*value;peak=Math.max(peak,Math.abs(value));}
      return {rms:Math.sqrt(sum/samples.length),peak};
    };
    const contact=await render({source:'valves',cylinder:1,angle:360,issue:'piston_valve'},{type:'piston_valve',cylinder:1,strength:1});
    const bearing=await render({source:'rotating',cylinder:1,angle:8,issue:'piston_bearing'},{type:'piston_bearing',cylinder:1,strength:1});
    const dead=await render({source:'combustion',cylinder:1,angle:0},{type:'weak_cylinder',cylinder:1,strength:1});
    const other=await render({source:'combustion',cylinder:2,angle:540},{type:'weak_cylinder',cylinder:1,strength:1});
    return {contact,bearing,dead,other};
  },moduleUrls);
  assert(pcm.contact.rms>0&&pcm.bearing.rms>0&&pcm.other.rms>0);assert.equal(pcm.dead.rms,0);
  assert(pcm.contact.peak<1&&pcm.bearing.peak<1);
  await scenario('pump_timing');await input('audio-timing-number',15);
  await page.locator('#audio-profile').scrollIntoViewIfNeeded();await assertLayout(page);
  await page.screenshot({path:path.join(output,'desktop_engine_issues.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#audio-profile').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);await assertLayout(page);await page.screenshot({path:path.join(output,'mobile_engine_issues.png')});
  return {mutedByDefault:true,scenarioSelectionDoesNotEnableSound:true,allCylindersSelectable:true,
    scriptedContactAndBearingEventsIsolated:true,sourceGatesRespected:true,zeroStrengthStopsMechanicalEvents:true,
    signedPumpTimingAndFlowAgree:true,selectedCylinderTimingIsolated:true,injectionTimingLeavesBurnAndPistonsUnchanged:true,
    customPreservesScenario:true,normalClearsScenario:true,muteStopsEvents:true,playDoesNotAutoUnmute:true,
    offlinePcm:pcm,desktopMobileLayout:true,collisionSolved:false,combustionSolved:false,physicalFaultSoundsValidated:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
