import test from 'node:test';
import assert from 'node:assert/strict';
import { mountingPreview } from '../../src/climbing_volumes/preview.mjs';

test('mounting references contain the whole base-radius circle without changing panels', () => {
  const panel = { name:'panel_A', vertices:[[1,2,3]], indices:[0,0,0] };
  const source = [panel, { name:'mount_plane_1', reference:true, vertices:[[-3,0,-2],[3,0,-2],[3,0,2],[-3,0,2]] }, { name:'mount_plane_2', reference:true, vertices:[[0,0,-2],[0,3,-2],[0,3,2],[0,0,2]] }];
  const original = JSON.stringify(source), parts = mountingPreview(source, 100);
  assert.strictEqual(parts[0], panel);
  assert.equal(JSON.stringify(source), original);
  const wall = parts[1].vertices;
  for (let angle = 0; angle < 2 * Math.PI; angle += .01) {
    const x = 100 * Math.cos(angle), z = 100 * Math.sin(angle);
    assert(x > wall[0][0] && x < wall[1][0] && z > wall[0][2] && z < wall[2][2]);
  }
  assert(parts[2].vertices[1][1] >= 100);
  assert.deepEqual(mountingPreview(parts,100),parts);
});

test('invalid circle dimensions are rejected', () => {
  for (const radius of [0,-1,NaN,Infinity]) assert.throws(() => mountingPreview([],radius));
});
