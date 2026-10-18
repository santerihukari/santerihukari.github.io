import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../../src/legacy_library/catalogue.mjs';

test('heavy exact-geometry models have a bounded allowance for slower browser kernels', () => {
  for (const [key, model] of Object.entries(catalogue)) {
    assert.equal(model.buildTimeoutMs,
      ['badminton_pole_head_square', 'unlevel_hangboard_depth_taper'].includes(key) ? 180000 : 90000);
  }
});
