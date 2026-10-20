const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertModelState,assertCameraStable,assertLayout,canvasPixels}=require('./qa-runtime.cjs');

runSuite('mechanics',{assembly:'powertrain',scope:'gearbox'},async({page,snapshot,input,setPlaying,selectAssembly,assetUrl,manifest,output})=>{
  const ui=page.locator('#t4Engine');assert.equal((await snapshot()).inspectionScope,'gearbox');
  const ledger=await (await page.request.get(assetUrl('powertrain','component_references.json'))).json();
  assert.equal(ledger.external_meshes_imported,false);assert.equal(ledger.photo_scale_calibrated,false);
  for(const id of ['ovoko_huj1820','aspl_a0006','aspl_s0005'])assert(ledger.assets.some(asset=>asset.id===id&&asset.photo_informed_cad));
  assert.equal(await ui.locator('#component-references').evaluate(element=>element.href),assetUrl('powertrain','component_references.json'));
  await ui.locator('#cutaway').uncheck();let state=await snapshot();
  for(const id of ['drive_gearcase','drive_output_extension','drive_shaft_bracket','starter','starter_solenoid','starter_pinion','drive_engine_backplate'])assert(state.visibleParts.includes(id),id);
  for(const id of ['block','drive_tyre_left'])assert(!state.visibleParts.includes(id),id);
  const desktop=await canvasPixels(page);assert(desktop.contrast>1000);
  await page.screenshot({path:path.join(output,'mechanics_gearbox_castings.png')});
  const camera=await snapshot(),before=state.driveMatrices;
  await input('crank-angle',140);const after=(await snapshot()).driveMatrices;
  for(const id of ['drive_output_extension','drive_shaft_bracket'])assert.deepEqual(before.find(p=>p.id===id).matrix,after.find(p=>p.id===id).matrix,id);
  for(const id of ['drive_intermediate','drive_flange_right'])assert.notDeepEqual(before.find(p=>p.id===id).matrix,after.find(p=>p.id===id).matrix,id);
  await input('rpm-slider',1735);await ui.locator('#drive-gear').selectOption('R');assertCameraStable(await snapshot(),camera);
  await ui.locator('#drive-gear').selectOption('1');await setPlaying(true);await page.waitForTimeout(150);
  assertCameraStable(await snapshot(),camera);await setPlaying(false);
  const starter=await (await page.request.get(assetUrl('powertrain','starter_reference.json'))).json();
  assert.equal(starter.drive_direction,'+X toward flywheel');assert.equal(starter.installed_variant_verified,false);
  await ui.locator('#part-search').fill('Ribbed long-side');await ui.locator('[data-part="drive_output_extension"] button').click();
  assertCameraStable(await snapshot(),camera);await page.screenshot({path:path.join(output,'gearbox_output_extension_highlight.png')});
  await ui.locator('#part-search').fill('');await ui.locator('#cutaway').check();
  await page.screenshot({path:path.join(output,'mechanics_gearbox_cutaway.png')});
  await ui.locator('#inspection-scope').selectOption('clutch');assert((await snapshot()).visibleParts.includes('starter'));
  const audit=await (await page.request.get(assetUrl('powertrain','interference_report.json'))).json();
  assert.equal(audit.unresolved_count,0);assert.equal(audit.documented_attachment_count,18);
  await ui.locator('#inspection-scope').selectOption('all');await selectAssembly('vehicle');assertModelState(await snapshot(),'vehicle');
  assert.equal((await snapshot()).vehicle,true);
  assert.equal(await ui.locator('#component-references').evaluate(element=>element.href),assetUrl('vehicle','component_references.json'));
  await ui.locator('#cutaway').uncheck();
  const {scopeIncludes}=await import('../../src/t4-engine/release-2026-10-20/inspection.mjs');
  const vehicleManifest=manifest('vehicle'),scopes=[];
  for(const scope of ['all','engine','clutch','gearbox','final-drive','axles','wheels','vehicle']){
    await ui.locator('#inspection-scope').selectOption(scope);const scoped=await snapshot();
    const expected=vehicleManifest.parts.filter(part=>scopeIncludes(part,scope)).map(part=>part.id).sort();
    assert.deepEqual([...scoped.visibleParts].sort(),expected,scope);assert.equal(scoped.inspectionScope,scope);scopes.push({scope,parts:expected.length});
    const pose=await snapshot();await input('rpm-slider',1800);await input('drive-bias-number',35);assertCameraStable(await snapshot(),pose);
  }
  await ui.locator('#inspection-scope').selectOption('all');await ui.locator('#fit').click();
  const vehicleDesktop=await canvasPixels(page);assert(vehicleDesktop.contrast>1000);
  await page.screenshot({path:path.join(output,'mechanics_swb_vehicle.png')});
  assert.equal(vehicleManifest.vehicle.repair_ready,false);assert.equal(vehicleManifest.vehicle.whole_vehicle_physics_solved,false);
  assert.equal(vehicleManifest.vehicle.parameters.wheelbase,2920);
  await ui.locator('#part-search').fill('vehicle_radiator');await ui.locator('[data-part="vehicle_radiator"] button').click();
  assert.equal((await snapshot()).selected,'vehicle_radiator');
  assert.equal(await ui.locator('#download-glb,#download-step,#download-zip,#download-part').count(),0);
  await ui.locator('#part-search').fill('');await page.setViewportSize({width:390,height:844});await ui.locator('#fit').click();await assertLayout(page);
  const mobile=await canvasPixels(page);assert(mobile.contrast>200);await page.screenshot({path:path.join(output,'mechanics_swb_mobile.png'),fullPage:true});
  await selectAssembly('default');assert.equal((await snapshot()).vehicle,false);assertModelState(await snapshot(),'default');
  assert.equal(await ui.locator('#component-references').evaluate(element=>element.href),assetUrl('default','component_references.json'));
  return {assemblies:[271,400,435],desktop,vehicleDesktop,mobile,scopes,gearboxScope:true,clutchStarterScope:true,
    staticCastingsAndMovingOutput:true,cameraStable:true,geometryDownloads:false,
    audit:{unresolved:audit.unresolved_count,documentedAttachments:audit.documented_attachment_count},repairReady:false,wholeVehiclePhysicsSolved:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
