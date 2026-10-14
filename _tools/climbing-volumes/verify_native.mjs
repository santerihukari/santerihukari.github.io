import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import * as THREE from '../../assets/cad/coffee-filter/three/build/three.module.js';
import { unzipSync, strFromU8 } from '../../assets/cad/coffee-filter/three/examples/jsm/libs/fflate.module.js';
import { buildVolume } from '../../src/climbing_volumes/geometry.mjs';
import { migrateSettings, validateParameters } from '../../src/climbing_volumes/parameters.mjs';
import { panelBundle, panelSVG, currentExport } from '../../src/climbing_volumes/exports.mjs';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../../assets/cad/coffee-filter/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { GLTFExporter } = await import('../../assets/cad/coffee-filter/three/examples/jsm/exporters/GLTFExporter.js');

const config = JSON.parse(await fs.readFile(new URL('../../assets/cad/climbing-volumes/config.json', import.meta.url)));
const oracle = JSON.parse(await fs.readFile(new URL('./native-fixtures.json', import.meta.url)));
for (const [name, expected] of Object.entries(oracle.source_sha256)) {
  const bytes = await fs.readFile(`F:/param_cad/climbing_crack_brace/${name}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `Native fixture source hash: ${name}`);
}
console.log('PASS live native source hashes: model.py, volumes.py, shells.py, inner_supports.py');
for (const [key, value] of Object.entries(oracle.limits)) assert.deepEqual(config.limits[key], value, key);
const module = await Module(); module.setup();
const output = new URL('./artifacts/native/', import.meta.url); await fs.mkdir(output, { recursive: true });
const near = (actual, expected, name, relative = 1e-5) => assert(Math.abs(actual - expected) <= Math.max(1e-5, Math.abs(expected) * relative), `${name}: ${actual} != ${expected}`);
function cloud(actual, expected, name, epsilon = 1e-5) {
  for (const [points, target] of [[actual, expected], [expected, actual]]) for (const point of points) {
    assert(target.some(other => Math.hypot(...point.map((value, axis) => value - other[axis])) < epsilon), `${name}: missing ${point}`);
  }
}
function surfaces(actual, expected, name) {
  for (const [mesh, target] of [[actual, expected], [expected, actual]]) {
    const triangles = [];
    for (let i = 0; i < target.indices.length; i += 3) triangles.push(new THREE.Triangle(...target.indices.slice(i, i + 3).map(index => new THREE.Vector3(...target.vertices[index]))));
    for (const point of mesh.vertices) {
      const vertex = new THREE.Vector3(...point), closest = new THREE.Vector3();
      assert(triangles.some(triangle => triangle.closestPointToPoint(vertex, closest).distanceTo(vertex) < .002), `${name}: off-surface ${point}`);
    }
  }
}
// GLTFExporter uses the browser FileReader API; these are its two Blob read operations.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
async function glb(result) {
  const group = new THREE.Group();
  for (const part of result.parts) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.vertices.flat(), 3)); geometry.setIndex(part.indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: part.color, side: part.reference ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.name = part.name; group.add(mesh);
  }
  group.rotation.x = -Math.PI / 2; group.scale.setScalar(.001); group.updateMatrixWorld(true);
  try { return await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: false }); }
  finally { group.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); }); }
}
let failures = 0;
for (const fixture of oracle.fixtures) {
  try {
    if (fixture.reject) { assert.throws(() => buildVolume(fixture.parameters, config, module)); console.log(`PASS rejection ${fixture.id}`); continue; }
    const result = buildVolume(fixture.parameters, config, module), report = result.report, expected = fixture.report;
    for (const key of ['total_panels', 'support_count', 'total_fabrication_parts', 'incut_panels', 'independent_wall_lengths', 'independent_length_factors', 'base_edge_anchored', 'identical_panel_solids', 'end_caps_identical', 'mirror_symmetric', 'shell_outline_mirror_symmetric']) assert.deepEqual(report[key], expected[key], `${fixture.id}/${key}`);
    for (const key of ['projection_mm', 'ridge_distance_mm', 'volume_height_mm']) near(report[key], expected[key], key);
    for (const key of ['radius_mm', 'diameter_mm', 'nominal_radius_mm']) near(report.base_radius_reference[key], expected.base_radius_reference[key], key);
    for (const key of ['overall_factor', 'effective_reach_mm', 'nominal_wall_edge_mm', 'plywood_thickness_scaled']) assert.equal(report.size_scaling[key], expected.size_scaling[key]);
    for (const [index, panel] of report.panels.entries()) {
      const source = expected.panels[index], mesh = result.meshes[index], original = fixture.meshes_mm[index];
      near(mesh.volume, original.volume_mm3, `${fixture.id}/${panel.id} volume`);
      if (panel.mounting_holes.length) surfaces(mesh, original, `${fixture.id}/${panel.id} mesh`);
      else cloud(mesh.vertices, original.vertices, `${fixture.id}/${panel.id} mesh`);
      near(panel.tilt_to_reference_deg, source.tilt_to_reference_deg, 'tilt');
      near(panel.nominal_tilt_deg, source.nominal_tilt_deg, 'nominal tilt');
      cloud(panel.local_long_face_vertices_mm, source.local_long_face_vertices_mm, 'outer face');
      cloud(panel.local_short_face_vertices_mm, source.local_short_face_vertices_mm, 'inner face');
      for (const key of ['role', 'incut', 'length_factor']) assert.equal(panel[key], source[key], key);
      panel.wall_edge_lengths_mm.forEach((value, i) => near(value, source.wall_edge_lengths_mm[i], 'wall edge'));
      assert.equal(panel.cut_faces.length, source.cut_faces.length);
      for (const cut of panel.cut_faces) {
        const native = source.cut_faces.find(other => other.name === cut.name && other.contact_panel === cut.contact_panel); assert(native);
        cloud(cut.vertices_mm, native.vertices_mm, 'contact polygon');
      }
      assert.equal(panel.mounting_holes.length, source.mounting_holes.length);
      for (const [i, hole] of panel.mounting_holes.entries()) {
        const native = source.mounting_holes[i]; cloud(hole.face_outline_mm, native.face_outline_mm, 'bore outline');
        near(hole.wall_to_outer_face_mm, native.wall_to_outer_face_mm, 'bore length');
        assert.equal(hole.face_outline_mm.length, 96);
        for (const point of hole.outline_xy_mm) assert.equal(point.length, 2);
      }
      assert.equal((panelSVG(result, index).match(/data-bore=/g) ?? []).length, source.mounting_holes.length);
    }
    for (const support of result.supports) {
      const native = expected.inner_supports.find(part => part.id === support.id); assert(native, support.id);
      near(support.mesh.volume, native.volume_mm3, `${fixture.id}/${support.id} volume`);
      surfaces(support.mesh, fixture.supports_mm[support.id], `${support.id} surface`);
      cloud([support.report.stock_origin_mm], [native.stock_origin_mm], 'stock origin');
      cloud(support.report.stock_axes_local, native.stock_axes_local, 'stock axes');
      support.report.stock_dimensions_mm.forEach((value, i) => near(value, native.stock_dimensions_mm[i], 'stock size'));
      assert.equal(support.report.contacts.length, native.contacts.length);
      for (const contact of support.report.contacts) {
        const other = native.contacts.find(value => value.panel === contact.panel); assert(other);
        const physical = fixture.supports_mm[support.id].contacts.find(value => value.panel === contact.panel);
        assert(contact.contact_area_mm2 > 0, 'positive fitted contact');
        near(contact.contact_area_mm2, physical.area_mm2, `${support.id} physical contact area`, 2e-4);
        cloud(contact.contact_vertices_mm, physical.outer_vertices_mm, `${support.id} contact outline`, .002);
        near(contact.limit_mm, other.limit_mm, 'contact plane');
        cloud([contact.normal_local], [other.normal_local], 'contact normal');
      }
      if (native.wall_contact_area_mm2) near(support.report.wall_contact_area_mm2, fixture.supports_mm[support.id].wall_area_mm2, 'physical wall contact', 2e-4);
    }
    const bundle = panelBundle(result, await glb(result)), files = unzipSync(bundle);
    assert.equal(Object.keys(files).length, report.total_panels * 2 + report.support_count + 3 + Number(report.support_count > 0));
    if (report.support_count) assert.equal(strFromU8(files['support_cut_list.json']), JSON.stringify(report.inner_supports, null, 2));
    await fs.writeFile(new URL(`${fixture.id}_panels.zip`, output), bundle);
    console.log(`PASS native parity ${fixture.id}: reports, solids, fitted contacts, stock, bores, SVG/ZIP/GLB`);
  } catch (error) { failures++; console.error(`FAIL ${fixture.id}: ${error.stack}`); }
}
for (const overrides of [{ overall_scale: null }, { panel_length_factors: null }, { overall_scale: Infinity }, { panel_length_factors: [Number.MAX_VALUE, 1, 1] }, { panel_length_factors: [0, 1, 1] }, { panel_length_factors: [1, 1, 1], panel_tilts: [0, 45, 45] }]) assert.throws(() => validateParameters({ ...config.defaults, ...overrides }, config));
for (const scale of [1, 3]) {
  const migrated = migrateSettings({ ...config.defaults, overall_scale: scale, panel_wall_lengths: [300, 400, 500] }, config);
  assert.deepEqual(migrated.panel_length_factors, [.75, 1, 1.25]); assert.deepEqual(migrated.panel_wall_lengths, []);
  const result = buildVolume(migrated, config); result.report.panels.forEach((panel, i) => near(panel.wall_edge_lengths_mm[0], [300, 400, 500][i] * scale, 'migrated lengths'));
}
let sequence = 1;
const snapshot = { sequence: 1 }, isCurrent = value => value.sequence === sequence;
assert.equal(await currentExport(snapshot, isCurrent, async () => { sequence++; return 'stale'; }), null);
assert.equal(await currentExport(snapshot, isCurrent, async () => { throw new Error('Stale export must not start'); }), null);
sequence = 1; assert.equal(await currentExport(snapshot, isCurrent, async () => 'current'), 'current');
console.log('PASS migrations, overflow, mixed-input rejection, asynchronous stale export guards');
if (failures) process.exitCode = 1;
