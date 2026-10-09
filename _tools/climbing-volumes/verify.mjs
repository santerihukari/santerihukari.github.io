import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildVolume, cyclicBase } from '../../src/climbing_volumes/geometry.mjs';
import { validateParameters, migrateSettings, modelLink, readLink } from '../../src/climbing_volumes/parameters.mjs';
import { panelSTL, panelSVG, panelBundle } from '../../src/climbing_volumes/exports.mjs';
import { unzipSync, strFromU8 } from '../../assets/cad/coffee-filter/three/examples/jsm/libs/fflate.module.js';

const config = JSON.parse(await fs.readFile(new URL('../../assets/cad/climbing-volumes/config.json', import.meta.url)));
const fixtures = JSON.parse(await fs.readFile(new URL('./fixtures.json', import.meta.url)));
const near = (a, b, name) => assert(Math.abs(a - b) < 1e-5 * Math.max(1, Math.abs(b)), `${name}: ${a} != ${b}`);
const cloud = points => points.map(p => p.map(v => Math.round(v * 1e5) / 1e5)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
function compareCloud(a, b, name) {
  assert.equal(a.length, b.length, `${name}: point count`);
  const candidates = [...b];
  for (const point of a) { const i = candidates.findIndex(other => Math.hypot(...point.map((v, axis) => v - other[axis])) < 1e-5); assert(i >= 0, `${name}: missing ${point}`); candidates.splice(i, 1); }
}
let failed = 0;
for (const fixture of fixtures) {
  try {
    const result = buildVolume(fixture.parameters, config), expected = fixture.report;
    assert.equal(result.report.total_panels, expected.total_panels, fixture.id);
    assert.equal(result.report.independent_wall_lengths, expected.independent_wall_lengths);
    for (const key of ['projection_mm', 'volume_height_mm', 'extra_apex_cuts']) near(result.report[key], expected[key], key);
    near(result.report.base_radius_reference.radius_mm, expected.base_radius_reference.radius_mm, 'Actual footprint radius');
    near(result.report.base_radius_reference.diameter_mm, expected.base_radius_reference.diameter_mm, 'Actual footprint diameter');
    for (let i = 0; i < result.meshes.length; i++) {
      const mesh = result.meshes[i], original = fixture.meshes_mm[i], report = result.report.panels[i], source = expected.panels[i];
      near(mesh.volume, original.volume_mm3, `${fixture.id}/${i} volume`);
      compareCloud(mesh.vertices, original.vertices, `${fixture.id}/${i} vertices`);
      compareCloud(report.local_long_face_vertices_mm, source.local_long_face_vertices_mm, `${fixture.id}/${i} outer`);
      compareCloud(report.local_short_face_vertices_mm, source.local_short_face_vertices_mm, `${fixture.id}/${i} inner`);
      near(report.tilt_to_reference_deg, source.tilt_to_reference_deg, 'tilt');
      report.normal.forEach((v, axis) => near(v, source.normal[axis], 'normal'));
      assert.equal(report.role, source.role);
      report.wall_edge_lengths_mm.forEach((v, i) => near(v, source.wall_edge_lengths_mm[i], 'Wall-edge length'));
      assert.equal(report.edges.length, source.edges.length);
      const edges = [...source.edges];
      for (const edge of report.edges) { const index = edges.findIndex(e => e.name === edge.name && Math.abs(e.long_edge_mm - edge.long_edge_mm) < 1e-5); assert(index >= 0, `${fixture.id}/${i} edge ${edge.name}`); const e = edges.splice(index, 1)[0]; near(edge.short_edge_mm, e.short_edge_mm, 'short edge'); near(edge.bevel_from_square_deg, e.bevel_from_square_deg, 'bevel'); }
      assert.equal(report.cut_faces.length, source.cut_faces.length, 'Complete cut faces');
      for (const cut of report.cut_faces) {
        const original = source.cut_faces.find(c => c.contact_panel === cut.contact_panel && c.name === cut.name);
        assert(original, 'Missing contact'); compareCloud(cut.vertices_mm, original.vertices_mm, 'contact polygon');
        if (cut.contact_panel) { const other = result.report.panels.find(p => p.id === cut.contact_panel), opposite = other.cut_faces.find(c => c.contact_panel === report.id); assert(opposite, 'Missing reciprocal contact'); compareCloud(cut.vertices_mm, opposite.vertices_mm, 'shared contact'); }
      }
      const projection = mesh.vertices.map(v => v.reduce((s, n, a) => s + n * report.normal[a], 0));
      near(Math.max(...projection) - Math.min(...projection), result.parameters.plywood_thickness, 'Exact normal thickness');
      const counts = new Map(); for (let t = 0; t < mesh.indices.length; t += 3) for (let edge = 0; edge < 3; edge++) { const a = mesh.indices[t + edge], b = mesh.indices[t + (edge + 1) % 3], key = [a, b].sort((a, b) => a - b).join(','); counts.set(key, (counts.get(key) || 0) + 1); } assert([...counts.values()].every(n => n === 2), 'Watertight convex panel');
      const stl = panelSTL(mesh); assert.equal(stl.length, 84 + new DataView(stl.buffer).getUint32(80, true) * 50);
      const svg = panelSVG(result, i); assert.match(svg, /width="[\d.]+mm"/); assert.match(svg, /h100"/); assert.match(svg, /Additional trims:/);
    }
    if (fixture.id === 'current') { const output = new URL('../../output/climbing-volumes/', import.meta.url); await fs.mkdir(output, { recursive: true }); for (let i = 0; i < result.meshes.length; i++) await fs.writeFile(new URL(`verified-panel-${i}.stl`, output), panelSTL(result.meshes[i])); }
    console.log(`PASS ${fixture.id}: volumes, normals, full contact polygons, edges, angles, STL/SVG`);
  } catch (error) { failed++; console.error(`FAIL ${fixture.id}: ${error.stack}`); }
}
for (const overrides of [{ brace_reach: NaN }, { surface_count: 2, mounting_faces: 1 }, { mounting_faces: 2, surface_count: 2, panel_tilts: [35, 45] }, { mounting_faces: 2, surface_count: 2, corner_segments: 0, corner_flat_faces: true }, { mounting_faces: 2, surface_count: 2, corner_segments: 3, corner_bulge_ratio: 0.3 }, { plywood_thickness: 60, brace_reach: 30 }, { surface_count: 3.2 }]) assert.throws(() => buildVolume({ ...config.defaults, ...overrides }, config));
const migrated = migrateSettings({ ...config.defaults, wall_height: 8000, timber_width: 203, corner_fan: 8 }, config); assert.deepEqual(migrated, config.defaults);
assert.deepEqual(migrateSettings({ ...config.defaults, mounting_faces: 1, surface_count: 3, panel_tilts: [0, 40, 0] }, config).panel_tilts, [config.defaults.flat_slope_angle, 40, config.defaults.flat_slope_angle]);
assert.deepEqual(migrateSettings(config.previous_defaults, config), config.defaults);
assert.deepEqual(migrateSettings(config.previous_defaults, config, false), config.previous_defaults);
const formerEarlyDefaults = structuredClone(config.previous_defaults); delete formerEarlyDefaults.panel_wall_lengths;
assert.deepEqual(migrateSettings(formerEarlyDefaults, config), config.defaults);
assert.equal(migrateSettings({ ...config.previous_defaults, brace_reach: 300 }, config).brace_reach, 300);
assert.equal(migrateSettings({ ...config.previous_defaults, brace_reach: 300 }, config).corner_segments, 3);
const formerFlatDefaults = { ...config.defaults, flat_slope_angle: 70.52877936550931 };
assert.deepEqual(migrateSettings(formerFlatDefaults, config), config.defaults);
assert.deepEqual(migrateSettings(formerFlatDefaults, config, false), formerFlatDefaults);
assert.equal(migrateSettings({ ...formerFlatDefaults, brace_reach: 300 }, config).flat_slope_angle, formerFlatDefaults.flat_slope_angle);
assert.equal(config.defaults.flat_slope_angle, 45);
for (const mode of [1, 2]) {
  const result = buildVolume({ ...config.defaults, mounting_faces: mode, surface_count: mode === 1 ? 3 : 2 }, config);
  assert.equal(result.report.total_panels, mode === 1 ? 3 : 2);
  for (const panel of result.report.panels) {
    assert.equal(panel.shape, 'triangle'); assert.equal(panel.edges.length, 3);
    if (mode === 1) near(panel.tilt_to_reference_deg, 45, 'Flat default tilt');
    else {
      const lengths = panel.edges.map(edge => edge.long_edge_mm);
      lengths.forEach(length => near(length, lengths[0], 'Equilateral corner default edges'));
      panel.corner_angles_deg.forEach(angle => near(angle, 60, 'Equilateral corner default angles'));
    }
    near(panel.panel_volume_mm3, result.report.panels[0].panel_volume_mm3, 'Matching default panels');
  }
  assert.equal(result.report.extra_apex_cuts, 0);
}
assert.throws(() => buildVolume({ ...config.defaults, mounting_faces: 1, surface_count: 3, panel_tilts: [90, 90, 90] }, config));
assert.throws(() => buildVolume({ ...config.defaults, mounting_faces: 1, surface_count: 3, panel_tilts: [0, 90, 45] }, config));
assert.throws(() => buildVolume({ ...config.defaults, brace_reach: 2501 }, config));
for (const lengths of [[300, 400, 500], [300, 400, 650], [500, 100, 200, 250], [300, 400, 500, 600], Array.from({ length: 12 }, (_, i) => 200 + i * 10)]) {
  const points = cyclicBase(lengths, 31 * Math.PI / 180);
  lengths.forEach((length, i) => near(Math.hypot(...points[i].map((v, axis) => v - points[(i + 1) % points.length][axis])), length, 'Cyclic polygon side'));
}
for (const panel_wall_lengths of [[300, 400, 700], [300, 400, 800], [300, 400], [300, true, 500], [300, NaN, 500], [300, 0, 500], [300, 5001, 500]]) assert.throws(() => buildVolume({ ...config.defaults, mounting_faces: 1, surface_count: 3, panel_wall_lengths }, config));
assert.throws(() => validateParameters({ ...config.defaults, wall_height: 1 }, config));
assert.deepEqual(readLink(modelLink('https://example.org/prefix/tool/', config.defaults, config), config), config.defaults);
const result = buildVolume(config.defaults, config), files = unzipSync(panelBundle(result, new Uint8Array([0, 1, 2]).buffer));
assert.equal(Object.keys(files).length, result.report.total_panels * 2 + 3); assert.equal(JSON.parse(strFromU8(files['cutting_report.json'])).copyright, 'Santeri Hukari');
console.log('PASS invalid states, settings migration, parameter links, complete ZIP inventory');
if (failed) process.exitCode = 1;
