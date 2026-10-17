// Adapted from the immutable 2026-10-17 r8_live1 handoff; analyser checks are not listening tests.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertLayout,assertCameraStable,canvasPixels}=require('./qa-runtime.cjs');

runSuite('live-audio',{assembly:'powertrain',mixer:1},async({page,snapshot,input,setPlaying,openSound,selectAssembly,reload,output})=>{
  let s=await snapshot();assert(s.cutaway);assert.equal(s.audio.contextCreated,false);
  assert.equal(s.audio.load,.25);assert.equal(s.pulleyMarks.length,5);assert(s.pulleyMarks.every(m=>m.count===8));
  const desktop=await canvasPixels(page);assert(desktop.color>500);
  await page.screenshot({path:path.join(output,'desktop_live_default.png')});
  const marks=s.pulleyMarks,initialCamera=s;
  await input('crank-angle',45);await page.waitForTimeout(80);s=await snapshot();
  for(const before of marks){const after=s.pulleyMarks.find(m=>m.id===before.id);assert(Math.hypot(...after.witness.map((v,i)=>v-before.witness[i]))>5);}
  assertCameraStable(s,initialCamera);
  await page.locator('#part-search').fill('pulley');
  await page.locator('[data-view="timing"]').click();await page.screenshot({path:path.join(output,'pulley_witnesses.png')});
  await page.locator('[data-view="iso"]').click();await page.locator('#part-search').fill('');
  const camera=await snapshot();
  await page.locator('#audio-all').check();await page.locator('#audio-enabled').check();await setPlaying(true);
  await page.waitForTimeout(250);const starts=(await snapshot()).audio.transportStarts;
  const samples=await page.evaluate(async()=>{
    const samples=[],buffer=new Float32Array(window.__audioProbe.analyser.fftSize);
    for(let i=0;i<180;i++){
      const rpm=850+Math.round(2800*(.5-.5*Math.cos(i/179*Math.PI*2)));
      const slider=document.querySelector('#t4Engine #rpm-slider');slider.value=rpm;slider.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,8));
      window.__audioProbe.analyser.getFloatTimeDomainData(buffer);
      const s=window.engineInspection.snapshot();
      samples.push({rpm:s.nominalRpm,phase:s.audio.phaseAngle,running:s.audio.running,starts:s.audio.transportStarts,
        rms:Math.sqrt(buffer.reduce((sum,x)=>sum+x*x,0)/buffer.length),time:window.__audioProbe.context.currentTime});
    }
    return samples;
  });
  assert(samples.every(s=>s.running&&s.starts===starts),'RPM dragging restarted or stopped audio');
  const rewind=samples.findIndex((s,i)=>i&&s.phase<samples[i-1].phase-1e-7);
  assert(rewind<0,'Audio phase reset during RPM dragging: '+JSON.stringify(samples.slice(Math.max(0,rewind-1),rewind+1)));
  assert(samples.at(-1).phase-samples[0].phase>3000,'Audio phase failed to advance');
  let gap=0,maxGap=0;for(let i=1;i<samples.length;i++){gap=samples[i].rms<1e-6?gap+samples[i].time-samples[i-1].time:0;maxGap=Math.max(gap,maxGap);}
  assert(maxGap<.1,'RPM dragging caused a sustained silent gap');
  assert(samples.filter(s=>s.rms>1e-5).length>samples.length*.85,'Live audio has insufficient rendered signal');
  assert.equal((await snapshot()).audio.sources.includes('turbo'),false);
  await input('rpm',3000);await input('engine-load-number',10);
  assert.equal(await page.locator('#engine-load').inputValue(),'10');
  await page.locator('[data-source="turbo"]').check();await page.waitForTimeout(150);
  const low=(await snapshot()).audio;await input('engine-load',100);
  assert.equal(await page.locator('#engine-load-number').inputValue(),'100');
  await page.waitForTimeout(60);const early=(await snapshot()).audio;
  await page.waitForTimeout(700);const high=(await snapshot()).audio;
  assert(high.turboTargetRpm>low.turboTargetRpm);assert(high.turboFrequency>low.turboFrequency*1.5);
  assert(early.turboShaftRpm<high.turboShaftRpm&&early.turboShaftRpm<early.turboTargetRpm,'Spool-up was instantaneous');
  assert.equal(high.transportStarts,starts);
  await input('engine-load',0);await page.waitForTimeout(120);const down=(await snapshot()).audio;
  assert(down.turboShaftRpm<high.turboShaftRpm&&down.turboShaftRpm>down.turboTargetRpm);
  await input('rpm',1500);await page.waitForTimeout(400);assert((await snapshot()).audio.turboFrequency<high.turboFrequency);
  assertCameraStable(await snapshot(),camera);
  await page.locator('#audio-enabled').uncheck();assert.equal((await snapshot()).audio.running,false);await setPlaying(false);
  await page.locator('#audio-enabled').check();await setPlaying(true);assert((await snapshot()).audio.running);
  await selectAssembly('default');assert((await snapshot()).cutaway);assert.equal((await snapshot()).pulleyMarks.length,5);
  assert.equal((await snapshot()).audio.enabled,false,'Assembly replacement must disarm audio');
  assert.equal(await page.locator('#audio-enabled').isChecked(),false);
  const engineMarks=(await snapshot()).pulleyMarks;
  await input('crank-angle',90);await page.waitForTimeout(80);
  for(const before of engineMarks){const after=(await snapshot()).pulleyMarks.find(m=>m.id===before.id);assert(Math.hypot(...after.witness.map((v,i)=>v-before.witness[i]))>5);}
  await page.locator('[data-view="timing"]').click();await page.waitForTimeout(100);
  await page.screenshot({path:path.join(output,'engine_pulley_witnesses.png')});
  await page.locator('#cutaway').uncheck();assert.equal((await snapshot()).cutaway,false);
  await reload();assert((await snapshot()).cutaway);assert.equal((await snapshot()).audio.contextCreated,false);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await assertLayout(page);const mobile=await canvasPixels(page);assert(mobile.color>100);
  await openSound();await page.locator('#engine-load').scrollIntoViewIfNeeded();await assertLayout(page);
  await page.screenshot({path:path.join(output,'mobile_live_audio.png')});
  return {cutawayDefault:true,allFivePulleysHaveMovingWitnesses:true,bothModelsHaveMovingWitnesses:true,
    continuousAudioDuringDrag:true,transportStarts:starts,dragSamples:samples.length,maxSilentGapSeconds:maxGap,
    minimumRms:Math.min(...samples.map(s=>s.rms)),liveRetimes:high.liveRetimes,
    turboOptIn:true,loadResponse:{lowHz:low.turboFrequency,highHz:high.turboFrequency},spoolLag:true,
    cameraStable:true,assemblyReplacementPausesAndDisarmsAudio:true,desktop,mobile,noPressureSolver:true,noPhysicalAudioValidation:true};
},{initialize:page=>page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
    createDynamicsCompressor(){
      const node=super.createDynamicsCompressor(),analyser=this.createAnalyser();analyser.fftSize=2048;
      node.connect(analyser);window.__audioProbe={context:this,analyser};return node;
    }
  };
})}).catch(error=>{console.error(error);process.exitCode=1;});
