const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {chromium,firefox}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const {PNG}=require(path.resolve(path.dirname(process.execPath),'../node_modules/pngjs'));
const kind=process.env.OPTICS_BROWSER||'chromium',url=process.env.OPTICS_URL||'http://127.0.0.1:4000/tools/optics/';
const out=path.resolve(__dirname,'../../output/optics-site/exposure');
async function ready(page){await page.waitForFunction(()=>document.body.dataset.ready==='true'&&Number(document.body.dataset.samples)>=opticsLab.sensor.total,null,{timeout:120000});}
async function image(page){const b=Buffer.from(await page.locator('#sensor-image').evaluate(c=>c.toDataURL().split(',')[1]),'base64');return {png:PNG.sync.read(b),hash:createHash('sha256').update(b).digest('hex'),buffer:b};}
function rms(a,b){assert.equal(a.png.data.length,b.png.data.length);let sum=0,count=0;for(let i=0;i<a.png.data.length;i++)if(i%4!==3){sum+=(a.png.data[i]-b.png.data[i])**2;count++;}return Math.sqrt(sum/count);}
function correlation(p,dx,dy){let n=0,a=0,b=0,aa=0,bb=0,ab=0;for(let y=5;y<325;y++)for(let x=5;x<75;x++){const u=p.data[(y*p.width+x)*4],v=p.data[((y+dy)*p.width+x+dx)*4];n++;a+=u;b+=v;aa+=u*u;bb+=v*v;ab+=u*v;}return (ab-a*b/n)/Math.sqrt((aa-a*a/n)*(bb-b*b/n));}
async function iso(page,value){await page.locator('#n-iso').fill(String(value));await page.locator('#n-iso').press('Enter');await page.waitForFunction(v=>opticsLab.data.settings.iso===v,value);await ready(page);}
async function noise(page,enabled){await page.locator('#sensorNoise').setChecked(enabled);await page.waitForFunction(v=>opticsLab.data.settings.sensorNoise===v,enabled);await ready(page);}
async function number(page,key,value){await page.locator('#n-'+key).fill(String(value));await page.locator('#n-'+key).press('Enter');await page.waitForFunction(([key,value])=>opticsLab.data.settings[key]===value,[key,value]);await ready(page);}
(async()=>{
 const {SHUTTER_PRESETS}=await import('../../assets/optics/exposure.mjs');
 const browser=await(kind==='firefox'?firefox:chromium).launch({headless:true,...(kind==='chromium'?{executablePath:'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']}: {})});
 let page;const errors=[],failed=[],external=[];
 try{
  await fs.mkdir(out,{recursive:true});page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  page.context().on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());});
  await page.goto(url);await ready(page);await page.locator('button[data-work-mode=exposure]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='exposure');
  await page.locator('[data-exposure-mode=auto]').click();await page.waitForFunction(()=>opticsLab.data.settings.exposureLock);await noise(page,false);await iso(page,100);
  const clean=await image(page);await noise(page,true);const low=await image(page);await iso(page,6400);const high=await image(page);
  const lowRms=rms(low,clean),highRms=rms(high,clean);assert(highRms>lowRms*2&&highRms>1,'High ISO has no visible increase in noise');assert(highRms<40,'Noise overwhelms the scene');
  await fs.writeFile(path.join(out,`${kind}-iso100.png`),low.buffer);await fs.writeFile(path.join(out,`${kind}-iso6400.png`),high.buffer);
  await page.evaluate(()=>opticsLab.set({iso:6400}));await ready(page);assert.equal((await image(page)).hash,high.hash,'Noise flickers or averages away after a rebuild');
  const previewVariance=await page.evaluate(()=>opticsLab.sensor.present.uniforms.noiseVariance.value.toArray());
  await page.locator('#pixel-crop').check();await ready(page);const nativeVariance=await page.evaluate(()=>opticsLab.sensor.present.uniforms.noiseVariance.value.toArray());assert(nativeVariance[0]>previewVariance[0]*60);
  const native=await image(page);await fs.writeFile(path.join(out,`${kind}-iso6400-native.png`),native.buffer);
  for(const [dx,dy]of [[1,0],[0,1],[1,1],[2,0]])assert(Math.abs(correlation(native.png,dx,dy))<.1,'Grain contains correlated stripes or checkerboarding');
  await page.locator('#pixel-crop').uncheck();await ready(page);
  assert.equal(await page.locator('#n-iso').getAttribute('max'),'51200');
  await page.locator('#s-iso').press('End');await page.waitForFunction(()=>opticsLab.data.settings.iso===51200);await ready(page);
  const maxIso=await image(page);assert(rms(maxIso,clean)>highRms,'R5 maximum ISO does not increase simulated grain');
  await page.screenshot({path:path.join(out,`${kind}-iso51200.png`)});
  await page.locator('button[data-work-mode=geometry]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='geometry');await ready(page);
  assert.deepEqual(await page.evaluate(()=>opticsLab.sensor.present.uniforms.noiseVariance.value.toArray()),[0,0]);assert.equal((await image(page)).hash,clean.hash,'Geometry preview inherited ISO grain');
  await page.locator('button[data-work-mode=exposure]').click();await page.waitForFunction(()=>opticsLab.data.settings.workMode==='exposure');await noise(page,false);
  for(const value of [1/8000,1/125,.5,30,60,3600]){
   const index=SHUTTER_PRESETS.findIndex(p=>p.value===value);
   await page.locator('#s-shutter').evaluate((el,index)=>{el.value=String(index);el.dispatchEvent(new Event('input',{bubbles:true}));},index);
   await page.waitForFunction(v=>opticsLab.data.settings.shutter===v,value);await ready(page);
   assert.equal(await page.locator('#n-shutter').inputValue(),String(value));assert.equal(await page.locator('#s-shutter').getAttribute('aria-valuetext'),SHUTTER_PRESETS[index].label);
   assert(await page.locator('#n-shutter').isVisible());assert(await page.evaluate(()=>Number.isFinite(opticsLab.data.exposure_ev)));
  }
  await page.locator('#s-shutter').press('Home');await page.waitForFunction(()=>opticsLab.data.settings.shutter===1/8000);
  await page.locator('#s-shutter').press('End');await page.waitForFunction(()=>opticsLab.data.settings.shutter===3600);await ready(page);
  for(const value of [900,86400,1e10,1e308]){
   await number(page,'shutter',value);assert((await page.locator('#shutter-label').textContent()).includes('custom'));
   assert(await page.evaluate(()=>Number.isFinite(opticsLab.data.relative_exposure)&&Number.isFinite(opticsLab.data.exposure_ev)));
  }
  await page.locator('#n-shutter').fill('0');await page.locator('#n-shutter').press('Enter');assert(!(await page.locator('#n-shutter').evaluate(el=>el.checkValidity())));assert.equal(await page.evaluate(()=>opticsLab.data.settings.shutter),1e308);
  await number(page,'shutter',1/1000);await number(page,'fnumber',2.8);
  await page.locator('#autoIso').check();await page.waitForFunction(()=>opticsLab.data.settings.autoIso&&opticsLab.data.settings.iso===800);await ready(page);
  assert(await page.locator('#n-iso').isDisabled());assert(await page.locator('#s-iso').isDisabled());assert.equal(await page.locator('#n-shutter').inputValue(),'0.001');
  await noise(page,true);const autoVariance=await page.evaluate(()=>opticsLab.sensor.present.uniforms.noiseVariance.value.x);
  await number(page,'fnumber',5.6);await page.waitForFunction(()=>opticsLab.data.settings.iso===3200);await ready(page);
  assert((await page.evaluate(()=>opticsLab.sensor.present.uniforms.noiseVariance.value.x))>autoVariance*3);
  await number(page,'fnumber',22);await number(page,'shutter',1/8000);assert.equal(await page.evaluate(()=>opticsLab.data.auto_iso.limit),'maximum');assert.equal(await page.locator('#n-iso').inputValue(),'51200');assert((await page.locator('#auto-iso-note').textContent()).includes('upper limit'));assert((await page.locator('#auto-iso-note').textContent()).includes('100–51200'));
  await number(page,'fnumber',1.4);await number(page,'shutter',30);assert.equal(await page.evaluate(()=>opticsLab.data.auto_iso.limit),'minimum');assert((await page.locator('#auto-iso-note').textContent()).includes('lower limit'));
  await page.locator('#autoIso').uncheck();await page.waitForFunction(()=>!opticsLab.data.settings.autoIso);await ready(page);assert(await page.locator('#n-iso').isEnabled());assert(await page.locator('#s-iso').isEnabled());await iso(page,1600);
  await number(page,'shutter',900);await page.locator('#autoIso').check();await page.waitForFunction(()=>opticsLab.data.settings.autoIso&&opticsLab.data.settings.iso===100);await ready(page);
  const saved=await page.evaluate(()=>opticsLab.settings);await page.goto(url+'#s='+encodeURIComponent(JSON.stringify(saved)));await page.reload();await ready(page);
  assert((await page.locator('#shutter-label').textContent()).includes('custom'));assert.equal(await page.locator('#n-shutter').inputValue(),'900');assert(await page.locator('#sensorNoise').isChecked());
  assert(await page.locator('#autoIso').isChecked());assert(await page.locator('#n-iso').isDisabled());assert.equal(await page.locator('#n-iso').inputValue(),'100');
  await number(page,'fnumber',2.8);await number(page,'shutter',1/1000);
  await page.screenshot({path:path.join(out,`${kind}-desktop-controls.png`)});
  for(const [width,height]of [[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.locator('#controls').evaluate(el=>el.scrollTop=0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
   await page.screenshot({path:path.join(out,`${kind}-${width}-controls.png`)});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
  const report={browser:kind,url,lowRms,highRms,r5MaximumIso:51200,autoIsoRange:[100,51200],stableNoise:true,downsamplingAveragesNoise:true,geometryNoiseFree:true,standardSpeedSlider:true,keyboardSlider:true,customDurationThrough1e308:true,invalidDurationRejected:true,autoIso:true,autoIsoLimits:true,sharedLongExposureAndAutoIso:true,mobile:true,errors,failed,external};
  await fs.writeFile(path.join(out,`${kind}-exposure.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){if(page)await page.screenshot({path:path.join(out,`${kind}-failure.png`)}).catch(()=>{});throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
