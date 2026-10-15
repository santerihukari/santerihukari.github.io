import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import createManifold from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildHolder } from '../../src/coffee_filter/geometry.mjs';
import { defaults, selectLayout, selectProfile, editParameter, frontRiseMaximum, validateParameters } from '../../src/coffee_filter/parameters.mjs';

const module = await createManifold();
module.setup();
const { fixtures } = JSON.parse(await readFile(new URL('./reference-fixtures.json', import.meta.url), 'utf8'));
const legacyHashes = JSON.parse(await readFile(new URL('./legacy-mesh-hashes.json', import.meta.url), 'utf8'));
const near = (actual, expected, tolerance = 0.0001) => assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

function checkMesh(mesh, genus = 5) {
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const triangle = [...mesh.indices.subarray(i, i + 3)];
    assert.equal(new Set(triangle).size, 3);
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      const edge = edges.get(key) || { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) assert.deepEqual(edge, { count: 2, winding: 0 });
  assert.equal(mesh.genus, genus);
}

for (const fixture of fixtures) {
  test(`Python parity: ${fixture.name}`, () => {
    if (fixture.error) { assert.throws(() => buildHolder(module, fixture.parameters)); return; }
    const mesh = buildHolder(module, fixture.parameters);
    assert.equal(createHash('sha256').update(new Uint8Array(mesh.positions.buffer)).update(new Uint8Array(mesh.indices.buffer)).digest('hex'), legacyHashes[fixture.name], 'Existing valid geometry must remain byte-identical');
    mesh.bounds.forEach((value, i) => near(value, fixture.bounds[i]));
    near(mesh.volume, fixture.volume, 0.02);
    near(mesh.contact_z, fixture.contact_z);
    mesh.paper_outline.forEach((point, i) => point.forEach((value, j) => near(value, fixture.paper_outline[i][j])));
    checkMesh(mesh);
  });
}

for (const layout of ['symmetric', 'side_rest', 'side_rest_right']) for (const mounting of ['screws', 'free_standing']) {
  test(`depth edits preserve actual shell slope: ${layout}, ${mounting}`, () => {
    let p = { ...selectLayout(defaults, layout), mounting };
    for (const depth of [17, 25, 40, 17]) {
      p = editParameter(p, 'usable_depth', depth);
      near(p.front_rise / depth, 15 / 17, 1e-14);
      const mesh = buildHolder(module, p);
      checkMesh(mesh, mesh.genus);
      const topAt = y => {
        let top = -Infinity;
        for (let i = 0; i < mesh.positions.length; i += 3) if (Math.abs(mesh.positions[i + 1] - y) < 1e-5) top = Math.max(top, mesh.positions[i + 2]);
        return top;
      };
      near((topAt(depth) - topAt(0)) / depth, 15 / 17, 2e-6);
      if (mounting === 'screws') assert.equal(mesh.front_access, depth === 17 ? 'round' : depth === 25 ? 'open_bottom' : 'clear_below');
    }
    p = editParameter(p, 'front_rise', 8.5);
    near(editParameter(p, 'usable_depth', 40).front_rise, 20);
  });
}

test('rise limits scale with depth without clamping the preserved slope', () => {
  for (const depth of [10, 17, 25, 40, 45]) {
    const p = editParameter({ ...defaults, usable_depth: 10, front_rise: 16 }, 'usable_depth', depth);
    assert.deepEqual(validateParameters(p), p);
    near(p.front_rise, frontRiseMaximum(depth));
    assert.throws(() => validateParameters({ ...p, front_rise: p.front_rise + 0.1 }));
  }
});

test('front-access transitions keep one manifold solid without thin bottom ligaments', () => {
  for (const layout of ['symmetric', 'side_rest', 'side_rest_right']) for (const rise of [18, 18.001, 21, 25, 28.999, 29, 40]) {
    const mesh = buildHolder(module, { ...selectLayout(defaults, layout), usable_depth: 40, front_rise: rise });
    checkMesh(mesh, rise <= 18 ? 5 : 3);
  }
});
test('nonfinite parameters and unsupported layouts are rejected', () => {
  for (const angle of [NaN, Infinity, true, '76.94', null]) assert.throws(() => buildHolder(module, { ...defaults, angle }));
  assert.throws(() => buildHolder(module, { ...defaults, layout: 'unknown' }));
  assert.throws(() => buildHolder(module, { ...defaults, radius: 100, tip_cut: 100 }));
});

test('side-rest presets default to a 17 mm seating drop without changing symmetric defaults', () => {
  for (const profile of ['measured', 'right_angle']) {
    const values = selectProfile(selectLayout(defaults, 'side_rest'), profile);
    assert.equal(values.paper_drop, 17);
    assert.equal(values.angle, profile === 'measured' ? 76.94 : 90);
    checkMesh(buildHolder(module, values));
    assert.equal(selectProfile({ ...values, paper_drop: 5 }, profile).paper_drop, 17);
    assert.equal(selectLayout(values, 'symmetric').paper_drop, 0);
    assert.equal(selectProfile(selectLayout(values, 'symmetric'), profile).paper_drop, 0);
    assert.equal(selectProfile({ ...values, paper_drop: 5 }, 'custom').paper_drop, 5);
  }
  assert.equal(defaults.paper_drop, 0);
});

test('right side-rest is a true mirrored solid, including the paper outline',()=>{
  for(const profile of ['measured','right_angle']){
    const left=buildHolder(module,selectProfile(selectLayout(defaults,'side_rest'),profile));
    const right=buildHolder(module,selectProfile(selectLayout(defaults,'side_rest_right'),profile));
    checkMesh(right);near(left.volume,right.volume,.03);near(right.bounds[0],-left.bounds[3]);near(right.bounds[3],-left.bounds[0]);
    for(let i=0;i<left.paper_outline.length;i++){near(right.paper_outline[i][0],-left.paper_outline[i][0]);near(right.paper_outline[i][1],left.paper_outline[i][1]);}
  }
});

for(const layout of ['symmetric','side_rest','side_rest_right'])for(const profile of ['measured','right_angle']){
  test(`self-standing: ${layout}, ${profile}`,()=>{
    const p={...selectProfile(selectLayout(defaults,layout),profile),mounting:'free_standing'};
    const mesh=buildHolder(module,p);checkMesh(mesh,mesh.genus);
    const solid=module.Manifold.ofMesh(new module.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices}));
    const parts=solid.decompose();assert.equal(parts.length,1);assert.equal(solid.status(),'NoError');parts.forEach(p=>p.delete());solid.delete();
    assert(mesh.volume>0);near(mesh.bounds[2],0);assert.deepEqual(mesh.hole_xs,[]);assert.equal(mesh.hole_z,null);
    const paperBottom=Math.min(...mesh.paper_outline.map(([,z])=>z))-mesh.contact_z;
    assert(paperBottom>=6-1e-4,'Papers must clear the base');
    assert(mesh.bounds[0]<=Math.min(...mesh.paper_outline.map(([x])=>x))-5.9);
    assert(mesh.bounds[3]>=Math.max(...mesh.paper_outline.map(([x])=>x))+5.9);
  });
}
