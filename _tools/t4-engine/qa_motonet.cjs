const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runSuite,assertCameraStable,assertLayout,canvasPixels}=require('./qa-runtime.cjs');
const {downloadPublished}=require('./qa_downloads.cjs');

runSuite('motonet',{assembly:'powertrain',part:'alternator',service:'motonet'},async({page,snapshot,selectAssembly,assetUrl,output})=>{
  const ui=page.locator('#t4Engine'),panel=ui.locator('#service-panel');
  await page.waitForFunction(()=>window.engineInspection?.snapshot().service?.part_count===400);
  assert.equal(await ui.locator('#service-tab-motonet').getAttribute('aria-selected'),'true');
  assert.match(await panel.innerText(),/229 listings/);assert.match(await panel.innerText(),/ZERO fitted matches/);
  const first=panel.locator('[data-retailer-sku="13-2300"]');assert(await first.isVisible());
  const href=await first.locator('a').first().getAttribute('href'),url=new URL(href);
  assert.equal(url.hostname,'www.motonet.fi');assert(url.pathname.startsWith('/tuote/laturi-13-2300'));
  assert.equal(url.searchParams.get('product'),'13-2300');assert.match(await first.innerText(),/028 903 029 M/);
  await page.screenshot({path:path.join(output,'motonet_alternator_desktop.png')});
  const desktop=await canvasPixels(page);assert(desktop.contrast>1000);
  const catalogue=await (await page.request.get(assetUrl('powertrain','service_catalogue.json'))).json();
  await ui.locator('#service-filter').selectOption('motonet');
  assert.equal(await ui.locator('.part-row').count(),catalogue.retailer_research.summary.parts_with_replacement_candidates);
  const camera=await snapshot();await ui.locator('#part-search').fill('13-2300');assert.equal(await ui.locator('.part-row').count(),4);
  await ui.locator('[data-part="alternator_rotor"] button').click();assertCameraStable(await snapshot(),camera);
  assert.match(await panel.innerText(),/Complete alternator/);
  await ui.locator('#labels').check();await ui.locator('#label-mode').selectOption('motonet');
  await page.waitForFunction(()=>document.querySelector('#t4Engine #labels-overlay').textContent.includes('Motonet candidate'));
  await ui.locator('#part-search').fill('028 903 029 M');assert.equal(await ui.locator('.part-row').count(),4);
  await ui.locator('#part-search').fill('25-00068');assert.equal(await ui.locator('.part-row').count(),8);
  await ui.locator('[data-part="head_bolt_0_1"] button').click();assert.match(await panel.innerText(),/CAD has only 8/);
  await ui.locator('#service-tab-fasteners').click();assert.match(await panel.innerText(),/10 head bolts/);
  assert.match(await panel.innerText(),/no torque recommendation/);assert.doesNotMatch(await panel.innerText(),/\d+(?:\.\d+)?\s*Nm\b/);
  await ui.locator('#service-tab-motonet').click();await ui.locator('#part-search').fill('block');
  assert.equal(await ui.locator('.part-row').count(),0);
  await ui.locator('#service-filter').selectOption('all');await ui.locator('[data-part="block"] button').click();
  assert.match(await panel.innerText(),/No direct replacement identified/);assert.match(await panel.innerText(),/Related items only/);
  await ui.locator('#part-search').fill('drive_gearcase');await ui.locator('[data-part="drive_gearcase"] button').click();
  assert.match(await panel.innerText(),/No direct replacement identified/);
  await ui.locator('#part-search').fill('15-0167');await ui.locator('[data-part="oil_filter"] button').click();
  assert.match(await panel.innerText(),/Screened out for stated configuration/);
  await panel.locator('[data-retailer-sku="15-0167"] summary').first().click();
  assert.match(await panel.locator('[data-retailer-sku="15-0167"]').innerText(),/ends July 1996/);
  const downloads=[];
  for(const [variant,count] of [['powertrain',400],['vehicle',435],['default',271]]){
    await ui.locator('#part-search').fill('');if(variant!=='powertrain')await selectAssembly(variant);
    await page.waitForFunction(n=>window.engineInspection?.snapshot().service?.part_count===n,count);
    const download=await downloadPublished({page,output,assetUrl},variant,'motonet-csv','motonet_replacements.csv');downloads.push({variant,...download});
    const csv=fs.readFileSync(path.join(output,variant+'-motonet_replacements.csv'),'utf8');
    for(const term of ['13-2300','screened_out','https://www.motonet.fi/tuote/'])assert(csv.includes(term));
    const response=await page.request.get(assetUrl(variant,'motonet_research.json'));assert(response.ok());
    assert.equal((await response.json()).summary.distinct_listings_reviewed,229);
    assert((await page.request.get(assetUrl(variant,'motonet_research.md'))).ok());
    if(variant==='vehicle'){
      await ui.locator('#part-search').fill('radiator');await ui.locator('[data-part="vehicle_radiator"] button').click();
      assert.match(await panel.innerText(),/Radiator/);await ui.locator('#part-search').fill('');
    }
  }
  await page.setViewportSize({width:1120,height:900});await ui.locator('#fit').click();
  assert(await ui.locator('[data-service-tab]').evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth+1)));
  await page.screenshot({path:path.join(output,'motonet_compact.png')});
  await page.setViewportSize({width:390,height:844});await ui.locator('#fit').click();await assertLayout(page);
  const mobile=await canvasPixels(page);assert(mobile.contrast>200);
  await page.screenshot({path:path.join(output,'motonet_mobile.png'),fullPage:true});await panel.screenshot({path:path.join(output,'motonet_mobile_panel.png')});
  return {categories:36,listings:229,desktop,mobile,skuAndCrossReferenceSearch:true,actualProductLinks:true,
    screenedOutVariants:true,relatedItemsNotReplacementCastings:true,headBoltCountWarning:true,staticCamera:true,
    retailerLabels:true,actualCsvDownloads:downloads,allAssemblyReports:true,compactTabsFit:true,fittedMatchesConfirmed:0};
}).catch(error=>{console.error(error);process.exitCode=1;});
