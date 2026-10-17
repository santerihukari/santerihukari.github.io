// Adapted from the immutable r8_live1 handoff; fixed geometry replaces local CAD regeneration.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {runSuite,assertModelState,assertCameraStable,assertLayout,canvasPixels}=require('./qa-runtime.cjs');

runSuite('powertrain',{assembly:'powertrain'},async({page,snapshot,input,setPlaying,selectAssembly,reload,assetUrl,output})=>{
  let s=await snapshot();assert.equal(s.partCount,398);assert.equal(s.audio.enabled,false);assert.equal(s.audio.contextCreated,false);
  assert.equal(await page.locator('#assembly-variant').inputValue(),'powertrain');
  await page.waitForTimeout(250);await page.screenshot({path:path.join(output,'desktop_powertrain.png')});
  const camera=await snapshot(),pixels=()=>canvasPixels(page);
  const initial=await pixels();assert(initial.color>500);
  await page.locator('#cutaway').check();await setPlaying(true);await page.waitForTimeout(350);
  const before=await snapshot(),image1=await pixels();await page.waitForTimeout(350);const after=await snapshot(),image2=await pixels();
  assert(after.drivePhases.left>before.drivePhases.left);assert.notDeepEqual(before.driveMatrices,after.driveMatrices);assert.notEqual(image1.checksum,image2.checksum);
  await page.locator('#drive-gear').selectOption('N');const n=(await snapshot()).drivePhases;
  await page.waitForTimeout(160);s=await snapshot();assert.equal(s.drivePhases.left,n.left);assert(s.drivePhases.input>n.input);
  for(const gear of ['1','2','3','4','5']){
    await page.locator('#drive-gear').selectOption(gear);assert((await snapshot()).driveReadout.carrierRpm>0);
  }
  await page.locator('#drive-gear').selectOption('2');
  await input('drive-clutch-number',0);assert.equal(await page.locator('#drive-clutch').inputValue(),'0');
  const off=(await snapshot()).drivePhases;await page.waitForTimeout(150);s=await snapshot();assert.equal(s.drivePhases.input,off.input);assert.equal(s.driveReadout.roadKph,0);
  assert.equal(s.driveMatrices.find(m=>m.id==='drive_release_bearing').matrix[12],6);
  await input('drive-clutch',100);assert.equal(await page.locator('#drive-clutch-number').inputValue(),'100');
  await page.locator('#drive-gear').selectOption('R');assert((await snapshot()).driveReadout.roadKph<0);
  await input('drive-bias-number',100);assert.equal(await page.locator('#drive-bias').inputValue(),'100');
  s=await snapshot();assert.equal(s.driveReadout.leftRpm,0);assert(Math.abs(s.driveReadout.rightRpm/2-s.driveReadout.carrierRpm)<1e-8);
  assertCameraStable(s,camera);await setPlaying(false);
  await page.screenshot({path:path.join(output,'desktop_drivetrain_cutaway.png')});
  await page.locator('#part-search').fill('tyre');await page.locator('[data-part="drive_tyre_left"] button').click();
  assert.equal(await page.locator('#download-part').getAttribute('href'),assetUrl('powertrain','parts/drive_tyre_left.stl'));
  await page.locator('#part-search').fill('');
  const checkDownloads=async(variant,part)=>{
    const downloads=[];
    for(const [id,file] of [['glb','engine_assembly.glb'],['step','engine_assembly.step'],['zip','engine_parts.zip'],['part',`parts/${part}.stl`]]){
      const href=await page.locator('#download-'+id).getAttribute('href');assert.equal(href,assetUrl(variant,file));
      const pending=page.waitForEvent('download');await page.locator('#download-'+id).click();const download=await pending;
      const destination=path.join(output,variant+'-'+path.basename(file));await download.saveAs(destination);assert.equal(await download.failure(),null);
      const actual=fs.readFileSync(destination);
      const expected=fs.readFileSync(path.join(__dirname,'../../assets/models',
        variant==='powertrain'?'vw-t4-powertrain/r8':'vw-t4-engine/r7',file));
      assert.equal(actual.length,expected.length);assert.equal(crypto.createHash('sha256').update(actual).digest('hex'),crypto.createHash('sha256').update(expected).digest('hex'));
      if(id==='glb')assert.equal(actual.subarray(0,4).toString(),'glTF');
      if(id==='step')assert(actual.toString().startsWith('ISO-10303-21'));
      downloads.push({file,bytes:actual.length});
    }
    return downloads;
  };
  const powertrainDownloads=await checkDownloads('powertrain','drive_tyre_left');
  const response=await page.request.get(assetUrl('powertrain','manifest.json'));assert(response.ok());const manifest=await response.json();
  assert.equal(manifest.powertrain.measurements_verified,false);assert.equal(manifest.engine_geometry_revision,7);
  assertModelState(await snapshot(),'powertrain');
  assert.equal(await page.locator('#apply:not(:disabled)').count(),0,'Static app must not offer CAD regeneration');
  assert(await page.locator('#geometry-fields dd').count()>20,'Engine reference dimensions are missing');
  const dimensions=await page.locator('#drive-geometry-fields').textContent();
  assert(dimensions.includes(`${manifest.powertrain.geometry_parameters.clutch_diameter} mm`),'Clutch reference must match the frozen manifest');
  const editable=await page.locator('.parameters input:not(#sound-panel input), #powertrain-geometry input').evaluateAll(inputs=>
    inputs.filter(input=>!input.disabled&&!input.readOnly).map(input=>input.id||input.name));
  assert.deepEqual(editable,[],'Authoring dimensions must be read-only');
  const saved=(await snapshot()).driveState;
  await selectAssembly('default');assert.equal((await snapshot()).partCount,271);assert(await page.locator('#drive-controls').isHidden());
  assert.equal((await snapshot()).cutaway,true);
  await page.locator('#part-search').fill('crankshaft');await page.locator('[data-part="crankshaft"] button').click();
  const engineDownloads=await checkDownloads('default','crankshaft');
  await page.locator('#part-search').fill('');
  await selectAssembly('powertrain');assert.equal(await page.locator('#drive-gear').inputValue(),'R');
  assert.deepEqual((await snapshot()).driveState,saved);
  await page.locator('#drive-gear').selectOption('1');await input('drive-bias',0);await page.locator('#cutaway').uncheck();
  await selectAssembly('default');assert.equal((await snapshot()).cutaway,false);
  await selectAssembly('powertrain');assert.equal((await snapshot()).cutaway,false);
  await reload();assertModelState(await snapshot(),'powertrain');assert.equal((await snapshot()).audio.contextCreated,false);
  await page.locator('#cutaway').uncheck();
  await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();await page.waitForTimeout(300);
  const mobile=await pixels();assert(mobile.color>200);await assertLayout(page);
  await page.screenshot({path:path.join(output,'mobile_powertrain.png')});
  await page.locator('#drive-controls').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'mobile_drivetrain_controls.png')});
  assert(await page.locator('.drive-row').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  return {parts:398,desktop:initial,mobile,movingWheelMeshes:true,neutralStopsWheelsNotInput:true,
    clutchOpenStopsDrivenTrain:true,releaseTravelVisible:true,allForwardGears:true,reverseAndDifferential:true,cameraStable:true,
    fixedGeometrySnapshotVerified:true,actualCadRegeneration:false,settingsPreserved:true,cutawayChoicePreserved:true,
    engineOnlyRetained:true,selectedModelReload:true,powertrainDownloads,engineDownloads,audioStartsOff:true,desktopMobileLayout:true,
    physicalFitValidated:false,drivetrainDynamicsSolved:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
