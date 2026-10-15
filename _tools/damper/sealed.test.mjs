import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { CONTROLS, DATUMS, DEFAULTS, glandDimensions, validateSettings } from '../../src/damper/sealed-parameters.mjs';
import { generateSealed } from '../../src/damper/sealed-geometry.mjs';

const baseline = JSON.parse(readFileSync(new URL('../../assets/cad/air-damper/model.json', import.meta.url)));
const before = JSON.stringify(baseline);
const api = await Module({ locateFile: name => fileURLToPath(new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url)) });
api.setup();
const cache = new Map();
function generate(input = {}) {
  const key = JSON.stringify(input);
  if (!cache.has(key)) cache.set(key, generateSealed(api, input, baseline));
  return cache.get(key);
}
function box(positions) {
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  positions.forEach((value, i) => { low[i % 3] = Math.min(low[i % 3], value); high[i % 3] = Math.max(high[i % 3], value); });
  return { low, high, size: high.map((value, i) => value - low[i]) };
}
function solid(mesh) {
  const data = new api.Mesh({ numProp: 3, vertProperties: new Float32Array(mesh.positions), triVerts: new Uint32Array(mesh.indices) });
  data.merge(); return new api.Manifold(data);
}
function checkMesh(mesh, label, bodies = 1) {
  assert(mesh.positions.length && mesh.indices.length, `${label}: empty mesh`);
  assert(mesh.positions.every(Number.isFinite));
  assert(mesh.indices.every(value => Number.isInteger(value) && value >= 0 && value < mesh.positions.length / 3));
  const model = solid(mesh), pieces = model.decompose();
  try { assert.equal(model.status(), 'NoError', label); assert(model.volume() > 0, `${label}: nonpositive volume`); assert.equal(pieces.length, bodies, `${label}: body count`); }
  finally { pieces.forEach(piece => piece.delete()); model.delete(); }
}
function checkResult(result) {
  assert.equal(result.print_manifest.length, 7);
  for (const item of result.print_manifest) {
    assert.equal(item.quantity, 1); assert.equal(item.bodies, 1); assert.equal(item.watertight, true);
    const part = result.parts.find(part => part.name === item.part);
    assert(part && !part.reference); checkMesh(part, item.part);
    if (part.section_positions.length) checkMesh({ positions: part.section_positions, indices: part.section_indices }, `${item.part} section`);
    const mesh = result.print_meshes[item.part]; checkMesh(mesh, `${item.part} print`);
    const bounds = box(mesh.positions);
    assert(Math.abs(bounds.low[2]) < 1e-6);
    bounds.size.forEach((size, i) => assert(Math.abs(size - item.dimensions_mm[i]) < 1e-5));
    const a = solid(part), b = solid(mesh);
    try { assert(Math.abs(a.volume() - b.volume()) < .03, `${item.part}: print transform changed volume`); }
    finally { a.delete(); b.delete(); }
  }
  for (const part of result.parts.filter(part => part.reference)) assert(!Object.hasOwn(result.print_meshes, part.name), 'Reference leaked into STL set');
  for (const row of result.report.sealed.motion) for (const amount of Object.values(row.intersections_mm3)) assert(amount < 0.0001);
  assert.deepEqual(result.report.sealed.needle.checks.map(row => row.opening_mm), [...new Set([0, 1, result.sealed_parameters.bleed_opening])]);
  for (const row of result.report.sealed.needle.checks) {
    assert(row.rear_cap_intersection_mm3 < 0.0001);
    assert(row.remaining_thread_engagement_mm >= 5);
    assert(row.stem_ring_x_mm[0] > 55 && row.stem_ring_x_mm[1] < 61.8);
  }
  const [closed, opened] = result.report.sealed.flow.probes;
  assert.equal(closed.connected_inlet_to_exhaust, false);
  assert.equal(opened.connected_inlet_to_exhaust, true);
  assert.equal(opened.inlet_to_stem_exit_with_nominal_seal, false);
  assert.equal(result.report.sealed.flow.cfd, false);
  assert.equal(result.report.performance_simulated, false);
  assert.equal(result.parameters.front_guide_length, 0);
  assert.equal(result.maximum_stroke_mm, baseline.parameters.rod_length - result.sealed_parameters.cap_thickness_mm);
  assert.equal(JSON.stringify(baseline), before, 'Baseline was mutated');
}

test('public settings and grouped control metadata are stable and strict', () => {
  assert.deepEqual(validateSettings(), DEFAULTS);
  assert.deepEqual(CONTROLS.flatMap(group => group.fields.map(field => field.key)).sort(), Object.keys(DEFAULTS).sort());
  for (const input of [{ piston_rings: 3 }, { piston_rings: .5 }, { bleed_opening: NaN }, { bleed_opening: 1.1 }, { cap_thickness_mm: 5 }, { rod_seal: 1 }, { unknown: 3 }]) assert.throws(() => validateSettings(input));
  assert.equal(DEFAULTS.piston_rings, 1); assert.equal(DEFAULTS.rod_seal, false);
});

test('glands use expected print diameters, stretch thinning and the actual chamfer mouth', () => {
  const g = glandDimensions(validateSettings());
  assert(Math.abs(g.piston.squeeze_percent - 8) < 1e-8);
  assert(Math.abs(g.piston.cad_root_mm - 17.2569526136) < 1e-6);
  assert(g.piston.stretch_percent > 0 && g.piston.stretch_percent <= 6);
  assert(g.piston.fill_percent < 85 && g.face.fill_percent < 85 && g.stem.fill_percent < 85);
  assert(Math.abs(g.face.inner_land_mm - .65) < 1e-8);
  assert.equal(DATUMS.bore_mouth_cad_mm, 21.2);
  assert.equal(g.face.outer_land_mm, .75);
  for (const input of [{ piston_ring_id_mm: 19 }, { piston_ring_id_mm: 15 }, { piston_gland_width_mm: 1.2 }, { cap_ring_id_mm: 22 }, { cap_gland_width_mm: 3 }, { rod_seal: true, rod_ring_id_mm: 6 }]) assert.throws(() => validateSettings(input));
});

test('default sealed revision contains positive print solids and capped sections', () => {
  const result = generate(); checkResult(result);
  assert.deepEqual(result.parts.find(part => part.name === 'housing').positions, baseline.parts.find(part => part.name === 'housing').positions);
  assert.equal(result.report.sealed.baseline.housing_full_mesh_exact, true);
  assert.equal(result.report.sealed.source.copyright, 'Santeri Hukari');
  assert.equal(result.report.sealed.source.third_party_geometry_added, false);
  assert.equal(result.parts.filter(part => part.name.startsWith('piston_ring_')).length, 1);
  assert(result.report.sealed.warnings.some(text => /not a pressure vessel/.test(text)));
});

test('zero rings preserves the full exact plunger; grooving does not alter rod/button shape', () => {
  const result = generate({ piston_rings: 0, bleed_opening: 0 }); checkResult(result);
  const original = baseline.parts.find(part => part.name === 'plunger'), exact = result.parts.find(part => part.name === 'plunger');
  assert.deepEqual(exact.positions, original.positions); assert.deepEqual(exact.indices, original.indices);
  assert(!result.parts.some(part => part.name.startsWith('piston_ring_')));
  assert(result.report.sealed.warnings.some(text => /trapped air/.test(text)));
  const rounded = new Float32Array(original.positions), source = new Set();
  for (let i = 0; i < rounded.length; i += 3) if (rounded[i] < 0) source.add([...rounded.slice(i, i + 3)].join(','));
  const cut = generate().parts.find(part => part.name === 'plunger').positions;
  for (let i = 0; i < cut.length; i += 3) if (cut[i] < 0) assert(source.has(cut.slice(i, i + 3).join(',')), 'Button or rod was reprofiled/scaled');
});

test('0/1/2 piston rings, independent seal choices, endpoints and thick caps remain valid', () => {
  const seals = [
    { front_face_seal: false, rear_face_seal: true, rod_seal: false },
    { front_face_seal: false, rear_face_seal: false, rod_seal: false },
    { front_face_seal: true, rear_face_seal: false, rod_seal: false },
    { front_face_seal: false, rear_face_seal: false, rod_seal: true },
    { front_face_seal: true, rear_face_seal: true, rod_seal: true }
  ];
  for (const piston_rings of [0, 1, 2]) for (const [index, toggles] of seals.entries()) {
    const settings = { piston_rings, ...toggles, bleed_opening: index % 2, cap_thickness_mm: piston_rings === 2 ? 8 : 6 };
    const result = generate(settings); checkResult(result);
    assert.equal(result.parts.filter(part => part.name.startsWith('piston_ring_')).length, piston_rings);
    assert.deepEqual(result.report.sealed.glands.piston.centers_x_mm, piston_rings === 2 ? [6, 16] : piston_rings ? [11] : []);
    for (const row of result.report.sealed.hardware) {
      assert(row.nut_to_housing_intersection_mm3 < .0001 && row.washer_to_housing_intersection_mm3 < .0001);
      assert(row.screw_protrusion_beyond_nut_mm >= 1);
    }
  }
  checkResult(generate({ cap_thickness_mm: 7, bleed_orifice_mm: .8, bleed_opening: .25, flap_thickness_mm: .8 }));
});

test('fractional needle openings check the selected pose and actual returned cap/needle meshes', () => {
  for (const opening of [.2, .5, .85]) {
    const result = generate({ bleed_opening: opening });
    const checks = result.report.sealed.needle.checks;
    assert.deepEqual(checks.map(row => row.opening_mm), [0, 1, opening]);
    const selected = checks.find(row => row.opening_mm === opening);
    assert(selected && selected.rear_cap_intersection_mm3 < .0001);
    const needle = solid(result.parts.find(part => part.name === 'bleed_needle'));
    const rear = solid(result.parts.find(part => part.name === 'rear_cap'));
    const overlap = api.Manifold.intersection(needle, rear);
    try {
      const actual = Math.max(0, overlap.volume());
      assert(actual < .0001, `Selected ${opening} mm needle intersects the returned rear-cap mesh by ${actual} mm3`);
      assert(Math.abs(actual - selected.rear_cap_intersection_mm3) < .0001, 'Selected-pose report does not agree with the returned meshes');
    } finally { overlap.delete(); needle.delete(); rear.delete(); }
  }
});

test('silicone flap is one sheet body with exact mm SVG contour and blind anchor', () => {
  const result = generate(), flap = result.parts.find(part => part.name === 'reset_flap');
  checkMesh(flap, 'Silicone flap');
  const b = box(flap.positions);
  assert(Math.abs(b.low[0] - 49.5) < 1e-5 && Math.abs(b.high[0] - 50) < 1e-5);
  assert(Math.abs(b.low[1] + 1.6) < 1e-5 && Math.abs(b.high[1] - 9) < 1e-5);
  assert(Math.abs(b.low[2] - 14) < 1e-5 && Math.abs(b.high[2] - 24.6) < 1e-5);
  assert.match(result.reset_template_svg, /width="[\d.]+mm" height="[\d.]+mm"/);
  assert.match(result.reset_template_svg, /1\.85 mm anchor hole/);
  assert.match(result.reset_template_svg, /h10/);
  const contour = /<path d="([^"]+)"/.exec(result.reset_template_svg)[1];
  assert.equal((contour.match(/M/g) || []).length, 2, 'SVG must have one outer boundary and one anchor hole');
  assert(!result.print_manifest.some(item => /reed$|flap|spring|ring|screw|nut|washer/.test(item.part)));
});

test('worker source keeps baseline init separate from small settings requests', () => {
  const worker = readFileSync(new URL('../../src/damper/sealed-worker.js', import.meta.url), 'utf8');
  assert.match(worker, /data\.type === 'init'/); assert.match(worker, /baseline = data\.baseline/);
  assert.match(worker, /self\.postMessage\(\{ type: 'ready' \}\)/);
  assert.match(worker, /generateSealed\(await runtime, data\.settings, baseline\)/);
  assert.match(worker, /self\.postMessage\(\{ sequence, result \}\)/);
});

test('independent Python/trimesh verifies exports, closed sections and exact silicone template', () => {
  const python = process.env.SEALED_PYTHON || 'F:/anaconda3/python.exe';
  for (const settings of [{}, { piston_rings: 0, bleed_opening: 0 }, { piston_rings: 2, front_face_seal: true, rod_seal: true, cap_thickness_mm: 8, bleed_opening: 1 }]) {
    const output = spawnSync(python, [fileURLToPath(new URL('./verify_sealed.py', import.meta.url))], { input: JSON.stringify(generate(settings)), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(output.status, 0, `${output.error || ''}\n${output.stderr}\n${output.stdout}`);
    assert.match(output.stdout, /PASS independent trimesh/);
  }
});
