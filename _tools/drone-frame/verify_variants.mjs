import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildDrone, motorCenters, rotateXY, rotorEnvelope } from '../../src/drone_frame/geometry.mjs';
import { printProfiles } from '../../src/drone_frame/print_profiles.mjs';
import { modelLink, readLink, validateParameters } from '../../src/drone_frame/parameters.mjs';
import { binarySTL } from '../../src/drone_frame/exports.mjs';

const configBytes = await fs.readFile(new URL('../../assets/cad/drone-frame/config.json', import.meta.url));
const config = JSON.parse(configBytes);
const module = await Module({ locateFile: name => fileURLToPath(new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url)) });
module.setup();
const baseline = buildDrone(module, config.defaults, config);
const solid = mesh => new module.Manifold({ numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices });
const baselineLower = solid(baseline.exports.lower), baselineUpper = solid(baseline.parts.find(part => part.name === 'upper').mesh);
const totals = {};
try {
  for (const [id, profile] of Object.entries(printProfiles)) {
    const result = buildDrone(module, { ...config.defaults, print_profile: id }, config), p = result.parameters;
    const lower = solid(result.exports.lower), upper = solid(result.parts.find(part => part.name === 'upper').mesh);
    const owned = [], own = item => { owned.push(item); return item; };
    try {
      assert(own(lower.subtract(baselineLower)).volume() < 0.005, 'Lower thinning must only remove original material');
      assert(own(upper.subtract(baselineUpper)).volume() < 0.005, 'Upper thinning must only remove original material');
      assert.equal(lower.status(), 'NoError'); assert.equal(upper.status(), 'NoError');
      for (const part of ['lower', 'upper']) {
        const mesh = result.exports[part];
        assert.equal(mesh.components, 1);
        mesh.bounds.forEach((row, end) => row.forEach((v, axis) => {
          if (!profile.layoutJig || axis < 2) assert(Math.abs(v - baseline.exports[part].bounds[end][axis]) < 0.025);
        }));
      }
      assert.deepEqual(result.exports.coupon, baseline.exports.coupon, 'Normal-height motor coupon must not change');
      assert.deepEqual(result.holes, baseline.holes); assert.deepEqual(result.slots, baseline.slots);
      assert.deepEqual(result.report.motor_screws, baseline.report.motor_screws);
      if (profile.layoutJig) {
        assert.equal(result.report.controller_mount.enabled, false);
        assert.equal(result.report.motor_cables.enabled, false);
        assert.equal(result.report.print_version.layout_only, true);
        assert(Math.abs(result.exports.lower.bounds[1][2] - p.motor_platform_thickness) < 0.025);
        assert(Math.abs(result.exports.upper.bounds[1][2] - result.exports.upper.bounds[0][2] - profile.roof) < 0.025);
      } else assert.deepEqual(result.report.controller_mount, baseline.report.controller_mount);
      assert(result.report.lower_upper_intersection_mm3 < 0.001);
      assert.equal(result.report.printer.status, 'pass'); assert.equal(result.report.printer.upper.status, 'pass');
      assert.equal(result.report.status, 'fail', 'Version selector must not certify unresolved generic envelopes');
      const envelopes = parts => parts.filter(part => !part.printable && !(profile.layoutJig && part.label.startsWith('Root ')));
      assert.deepEqual(envelopes(result.parts), envelopes(baseline.parts), 'No hardware pose may change');
      for (const [mx, my] of Object.values(motorCenters(p))) {
        const section = own(module.CrossSection.circle(p.motor_pad_diameter / 2, 128));
        const pad = own(own(section.extrude(p.motor_platform_thickness)).translate([mx, my, 0]));
        const a = own(lower.intersect(pad)), b = own(baselineLower.intersect(pad));
        assert(Math.abs(a.volume() - b.volume()) < 0.1, `Keep complete motor pad and screw grip within float32 clipping tolerance: volume difference ${a.volume() - b.volume()}`);
        const angle = Math.atan2(my, mx) * 180 / Math.PI, [x, y] = rotateXY(p.root_boss_station, 0, angle);
        const bossSection = own(own(module.CrossSection.circle(profile.layoutJig ? p.root_hole_diameter / 2 + profile.web : p.root_boss_diameter / 2, 96)).subtract(own(module.CrossSection.circle(p.root_hole_diameter / 2, 96))));
        const bossHeight = profile.layoutJig ? Math.min(profile.bossHeight, p.frame_thickness) : p.frame_thickness + p.clear_bay_height;
        const boss = own(own(bossSection.extrude(bossHeight)).translate([x, y, 0]));
        assert(Math.abs(own(lower.intersect(boss)).volume() - boss.volume()) < 0.005, 'Correct root-bolt boss for selected print purpose');
        if (profile.layoutJig) {
          const above = own(own(bossSection.extrude(1)).translate([x, y, bossHeight + 0.01]));
          assert(own(lower.intersect(above)).isEmpty(), 'Layout-jig bosses must be short, not full-height columns');
        }
        const envelope = rotorEnvelope(p, config), sweep = own(own(own(module.CrossSection.circle(envelope.radius + 1, 512)).extrude(envelope.maximum - envelope.minimum + 2)).translate([mx, my, envelope.minimum - 1]));
        assert(own(lower.intersect(sweep)).volume() < 0.001 && own(upper.intersect(sweep)).volume() < 0.001, 'Prop sweep clearance');
      }
      if (id !== 'full') {
        const probe = own(own(module.Manifold.cube([0.2, 0.2, p.frame_thickness - profile.skin])).translate([10.4, 10.4, profile.skin]));
        assert(own(lower.intersect(probe)).volume() < 0.00001, 'Actual base skin must be thinner outside interfaces');
      }
      if (profile.layoutJig) {
        // In the default print orientation, each raised XY section sits on material below it.
        let below = null;
        for (const z of [profile.skin / 2, (profile.skin + profile.bossHeight) / 2, (profile.bossHeight + p.motor_platform_thickness) / 2]) {
          const slab = own(own(module.Manifold.cube([400, 400, 0.05], true)).translate([0, 0, z]));
          const section = own(own(lower.intersect(slab)).project());
          if (below) assert(own(section.subtract(below)).area() < 0.005, 'No unsupported islands or overhangs in default fit jig');
          below = section;
        }
      }
      totals[id] = result.report.print_version.material_volume_cm3;
      const destination = new URL(`../../output/drone-frame/print-variants/${id}/`, import.meta.url); await fs.mkdir(destination, { recursive: true });
      for (const [name, mesh] of Object.entries(result.exports)) await fs.writeFile(new URL(`${name}.stl`, destination), new Uint8Array(binarySTL(mesh)));
      const expected = Object.fromEntries(Object.entries(result.exports).map(([name, mesh]) => [name, { bounds: mesh.bounds, volume: mesh.volume, components: mesh.components }]));
      await fs.writeFile(new URL('report.json', destination), JSON.stringify({ parameters: p, report: result.report, expected, config_sha256: createHash('sha256').update(configBytes).digest('hex') }, null, 2));
      assert.deepEqual(readLink(modelLink('https://example.org/sub/drone/', p, config), config), p);
      console.log(`PASS ${id}: ${totals[id].toFixed(2)} cm3; correct mounting layout, coupon, bed and sweep clearance`);
    } finally { owned.reverse().forEach(item => item.delete()); upper.delete(); lower.delete(); }
  }
  assert(totals.fit_check < totals.full * 0.35, 'Fit geometry must reduce solid volume by at least 65%');
  assert(totals.fit_check < totals.bench_test && totals.bench_test < totals.full);
  for (const changes of [{ lower_body_length: 100 }, { motor_cable_ports_enabled: false }, { carrier_enabled: false }, { under_controller_ties_enabled: false }, { esp32_rotation_z: 75 }, { controller_mount_style: 'integrated_under' }, { controller_mount_style: 'separate_above' }, { motor_recess_enabled: true }]) {
    const full = buildDrone(module, { ...config.defaults, ...changes }, config), fullLower = solid(full.exports.lower);
    try {
      for (const id of ['fit_check', 'bench_test']) {
        const result = buildDrone(module, { ...config.defaults, ...changes, print_profile: id }, config);
        assert.equal(result.exports.lower.components, 1); assert.equal(result.exports.upper.components, 1);
        assert(result.report.lower_upper_intersection_mm3 < 0.001);
        assert.deepEqual(result.exports.coupon, full.exports.coupon);
        const actual = solid(result.exports.lower), excess = actual.subtract(fullLower);
        try { assert(excess.volume() < 0.005, `No filled screw recesses or added material for ${id}`); }
        finally { excess.delete(); actual.delete(); }
      }
    } finally { fullLower.delete(); }
  }
  const previous = structuredClone(config.defaults); delete previous.print_profile;
  assert.equal(readLink(`https://example.org/#drone-v1=${encodeURIComponent(JSON.stringify(previous))}`, config).print_profile, 'full');
  assert.throws(() => validateParameters({ ...config.defaults, print_profile: 'flight-certified' }, config));
  assert.throws(() => validateParameters({ ...config.historical, print_profile: 'fit_check' }, config));
  console.log('PASS thin-version parameter edits, shared-link migration and invalid profiles');
} finally { baselineLower.delete(); baselineUpper.delete(); }
