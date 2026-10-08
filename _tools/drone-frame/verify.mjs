import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDrone } from '../../src/drone_frame/geometry.mjs';
import { validateParameters, modelLink, readLink } from '../../src/drone_frame/parameters.mjs';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { binarySTL } from '../../src/drone_frame/exports.mjs';

const config = JSON.parse(await fs.readFile(new URL('../../assets/cad/drone-frame/config.json', import.meta.url)));
const fixtures = JSON.parse(await fs.readFile(new URL('./fixtures.json', import.meta.url)));
const module = await Module({ locateFile: name => fileURLToPath(new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url)) });
module.setup();
let failures = 0;
for (const fixture of fixtures.cases ?? fixtures) {
  try {
    const result = buildDrone(module, fixture.parameters, config);
    if (fixture.error) throw new Error(`Python rejected this fixture: ${fixture.error}`);
    for (const [name, expected] of Object.entries(fixture.expected)) {
      const actual = name.startsWith('keeper-') ? result.parts.find(part => part.name === name)?.mesh : result.exports[name];
      assert(actual, `Missing ${name}`);
      for (let end = 0; end < 2; end++) for (let axis = 0; axis < 3; axis++) assert(Math.abs(actual.bounds[end][axis] - expected.bounds[end][axis]) < 0.025, `${name} bounds ${end}/${axis}: ${actual.bounds[end][axis]} != ${expected.bounds[end][axis]}`);
      assert(Math.abs(actual.volume - expected.volume) / expected.volume < 0.002, `${name} volume ${actual.volume} != ${expected.volume}`);
      assert.equal(actual.genus, expected.genus, `${name} genus`);
      assert.equal(actual.components, expected.components, `${name} components`);
    }
    for (const [name, mesh] of Object.entries(result.exports)) assert(Math.abs(mesh.bounds[0][2]) < 0.025, `${name} print datum`);
    if (fixture.name === 'current') {
      const destination = new URL('../../output/drone-frame/', import.meta.url); await fs.mkdir(destination, { recursive: true });
      for (const [name, mesh] of Object.entries(result.exports)) await fs.writeFile(new URL(`verified-${name}.stl`, destination), new Uint8Array(binarySTL(mesh)));
      assert.equal(result.report.lower_ribs.ribs.length, 8);
      assert.equal(result.report.lower_ribs.minimum_calculated_gap_mm, 1);
      assert.equal(result.report.status, 'fail', 'Generic motor sweep overlap warning must not disappear');
    }
    console.log(`PASS ${fixture.name}`);
  } catch (error) {
    if (fixture.error) console.log(`PASS rejected ${fixture.name}`);
    else { failures++; console.error(`FAIL ${fixture.name}: ${error.stack}`); }
  }
}
const address = modelLink('https://example.org/sub/parametric-models/drone-frame/', config.defaults, config);
assert.deepEqual(readLink(address, config), config.defaults);
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
