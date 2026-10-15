import assert from 'node:assert/strict';
import test from 'node:test';
import { paperStack, defaultPaperDensity, densityFromSheets, maximumPreviewSheets } from '../../src/coffee_filter/paper-preview.mjs';

const near = (a, b) => assert(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('density keeps 0.85 mm spacing and exact slope while depth changes', () => {
  for (const [depth, count] of [[17, 20], [25, 29], [40, 47]]) {
    const stack = paperStack(depth, depth * 15 / 17);
    assert.equal(stack.count, count); near(stack.spacing, 17 / 20); near(stack.slope, 15 / 17);
    near((stack.positions[0][0] + stack.positions.at(-1)[0]) / 2, depth / 2);
    for (let i = 1; i < stack.count; i++) {
      near(stack.positions[i][0] - stack.positions[i - 1][0], stack.spacing);
      near((stack.positions[i][1] - stack.positions[i - 1][1]) / stack.spacing, 15 / 17);
    }
    assert(stack.positions[0][0] > 0 && stack.positions.at(-1)[0] < depth);
  }
});

test('legacy sheet counts convert using saved depth, then grow at fixed density', () => {
  for (const depth of [10, 17, 24.5, 45]) for (const sheets of [1, 12, 20, 30]) {
    const density = densityFromSheets(sheets, depth);
    assert.equal(paperStack(depth, 15, density).count, sheets);
  }
  near(densityFromSheets(20, 17), defaultPaperDensity);
});

test('preview allocation remains bounded and invalid density fails closed', () => {
  assert.equal(paperStack(45, 15, 30).count, maximumPreviewSheets);
  assert.equal(paperStack(10, 0, 0.1).count, 1);
  for (const density of [0, -1, 30.1, NaN, Infinity, null, '12', true]) assert.throws(() => paperStack(17, 15, density));
  for (const sheets of [0, 31, 1.5, NaN, null]) assert.throws(() => densityFromSheets(sheets, 17));
  for (const depth of [0, 5, 46, NaN, Infinity, null, '17']) assert.throws(() => densityFromSheets(20, depth));
});
