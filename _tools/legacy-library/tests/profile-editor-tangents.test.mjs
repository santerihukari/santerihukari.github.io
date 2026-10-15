import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateCurveSpline as formSpline} from '../../../src/legacy_library/form.mjs';
import {meta} from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';

const uiSource = await readFile(new URL('../../../src/ui.js', import.meta.url), 'utf8');
const {evaluateCurveSpline: originalSpline} = await import('data:text/javascript;base64,' + Buffer.from(uiSource + '\nexport {evaluateCurveSpline};').toString('base64'));
const width = meta.params.find(p => p.key === 'width_taper_curve');
const depth = meta.params.find(p => p.key === 'depth_taper_curve');
const editors = [['original UI', originalSpline], ['form canvas', formSpline]];
const points = pairs => Object.freeze(pairs.map(([x, y]) => Object.freeze({x, y})));
const rising = points([[0, .7], [.05, .71], [.051, 1.1], [.8, 1.11], [1, 1.4]]);
const cases = [
  ['unequal monotone rise', rising],
  ['unequal monotone fall', points(rising.map(p => [p.x, 2 - p.y]))],
  ['unequal plateaus', points([[0, .7], [.002, .8], [.6, .8], [.601, 1.3], [1, 1.4]])],
  ['anchored width extrema', points([[0, 1], [.05, 1.01], [.051, 1.4], [.8, 1.41], [1, 1]])],
  ['anchored width dips', points([[0, 1], [.001, .6], [.65, .59], [.9, .99], [1, 1]])],
  ['flat', points([[0, 1], [.001, 1], [.75, 1], [1, 1]])],
  ['two nodes', points([[0, .7], [1, 1.4]])]
];
const near = (actual, expected, tolerance, message) => assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

// Independent Bernstein oracle for the Hermite segment defined by the shared per-node slopes.
function expectedValue(data, slopes, segment, t) {
  const a = data[segment], b = data[segment + 1], w = b.x - a.x, u = 1 - t;
  return u ** 3 * a.y + 3 * u ** 2 * t * (a.y + slopes[segment] * w / 3)
    + 3 * u * t ** 2 * (b.y - slopes[segment + 1] * w / 3) + t ** 3 * b.y;
}

// Four samples recover an exact cubic endpoint derivative, without finite-difference truncation.
function endpointSlopes(evaluate, data, param, segment) {
  const a = data[segment], b = data[segment + 1], w = b.x - a.x;
  const y = [a.x, a.x + w / 3, a.x + 2 * w / 3, b.x].map(x => evaluate(data, x, param));
  return [(-11 * y[0] + 18 * y[1] - 9 * y[2] + 2 * y[3]) / (2 * w),
    (11 * y[3] - 18 * y[2] + 9 * y[1] - 2 * y[0]) / (2 * w)];
}

// Frozen pre-callback original-app behavior, including its denominator guards and arithmetic order.
function previousOriginalSpline(data, t, param) {
  const low = typeof param.yMin === 'number' ? param.yMin : 0;
  const high = typeof param.yMax === 'number' ? param.yMax : 2;
  const u = Math.min(1, Math.max(0, t));
  if (!data.length) return 1;
  if (data.length === 1 || u <= data[0].x) return data[0].y;
  if (u >= data.at(-1).x) return data.at(-1).y;
  for (let i = 0; i + 1 < data.length; i++) {
    const p = data[i], q = data[i + 1];
    if (u < p.x || u > q.x) continue;
    const prev = data[Math.max(0, i - 1)], next = data[Math.min(data.length - 1, i + 2)];
    const w = Math.max(1e-9, q.x - p.x), s = (u - p.x) / w;
    let m = param.flatEndpoints && i === 0 ? 0 : ((q.y - prev.y) / Math.max(1e-9, q.x - prev.x)) * w;
    let k = param.flatEndpoints && i + 1 === data.length - 1 ? 0 : ((next.y - p.y) / Math.max(1e-9, next.x - p.x)) * w;
    if (param.boundedTangents) {
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      m = Math.min(3 * (hi - p.y), Math.max(3 * (lo - p.y), m));
      k = Math.min(3 * (q.y - lo), Math.max(3 * (q.y - hi), k));
    }
    const s2 = s * s, s3 = s2 * s;
    return Math.min(high, Math.max(low, (2 * s3 - 3 * s2 + 1) * p.y + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * q.y + (s3 - s2) * k));
  }
  return data.at(-1).y;
}

// Frozen pre-extraction form drawing loop; deliberately retains its unguarded widths and powers.
function previousFormSpline(data, x, param) {
  const low = param.yMin ?? 0, high = param.yMax ?? 2;
  let y = x <= data[0].x ? data[0].y : data.at(-1).y;
  for (let i = 0; i < data.length - 1; i++) if (x >= data[i].x && x <= data[i + 1].x) {
    const p = data[i], q = data[i + 1], prev = data[Math.max(0, i - 1)], next = data[Math.min(data.length - 1, i + 2)], w = q.x - p.x, t = (x - p.x) / w;
    let m = param.flatEndpoints && i === 0 ? 0 : (q.y - prev.y) / (q.x - prev.x) * w;
    let k = param.flatEndpoints && i + 1 === data.length - 1 ? 0 : (next.y - p.y) / (next.x - p.x) * w;
    if (param.boundedTangents) {
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      m = Math.max(3 * (lo - p.y), Math.min(3 * (hi - p.y), m)); k = Math.max(3 * (q.y - hi), Math.min(3 * (q.y - lo), k));
    }
    y = Math.min(high, Math.max(low, (2 * t ** 3 - 3 * t ** 2 + 1) * p.y + (t ** 3 - 2 * t ** 2 + t) * m + (-2 * t ** 3 + 3 * t ** 2) * q.y + (t ** 3 - t ** 2) * k)); break;
  }
  return y;
}

test('width metadata supplies the shared slope callback; generic depth metadata does not', () => {
  assert.equal(typeof width.profileTangents, 'function');
  assert.equal(depth.profileTangents, undefined, 'Version 1 depth must retain its original interpolation');
});

for (const [name, data] of cases) {
  test(`${name}: both editor values and C1 tangents agree with the shared callback`, () => {
    const slopes = width.profileTangents(data);
    assert.equal(slopes.length, data.length); assert.equal(slopes[0], 0); assert.equal(slopes.at(-1), 0);
    for (let segment = 0; segment < data.length - 1; segment++) {
      const a = data[segment], b = data[segment + 1], lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      for (let sample = 0; sample <= 40; sample++) {
        const t = sample / 40, x = a.x + t * (b.x - a.x), expected = expectedValue(data, slopes, segment, t);
        const values = editors.map(([editor, evaluate]) => {
          const value = evaluate(data, x, width);
          near(value, expected, 2e-12, `${name}, ${editor}, segment ${segment}, t=${t}`);
          assert(value >= lo - 2e-12 && value <= hi + 2e-12, `${editor}: bounded segment`);
          return value;
        });
        near(values[0], values[1], 2e-12, 'Both editors must draw the same profile');
      }
      for (const [editor, evaluate] of editors) {
        const [left, right] = endpointSlopes(evaluate, data, width, segment);
        near(left, slopes[segment], 2e-8, `${name}, ${editor}: left dy/dx`);
        near(right, slopes[segment + 1], 2e-8, `${name}, ${editor}: right dy/dx`);
        if (segment) near(left, endpointSlopes(evaluate, data, width, segment - 1)[1], 2e-8, `${editor}: C1 at node ${segment}`);
      }
    }
  });
}

test('the adversarial monotone fixture exposes the old segment-local tangent discontinuity', () => {
  const legacy = {...width, profileTangents: undefined};
  for (const [name, evaluate] of editors) {
    const before = endpointSlopes(evaluate, rising, legacy, 0)[1];
    const after = endpointSlopes(evaluate, rising, legacy, 1)[0];
    assert(Math.abs(before - after) > 1, `${name}: the regression fixture must expose the old kink`);
    const shared = width.profileTangents(rising)[1];
    near(endpointSlopes(evaluate, rising, width, 0)[1], shared, 2e-8, name);
    near(endpointSlopes(evaluate, rising, width, 1)[0], shared, 2e-8, name);
  }
});

test('callback results bypass legacy endpoint and segment-bound policies and can be reused per draw', () => {
  for (const [name, evaluate] of editors) {
    const slopes = width.profileTangents(rising); let calls = 0;
    const param = {yMin: .5, yMax: 1.5, profileTangents(data) {assert.equal(data, rising); calls++; return slopes;},
      get flatEndpoints() {throw new Error('Callback owns endpoint slopes');},
      get boundedTangents() {throw new Error('Do not reapply segment-specific bounds');}};
    near(evaluate(rising, .0505, param), expectedValue(rising, slopes, 1, .5), 2e-12, name);
    assert.equal(calls, 1);
    for (const x of [.01, .0505, .1, .7]) evaluate(rising, x, param, slopes);
    assert.equal(calls, 1, `${name}: precomputed slopes avoid repeated callbacks during a draw`);
  }
});

test('no-callback behavior stays exactly equal to each editor previous implementation', () => {
  const legacyCases = [...cases, ['narrow interval', points([[0, .7], [1e-11, .9], [.25, 1.3], [1, 1]])],
    ['partial domain', points([[.2, .8], [.3, 1.4], [.8, 1.1]])], ['one node', points([[.5, 1]])]];
  const options = [{}, {flatEndpoints: true}, {boundedTangents: true}, {flatEndpoints: true, boundedTangents: true},
    {yMin: .85, yMax: 1.15}, {flatEndpoints: true, boundedTangents: true, yMin: .5, yMax: 1.5}];
  for (const [name, data] of legacyCases) for (const param of options) for (const absent of [undefined, null, false]) {
    const metadata = {...param, profileTangents: absent};
    const xs = [-1, 0, ...data.map(p => p.x), ...Array.from({length: 161}, (_, i) => i / 160), 1, 2];
    for (const x of xs) {
      assert.equal(originalSpline(data, x, metadata), previousOriginalSpline(data, x, metadata), `Original UI changed: ${name}, x=${x}`);
      assert.equal(formSpline(data, x, metadata), previousFormSpline(data, x, metadata), `Form changed: ${name}, x=${x}`);
    }
  }
  assert.equal(originalSpline([], .5, {}), 1);
  assert.equal(formSpline([], .5, {}), 1);
});

test('actual generic version-1 depth metadata retains values and derivatives without opting into shared slopes', () => {
  const data = points([[0, 1], [.07, 1.1], [.071, .8], [.8, .85], [1, 1.2]]);
  for (const [name, evaluate, previous] of [['original UI', originalSpline, previousOriginalSpline], ['form canvas', formSpline, previousFormSpline]]) {
    for (let i = 0; i <= 160; i++) assert.equal(evaluate(data, i / 160, depth), previous(data, i / 160, depth), name);
    for (let i = 0; i < data.length - 1; i++) assert.deepEqual(endpointSlopes(evaluate, data, depth, i), endpointSlopes(previous, data, depth, i), `${name}: version-1 derivatives changed`);
  }
});
