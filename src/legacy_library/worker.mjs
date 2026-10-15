import {getModel} from './catalogue.mjs';
import {validate} from './parameters.mjs';
import {initKernel} from './kernel.mjs';
import {tessellate, meshMetrics, tessellationOptions} from './tessellate.mjs';

let shape, builtRevision = -1;
self.onmessage = async ({data}) => {
  const {id, key, revision, type} = data;
  const started = performance.now(), progress = stage => self.postMessage({id, revision, type:'progress', stage});
  try {
    progress('loading');
    const definition = getModel(key), model = await definition.load();
    const result = validate(model.meta, data.params);
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    const oc = await initKernel();
    const loaded = performance.now();
    if (type === 'build') {
      progress('geometry');
      shape?.delete?.(); shape = null; builtRevision = -1;
      const warnings = [], warn = console.warn;
      try {
        console.warn = (...args) => { warnings.push(args.map(String).join(' ')); warn(...args); };
        shape = model.build(oc, result.params);
      } finally { console.warn = warn; }
      if (!shape || shape.IsNull?.()) throw new Error('The original builder returned an empty shape.');
      const generated = performance.now(); progress('preview');
      const mesh = tessellate(oc, shape, tessellationOptions(model.meta));
      builtRevision = revision;
      const timings = {loading_ms:loaded-started, geometry_ms:generated-loaded, preview_ms:performance.now()-generated};
      self.postMessage({id, revision, mesh, warnings, metrics:meshMetrics(mesh), timings}, [mesh.positions.buffer, mesh.indices.buffer]);
    } else if (type === 'stl') {
      if (!shape || revision !== builtRevision) throw new Error('Build the current parameters before downloading.');
      const file = `/legacy-${id}.stl`, writer = new oc.StlAPI_Writer(), progress = oc.createProgressRange();
      try {
        writer.SetASCIIMode?.(false);
        if (!writer.Write(shape, file, progress)) throw new Error('STL writer failed.');
        const bytes = new Uint8Array(oc.FS.readFile(file));
        self.postMessage({id, revision, bytes}, [bytes.buffer]);
      } finally { progress?.delete?.(); writer.delete(); try { oc.FS.unlink(file); } catch {} }
    } else throw new Error('Unknown geometry request.');
  } catch (error) { self.postMessage({id, revision, error: String(error?.message || error)}); }
};
