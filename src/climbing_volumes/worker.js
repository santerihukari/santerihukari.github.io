import { buildVolume } from './geometry.mjs';
self.onmessage = event => {
  const { sequence, parameters, config } = event.data;
  try { self.postMessage({ sequence, result: buildVolume(parameters, config) }); }
  catch (error) { self.postMessage({ sequence, error: error.message }); }
};
