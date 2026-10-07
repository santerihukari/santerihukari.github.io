import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults, parameters, selectLayout, selectProfile } from '../../src/coffee_filter/parameters.mjs';
import { createModelLink, readModelLink, profileForParameters } from '../../src/coffee_filter/model-link.mjs';

const address = 'https://santerihukari.com/parametric-models/';
const view = { color: '#345abc', papers: false, sheets: 12 };
const customized = {
  layout: 'side_rest', angle: 80.25, radius: 180, tip_cut: 41,
  wall_height: 32.5, wall_thickness: 3.4, edge_radius: 0.7, usable_depth: 24.5,
  front_rise: 12, clearance: 1.3, paper_drop: 6.5, screw_spacing: 76
};
const mutate = edit => {
  const url = new URL(createModelLink(address, defaults, view));
  edit(url.searchParams);
  return url.href;
};

test('all geometry and preview values round-trip exactly, including a non-default seating drop', () => {
  const link = createModelLink(address, customized, view);
  assert.deepEqual(readModelLink(link), { parameters: customized, preview: view });
  assert.equal(new URL(link).searchParams.get('model'), 'coffee-filter-holder');
  assert.equal(new URL(link).searchParams.get('v'), '1');
  assert.equal(new URL(link).searchParams.size, parameters.length + 6);
});

test('links snapshot values and preserve the current host, prefix and supported page path', () => {
  for (const path of [address, 'http://127.0.0.1:4000/parametric-models/',
    'https://example.com/project/parametric-models/', 'https://example.com/project/stl_param/coffee-filter-holder/']) {
    const source = new URL(`${path}?utm_source=unrelated#old-section`);
    const values = { ...customized };
    const link = createModelLink(source.href, values, view);
    const url = new URL(link);
    assert.equal(url.origin, source.origin);
    assert.equal(url.pathname, source.pathname);
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.has('utm_source'), false);
    values.angle = 90;
    assert.deepEqual(readModelLink(link).parameters, customized);
  }
});

test('both layouts and both profiles round-trip without reapplying preset defaults', () => {
  for (const layout of ['symmetric', 'side_rest']) {
    for (const profile of ['measured', 'right_angle']) {
      const values = { ...selectProfile(selectLayout(defaults, layout), profile), paper_drop: 4.5 };
      const restored = readModelLink(createModelLink(address, values)).parameters;
      assert.deepEqual(restored, values);
      assert.equal(profileForParameters(restored), profile);
    }
  }
  assert.equal(profileForParameters(customized), 'custom');
});

test('unconfigured visits keep defaults, and optional preview fields have explicit defaults', () => {
  assert.equal(readModelLink(address), null);
  assert.equal(readModelLink(`${address}?utm_source=message`), null);
  const restored = readModelLink(mutate(query => { for (const key of ['color', 'papers', 'sheets']) query.delete(key); }));
  assert.deepEqual(restored, { parameters: defaults, preview: { color: '#16817d', papers: true, sheets: 15 } });
});

for (const key of ['model', 'v', 'layout', ...parameters.map(p => p.key)]) {
  test(`incomplete links reject missing ${key} instead of filling it from defaults`, () => {
    assert.throws(() => readModelLink(mutate(query => query.delete(key))));
  });
}

for (const [name, key, value] of [
  ['unsupported model', 'model', '../../unknown'], ['unsupported version', 'v', '2'],
  ['unknown layout', 'layout', 'wrong'], ['empty number', 'angle', ''],
  ['whitespace', 'angle', ' '], ['NaN', 'angle', 'NaN'], ['infinity', 'radius', 'Infinity'],
  ['numeric overflow', 'radius', '1e999'], ['hex number', 'radius', '0xb4'],
  ['out of range', 'angle', '91'], ['off step', 'wall_height', '32.25'],
  ['invalid cut', 'tip_cut', '100'], ['HTML color', 'color', '<script>'],
  ['paper flag', 'papers', 'true'], ['zero sheets', 'sheets', '0'],
  ['too many sheets', 'sheets', '31'], ['fractional sheets', 'sheets', '1.5'],
  ['nonnumeric sheets', 'sheets', 'NaN'], ['hex sheets', 'sheets', '0xf']
]) {
  test(`malformed links reject ${name}`, () => {
    const link = mutate(query => {
      query.set(key, value);
      if (name === 'invalid cut') query.set('radius', '100');
    });
    assert.throws(() => readModelLink(link));
  });
}

for (const key of ['model', 'v', 'layout', ...parameters.map(p => p.key), 'color', 'papers', 'sheets']) {
  test(`ambiguous links reject duplicate ${key}`, () => {
    assert.throws(() => readModelLink(mutate(query => query.append(key, query.get(key)))));
  });
}

test('invalid builder state, non-web addresses and oversized payloads are rejected', () => {
  assert.throws(() => createModelLink(address, { ...defaults, angle: NaN }));
  assert.throws(() => createModelLink(address, { ...defaults, paper_drop: 0.25 }));
  assert.throws(() => createModelLink(address, defaults, { papers: 'false' }));
  assert.throws(() => createModelLink(address, defaults, { color: 'red' }));
  assert.throws(() => createModelLink(address, defaults, { sheets: 100 }));
  assert.throws(() => createModelLink('javascript:alert(1)', defaults));
  assert.throws(() => readModelLink('file:///model.html'));
  assert.throws(() => readModelLink(mutate(query => query.set('extra', 'x'.repeat(4097)))));
});
