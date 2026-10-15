import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROLS, DEFAULTS, glandDimensions, validateSettings } from '../../src/damper/sealed-parameters.mjs';
import { createModelLink, readModelLink } from '../../src/damper/model-link.mjs';

const page = 'https://example.test/prefix/parametric-models/cabinet-air-damper/?source=library';
const link = values => createModelLink(page, 'sealed', { ...DEFAULTS, ...values });
const mutate = callback => { const url = new URL(link()), query = new URLSearchParams(url.hash.split('?')[1]); callback(query); url.hash = `damper-v2?${query}`; return url.href; };

test('legacy page links retain path and query, remove hash and need no sealed settings', () => {
  assert.equal(createModelLink(`${page}#old-anchor`), page);
  for (const suffix of ['', '#dimensions', '#fixed-v1']) assert.equal(readModelLink(page + suffix), null);
  assert.throws(() => createModelLink(page, 'other'), /design/);
});

test('all canonical settings round-trip for zero, one and two piston rings', () => {
  for (const piston_rings of [0, 1, 2]) {
    const settings = validateSettings({ ...DEFAULTS, piston_rings, bleed_opening: .75 });
    const address = link(settings), url = new URL(address);
    assert.equal(url.pathname, new URL(page).pathname);
    assert.equal(url.search, '?source=library');
    assert.match(url.hash, /^#damper-v2\?/);
    assert.deepEqual(readModelLink(address), { design: 'sealed', settings });
    assert.equal(createModelLink(address, 'sealed', readModelLink(address).settings), address);
    assert.equal([...new URLSearchParams(url.hash.split('?')[1]).keys()].length, Object.keys(DEFAULTS).length);
  }
});

test('boolean options and non-default cap, bleed and flap values round-trip', () => {
  const values = { ...DEFAULTS, front_face_seal: true, rear_face_seal: false, rod_seal: true, cap_thickness_mm: 8, bleed_opening: 0, flap_thickness_mm: .8 };
  assert.deepEqual(readModelLink(link(values)).settings, values);
  assert.equal(readModelLink(link()).settings.bleed_opening, DEFAULTS.bleed_opening);
});

test('links require complete unique known fields with strict number and boolean syntax', () => {
  for (const change of [q => q.delete('piston_ring_id_mm'), q => q.append('piston_rings', '2'), q => q.set('unknown', '1'), q => q.set('bleed_opening', ''), q => q.set('bleed_opening', 'Infinity'), q => q.set('bleed_opening', 'NaN'), q => q.set('bleed_opening', '0x1'), q => q.set('bleed_opening', ' 0.5'), q => q.set('rear_face_seal', '1'), q => q.set('piston_rings', '1.5')]) assert.throws(() => readModelLink(mutate(change)));
  for (const hash of ['damper-v2', 'damper-v1?x=1', 'damper-v3?x=1', `damper-v2?${'x'.repeat(4100)}`]) assert.throws(() => readModelLink(`${page}#${hash}`));
});

test('links reject out-of-range values and physically invalid gland combinations', () => {
  for (const change of [q => q.set('piston_rings', '3'), q => q.set('bleed_opening', '-0.1'), q => q.set('piston_ring_id_mm', '15'), q => q.set('cap_ring_cs_mm', '2'), q => q.set('cap_thickness_mm', '4')]) assert.throws(() => readModelLink(mutate(change)));
  assert.throws(() => createModelLink(page, 'sealed', { ...DEFAULTS, bleed_opening: NaN }));
  for (const address of ['file:///damper.html', 'javascript:alert(1)', 'data:text/html,x']) {
    assert.throws(() => createModelLink(address)); assert.throws(() => readModelLink(address));
  }
});

test('control metadata covers canonical defaults exactly and defaults are independent values', () => {
  const fields = CONTROLS.flatMap(group => group.fields);
  assert.equal(new Set(fields.map(field => field.key)).size, fields.length);
  assert.deepEqual(fields.map(field => field.key).sort(), Object.keys(DEFAULTS).sort());
  assert.deepEqual(validateSettings(), DEFAULTS);
  const independent = validateSettings(); independent.piston_rings = 2;
  assert.equal(DEFAULTS.piston_rings, 1);
  for (const field of fields) {
    if (field.type === 'boolean') assert.throws(() => validateSettings({ [field.key]: 1 }));
    else for (const value of [field.min - 1, field.max + 1, NaN, Infinity, '', null]) assert.throws(() => validateSettings({ [field.key]: value }));
  }
  for (const input of [null, [], 'sealed', { other: 1 }]) assert.throws(() => validateSettings(input));
});

test('one-ring baseline and two-ring glands retain distinct measured-print assumptions', () => {
  for (const piston_rings of [0, 1, 2]) {
    const glands = glandDimensions(validateSettings({ piston_rings }));
    assert.equal(glands.piston.centers_x_mm.length, piston_rings);
    assert(glands.piston.squeeze_percent >= 5 && glands.piston.squeeze_percent <= 15);
    assert(glands.piston.fill_percent <= 85);
    assert(glands.face.inner_land_mm >= .6 && glands.face.outer_land_mm >= .6);
    assert.notEqual(glands.piston.cad_root_mm, glands.piston.expected_root_mm);
  }
});
