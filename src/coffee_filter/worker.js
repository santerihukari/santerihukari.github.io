import createManifold from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { buildHolder } from './geometry.mjs';

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
        const result = buildHolder(module, request.parameters);
        self.postMessage({ sequence: request.sequence, result }, [result.positions.buffer, result.indices.buffer]);
      } catch (error) {
        self.postMessage({ sequence: request.sequence, error: error.message });
      }
    }
  } catch (error) {
    if (pending) self.postMessage({ sequence: pending.sequence, error: 'Unable to load the geometry engine. Reload to try again.' });
    pending = null;
  } finally {
    running = false;
  }
}

self.onmessage = event => {
  pending = event.data;
  processRequests();
};
