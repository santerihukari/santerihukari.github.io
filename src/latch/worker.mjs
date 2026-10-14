import Module from '../../assets/cad/latch/manifold/manifold.js';
import { generate } from './model.mjs';
const ready = Module({ locateFile: () => new URL('../../assets/cad/latch/manifold/manifold.wasm', import.meta.url).href }).then((api) => { api.setup(); return api; });
self.onmessage = async ({ data }) => {
  try { self.postMessage({ id: data.id, result: generate(await ready, data.parameters) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
