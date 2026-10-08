import createManifold from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildDrone } from './geometry.mjs';

const kernel = createManifold().then(module => { module.setup(); return module; });
let pending = null;
let running = false;

async function processRequests() {
  if (running) return;
  running = true;
  try {
    const module = await kernel;
    while (pending) {
      const request = pending;
      pending = null;
      try {
        const result = buildDrone(module, request.parameters, request.config);
        const buffers = new Set();
        for (const mesh of [...result.parts.map(part => part.mesh).filter(Boolean), ...Object.values(result.exports)]) {
          buffers.add(mesh.positions.buffer);
          buffers.add(mesh.indices.buffer);
        }
        self.postMessage({ sequence: request.sequence, result }, [...buffers]);
      } catch (error) {
        self.postMessage({ sequence: request.sequence, error: error.message });
      }
    }
  } catch {
    if (pending) self.postMessage({ sequence: pending.sequence, error: 'The geometry engine could not load. Reload to try again.' });
    pending = null;
  } finally { running = false; }
}
self.onmessage = event => { pending = event.data; processRequests(); };
