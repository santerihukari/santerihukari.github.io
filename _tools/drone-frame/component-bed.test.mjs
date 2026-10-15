import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildDrone } from '../../src/drone_frame/geometry.mjs';
import { componentCatalog, inferComponent, applyComponent } from '../../src/drone_frame/components.mjs';
import { printerBeds, bedCheck, clearanceCheck, fitCandidates, verifiedOrientation, rotatedBounds } from '../../src/drone_frame/print-bed.mjs';

const config = JSON.parse(await fs.readFile(new URL('../../assets/cad/drone-frame/config.json', import.meta.url)));
const module = await Module({ locateFile: name => fileURLToPath(new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url)) });
module.setup();
const original = buildDrone(module, config.defaults, config), beds = printerBeds(config);

test('component choices infer published envelopes and retain the preferred upper defaults', () => {
  const catalog = componentCatalog(config);
  assert.equal(inferComponent(config.defaults, catalog.controller), 'website_esp32');
  assert.equal(inferComponent(config.defaults, catalog.esc), 'velox_v50a');
  assert.equal(inferComponent(config.defaults, catalog.motor), 'v2207_v3');
  assert.equal(inferComponent(config.defaults, catalog.prop), 'conservative_51');
  const teensy = applyComponent(config.defaults, 'controller', 'teensy_4_1', config);
  assert.equal(teensy.esp32_size_x, config.controllers.teensy_4_1.changes.esp32_size_x);
  assert.equal(teensy.esp32_size_y, config.controllers.teensy_4_1.changes.esp32_size_y);
  const restored = applyComponent(teensy, 'controller', 'website_esp32', config);
  assert.equal(restored.esp32_size_x, config.defaults.esp32_size_x);
  for (const key of ['clear_bay_height', 'controller_center_support_enabled', 'controller_side_supports_enabled', 'controller_long_tie_slots', 'controller_antenna_roof_opening']) assert.equal(restored[key], config.defaults[key]);
  const sourceMotor = applyComponent({ ...config.defaults, motor_envelope_diameter: 32 }, 'motor', 'v2207_v3', config);
  assert.equal(sourceMotor.motor_envelope_diameter, config.defaults.motor_envelope_diameter);
  assert.deepEqual(sourceMotor.motor_mount_points, config.defaults.motor_mount_points);
  const sourceEsc = applyComponent({ ...config.defaults, esc_size_x: 50 }, 'esc', 'velox_v50a', config);
  assert.deepEqual(sourceEsc.esc_mount_points, config.hardware_defaults.parameters.esc_mount_points);
  assert.equal(sourceEsc.esc_size_x, config.hardware_defaults.esc.body_dimensions_mm[0]);
  assert.deepEqual(applyComponent(config.defaults, 'motor', 'custom', config), config.defaults);
});

test('printer selection is bed metadata, not a parameter recipe', () => {
  const snapshot = JSON.stringify(config.defaults);
  assert.deepEqual(Object.keys(beds[0]).sort(), ['depth', 'height', 'id', 'label', 'width']);
  bedCheck(original, beds[0]); bedCheck(original, beds[1]);
  assert.equal(JSON.stringify(config.defaults), snapshot);
  assert.equal(original.parameters.motor_x_offset, config.defaults.motor_x_offset);
});

test('actual lower and upper export vertices fit the documented Ender bed with brim', () => {
  const check = bedCheck(original, beds.find(bed => bed.id === 'ender3_v2'));
  assert(check.fits);
  const lower = check.parts.find(part => part.key === 'lower'), upper = check.parts.find(part => part.key === 'upper');
  assert.deepEqual(lower.required.map(value => Number(value.toFixed(3))), [213, 216]);
  assert(Math.abs(upper.required[0] - 102.8467636) < 0.001);
  assert.equal(upper.required[1], 130);
  assert(clearanceCheck(original, config).acceptable);
  assert.match(clearanceCheck(original, config).caveat, /edge-web warnings remain/);
});

test('explicit MK4 fit verifies actual exports without changing components or upper construction', () => {
  const bed = beds.find(bed => bed.id === 'prusa_mk4');
  assert(!bedCheck(original, bed).fits);
  const candidates = fitCandidates(config.defaults, bed, config);
  let accepted;
  for (const candidate of candidates) {
    const result = buildDrone(module, candidate, config), check = verifiedOrientation(result, bed, config);
    if (check) { accepted = { result, check }; break; }
  }
  assert(accepted, 'No checked MK4 candidate');
  assert(accepted.check.parts.every(part => part.fits));
  assert(accepted.check.parts.some(part => part.key === 'lower'));
  assert(accepted.check.parts.some(part => part.key === 'upper'));
  const allowed = new Set(['motor_x_offset', 'motor_y_offset', 'printer_bed_width', 'printer_bed_depth', 'printer_height', 'print_rotation_z']);
  for (const key of Object.keys(config.defaults).filter(key => !allowed.has(key))) assert.deepEqual(accepted.result.parameters[key], config.defaults[key], key);
});

test('an undersized bed or larger selected props cannot be fitted by silently reducing choices', () => {
  const snapshot = structuredClone(config.defaults), tiny = { id: 'tiny', label: 'Test bed', width: 100, depth: 100, height: 100 };
  assert.equal(fitCandidates(config.defaults, tiny, config).length, 0);
  assert(!verifiedOrientation(original, tiny, config));
  const largeProps = { ...config.defaults, prop_diameter: 200 };
  assert.equal(fitCandidates(largeProps, beds[0], config).length, 0);
  assert.equal(largeProps.prop_diameter, 200);
  assert.deepEqual(config.defaults, snapshot);
});

test('new component/sweep or cutout failures are rejected; bounds use mesh vertices', () => {
  const collision = { ...original, report: { ...original.report, overlapping_envelopes: [['ESC', 'Controller']] } };
  assert(!clearanceCheck(collision, config).acceptable);
  const sweep = { ...original, report: { ...original.report, checks: [...original.report.checks, { component: 'ESC', motor: 'motor_front_right', status: 'fail' }] } };
  assert(!clearanceCheck(sweep, config).acceptable);
  const alteredMount = { ...original, parameters: { ...original.parameters, motor_mount_points: [[-10, 0], [10, 0]] } };
  assert(!clearanceCheck(alteredMount, config).acceptable);
  const triangle = { positions: new Float32Array([-1, -2, 0, 2, 0, 0, 0, 3, 0]), indices: new Uint32Array([0, 1, 2]), bounds: [[-100, -100, 0], [100, 100, 0]] };
  const bounds = rotatedBounds(triangle, 90);
  assert(bounds[0].every((value, i) => Math.abs(value - [-3, -1, 0][i]) < 0.000001));
  assert(bounds[1].every((value, i) => Math.abs(value - [2, 2, 0][i]) < 0.000001));
});
