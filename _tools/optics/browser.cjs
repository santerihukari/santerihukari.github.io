const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {chromium,firefox}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../output/optics-site'),url=process.env.OPTICS_URL||'http://127.0.0.1:4000/tools/optics/';
const kind=process.env.OPTICS_BROWSER||'chromium';
async function reveal(page,selector){await page.locator(selector).evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});}
function pixels(buffer){const png=PNG.sync.read(buffer),colors=new Set();let sum=0;for(let i=0;i<png.data.length;i+=16){colors.add(`${png.data[i]},${png.data[i+1]},${png.data[i+2]}`);sum+=png.data[i]+png.data[i+1]+png.data[i+2];}return{unique:colors.size,sum,hash:createHash('sha256').update(png.data).digest('hex')};}
async function checkSensorField(page){
 const result=await page.evaluate(()=>{
  const d=opticsLab.data,v=opticsLab.viewer,s=opticsLab.sensor;
  const volume=v.group.children.find(o=>o.userData.kind==='dof'),focus=v.group.children.find(o=>o.userData.kind==='focus');
  if(!volume)return{valid:d.dof.near_m===null,absent:true};
  // Sample zero is the central pupil, independently checking against the real
  // sensor renderer's projection matrix rather than a second inverse formula.
  s.count=0;s.step();const camera=s.camera.clone();camera.updateMatrixWorld(true);
  const region=volume.userData.region,sets=[region.near,region.far];if(focus)sets.push(focus.userData.opticalCorners);
  const expected=[[1,1],[-1,1],[-1,-1],[1,-1]];
  const valid=sets.every(corners=>corners.every((c,i)=>{
   const ndc=camera.position.clone().set(c[0]/1000,c[1]/1000,c[2]/1000).project(camera);
   return Math.abs(ndc.x-expected[i][0])<1e-8&&Math.abs(ndc.y-expected[i][1])<1e-8;
  }));
  const c=region.near;
  return{valid,absent:false,indices:volume.geometry.index.count,unbounded:region.unbounded,near:region.nearMm,far:region.farMm,width:Math.abs(c[1][0]-c[0][0]),height:Math.abs(c[2][1]-c[1][1]),centerX:c.reduce((s,p)=>s+p[0],0)/4,centerY:c.reduce((s,p)=>s+p[1],0)/4};
 });
 assert(result.valid,'DOF/focus boundary does not match the physical sensor projection');
 if(!result.absent)assert.equal(result.indices,result.unbounded?30:36,'Infinity must not have a false far cap');return result;
}
(async()=>{
 const browser=await(kind==='firefox'?firefox:chromium).launch({headless:true,...(kind==='chromium'?{executablePath:'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']}: {})});
 const errors=[],failed=[],external=[],methods=[],checks=[];let page;
 try{
  page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(120000);
  await fs.mkdir(root,{recursive:true});
  await page.addInitScript(()=>{if(!localStorage.getItem('theme'))localStorage.setItem('theme','dark');});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.context().on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());methods.push(r.method());});
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  const bootStart=Date.now();await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});const bootMs=Date.now()-bootStart;
  await page.waitForFunction(()=>Number(document.body.dataset.samples)>=48,null,{timeout:60000});
  const canvas=page.locator('#optical-canvas'),image=page.locator('#sensor-image');
  const base=pixels(await image.screenshot({path:path.join(root,`qa-${kind}-sensor-default.png`)}));assert(base.unique>100,'Blank sensor preview');
  assert(pixels(await canvas.screenshot()).unique>100,'Blank 3D canvas');
  await page.screenshot({path:path.join(root,`qa-${kind}-desktop.png`)});
  const defaultData=await page.evaluate(()=>({efl:opticsLab.data.efl,subjectBlur:opticsLab.data.targets[1].blur_um,mp:opticsLab.data.sensor.megapixels}));
  const defaults=await page.evaluate(()=>opticsLab.settings);
  const fixtures=JSON.parse(await fs.readFile(path.join(root,'fixtures.json'),'utf8'));let compared=0,maxScaledError=0;
  function compare(actual,expected,label){
    if(typeof expected==='number'){
      assert.equal(typeof actual,'number',label);assert(Number.isFinite(actual),label);
      const tolerance=1e-8+Math.abs(expected)*2e-7,error=Math.abs(actual-expected);maxScaledError=Math.max(maxScaledError,error/tolerance);compared++;assert(error<=tolerance,`${label}: ${actual} != ${expected}`);
    }else if(expected&&typeof expected==='object'){
      assert.deepEqual(Object.keys(actual),Object.keys(expected),label);for(const key of Object.keys(expected))compare(actual[key],expected[key],label+'.'+key);
    }else assert.equal(actual,expected,label);
  }
  for(const [index,fixture] of fixtures.cases.entries()){
    await page.evaluate(settings=>opticsLab.set(settings),fixture.result.settings);
    compare(await page.evaluate(()=>opticsLab.data),fixture.result,`case${index}`);
  }
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.model==='ideal'&&opticsLab.data.settings.focus===3&&opticsLab.data.settings.sensorOffset===0&&opticsLab.data.settings.shutter===1/125&&opticsLab.data.settings.workMode==='geometry');await page.waitForFunction(()=>document.body.dataset.samples==='48');
  assert(Math.abs(defaultData.efl-50)<1e-9);assert(defaultData.subjectBlur<1e-8);assert.equal(defaultData.mp,24);
  const opticalState=()=>page.evaluate(()=>{const d=opticsLab.data;return {focus:d.settings.focus,efl:d.efl,sensorZ:d.sensor_z,matrix:d.matrix,projection:d.projection,targets:d.targets,camera:opticsLab.camera};});
  const beforeFormat=await opticalState();
  for(const [preset,pitch]of [['r5',4.4],['r7',3.2],['r6',6.56],['r6ii',6]]){
    await page.locator('#camera-preset').selectOption(preset);await page.waitForFunction(p=>opticsLab.data.settings.pitch===p,pitch);
    assert.deepEqual(await opticalState(),beforeFormat,'Sensor format changed focus, optics, scene geometry or camera');
  }
  await page.locator('#physical-scale').check();
  assert(await page.evaluate(()=>{const v=opticsLab.viewer,t=opticsLab.data.targets[1],q=v.point(t.x,t.y,-t.distance);return q.x===-t.distance&&q.y===t.y&&q.z===-t.x;}),'True scale still compresses object space');
  assert((await page.locator('#scale-note').textContent()).includes('True physical scale'));
  await page.screenshot({path:path.join(root,`qa-${kind}-true-scale.png`)});
  await page.locator('#physical-scale').uncheck();
  assert((await page.locator('#scale-note').textContent()).includes('not to scale'));
  const beforeDemo=await page.evaluate(()=>({settings:opticsLab.settings,camera:opticsLab.camera,target:opticsLab.viewer.controls.target.toArray()}));
  await reveal(page,'#bokeh-demo');
  await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===.52);
  assert.equal(await page.locator('#bokeh-demo').textContent(),'Exit bokeh demo');
  await page.locator('[data-view=system]').click();assert(await canvas.isVisible(),'System view is inaccessible from bokeh demo');
  await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===3);
  const afterDemo=await page.evaluate(()=>({settings:opticsLab.settings,camera:opticsLab.camera,target:opticsLab.viewer.controls.target.toArray()}));
  assert.deepEqual(afterDemo.settings,beforeDemo.settings,'Bokeh exit did not restore optical parameters');
  for(const key of ['camera','target'])assert(afterDemo[key].every((v,i)=>Math.abs(v-beforeDemo[key][i])<1e-6),'Bokeh exit did not restore '+key);
  assert(!(await page.locator('#pixel-crop').isChecked()));assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'system');
  await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===.52);
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===3&&document.body.dataset.samples==='48');
  assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'system','Reset stayed in sensor view');
  assert.equal(await page.locator('#bokeh-demo').getAttribute('aria-pressed'),'false');
  for(const [index,key,value] of [[0,'targetA',2.2],[1,'subject',4],[2,'targetC',12]]){
    await reveal(page,'#n-'+key);
    const before=await page.evaluate(()=>({targets:opticsLab.data.targets,focus:opticsLab.settings.focus,camera:opticsLab.camera,mapped:opticsLab.data.targets.map(t=>opticsLab.viewer.point(t.x,t.y,-t.distance).normalize().toArray()),objects:opticsLab.viewer.world.targets.map(t=>({position:t.root.position.toArray(),size:t.panel.scale.toArray()}))}));
    await page.locator('#n-'+key).fill(String(value));await page.locator('#n-'+key).press('Enter');await page.waitForFunction(([key,value])=>opticsLab.data.settings[key]===value,[key,value]);await page.waitForFunction(()=>document.body.dataset.samples==='48');
    const after=await page.evaluate(()=>({targets:opticsLab.data.targets,focus:opticsLab.settings.focus,camera:opticsLab.camera,mapped:opticsLab.data.targets.map(t=>opticsLab.viewer.point(t.x,t.y,-t.distance).normalize().toArray()),objects:opticsLab.viewer.world.targets.map(t=>({position:t.root.position.toArray(),size:t.panel.scale.toArray()}))}));
    assert.equal(after.targets[index].radial_distance,value*1000);assert.equal(after.focus,before.focus);assert.deepEqual(after.camera,before.camera);
    assert(Math.abs(Math.hypot(after.targets[index].x,after.targets[index].y,after.targets[index].distance)-value*1000)<1e-8,'Distance is not a radial range');
    for(const axis of ['sensor_x','sensor_y'])assert(Math.abs(after.targets[index][axis]-before.targets[index][axis])<1e-9,'Range change drifted across the sensor');
    assert(after.mapped[index].every((v,j)=>Math.abs(v-before.mapped[index][j])<1e-10),'Compressed overview bends the radial movement');
    assert.notEqual(pixels(await image.screenshot()).hash,base.hash,'Moving a target did not change the image');
    for(let j=0;j<3;j++){assert.deepEqual(after.objects[j].size,before.objects[j].size,'Target physical size changed');if(j!==index){assert.deepEqual(after.targets[j],before.targets[j]);assert.deepEqual(after.objects[j],before.objects[j]);}}
  }
  await page.locator('.target-parameters').evaluate(el=>el.open=true);await page.locator('.position-options summary').click();
  for(const [i,letter] of ['A','B','C'].entries())for(const [axis,value] of [['X',-12+i*10],['Y',-4+i*3]]){
    const before=await page.evaluate(()=>({targets:opticsLab.data.targets,focus:opticsLab.settings.focus,camera:opticsLab.camera}));
    const key=`target${letter}${axis}`;await page.locator('#n-'+key).fill(String(value));await page.locator('#n-'+key).press('Enter');await page.waitForFunction(([key,value])=>opticsLab.data.settings[key]===value,[key,value]);
    const after=await page.evaluate(()=>({targets:opticsLab.data.targets,focus:opticsLab.settings.focus,camera:opticsLab.camera}));
    assert.equal(after.targets[i].radial_distance,before.targets[i].radial_distance);assert.equal(after.focus,before.focus);assert.deepEqual(after.camera,before.camera);
    assert.notEqual(after.targets[i][axis==='X'?'sensor_x':'sensor_y'],before.targets[i][axis==='X'?'sensor_x':'sensor_y']);
    for(let j=0;j<3;j++)if(j!==i)assert.deepEqual(after.targets[j],before.targets[j]);
  }
  await page.screenshot({path:path.join(root,`qa-${kind}-xy-controls.png`)});
  const targetSettings=await page.evaluate(()=>opticsLab.settings);await page.goto(url+'#s='+encodeURIComponent(JSON.stringify(targetSettings)));await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true'&&opticsLab.data.settings.targetA===2.2&&opticsLab.data.settings.subject===4&&opticsLab.data.settings.targetC===12);
  assert(await page.evaluate(()=>opticsLab.settings.targetAX===-12&&opticsLab.settings.targetCY===2),'Target direction link was not restored');
  await page.goto(url+'#s='+encodeURIComponent(JSON.stringify({subject:3,targetA:1.8,targetC:7.2,focus:3})));await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true'&&opticsLab.data.settings.sceneVersion===2);
  assert(await page.evaluate(()=>Math.abs(opticsLab.data.targets[0].x+540)<1e-8&&Math.abs(opticsLab.data.targets[2].distance-7200)<1e-8),'Legacy axial link changed physical positions');
  await page.locator('#reset').click();await page.waitForFunction(expected=>Object.entries(expected).every(([k,v])=>opticsLab.data.settings[k]===v),defaults);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  await page.locator('#inspect-point').click();await page.waitForFunction(()=>document.body.dataset.samples==='96');assert.equal(await page.evaluate(()=>opticsLab.sensor.cropTarget),2);
  assert((await page.evaluate(()=>opticsLab.sensor.pointVisibility))>0,'Default point is hidden');
  const raw=async()=>PNG.sync.read(Buffer.from(await image.evaluate(c=>c.toDataURL().split(',')[1]),'base64'));
  const lit=await raw();await page.screenshot({path:path.join(root,`qa-${kind}-point-c-defocused.png`)});
  await page.evaluate(()=>{opticsLab.sensor.present.uniforms.pointFlux.value=0;opticsLab.sensor.count=0;document.body.dataset.samples='0';});await page.waitForFunction(()=>document.body.dataset.samples==='96');const unlit=await raw();
  const spreadRadius=await page.evaluate(()=>opticsLab.data.targets[2].blur_um/opticsLab.settings.pitch/2+6);
  let centerAdded=0,outsideAdded=0;for(let y=0;y<lit.height;y++)for(let x=0;x<lit.width;x++){const i=(y*lit.width+x)*4,diff=lit.data[i]-unlit.data[i];if(Math.hypot(x-lit.width/2,y-lit.height/2)<spreadRadius)centerAdded+=diff;else outsideAdded+=Math.abs(diff);}
  assert(centerAdded>5000,'Subpixel point source is absent or not centered in the crop');assert(centerAdded>outsideAdded*2,'Point spread leaks across unrelated sensor areas');
  await page.locator('[data-focus="2"]').click();await page.waitForFunction(()=>Math.abs(opticsLab.data.settings.focus-.45)<1e-9);await page.waitForFunction(()=>document.body.dataset.samples==='96');
  assert((await page.evaluate(()=>opticsLab.data.targets[2].blur_um))<1e-7);await page.screenshot({path:path.join(root,`qa-${kind}-point-c-focused.png`)});
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===3);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  await page.locator('[data-view=sensor]').click();assert(await page.locator('#stage-image').isVisible(),'Large sensor view unavailable');
  const previewBounds=await image.boundingBox(),stageBounds=await page.locator('#stage-image').boundingBox();
  assert(stageBounds.width>previewBounds.width*2,'Large sensor view is not substantially larger');
  await page.locator('#crop-target').selectOption('0');await page.waitForFunction(()=>document.body.dataset.samples==='96');
  assert(await page.locator('#pixel-crop').isChecked());
  assert.equal(await page.evaluate(()=>opticsLab.sensor.cropTarget),0);
  await page.locator('#stage-image').screenshot({path:path.join(root,`qa-${kind}-near-target-pixel-crop.png`)});
  await page.locator('#blur-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.fnumber===1.4&&Math.abs(opticsLab.data.settings.focus-1.8)<1e-9);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  assert(!(await page.locator('#pixel-crop').isChecked()),'Demo should show the full scene, not an in-focus crop');
  assert((await page.evaluate(()=>opticsLab.data.targets[0].blur_um))<1e-7,'Focus target A is not in focus');
  assert((await page.evaluate(()=>opticsLab.data.targets[1].blur_um))>300,'Demo subject B has insufficient calculated defocus');
  await page.screenshot({path:path.join(root,`qa-${kind}-large-sensor-demo.png`)});
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===3&&opticsLab.data.settings.fnumber===2.8);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  await page.locator('[data-view=system]').click();
  await checkSensorField(page);
  await page.evaluate(()=>opticsLab.set({cocMode:'custom'}));const fullField=await checkSensorField(page);
  await page.evaluate(()=>opticsLab.set({sensorW:23.5,sensorH:15.7}));const croppedField=await checkSensorField(page);
  assert(Math.abs(croppedField.width/fullField.width-23.5/36)<1e-10);assert(Math.abs(croppedField.height/fullField.height-15.7/24)<1e-10);assert.equal(croppedField.near,fullField.near);assert.equal(croppedField.far,fullField.far);
  assert(await page.evaluate(()=>Math.abs(opticsLab.data.targets[0].sensor_x)>opticsLab.settings.sensorW/2),'Out-of-frame target fixture should be outside the field');
  await page.evaluate(()=>opticsLab.set({shiftX:4,shiftY:-2}));const shiftedField=await checkSensorField(page);assert(shiftedField.centerX<0&&shiftedField.centerY>0);
  await page.locator('#fit').click();await page.screenshot({path:path.join(root,`qa-${kind}-sensor-clipped-dof.png`)});
  const fieldBeforeCrop=await page.evaluate(()=>Array.from(opticsLab.viewer.group.children.find(o=>o.userData.kind==='dof').geometry.attributes.position.array));
  await page.locator('#pixel-crop').check();assert.deepEqual(await page.evaluate(()=>Array.from(opticsLab.viewer.group.children.find(o=>o.userData.kind==='dof').geometry.attributes.position.array)),fieldBeforeCrop,'Inspection crop changed physical sensor field');await page.locator('#pixel-crop').uncheck();
  await page.evaluate(()=>opticsLab.set({focal:85}));await checkSensorField(page);
  await page.evaluate(()=>opticsLab.set({focus:'infinity'}));const infiniteField=await checkSensorField(page);assert(infiniteField.unbounded);await page.screenshot({path:path.join(root,`qa-${kind}-open-infinite-dof.png`)});
  await page.evaluate(()=>opticsLab.set({sensorOffset:-3}));assert((await checkSensorField(page)).absent);
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.sensorOffset===0&&opticsLab.data.settings.focal===50&&opticsLab.data.settings.focus===3);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  await page.locator('#s-focus').evaluate(input=>{input.value='750';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>Math.abs(opticsLab.data.settings.focus-100)<1e-9);
  assert.equal(await page.locator('#focus-infinity').count(),0,'Infinity must not need an extra toggle');
  await page.locator('#s-focus').focus();await page.locator('#s-focus').press('End');await page.waitForFunction(()=>opticsLab.data.focus_state==='infinity');await page.waitForFunction(()=>document.body.dataset.samples==='48');
  assert.equal(await page.locator('#s-focus').getAttribute('aria-valuetext'),'Infinity');assert.equal(await page.locator('#n-focus').getAttribute('placeholder'),'\u221e');
  assert.equal(await page.evaluate(()=>opticsLab.data.projection.focus_inverse_m),0);
  assert(await page.evaluate(()=>!opticsLab.viewer.group.children.some(o=>o.userData.kind==='focus')),'Infinity has a fake finite focus sheet');
  assert(pixels(await image.screenshot()).unique>100,'Infinity sensor preview is blank');
  await page.screenshot({path:path.join(root,`qa-${kind}-infinity.png`)});
  await page.locator('#n-focus').fill('100');await page.locator('#n-focus').press('Enter');await page.waitForFunction(()=>opticsLab.data.settings.focus===100);
  assert(Math.abs(Number(await page.locator('#s-focus').inputValue())-750)<1e-8);
  await page.locator('#s-focus').focus();await page.locator('#s-focus').press('End');await page.waitForFunction(()=>opticsLab.data.settings.focus==='infinity');
  const infinitySettings=await page.evaluate(()=>opticsLab.settings);
  await page.goto(url+'#s='+encodeURIComponent(JSON.stringify(infinitySettings)));await page.reload();
  await page.waitForFunction(()=>document.body.dataset.ready==='true'&&opticsLab.data.focus_state==='infinity');
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.focus===3);await page.waitForFunction(()=>document.body.dataset.samples==='48');
  const cameraBefore=await page.evaluate(()=>opticsLab.camera);
  await page.locator('#n-focus').fill('1.8');await page.locator('#n-focus').press('Enter');
  await page.waitForFunction(()=>Math.abs(opticsLab.data.settings.focus-1.8)<1e-6);
  await page.waitForFunction(()=>Number(document.body.dataset.samples)>=48);
  const changed=pixels(await image.screenshot({path:path.join(root,`qa-${kind}-sensor-near-focus.png`)}));
  assert(Math.abs(changed.sum-base.sum)>500,'Focus did not change the sensor image');
  assert((await page.evaluate(()=>opticsLab.camera)).every((v,i)=>Math.abs(v-cameraBefore[i])<1e-6),'Parameter update reframed camera');
  await page.locator('#model').selectOption('singlet');await page.waitForFunction(()=>opticsLab.data.settings.model==='singlet');
  assert((await page.evaluate(()=>opticsLab.data.spot_rms_um))>1,'Real lens does not show a finite spot');
  await page.locator('[data-view=bench]').click();await page.screenshot({path:path.join(root,`qa-${kind}-glass-bench.png`)});
  const drag=await canvas.boundingBox(),old=await page.evaluate(()=>opticsLab.camera);
  await page.mouse.move(drag.x+drag.width*.55,drag.y+drag.height*.55);await page.mouse.down();await page.mouse.move(drag.x+drag.width*.7,drag.y+drag.height*.65,{steps:12});await page.mouse.up();await page.waitForTimeout(400);
  assert.notDeepEqual(await page.evaluate(()=>opticsLab.camera),old,'Orbit controls did not rotate');
  await page.locator('[data-view=scene]').click();assert(pixels(await canvas.screenshot({path:path.join(root,`qa-${kind}-scene.png`)})).unique>100);
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.model==='ideal'&&opticsLab.data.settings.focus===3);
  await page.locator('[data-view=system]').click();await page.locator('#pixel-crop').check();await page.waitForFunction(()=>Number(document.body.dataset.samples)>=96);
  await image.screenshot({path:path.join(root,`qa-${kind}-native-pixels.png`)});
  const rawBefore=pixels(await image.screenshot());await page.locator('#upright').uncheck();await page.waitForFunction(()=>opticsLab.data.settings.upright===false);await page.waitForFunction(()=>Number(document.body.dataset.samples)>=96);
  assert.notEqual(pixels(await image.screenshot()).hash,rawBefore.hash,'Raw sensor orientation did not change');
  await page.locator('#pixel-crop').uncheck();await page.locator('#upright').check();
  await reveal(page,'#bokeh-demo');await page.locator('#bokeh-demo').click();await page.waitForFunction(()=>opticsLab.data.settings.focal===85&&opticsLab.data.settings.fnumber===2&&opticsLab.data.settings.focus===.52&&opticsLab.data.settings.lightBrightness===300);await page.waitForFunction(()=>document.body.dataset.samples==='96');
  assert(await page.locator('#stage-image').isVisible());assert((await page.evaluate(()=>opticsLab.sensor.pointVisibility))>0);assert.equal(await page.evaluate(()=>opticsLab.sensor.cropTarget),2);
  assert((await page.evaluate(()=>opticsLab.data.targets[2].blur_um))>1000,'Demo does not have large geometric bokeh');
  const bokehHashes=[];
  for(const blades of [0,3,4,5,6,8,9]){
    await page.locator('#blades').selectOption(String(blades));await page.waitForFunction(n=>opticsLab.data.settings.blades===n,blades);await page.waitForFunction(()=>document.body.dataset.samples==='96');
    const result=PNG.sync.read(Buffer.from(await image.evaluate(c=>c.toDataURL().split(',')[1]),'base64'));let bright=0;
    for(let i=0;i<result.data.length;i+=4)if(result.data[i]>125&&result.data[i+1]>110)bright++;
    assert(bright>8000,`Light bokeh is not clearly visible for ${blades} sides`);
    bokehHashes.push(createHash('sha256').update(result.data).digest('hex'));
    assert(await page.evaluate(()=>{
      const v=opticsLab.viewer,stop=v.group.children.find(o=>o.userData.kind==='stop'),d=opticsLab.data,n=d.settings.blades;
      if(stop?.geometry.type!=='ShapeGeometry')return false;v.group.updateMatrixWorld(true);
      const direction=v.camera.position.clone().set(1,0,0),origin=v.camera.position.clone().set(-1,0,0);
      v.raycaster.set(origin,direction);if(v.raycaster.intersectObject(stop).length)return false;
      const angle=n?Math.PI/n:0,r=d.aperture/2*(n?(1+Math.cos(angle))/2:1.1);
      v.raycaster.set(origin.set(-1,r*Math.sin(angle),-r*Math.cos(angle)),direction);
      return v.raycaster.intersectObject(stop).length>0;
    }),'3D iris opening does not match the selected aperture');
    if([0,3,5].includes(blades))await page.screenshot({path:path.join(root,`qa-${kind}-bokeh-${blades}.png`)});
  }
  assert.equal(new Set(bokehHashes).size,bokehHashes.length,'Different aperture masks produce identical bokeh');
  const lightBefore=await page.evaluate(()=>opticsLab.sensor.present.uniforms.pointFlux.value),brightnessBefore=await page.evaluate(()=>opticsLab.settings.lightBrightness);
  const lightInput=page.locator('#n-lightBrightness');await reveal(page,'#n-lightBrightness');await lightInput.fill('25');await lightInput.press('Enter');await page.waitForFunction(()=>opticsLab.data.settings.lightBrightness===25);
  assert(Math.abs((await page.evaluate(()=>opticsLab.sensor.present.uniforms.pointFlux.value))/lightBefore-25/brightnessBefore)<1e-9,'Light brightness does not control emission');
  await page.locator('#reset').click();await page.waitForFunction(()=>opticsLab.data.settings.focal===50&&opticsLab.data.settings.lightBrightness===300&&opticsLab.data.settings.blades===0);await page.waitForFunction(()=>document.body.dataset.samples==='48');assert.equal(await page.locator('#viewer').getAttribute('data-mode'),'system');
  for(const width of [1600,1024,390]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
    await page.locator('#fit').click();
    assert(await page.evaluate(()=>opticsLab.data.targets.every(t=>{
      const p=opticsLab.viewer.point(t.x,t.y,-t.distance).project(opticsLab.viewer.camera);return Math.abs(p.x)<.95&&Math.abs(p.y)<.95;
    })),'Fit view leaves a target outside the viewport');
    for(const light of [false,true]){
      if((await page.locator('html').getAttribute('data-theme')==='light')!==light)await page.locator('#theme').click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
      if(width===390){
        const bounds=await canvas.boundingBox();assert(bounds.height>=900*.2&&bounds.height<=900*.32,'Mobile 3D pane crowds out the sensor image');
        assert(await image.isVisible(),'Mobile sensor preview disappears behind the panel tabs');
        await page.locator('[data-panel=sensor-panel]').click();assert(await image.isVisible());
        await page.locator('[data-panel=controls]').click();assert(await page.locator('#n-focal').isVisible());
      }
      await page.screenshot({path:path.join(root,`qa-${kind}-${width}-${light?'light':'dark'}.png`)});
    }
  }
  await page.locator('#fullscreen').click();await page.waitForTimeout(350);
  assert(await page.evaluate(()=>document.fullscreenElement?.id==='viewer'),'Fullscreen did not enter');
  assert(await canvas.evaluate(c=>c.getBoundingClientRect().height>=innerHeight-2),'Fullscreen viewer does not fill display');
  await page.locator('#fullscreen').click();await page.waitForTimeout(100);
  await page.setViewportSize({width:1590,height:803});await page.locator('#controls').evaluate(el=>el.scrollTop=0);await page.locator('#fit').click();await page.waitForTimeout(250);
  if(await page.locator('html').getAttribute('data-theme')!=='dark')await page.locator('#theme').click();await page.waitForTimeout(150);
  await page.locator('#viewer').screenshot({path:path.resolve(__dirname,'../../assets/images/project-previews/optics-lab.png')});
  const siteDir=process.env.OPTICS_SITE_DIR||path.resolve(__dirname,'../../_site');
  await fs.copyFile(path.resolve(__dirname,'../../assets/images/project-previews/optics-lab.png'),path.join(siteDir,'assets/images/project-previews/optics-lab.png'));
  const siteRoot=new URL('../../',url),project=new URL('projects/optics-lab/',siteRoot);
  await page.goto(project.href);await page.locator('h1').filter({hasText:'Optics Lab'}).waitFor();assert(await page.getByRole('link',{name:'Open optics demo',exact:true}).count());
  await page.goto(new URL('projects/',siteRoot).href);assert(await page.getByRole('link',{name:'Optics Lab',exact:true}).count());
  assert(methods.every(method=>method==='GET'),'Calculations made a non-static request');
  assert.deepEqual(external,[],'External runtime requests');assert.deepEqual(errors,[],'Browser errors');assert.deepEqual(failed,[],'Failed page assets');
  const report={browser:kind,bootMs,parityCases:fixtures.cases.length,comparedNumbers:compared,maxScaledError,defaultData,sensorPixels:base,sensorClippedDof:true,sensorShiftTracked:true,infiniteFarEndOpen:true,inspectionCropNotPhysicalCrop:true,apertureBokehShapes:true,lightBrightness:true,bokehHashes,independentTargets:true,radialRangeWithoutSensorDrift:true,xyDirectionsIndependent:true,legacyAxialLinksMigrated:true,targetLinksRestored:true,pointSourceRendered:true,pointCenterAdded:centerAdded,pointOutsideAdded:outsideAdded,focusChangedImage:true,infinityFocus:true,focus100mAt75Percent:true,infinityLinkRestored:true,orbit:true,cameraPreserved:true,mobileFullscreen:true,staticOnly:true,external,errors,failed};
  await fs.writeFile(path.join(root,`browser-${kind}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){
  if(page){await page.screenshot({path:path.join(root,`failure-${kind}.png`)}).catch(()=>{});console.error(await page.evaluate(()=>({ready:document.body.dataset.ready,status:document.querySelector('#status')?.textContent,error:document.querySelector('#viewer-error')?.textContent,settings:window.opticsLab?.settings})).catch(()=>({closed:true})));}
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
