import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import createManifold from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildHolder } from '../../src/coffee_filter/geometry.mjs';
import { defaults, selectLayout, selectProfile } from '../../src/coffee_filter/parameters.mjs';

const module = await createManifold();
module.setup();
const { fixtures } = JSON.parse(await readFile(new URL('./reference-fixtures.json', import.meta.url), 'utf8'));
const near = (actual, expected, tolerance = 0.0001) => assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

function checkMesh(mesh) {
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
  assert.equal(mesh.genus, 5);
}

for (const fixture of fixtures) {
  test(`Python parity: ${fixture.name}`, () => {
    if (fixture.error) { assert.throws(() => buildHolder(module, fixture.parameters)); return; }
    const mesh = buildHolder(module, fixture.parameters);
    mesh.bounds.forEach((value, i) => near(value, fixture.bounds[i]));
    near(mesh.volume, fixture.volume, 0.02);
    near(mesh.contact_z, fixture.contact_z);
    mesh.paper_outline.forEach((point, i) => point.forEach((value, j) => near(value, fixture.paper_outline[i][j])));
    checkMesh(mesh);
  });
}
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
