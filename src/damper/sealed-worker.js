import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
import { generateSealed } from './sealed-geometry.mjs';

let baseline;
const runtime = Module({ locateFile: name => new URL(`../../assets/cad/coffee-filter/manifold/${name}`, import.meta.url).href }).then(api => { api.setup(); return api; });

self.onmessage = async ({ data }) => {
  const { sequence } = data;
  try {
    if (data.type === 'init') {
      if (!data.baseline?.parts || !data.baseline.parameters) throw new Error('Worker init requires the complete legacy model JSON.');
      baseline = data.baseline;
      await runtime; self.postMessage({ type: 'ready' }); return;
    }
    if (!baseline) throw new Error('Initialize the sealed worker with the legacy baseline first.');
    const result = generateSealed(await runtime, data.settings, baseline);
    self.postMessage({ sequence, result });
  } catch (reason) {
    self.postMessage(data.type === 'init' ? { type: 'error', error: reason.message } : { sequence, error: reason.message });
  }
};
