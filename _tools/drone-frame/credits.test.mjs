import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root=new URL('../../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const credits=JSON.parse(await read('assets/cad/drone-frame/credits.json'));
const registry=JSON.parse(await read('assets/cad/drone-frame/references/manifest.json'));
const config=JSON.parse(await read('assets/cad/drone-frame/config.json'));
const app=await read('src/drone_frame/app.js');
// Exercise the actual pure filter without booting Three.js or a DOM.
const filter=vm.runInNewContext(`(${app.split('function publicCredits(',2)[1].split('\nfunction noticeText()',1)[0].replace(/^/, 'function publicCredits(')})`);

test('public credits cover every bundled and optional reference, retaining licence files',async()=>{
  const selected=filter(credits,registry,config);
  assert.equal(selected.components.length,credits.components.length,'Stale credit entry in public JSON');
  for(const [id,model] of Object.entries(registry.models)) {
    const entry=selected.components.find(c=>c.public_models?.includes(id));
    assert(entry,`Missing bundled or optional public model: ${id}`);
    assert(model.licence && entry.licence);
    assert(entry.author.includes(model.author),`Attribution lost for ${id}`);
    if(model.notice) {
      assert.equal(entry.notice,model.notice);
      assert((await read(`assets/cad/drone-frame/${entry.notice}`)).length>100);
    }
  }
  for(const entry of selected.software) assert((await read(`assets/cad/drone-frame/${entry.notice}`)).length>100);
  assert(!JSON.stringify(selected).match(/David Scambell|Alexander Kuznetsov|grabcad\.com|YD-ESP32-S3/));
  assert.match(selected.publication,/absence of a licence is not permission/);
});

test('private-only credits cannot enter UI, notices, report or GLB attribution',()=>{
  const source=structuredClone(credits);
  source.components.push({name:'Private-only CAD',public_models:['private_mesh'],licence:'unresolved'});
  const selected=filter(source,registry,config);
  assert(!selected.components.some(c=>c.name==='Private-only CAD'));
  assert(app.includes('credits = publicCredits(credits, references, config)'));
  assert(app.includes('for (const component of credits.components)'));
  assert(app.includes('...credits.components.map'));
  assert(app.includes('sources: credits'));
  const missing=structuredClone(credits);
  missing.components=missing.components.filter(c=>!c.public_models?.includes('esp32_s3_wroom1_module'));
  assert.throws(()=>filter(missing,registry,config),/Missing public asset attribution/);
  const noLicence=structuredClone(registry);
  delete noLicence.models.esp32_s3_wroom1_module.licence;
  assert.throws(()=>filter(credits,noLicence,config),/Missing public asset attribution/);
});

test('always-visible description distinguishes hand checks from future stabilization',async()=>{
  const html=await read('_includes/drone-frame-configurator.html');
  const description=html.match(/<p class="cad-description">([^<]+)<\/p>/)[1];
  assert.match(description,/IMU-controlled drone/);
  assert.match(description,/Components (?:were )?fitted.*bent by hand/);
  assert.match(description,/(?:without|no) quantitative strength tests/);
  assert.match(description,/Not flight-ready|no.*flight qualification/);
  assert.match(description,/Next: IMU-feedback motor control, PID tuning for stabilization, then hovering/);
  assert(html.indexOf('class="cad-description"')<html.indexOf('<details'));
});
