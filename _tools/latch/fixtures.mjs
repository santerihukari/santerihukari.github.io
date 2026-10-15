import { mkdir, writeFile } from 'node:fs/promises';
import Module from '../../assets/cad/latch/manifold/manifold.js';
import { generate, stlBuffer } from '../../src/latch/model.mjs';
const output = new URL('./qa/fixtures/', import.meta.url);
await mkdir(output, { recursive: true });
const api = await Module(); api.setup();
const model = generate(api);
await writeFile(new URL('model.json', output), JSON.stringify(model));
for (const key of ['assembly', 'body', 'insert', 'nut_1']) {
  const parts = model.parts.filter(part => key === 'assembly' ? ['body', 'insert'].includes(part.id) : key === part.id);
  await writeFile(new URL(`${key}.stl`, output), Buffer.from(stlBuffer(parts)));
}
console.log('Generated one-nut public STL and JSON fixtures; assembly STL remains body + insert.');
