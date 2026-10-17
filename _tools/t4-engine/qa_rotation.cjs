// Adapted from the immutable 2026-10-17 r8_live1 handoff; static assets only.
const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout,canvasPixels}=require('./qa-runtime.cjs');

runSuite('rotation',{},async({page,snapshot,input,setPlaying,navigateAssembly,assetUrl,output})=>{
  const reports=[];
  for(const assembly of ['default','powertrain']){
    if(assembly==='powertrain'||(await snapshot()).powertrain)await navigateAssembly(assembly);
    const response=await page.request.get(assetUrl(assembly,'manifest.json'));assert(response.ok());
    const manifest=await response.json();
    assert.equal(manifest.rotation_convention.crank_sign,-1);
    assert.equal(manifest.model_revision,assembly==='default'?7:8);
    await page.locator('[data-view="timing"]').click();await input('crank-angle',0);
    const camera=await snapshot();
    const initial=await canvasPixels(page);
    // The drivetrain's gray wheel hides most colored engine surfaces from +X.
    const visible=initial.color>200||(assembly==='powertrain'&&initial.color>50&&initial.contrast>1000);
    assert(visible,'Timing-end assembly lacks expected rendered geometry: '+JSON.stringify(initial));
    await page.screenshot({path:path.join(output,assembly+'_clockwise_000.png')});
    for(const angle of [30,90,180,360,720]){
      await input('crank-angle',angle);const s=await snapshot();
      assertCameraStable(s,camera);assert.equal(s.audio.enabled,false);
      for(const item of s.motionMatrices){
        const part=manifest.parts.find(p=>p.id===item.id);
        if(part.motion.type!=='rotate')continue;
        assert(Math.abs(item.matrix[9]-Math.sin(angle*Math.PI/180*part.motion.ratio))<1e-8,item.id+' has the wrong rotation sign');
      }
      const rod=s.motionMatrices.find(p=>p.id==='rod_0').matrix;
      const reference=manifest.parts.find(p=>p.id==='rod_0').motion.reference_big;
      const pin=[reference[0],0,reference[2]+manifest.parameters.rod_length];
      const transformed=row=>rod[row]*pin[0]+rod[4+row]*pin[1]+rod[8+row]*pin[2]+rod[12+row];
      assert(Math.abs(transformed(1))<1e-7,'Rod small end left the cylinder axis');
      assert(Math.abs(transformed(2)-s.cylinderStates[0].pinZ)<1e-7);
      if(angle===30){
        const crank=s.motionMatrices.find(p=>p.id==='crankshaft');
        const projected=await page.evaluate(async ({matrix,camera,target})=>{
          const THREE=await import('three');
          const view=new THREE.PerspectiveCamera(40,1,1,15000);view.up.set(0,0,1);
          view.position.fromArray(camera);view.lookAt(new THREE.Vector3(...target));view.updateMatrixWorld(true);
          const top=new THREE.Vector3(0,0,50),before=top.clone().project(view);
          const after=top.applyMatrix4(new THREE.Matrix4().fromArray(matrix)).project(view);
          return {before:before.toArray(),after:after.toArray()};
        },{matrix:crank.matrix,camera:s.camera,target:s.target});
        assert(projected.after[0]>projected.before[0],'Top crank point must move screen-right (clockwise) from the timing end');
        await page.screenshot({path:path.join(output,assembly+'_clockwise_030.png')});
      }
      if(assembly==='powertrain'){
        const inputShaft=s.motionMatrices.find(p=>p.id==='drive_input_shaft').matrix;
        const pressure=s.motionMatrices.find(p=>p.id==='drive_pressure_plate').matrix;
        assert(Math.abs(inputShaft[9]-Math.sin(angle*Math.PI/180))<1e-8);
        assert(Math.abs(pressure[9]-inputShaft[9])<1e-8);
      }
    }
    await input('crank-angle',0);await setPlaying(true);await page.waitForTimeout(200);
    const before=await snapshot();await page.waitForTimeout(200);const after=await snapshot();
    assert(after.absoluteAngle>before.absoluteAngle,'Cycle progress must still advance');
    assert.notDeepEqual(after.motionMatrices,before.motionMatrices);
    assertCameraStable(after,camera);await setPlaying(false);
    await input('crank-angle',718);await setPlaying(true);
    await page.waitForFunction(()=>window.engineInspection.snapshot().absoluteAngle>725);
    const crossed=await snapshot();assert(crossed.angle<720&&crossed.absoluteAngle>720);
    for(const id of ['intermediate_sprocket','alternator_rotor']){
      const ratio=manifest.parts.find(part=>part.id===id).motion.ratio;
      const actual=crossed.motionMatrices.find(part=>part.id===id).matrix[9];
      assert(Math.abs(actual-Math.sin(crossed.absoluteAngle*Math.PI/180*ratio))<1e-8,id+' jumped at the engine-cycle boundary');
    }
    assertCameraStable(crossed,camera);await setPlaying(false);
    reports.push({assembly,clockwiseProjectedFromTimingEnd:true,drivenAndReverseBendSigns:true,rodPinAligned:true,fractionalAccessoryRotationContinuousAcross720:true,
      cycleProgressStillForward:true,cameraStable:true,audioStartsOff:true,coloredPixels:initial.color,contrastingPixels:initial.contrast});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();await page.waitForTimeout(200);
  await assertLayout(page);const mobile=await canvasPixels(page);assert(mobile.color>100,'Mobile rotation canvas is blank');
  await page.screenshot({path:path.join(output,'mobile_clockwise.png')});
  return {reports,mobile,physicalRotationValidated:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
