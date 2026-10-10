import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDrone, motorCenters, rotateXY } from '../../src/drone_frame/geometry.mjs';
import { validateParameters, modelLink, readLink } from '../../src/drone_frame/parameters.mjs';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { binarySTL } from '../../src/drone_frame/exports.mjs';

const config = JSON.parse(await fs.readFile(new URL('../../assets/cad/drone-frame/config.json', import.meta.url)));
const fixtures = JSON.parse(await fs.readFile(new URL('./fixtures.json', import.meta.url)));
const supplied = JSON.parse(await fs.readFile(new URL('./handoff-fixtures.json', import.meta.url)));
const module = await Module({ locateFile: name => fileURLToPath(new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url)) });
module.setup();
const degenerateExport = new DataView(binarySTL({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0]), indices: new Uint32Array([0, 0, 1, 0, 1, 3, 0, 1, 2]) }));
assert.equal(degenerateExport.getUint32(80, true), 1, 'Collapsed and collinear facets must not enter STL');
assert.equal(degenerateExport.byteLength, 134);
assert.equal(degenerateExport.getFloat32(92, true), 1, 'Preserve the valid face winding');
assert.equal(new DataView(binarySTL({ positions: new Float32Array([0, 0, 0, 0.0001, 0, 0, 0, 0.0001, 0]), indices: new Uint32Array([0, 1, 2]) })).getUint32(80, true), 1, 'Small nonzero-area faces must remain');
let failures = 0;
for (const fixture of fixtures.cases ?? fixtures) {
  try {
    const result = buildDrone(module, fixture.parameters, config);
    if (fixture.error) throw new Error(`Python rejected this fixture: ${fixture.error}`);
    for (const [name, expected] of Object.entries(fixture.expected)) {
      const actual = name.startsWith('keeper-') ? result.parts.find(part => part.name === name)?.mesh : result.exports[name];
      assert(actual, `Missing ${name}`);
      for (let end = 0; end < 2; end++) for (let axis = 0; axis < 3; axis++) assert(Math.abs(actual.bounds[end][axis] - expected.bounds[end][axis]) < 0.025, `${name} bounds ${end}/${axis}: ${actual.bounds[end][axis]} != ${expected.bounds[end][axis]}`);
      assert(Math.abs(actual.volume - expected.volume) / expected.volume < 0.00001, `${name} volume ${actual.volume} != ${expected.volume}`);
      assert.equal(actual.genus, expected.genus, `${name} genus`);
      assert.equal(actual.components, expected.components, `${name} components`);
    }
    for (const [name, mesh] of Object.entries(result.exports)) assert(Math.abs(mesh.bounds[0][2]) < 0.025, `${name} print datum`);
    if (['current', 'mk4'].includes(fixture.name)) {
      const golden = supplied.find(item => item.id === (fixture.name === 'current' ? 'ender3_v2' : 'prusa_mk4'));
      const near = (a, b) => assert(Math.abs(a - b) < 0.025, `${a} != ${b}`);
      result.exports.lower.bounds.forEach((row, end) => row.forEach((v, axis) => near(v, golden.frame.bounds[end][axis])));
      assert(Math.abs(result.exports.lower.volume / golden.frame.solid_volume_mm3 - 1) < 0.00001);
      result.exports.upper.bounds.forEach((row, end) => row.forEach((v, axis) => near(v, golden.upper.bounds[end][axis])));
      assert(Math.abs(result.exports.upper.volume / golden.upper.solid_volume_mm3 - 1) < 0.00001);
      for (let axis = 0; axis < 2; axis++) near(result.report.printer.required_xy_mm[axis], golden.printer.required_xy_mm[axis]);
      near(result.report.wheelbase_mm, golden.derived_layout.diagonal_wheelbase);
      for (const key of ['calculated_engagement_mm', 'head_bottom_z_mm', 'mount_plane_z_mm', 'material_above_pocket_mm']) near(result.report.motor_screws[key], golden.motor_screws[key]);
      near(result.report.body_tip_gap_mm, golden.clearance.body.tip_gap);
      assert(result.report.lower_upper_intersection_mm3 < 1e-6);
      assert.equal(result.report.printer.status, 'pass');
      assert.equal(result.report.printer.upper.status, 'pass');
      assert.equal(result.report.printer.rotation_z_deg, 0);
      assert.equal(fixture.parameters.brim_width, 5);
      assert.equal(fixture.parameters.separate_skirt_loops, 0);
      near(result.report.controller_mount.pcb_bottom_z, golden.controller_mount.pcb_bottom_z);
      near(result.report.controller_mount.pin_to_roof_gap_mm, golden.controller_mount.pin_to_roof_gap_mm);
      for (const key of ['bottom_z', 'top_z', 'cut_top_z', 'usable_height_mm', 'boss_clearance_mm', 'nominal_three_wire_clearance_mm']) near(result.report.motor_cables[key], golden.motor_cables[key]);
      result.report.motor_cables.routes.forEach((route, i) => {
        for (const key of ['port_entry', 'port_exit', 'guide_points', 'local_wire_centers_tz']) {
          const compare = (a, b) => Array.isArray(a) ? a.forEach((value, index) => compare(value, b[index])) : near(a, b);
          compare(route[key], golden.motor_cables.routes[i][key]);
        }
      });
    }
    if (fixture.name === 'current') {
      const destination = new URL('../../output/drone-frame/', import.meta.url); await fs.mkdir(destination, { recursive: true });
      for (const [name, mesh] of Object.entries(result.exports)) await fs.writeFile(new URL(`verified-${name}.stl`, destination), new Uint8Array(binarySTL(mesh)));
      assert.equal(result.report.lower_ribs.ribs.length, 8);
      assert.equal(result.report.lower_ribs.minimum_calculated_gap_mm, 1);
      assert.equal(result.report.status, 'fail', 'Generic motor sweep overlap warning must not disappear');
      assert(Math.abs(result.report.motor_screws.calculated_engagement_mm - 2.7) < 1e-8);
      assert(Math.abs(result.report.motor_screws.head_bottom_z_mm + 3) < 1e-8);
      result.report.printer.centered_margins_mm.forEach((margin, i) => assert(Math.abs(margin - [3.5, 2][i]) < 1e-5));
      assert(result.report.lower_upper_intersection_mm3 < 1e-6, 'Matching upper/lower parts must not intersect');
      assert.deepEqual(Object.keys(result.exports).sort(), ['coupon', 'lower', 'upper']);
      assert.equal(result.report.controller_mount.style, 'integrated_top');
      assert.deepEqual(result.report.body_lengths_mm, { lower: 112, upper: 120 });
      assert(result.report.motor_screws.nominal_pad_hole_edge_web_mm < 2, 'Unverified thin pad warning must remain');
      assert.equal(result.report.motor_cables.full_bolt_boss_protected, true);
      assert.equal(result.report.motor_cables.open_top, true);
      assert.equal(result.report.motor_cables.nominal_wire_packing, 'vertical_stack');
      assert.equal(result.report.controller_ties.count, 4); assert.equal(result.report.controller_ties.loop_count, 2);
      const withoutTies = buildDrone(module, { ...fixture.parameters, under_controller_ties_enabled: false }, config);
      assert(Math.abs(withoutTies.exports.upper.volume - result.exports.upper.volume - 4 * fixture.parameters.under_tie_slot_length * fixture.parameters.under_tie_slot_width * fixture.parameters.upper_deck_thickness) < 1e-5, 'Four roof-through cuts');
      assert.deepEqual(withoutTies.exports.lower, result.exports.lower, 'Roof ties must not alter lower frame');
      const p = fixture.parameters, lower = new module.Manifold({ numProp: 3, vertProperties: result.exports.lower.positions, triVerts: result.exports.lower.indices });
      try {
        for (const [mx, my] of Object.values(motorCenters(p))) {
          const owned = [], own = solid => { owned.push(solid); return solid; };
          try {
            const angle = Math.atan2(my, mx) * 180 / Math.PI, g = result.report.motor_cables;
            const xy = rotateXY(p.root_boss_station, 0, angle);
            const ring = own(own(module.CrossSection.circle(p.root_boss_diameter / 2, 96)).subtract(own(module.CrossSection.circle(p.root_hole_diameter / 2, 96))));
            const boss = own(own(ring.extrude(p.clear_bay_height)).translate([xy[0], xy[1], p.frame_thickness]));
            assert(Math.abs(own(lower.intersect(boss)).volume() - boss.volume()) < 0.001, 'Entire root-bolt boss must remain intact');
            const insertion = own(own(own(module.Manifold.cube([g.s_range[1] - g.s_range[0] - 0.002, g.t_range[1] - g.t_range[0] - 0.002, 30])).translate([g.s_range[0] + 0.001, g.t_range[0] + 0.001, g.bottom_z + 0.001])).rotate([0, 0, angle]));
            assert(own(lower.intersect(insertion)).volume() < 0.001, 'Soldered leads must have a clear insertion path from above');
          } finally { owned.reverse().forEach(solid => solid.delete()); }
        }
      } finally { lower.delete(); }
    }
    console.log(`PASS ${fixture.name}`);
  } catch (error) {
    if (fixture.error) console.log(`PASS rejected ${fixture.name}`);
    else { failures++; console.error(`FAIL ${fixture.name}: ${error.stack}`); }
  }
}
const address = modelLink('https://example.org/sub/parametric-models/drone-frame/', config.defaults, config);
assert.deepEqual(readLink(address, config), config.defaults);
const previous = fixtures.find(item => item.name === 'previous-website-default');
const previousLink = structuredClone(previous.parameters);
for (const key of ['motor_compact_pad', 'motor_cable_ports_enabled', 'motor_cable_port_width', 'motor_cable_boss_clearance', 'motor_cable_port_floor', 'motor_cable_port_height', 'motor_cable_wire_diameter', 'motor_cable_wire_gap', 'lower_body_length', 'motor_thread_depth']) delete previousLink[key];
assert.deepEqual(buildDrone(module, readLink(`https://example.org/#drone-v1=${encodeURIComponent(JSON.stringify(previousLink))}`, config), config).exports, buildDrone(module, previous.parameters, config).exports, 'Previously shared links must retain their printable geometry');
const oldLinkParameters = structuredClone(config.defaults); for (const key of ['under_controller_ties_enabled', 'under_tie_slot_length', 'under_tie_slot_width', 'under_tie_edge_gap']) delete oldLinkParameters[key];
assert.equal(readLink(`https://example.org/#drone-v1=${encodeURIComponent(JSON.stringify(oldLinkParameters))}`, config).under_controller_ties_enabled, false, 'Old links must not silently add roof slots');
const custom = { ...config.defaults, motor_x_offset: 106, esp32_rotation_z: 75 };
assert.deepEqual(readLink(modelLink('https://example.org/sub/model/?old=1', custom, config), config), custom);
assert.throws(() => validateParameters({ ...config.defaults, plate_width: NaN }, config));
assert.throws(() => validateParameters({ ...config.defaults, unexpected: 1 }, config));
assert.throws(() => validateParameters({ ...config.defaults, component_references: { private: 'model' } }, config));
const licensed = { ...config.defaults, component_references: { radio_module: { model_id: 'esp32_s3_wroom1_module', position: [0, -175, 0], rotation: [0, 0, 90] }, power_connector: { model_id: 'xt60_m_reference', position: [25, -175, 0], rotation: [0, 0, 0] } } };
assert.deepEqual(readLink(modelLink('https://example.org/sub/model/', licensed, config), config), licensed);
assert.deepEqual(buildDrone(module, licensed, config).report, buildDrone(module, config.defaults, config).report, 'Optional display references must not alter frame fit checks');
assert.deepEqual(buildDrone(module, licensed, config).exports.lower, buildDrone(module, config.defaults, config).exports.lower, 'Optional references must not enter printable geometry');
for (const setting of [
  { model_id: 'yd_esp32_s3_candidate', position: [0, 0, 0], rotation: [0, 0, 0] },
  { model_id: 'esp32_s3_wroom1_module', position: [0, NaN, 0], rotation: [0, 0, 0] },
  { model_id: 'esp32_s3_wroom1_module', position: [0, 0, 501], rotation: [0, 0, 0] },
  { model_id: 'esp32_s3_wroom1_module', position: [0, 0, 0], rotation: [0, 0, 361] },
  { model_id: 'esp32_s3_wroom1_module', position: [0, 0, 0], rotation: [0, 0, 0], source_transform: [] }
]) assert.throws(() => validateParameters({ ...config.defaults, component_references: { radio_module: setting } }, config));
const referenceRoot = new URL('../../assets/cad/drone-frame/references/', import.meta.url);
const references = JSON.parse(await fs.readFile(new URL('manifest.json', referenceRoot)));
assert.deepEqual(Object.keys(references.models).sort(), ['tmotor_v2207_v3_dimensional', 'tattu_1800_4s_dimensional', 'generic_51_triblade_cw', 'generic_51_triblade_ccw', 'esp32_s3_wroom1_module', 'xt60_m_reference', 'xt60_f_reference'].sort());
assert(!JSON.stringify(references).match(/[FK]:\\|local_references|reference_cache|private|inventory_family/));
const { createHash } = await import('node:crypto');
for (const [id, reference] of Object.entries(references.models)) {
  const data = await fs.readFile(new URL(`../../assets/cad/drone-frame/${reference.file}`, import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'), reference.sha256, id);
  const glb = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  assert(glb.meshes?.length, id);
  if (reference.slot) {
    assert.match(reference.licence, /CC-BY-SA-4.0/);
    assert.match(await fs.readFile(new URL(`../../assets/cad/drone-frame/${reference.notice}`, import.meta.url), 'utf8'), /CC-BY-SA|CC BY-SA/);
  }
}
assert.equal((await fs.readdir(referenceRoot)).filter(name => name.endsWith('.glb')).length, 7, 'Only approved meshes may be published');
assert.throws(() => readLink('https://example.org/#drone-v1=%7B%7D', config));
assert(!JSON.stringify(config).match(/[FK]:\\|local_references|reference_cache/));
assert.deepEqual(buildDrone(module, { ...config.defaults, root_hardware_preview: true }, config).report, buildDrone(module, config.defaults, config).report, 'Hardware visibility must not change fit checks');
console.log('PASS validation, sanitized configuration and shared-link round trip');
if (failures) process.exitCode = 1;
