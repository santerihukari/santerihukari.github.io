const assert=require('node:assert/strict'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout,canvasPixels}=require('./qa-runtime.cjs');
const {downloadPublished}=require('./qa_downloads.cjs');

runSuite('service',{assembly:'powertrain',part:'alternator',service:'part'},async({page,snapshot,selectAssembly,assetUrl,output,engineUrl,baseUrl,moduleUrls})=>{
  const ui=page.locator('#t4Engine'),panel=ui.locator('#service-panel');
  const ready=count=>page.waitForFunction(count=>window.engineInspection?.snapshot().service?.part_count===count,count);
  await ready(400);assert.equal((await snapshot()).selected,'alternator');
  assert.match(await panel.innerText(),/A0006/);assert.match(await panel.innerText(),/unidentified/);
  assert.equal(await panel.locator('a').first().getAttribute('href'),'https://as-pl.com/en/p/A0006');
  assert.equal(await panel.locator('a').first().getAttribute('target'),'_blank');
  assert.match(await panel.locator('a').first().getAttribute('rel'),/noopener/);
  const desktop=await canvasPixels(page);assert(desktop.contrast>1000);
  await page.screenshot({path:path.join(output,'service_parts_desktop.png')});
  const camera=await snapshot();await ui.locator('#part-search').fill('0120485036');
  assert.equal(await ui.locator('.part-row').count(),4);
  await ui.locator('[data-part="alternator_rotor"] button').click();
  assert.match(await panel.innerText(),/Parent assembly, not this individual submesh/);
  assertCameraStable(await snapshot(),camera);
  await ui.locator('#labels').check();await ui.locator('#label-mode').selectOption('references');
  await page.waitForFunction(()=>document.querySelector('#t4Engine #labels-overlay').textContent.includes('Assembly example'));
  await ui.locator('#part-search').fill('');await ui.locator('#service-filter').selectOption('examples');
  const catalogue=await (await page.request.get(assetUrl('powertrain','service_catalogue.json'))).json();
  assert.equal(await ui.locator('.part-row').count(),catalogue.summary.parts_with_examples);
  const gate=await page.evaluate(async({url,catalogue})=>{
    const {ServicePanel}=await import(url),panel=document.createElement('div'),service=new ServicePanel(panel);
    const joint=catalogue.joints.head_to_block;
    const synthetic={status:'verified',joint_id:joint.id,reviewed_on:'2026-10-19',
      source:{kind:'workshop_manual',url:'https://example.invalid/synthetic-only',document:'Synthetic fixture only',section:'Test'},
      applicability:{engine_or_gearbox_code:'TEST',fastener:'TEST',configuration:'TEST',matched_to_fitted_vehicle:true},
      conditions:'Synthetic only',sequence:'Synthetic only',replace_fastener:true,stages:[{value:1,unit:'Nm'}]};
    service.tab='fasteners';service.selected='head_bolt_0_1';
    const render=procedure=>{joint.tightening=procedure;service.load(catalogue);return panel.textContent;};
    return {exact:render(synthetic),wrongJoint:render({...synthetic,joint_id:'different_synthetic_joint'}),
      unmatched:render({...synthetic,applicability:{...synthetic.applicability,matched_to_fitted_vehicle:false}}),
      generic:render({...synthetic,source:{...synthetic.source,kind:'retailer'}})};
  },{url:moduleUrls.service,catalogue:structuredClone(catalogue)});
  assert.match(gate.exact,/1 Nm/);
  for(const key of ['wrongJoint','unmatched','generic']){
    assert.doesNotMatch(gate[key],/1 Nm/);assert.match(gate[key],/no torque recommendation/);
  }
  await page.evaluate(()=>{
    const outsider=document.createElement('button');outsider.hidden=true;outsider.id='t4-test-unrelated-tab';
    outsider.dataset.serviceTab='part';outsider.setAttribute('aria-selected','unrelated');document.body.append(outsider);
  });
  await ui.locator('#part-search').fill('S0005');await ui.locator('[data-part="starter"] button').click();
  await ui.locator('#service-tab-fasteners').click();
  assert.equal(await page.locator('#t4-test-unrelated-tab').getAttribute('aria-selected'),'unrelated','Service tab updates escaped the scoped adapter');
  await page.locator('#t4-test-unrelated-tab').evaluate(element=>element.remove());
  assert.match(await panel.innerText(),/Unverified joint: no torque recommendation/);
  assert.match(await panel.innerText(),/Required socket/);assert.doesNotMatch(await panel.innerText(),/\d+(?:\.\d+)?\s*(?:Nm|N\s*m)\b/);
  await page.screenshot({path:path.join(output,'service_fasteners_desktop.png')});
  await ui.locator('#service-tab-capture').click();assert.match(await panel.innerText(),/not captured/);
  assert.equal(await panel.locator('[data-capture-job="identity"]').getAttribute('open'),'');
  await page.screenshot({path:path.join(output,'service_capture_desktop.png')});
  await ui.locator('#service-tab-capture').focus();await page.keyboard.press('Home');
  assert.equal(await ui.locator('#service-tab-motonet').getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await ui.locator('#service-tab-capture').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await ui.locator('#service-tab-motonet').getAttribute('aria-selected'),'true');
  const downloads=[];
  for(const [variant,count] of [['powertrain',400],['vehicle',435],['default',271]]){
    await ui.locator('#service-filter').selectOption('all');await ui.locator('#part-search').fill('');
    if(variant!=='powertrain')await selectAssembly(variant);await ready(count);
    const metadata=await (await page.request.get(assetUrl(variant,'service_catalogue.json'))).json();
    assert.equal(Object.keys(metadata.parts).length,count);assert.equal(metadata.summary.verified_tightening_procedures,0);
    assert.equal(metadata.summary.identified_fitted_parts,0);
    for(const [id,file] of [['download-service','service_catalogue.json'],['service-csv','parts_service.csv'],['capture-json','capture_plan.json']]){
      downloads.push({variant,...await downloadPublished({page,output,assetUrl},variant,id,file)});
    }
  }
  await ui.locator('#part-search').fill('head_bolt_0_1');await ui.locator('[data-part="head_bolt_0_1"] button').click();
  await ui.locator('#service-tab-fasteners').click();
  const head=await panel.innerText();assert.match(head,/8 \(not an installed count\)/);assert.match(head,/10 head bolts/);
  assert.match(head,/not a repair BOM/);assert.doesNotMatch(head,/\d+(?:\.\d+)?\s*Nm\b/);
  await ui.locator('#isolate').check();assert.deepEqual((await snapshot()).visibleParts,['head_bolt_0_1']);
  await ui.locator('#isolate').uncheck();
  await page.setViewportSize({width:390,height:844});await ui.locator('#fit').click();await assertLayout(page);
  const mobile=await canvasPixels(page);assert(mobile.contrast>200);
  await page.screenshot({path:path.join(output,'service_mobile.png'),fullPage:true});
  await panel.screenshot({path:path.join(output,'service_mobile_fasteners.png')});

  // An isolated page audits its intentional 404 without weakening the normal suite's network checks.
  const fallbackContext=await page.context().browser().newContext({viewport:{width:1440,height:1000}});
  const fallback=await fallbackContext.newPage(),fallbackErrors=[],fallbackRequests=[],fallbackResponses=[],fallbackConsole=[];
  const missingUrl=assetUrl('default','service_catalogue.json');
  fallback.on('pageerror',error=>fallbackErrors.push(error.message));
  fallback.on('request',request=>fallbackRequests.push({url:request.url(),method:request.method()}));
  fallback.on('response',response=>{if(response.status()>=400)fallbackResponses.push({url:response.url(),status:response.status()});});
  fallback.on('console',message=>{if(message.type()==='error')fallbackConsole.push({text:message.text(),url:message.location().url});});
  try{
    await fallback.route(missingUrl,route=>route.fulfill({status:404,contentType:'text/plain',body:'Metadata unavailable (intentional test)'}));
    const url=new URL(engineUrl);url.search='?assembly=engine';const response=await fallback.goto(url.href,{waitUntil:'domcontentloaded'});assert(response.ok());
    await fallback.locator('#t4Engine[data-state="ready"]').waitFor({timeout:60000});
    await fallback.waitForFunction(()=>window.engineInspection?.snapshot().partCount===271&&/unavailable/i.test(document.querySelector('#t4Engine #service-panel').textContent));
    const state=await fallback.evaluate(()=>window.engineInspection.snapshot());assert.equal(state.service,null);assert.equal(state.audio.enabled,false);
    assert.deepEqual(fallbackErrors,[]);assert.deepEqual(fallbackResponses,[{url:missingUrl,status:404}]);
    assert(fallbackConsole.every(error=>error.url===missingUrl&&/404/.test(error.text)),JSON.stringify(fallbackConsole));
    for(const request of fallbackRequests){
      const url=new URL(request.url);assert.equal(request.method,'GET');assert.notEqual(url.port,'8770');
      assert(!/\/(?:api|model-files|download)(?:\/|$)/.test(url.pathname));
      if(url.origin===new URL(baseUrl).origin)assert(url.pathname.startsWith(new URL(baseUrl).pathname),'Fallback escaped nested prefix');
    }
    const fallbackPixels=await canvasPixels(fallback);assert(fallbackPixels.contrast>1000);
    await fallback.locator('[data-engine-mode=simulate]').click();await fallback.locator('#t4Engine #play').click();await fallback.waitForTimeout(150);
    assert((await fallback.evaluate(()=>window.engineInspection.snapshot())).absoluteAngle>state.absoluteAngle);
    await fallback.screenshot({path:path.join(output,'service_metadata_missing.png')});
  }finally{await fallbackContext.close();}
  return {assemblies:[271,400,435],desktop,mobile,referenceSearch:true,parentAssemblyWarning:true,staticCamera:true,
    labelledExamples:true,tabKeyboardNavigation:true,scopedTabs:true,syntheticExactJointTorqueGate:true,noGuessedTorques:true,headBoltDiscrepancy:true,
    actualDownloads:downloads,metadata404KeepsModelAndMotion:true,physicalRepairValidated:false};
}).catch(error=>{console.error(error);process.exitCode=1;});
