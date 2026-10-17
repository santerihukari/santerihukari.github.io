import {getModel} from '../parametric-catalogue.mjs';
import {validate} from './parameters.mjs';
import {initKernel} from './kernel.mjs';
import {tessellate, meshMetrics, tessellationOptions} from './tessellate.mjs';
import {texturedMesh,validateTexturedMesh,textureSTL} from './contact-texture.mjs';
import {binarySTL} from '../drone_frame/exports.mjs';

let shape, builtRevision = -1,baseMesh,geometryKey,builtTextureMesh,baseWarnings=[],nativeMesh,nativeKey;
self.onmessage = async ({data}) => {
  const {id, key, revision, type} = data;
  const started = performance.now(), progress = stage => self.postMessage({id, revision, type:'progress', stage});
  try {
    progress('loading');
    const definition = getModel(key), model = await definition.load();
    const result = validate(model.meta, data.params);
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    if(definition.meshBuilder){
      if(type==='build'){
        nativeMesh=null;builtRevision=-1;progress('geometry');
        const output=await model.buildMesh(result.params,progress);
        nativeMesh=output.mesh;nativeKey=key;builtRevision=revision;
        const mesh={positions:nativeMesh.positions.slice(),indices:nativeMesh.indices.slice()};
        self.postMessage({id,revision,mesh,metrics:meshMetrics(mesh),warnings:output.warnings,report:output.report,
          timings:{loading_ms:0,geometry_ms:performance.now()-started,preview_ms:0}},[mesh.positions.buffer,mesh.indices.buffer]);
      }else if(type==='stl'){
        if(!nativeMesh||nativeKey!==key||builtRevision!==revision)throw new Error('Build the current parameters before downloading.');
        const bytes=new Uint8Array(binarySTL(nativeMesh,definition.title));self.postMessage({id,revision,bytes},[bytes.buffer]);
      }else throw new Error('Unknown geometry request.');
      return;
    }
    const oc = await initKernel();
    const loaded = performance.now();
    if (type === 'build') {
      progress('geometry');
      builtRevision = -1;builtTextureMesh=null;
      const warnings = [], warn = console.warn;
      const signature=definition.contactTextures?key+JSON.stringify(Object.entries(result.params).filter(([name])=>name!=='surface_texture'&&name!=='texture_layer_height')):null;
      try {
        console.warn = (...args) => { warnings.push(args.map(String).join(' ')); warn(...args); };
        if(!shape||!signature||signature!==geometryKey){
          shape?.delete?.();shape=null;baseMesh=null;geometryKey=null;
          shape = model.build(oc, result.params);
          baseWarnings=warnings.slice();
        }else warnings.push(...baseWarnings);
      } finally { console.warn = warn; }
      if (!shape || shape.IsNull?.()) throw new Error('The original builder returned an empty shape.');
      const generated = performance.now(); progress('preview');
      baseMesh||=tessellate(oc, shape, tessellationOptions(model.meta));geometryKey=signature;
      let mesh=baseMesh,texture=null;
      if(definition.contactTextures&&result.params.surface_texture!=='none'){
        progress('texture');
        const output=texturedMesh(baseMesh,model.contactTextureRegions(result.params),result.params.surface_texture,result.params);
        mesh=output.mesh;texture=output.report;await validateTexturedMesh(mesh);builtTextureMesh=mesh;
        warnings.push('Experimental physical contact texture. Printed feel, skin comfort and load strength have not been validated.');
        if(texture.aggressive)warnings.push('Aggressive texture: sharp edges may abrade skin. Check the sliced preview and inspect the print before applying load.');
        if(texture.layer_height_mm)warnings.push(`Layer profiles use ${texture.layer_height_mm.toFixed(2)} mm spacing with the back against the bed (model -Y). Match the first and subsequent layer heights; slicer reproduction and friction are unverified.`);
      }
      builtRevision = revision;
      const timings = {loading_ms:loaded-started, geometry_ms:generated-loaded, preview_ms:performance.now()-generated};
      const outgoing=definition.contactTextures?{positions:mesh.positions.slice(),indices:mesh.indices.slice()}:mesh;
      self.postMessage({id, revision, mesh:outgoing, texture, warnings, metrics:meshMetrics(mesh), timings}, [outgoing.positions.buffer, outgoing.indices.buffer]);
    } else if (type === 'stl') {
      if (!shape || revision !== builtRevision) throw new Error('Build the current parameters before downloading.');
      if(builtTextureMesh){const bytes=textureSTL(builtTextureMesh);self.postMessage({id,revision,bytes},[bytes.buffer]);return;}
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
