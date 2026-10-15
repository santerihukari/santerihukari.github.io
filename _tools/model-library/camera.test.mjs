import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeCamera } from '../../src/cad-ui.mjs';

test('perspective resize changes aspect, not camera pose or zoom', () => {
  const camera = { position: [2, 4, 6], quaternion: [0, 0, 0, 1], zoom: 2, aspect: 1, updates: 0, updateProjectionMatrix() { this.updates++; } };
  resizeCamera(camera, 800, 400);
  assert.equal(camera.aspect, 2);
  assert.deepEqual(camera.position, [2, 4, 6]);
  assert.deepEqual(camera.quaternion, [0, 0, 0, 1]);
  assert.equal(camera.zoom, 2);
  assert.equal(camera.updates, 1);
});

test('orthographic resize preserves vertical field and its center', () => {
  const camera = { isOrthographicCamera: true, left: -50, right: 70, top: 80, bottom: -40, zoom: 1.5, updateProjectionMatrix() {} };
  resizeCamera(camera, 600, 300);
  assert.deepEqual([camera.left, camera.right, camera.top, camera.bottom, camera.zoom], [-110, 130, 80, -40, 1.5]);
  resizeCamera(camera, 300, 600);
  assert.deepEqual([camera.left, camera.right, camera.top, camera.bottom, camera.zoom], [-20, 40, 80, -40, 1.5]);
});

test('temporary zero-sized viewport has a finite projection', () => {
  const camera = { updateProjectionMatrix() {} };
  resizeCamera(camera, 0, 0);
  assert.equal(camera.aspect, 1);
});
