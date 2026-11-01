const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {chromium,firefox}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const kind=process.env.OPTICS_BROWSER||'chromium',url=process.env.OPTICS_URL||'http://127.0.0.1:4000/tools/optics/';
const out=path.resolve(__dirname,'../../output/optics-site/compact');
async function pixels(page){const encoded=await page.locator('#sensor-image').evaluate(c=>c.toDataURL().split(',')[1]);const p=PNG.sync.read(Buffer.from(encoded,'base64'));let mean=0;for(let i=0;i<p.data.length;i+=4)mean+=(p.data[i]+p.data[i+1]+p.data[i+2])/3;return {mean:mean/(p.width*p.height),hash:createHash('sha256').update(p.data).digest('hex')};}
async function ready(page){await page.waitForFunction(()=>document.body.dataset.ready==='true'&&Number(document.body.dataset.samples)>=opticsLab.sensor.total,null,{timeout:120000});}
async function number(page,key,value){const field=page.locator('#n-'+key);await field.fill(String(value));await field.press('Enter');await page.waitForFunction(([key,value])=>opticsLab.data.settings[key]===value,[key,value]);await ready(page);}
async function reset(page){await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='geometry'&&opticsLab.data.settings.fnumber===2.8&&opticsLab.data.settings.pitch===6);await ready(page);}
(async()=>{
 const browser=await(kind==='firefox'?firefox:chromium).launch({headless:true,...(kind==='chromium'?{executablePath:'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']}: {})});
 const errors=[],failed=[],external=[],methods=[];let page;
 try{
  await fs.mkdir(out,{recursive:true});page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  page.context().on('request',r=>{methods.push(r.method());if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());});
  await page.goto(url);await ready(page);
  assert.equal(await page.locator('#controls summary:visible').first().evaluate(el=>el.getBoundingClientRect().height),31);
  assert(!(await page.locator('#aperture-options').evaluate(el=>el.open)));assert(!(await page.locator('#sensor-controls').isVisible()));assert(!(await page.locator('#pitch-controls').isVisible()));
  const opticsBefore=await page.evaluate(()=>({focus:opticsLab.data.effective_focus_m,sensorZ:opticsLab.data.sensor_z,focal:opticsLab.data.efl}));
  assert.equal(await page.locator('#pitch-preset,#sensor-preset').count(),0,'Separate selectors allow impossible camera combinations');
  for(const [name,sensorW,sensorH,pitch]of [['r5',36,24,4.4],['r6',36,24,6.56],['r7',22.3,14.8,3.2],['r6ii',36,24,6]]){
   await page.locator('#camera-preset').selectOption(name);await page.waitForFunction(([w,h,p])=>opticsLab.data.settings.sensorW===w&&opticsLab.data.settings.sensorH===h&&opticsLab.data.settings.pitch===p,[sensorW,sensorH,pitch]);await ready(page);
   assert(!(await page.locator('#custom-sensor-controls').isVisible()),'Preset exposes fields that can invalidate it');
   assert.deepEqual(await page.evaluate(()=>({focus:opticsLab.data.effective_focus_m,sensorZ:opticsLab.data.sensor_z,focal:opticsLab.data.efl})),opticsBefore);
  }
  await page.locator('#camera-preset').selectOption('custom');
  for(const key of ['sensorW','sensorH','pitch'])assert(await page.locator('#n-'+key).isVisible());
  await number(page,'sensorW',29);await number(page,'sensorH',19);await number(page,'pitch',5.25);
  await page.locator('#aperture-options').evaluate(el=>el.open=true);await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===.52);await ready(page);
  assert.equal(await page.locator('#camera-preset').inputValue(),'r6ii');
  await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.pitch===5.25);await ready(page);
  assert.equal(await page.locator('#camera-preset').inputValue(),'custom');assert(await page.locator('#custom-sensor-controls').isVisible());
  await page.locator('#camera-preset').selectOption('r6ii');await page.waitForFunction(()=>opticsLab.data.settings.pitch===6);await ready(page);
  await page.evaluate(()=>opticsLab.set({sensorW:36,sensorH:24,pitch:3.2}));
  assert.equal(await page.locator('#camera-preset').inputValue(),'custom','Legacy mixed settings were relabeled as a Canon camera');
  assert(await page.locator('#custom-sensor-controls').isVisible());
  await page.locator('#camera-preset').selectOption('r6ii');await page.waitForFunction(()=>opticsLab.data.settings.pitch===6);await ready(page);
  if(process.argv.includes('--sensor-presets-only')){
   for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.locator('#camera-preset').selectOption('custom');await page.locator('#n-pitch').scrollIntoViewIfNeeded();
    assert(await page.locator('#n-pitch').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(out,`${kind}-${width}-custom-sensor.png`)});
    await page.locator('#camera-preset').selectOption('r7');await page.waitForFunction(()=>opticsLab.data.settings.sensorW===22.3&&opticsLab.data.settings.pitch===3.2);await ready(page);
    assert(!(await page.locator('#custom-sensor-controls').isVisible()));
    await page.screenshot({path:path.join(out,`${kind}-${width}-r7-preset.png`)});
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
   const report={browser:kind,url,combinedSensorPresets:true,customOnlyFields:true,legacyMixedSettingsCustom:true,bokehRestoresCustom:true,mobile:true,errors};
   await fs.writeFile(path.join(out,`${kind}-sensor-presets.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
  }
  await reset(page);const normal=await pixels(page);assert(normal.mean>10);
  await page.locator('[data-work-mode=exposure]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='exposure'&&!opticsLab.data.settings.exposureLock);await ready(page);
  assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'sensor');assert(await page.locator('#s-shutter').isVisible());assert(!(await page.locator('#n-focal').isVisible()));
  await page.locator('#sensorNoise').uncheck();await page.waitForFunction(()=>!opticsLab.data.settings.sensorNoise);await ready(page);
  const manual=await pixels(page),gain=await page.evaluate(()=>opticsLab.sensor.present.uniforms.gain.value);
  await number(page,'iso',200);const iso=await pixels(page);assert(iso.mean>manual.mean+3,'ISO did not brighten the manual sensor image');assert(Math.abs((await page.evaluate(()=>opticsLab.sensor.present.uniforms.gain.value))/gain-2)<1e-9);
  await number(page,'shutter',.016);assert(Math.abs((await page.evaluate(()=>opticsLab.sensor.present.uniforms.gain.value))/gain-4)<1e-9);
  await number(page,'fnumber',5.6);assert(Math.abs((await page.evaluate(()=>opticsLab.sensor.present.uniforms.gain.value))/gain-1)<1e-9);
  await page.locator('[data-exposure-mode=auto]').click();await page.waitForFunction(()=>opticsLab.data.settings.exposureLock);await ready(page);const automatic=await pixels(page);
  await number(page,'iso',800);assert.equal((await pixels(page)).hash,automatic.hash,'Auto preview changed brightness with ISO');assert.equal(await page.evaluate(()=>opticsLab.sensor.present.uniforms.gain.value),1);
  await reset(page);await page.locator('#aperture-options').evaluate(el=>el.open=true);await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===.52);await ready(page);
  const shapes={};
  for(const shape of ['0','star','heart','cross','slit']){
   await page.locator('#blades').selectOption(shape);await page.waitForFunction(s=>opticsLab.data.settings.apertureShape===(s==='0'?'regular':s),shape);await ready(page);shapes[shape]=await pixels(page);
   assert(shapes[shape].mean>2,'Missing bokeh image for '+shape);
   const iris=await page.evaluate(()=>{
    const v=opticsLab.viewer,d=opticsLab.data,stop=v.group.children.find(o=>o.userData.kind==='stop'),r=d.aperture/2,vertices=d.pupil.outline;
    function contains(x,y){if(d.settings.apertureShape==='regular'&&!d.settings.blades)return x*x+y*y<1;let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const [a,b]=vertices[i],[c,e]=vertices[j];if((b>y)!==(e>y)&&x<(c-a)*(y-b)/(e-b)+a)inside=!inside;}return inside;}
    stop.updateMatrixWorld(true);let checked=0,mismatches=0;
    for(let x=-.91;x<1;x+=.173)for(let y=-.93;y<1;y+=.179){v.raycaster.set(v.camera.position.clone().set(-1,y*r,-x*r),v.camera.position.clone().set(1,0,0));const blocked=v.raycaster.intersectObject(stop).length>0;if(blocked===contains(x,y))mismatches++;checked++;}
    return{checked,mismatches,area:d.pupil.area_fraction};
   });assert.equal(iris.mismatches,0,shape+' 3D opening differs from numerical pupil');assert(iris.checked>100);
   assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'sensor','Non-mode interaction changed the viewer mode');
   if(shape!=='0')await page.locator('#stage-image').screenshot({path:path.join(out,`${kind}-bokeh-${shape}.png`),timeout:10000});
  }
  assert.equal(new Set(Object.values(shapes).map(p=>p.hash)).size,5,'Special masks produce identical bokeh');await reset(page);
  for(const [width,height]of [[1600,1000],[1024,768],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.locator('#controls').evaluate(el=>el.scrollTop=0);
   for(const theme of ['dark','light']){
    if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'Page overflow');
    if(width<=760||height<=560){const image=await page.locator('#sensor-image').boundingBox();assert(image&&image.width>=200&&image.height>95&&image.y+image.height<height,'Mobile preview not visible with controls');}
    await page.screenshot({path:path.join(out,`${kind}-${width}x${height}-${theme}-geometry.png`)});
    await page.locator('[data-work-mode=exposure]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='exposure');await ready(page);assert(await page.locator('#stage-image').isVisible());
    await page.screenshot({path:path.join(out,`${kind}-${width}x${height}-${theme}-exposure.png`)});
    await page.locator('[data-work-mode=geometry]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='geometry');await ready(page);
   }
  }
  await page.locator('[data-work-mode=exposure]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='exposure');await page.locator('[data-exposure-mode=manual]').click();await number(page,'iso',400);
  await page.locator('#camera-preset').selectOption('r7');await page.waitForFunction(()=>opticsLab.data.settings.sensorW===22.3&&opticsLab.data.settings.pitch===3.2);await ready(page);
  const shared=await page.evaluate(()=>opticsLab.settings);await page.goto(url+'#s='+encodeURIComponent(JSON.stringify(shared)));await page.reload();await ready(page);
  assert.equal(await page.locator('#camera-preset').inputValue(),'r7');assert(!(await page.locator('#custom-sensor-controls').isVisible()));
  assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'sensor');assert.equal(await page.evaluate(()=>opticsLab.settings.iso),400);assert(!(await page.evaluate(()=>opticsLab.settings.exposureLock)));
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);if(new URL(url).port!=='8767')assert(methods.every(m=>m==='GET'));
  const report={browser:kind,url,cameraPresets:true,customFieldsOnly:true,manualExposure:true,autoBrightness:true,nonCircularBokeh:true,masksMatchIris:true,mobilePreviewAlwaysVisible:true,responsiveThemes:true,sharedExposureMode:true,shapes,errors,failed,external};await fs.writeFile(path.join(out,`${kind}-workspace.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){if(page)await page.screenshot({path:path.join(out,`${kind}-failure.png`)}).catch(()=>{});throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
