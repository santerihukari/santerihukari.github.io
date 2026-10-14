import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const source = new URL('file:///F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const nativeKernel = new URL('assets/cad/latch/manifold/manifold.js', root);
const manifest = JSON.parse(await readFile(new URL('assets/cad/latch/source-manifest.json', root)));

test('native geometry, installation and Manifold 3.3.2 match the authoritative bundle', async () => {
  assert.equal(JSON.parse(await readFile(new URL('node_modules/manifold-3d/package.json', source))).version, '3.3.2');
  for (const [native, original] of [
    ['src/latch/model.mjs', 'latch-assets/model.mjs'],
    ['src/latch/example.mjs', 'latch-assets/example.mjs'],
    ['assets/cad/latch/manifold/manifold.js', 'latch-assets/vendor/manifold.js'],
    ['assets/cad/latch/manifold/manifold.wasm', 'latch-assets/vendor/manifold.wasm'],
  ]) {
    assert.equal(hash(await readFile(new URL(native, root))), manifest.source_sha256[original], native);
    assert.equal(hash(await readFile(new URL(`static_site/${original}`, source))), manifest.source_sha256[original], original);
  }
  for (const file of ['manifold.js', 'manifold.wasm'])
    assert.equal(hash(await readFile(new URL(`assets/cad/latch/manifold/${file}`, root))), hash(await readFile(new URL(`node_modules/manifold-3d/${file}`, source))), `Pinned package bytes: ${file}`);
});

// Run the unchanged source assertions against the native copies and pinned WASM.
const suite = (await readFile(new URL('tests/model.test.mjs', source), 'utf8'))
  .replace("'manifold-3d'", JSON.stringify(nativeKernel.href))
  .replace("'../model.mjs'", JSON.stringify(new URL('src/latch/model.mjs', root).href))
  .replace("'../example.mjs'", JSON.stringify(new URL('src/latch/example.mjs', root).href));
await import(`data:text/javascript;base64,${Buffer.from(suite).toString('base64')}`);
