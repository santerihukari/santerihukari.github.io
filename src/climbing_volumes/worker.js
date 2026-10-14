import { buildVolume } from './geometry.mjs';
import Module from '../../assets/cad/coffee-filter/manifold/manifold.js';
const ready=Module().then(m=>{m.setup();return m;});
self.onmessage = async event => {
  const { sequence, parameters, config } = event.data;
  try { self.postMessage({ sequence, result: buildVolume(parameters, config,await ready) }); }
  catch (error) { self.postMessage({ sequence, error: error.message }); }
};
