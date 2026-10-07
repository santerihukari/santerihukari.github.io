import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '../../assets/cad/coffee-filter');
const files = {
  three: ['LICENSE', 'build/three.module.js', 'build/three.core.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/exporters/STLExporter.js', 'examples/jsm/exporters/GLTFExporter.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/STLLoader.js'],
  'manifold-3d': ['LICENSE', 'manifold.js', 'manifold.wasm']
};
for (const [library, names] of Object.entries(files)) {
  for (const name of names) {
    const destination = path.join(target, library === 'three' ? 'three' : 'manifold', name);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(here, 'node_modules', library, name), destination);
  }
}
await writeFile(path.join(target, 'versions.json'), JSON.stringify({ three: '0.180.0', 'manifold-3d': '3.4.1' }, null, 2) + '\n');
console.log(`Vendored pinned CAD dependencies to ${target}`);
