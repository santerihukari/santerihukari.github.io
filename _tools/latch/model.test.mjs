import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const source = new URL('file:///F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const nativeKernel = new URL('assets/cad/latch/manifold/manifold.js', root);
const manifest = JSON.parse(await readFile(new URL('assets/cad/latch/source-manifest.json', root)));

test('public one-nut adaptation and pinned kernel have explicit source provenance', async () => {
  assert.equal(JSON.parse(await readFile(new URL('node_modules/manifold-3d/package.json', source))).version, '3.3.2');
  for (const [native, original] of [
    ['src/latch/model.mjs', 'latch-assets/model.mjs'],
    ['src/latch/example.mjs', 'latch-assets/example.mjs'],
    ['assets/cad/latch/manifold/manifold.js', 'latch-assets/vendor/manifold.js'],
    ['assets/cad/latch/manifold/manifold.wasm', 'latch-assets/vendor/manifold.wasm'],
  ]) {
    assert.equal(hash(await readFile(new URL(native, root))), manifest.public_sha256?.[native] || manifest.source_sha256[original], native);
    assert.equal(hash(await readFile(new URL(`static_site/${original}`, source))), manifest.source_sha256[original], original);
  }
  for (const file of ['manifold.js', 'manifold.wasm'])
    assert.equal(hash(await readFile(new URL(`assets/cad/latch/manifold/${file}`, root))), hash(await readFile(new URL(`node_modules/manifold-3d/${file}`, source))), `Pinned package bytes: ${file}`);
});

// These unchanged assertions check the ORIGINAL two-nut baseline, not public parity.
const suite = (await readFile(new URL('tests/model.test.mjs', source), 'utf8'))
  .replace("'manifold-3d'", JSON.stringify(nativeKernel.href))
  .replace("'../model.mjs'", JSON.stringify(new URL('static_site/latch-assets/model.mjs', source).href))
  .replace("'../example.mjs'", JSON.stringify(new URL('static_site/latch-assets/example.mjs', source).href));
await import(`data:text/javascript;base64,${Buffer.from(suite).toString('base64')}`);

const {default: Module} = await import(nativeKernel.href);
const api = await Module(); api.setup();
const publicModel = await import(new URL('src/latch/model.mjs', root));
const originalModel = await import(new URL('static_site/latch-assets/model.mjs', source));
const {exampleLayout, exampleLatchState} = await import(new URL('src/latch/example.mjs', root));
const defaults = publicModel.generate(api);

test('intentional delta removes nut_2 only; every retained part and STL stays exact', () => {
  for (const input of [{}, {latch_reach:42,handle_depth:20,handle_width:32}, {pitch:2,thread_height:16,nut_thickness:6,nut_across_flats:34}, {smooth_upper_length:9}]) {
    const original = originalModel.generate(api,input), current = publicModel.generate(api,input);
    assert.deepEqual(current.parts.map(p=>p.id), ['body','insert','nut_1']);
    assert.deepEqual(current.parameters,original.parameters);
    assert.deepEqual(current.features,original.features.filter(f=>f.part!=='nut_2'));
    for (const part of current.parts) {
      const before=original.parts.find(p=>p.id===part.id);
      assert.deepEqual(part,before,`${part.id}: complete geometry and display contract`);
      assert.equal(hash(Buffer.from(publicModel.stlBuffer([part]))),hash(Buffer.from(originalModel.stlBuffer([before]))));
    }
    assert.equal(current.parts.length,original.parts.length-1);
    assert.deepEqual(current.report.print_quantity,{body:1,insert:1,nut_1:1});
    assert(!Object.hasOwn(current.report,'remaining_thread_covers_two_nuts'));
    assert(!current.report.warnings.some(w=>/two full nut|have not been physically tested/.test(w)));
    assert.match(current.report.warnings.join(' '),/normal use/);
    assert.match(current.report.warnings.join(' '),/Impact resistance and repeated heavy use/);
    for (const [key,value] of Object.entries(original.report))
      if (!['warnings','remaining_thread_covers_two_nuts'].includes(key)) assert.deepEqual(current.report[key],value,key);
  }
});

test('one-nut door fixture keeps nut_1 datum and thread phase, with no panel/body/nut overlap', () => {
  const layout=exampleLayout(defaults.parameters);
  assert.deepEqual(layout.nuts,[{id:'nut_1',position:[0,0,4],angle_deg:240}]);
  assert.equal(layout.mount_stack_height_mm,8); assert.equal(layout.threaded_length_mm,12);
  assert.deepEqual(layout.issues,[]); assert(layout.mounting_fit);
  assert(exampleLatchState(defaults.parameters,layout,0).latched);
  assert(!exampleLatchState(defaults.parameters,layout,90).latched);
  const fromPart=p=>new api.Manifold(new api.Mesh({numProp:3,vertProperties:new Float32Array(p.vertices.flat()),triVerts:new Uint32Array(p.faces.flat())}));
  const body=fromPart(defaults.parts[0]),nut=fromPart(defaults.parts[2]);
  const rotated=nut.rotate([0,0,layout.nuts[0].angle_deg]),mounted=rotated.translate(layout.nuts[0].position);
  const d=layout.door,block=api.Manifold.cube([d.right-d.left,d.top-d.bottom,d.thickness]);
  const placed=block.translate([d.left,d.bottom,0]),hole=api.Manifold.cylinder(d.thickness,d.hole_diameter/2,d.hole_diameter/2,96);
  const panel=placed.subtract(hole);
  try {
    for (const [a,b,label] of [[body,mounted,'nut screw phase'],[body,panel,'body bore and foot'],[mounted,panel,'nut against panel']]) {
      const overlap=api.Manifold.intersection(a,b);
      try {assert(overlap.volume()<1e-5,label);} finally {overlap.delete();}
    }
    assert.equal(mounted.boundingBox().min[2],d.thickness);
    assert.equal(mounted.boundingBox().max[2],layout.mount_stack_height_mm);
  } finally {for (const solid of [body,nut,rotated,mounted,block,placed,hole,panel]) solid.delete();}
  assert(exampleLayout(defaults.parameters,{door_thickness:8}).mounting_fit);
  assert(!exampleLayout(defaults.parameters,{door_thickness:8.5}).mounting_fit);
  assert.equal(exampleLayout(defaults.parameters,{},2).mount_stack_height_mm,12,'Historical comparison only');
  assert.throws(()=>exampleLayout(defaults.parameters,{},3));
});
