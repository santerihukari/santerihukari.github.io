import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {catalogue,defaults} from '../../../src/legacy_library/catalogue.mjs';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import {tessellate,meshMetrics,tessellationOptions} from '../../../src/legacy_library/tessellate.mjs';

const occtDir=new URL('../../../assets/occt/',import.meta.url);
const factorySource=await readFile(new URL('opencascade.full.js',occtDir),'utf8');
// Only the environment wrapper changes for Node; the checked-in kernel bytes do not.
const factory=new Function('require','__dirname',factorySource.replace(/export default Module;\s*$/,'return Module;'))(createRequire(import.meta.url),fileURLToPath(occtDir));
const oc=withProgressCompatibility(await factory({wasmBinary:await readFile(new URL('opencascade.full.wasm',occtDir))}));
function solidVolume(shape){const properties=new oc.GProp_GProps_1();try{oc.BRepGProp.VolumeProperties_1(shape,properties,false,false,false);return Math.abs(properties.Mass());}finally{properties.delete();}}
const oldSource=await readFile(new URL('../../../src/tessellate.js',import.meta.url),'utf8');
const threeUrl=new URL('../../../assets/cad/coffee-filter/three/build/three.module.js',import.meta.url).href;
const oldTessellator=await import(`data:text/javascript;base64,${Buffer.from(oldSource.replace('from "three"',`from "${threeUrl}"`)).toString('base64')}`);

for(const [key,definition] of Object.entries(catalogue)){
  if(process.env.MODEL_KEY && process.env.MODEL_KEY!==key)continue;
  test(`${key}: real OCCT default mesh, repeat original builder, STL`,{timeout:300000},async()=>{
    const module=await definition.load(),params=defaults(module.meta);
    const direct=await import(new URL(`../../../src/models/${definition.file}.js`,import.meta.url));
    let shape,original;
    try{
      shape=module.build(oc,params);
      assert(!shape.IsNull());const options=tessellationOptions(module.meta),mesh=tessellate(oc,shape,options),metrics=meshMetrics(mesh);
      assert(metrics.triangles>0);assert(metrics.volume>0);assert(metrics.min.every((v,i)=>Number.isFinite(v)&&v<metrics.max[i]));
      original=direct.build(oc,Object.fromEntries(direct.meta.params.map(p=>[p.key,p.default])));
      const baseline=tessellate(oc,original,options),reference=meshMetrics(baseline);
      assert.deepEqual(metrics,reference,'same original builder and defaults must preserve bounds and mesh volume');
      const volume=solidVolume(shape);assert(volume>0);assert.equal(volume,solidVolume(original),'analytic OCCT volume must remain exact');
      const old=oldTessellator.tessellateToMesh(oc,original,options);
      try{
        assert.deepEqual(mesh.positions,old.geometry.attributes.position.array,'actual old tessellator vertex parity');
        const indices=old.geometry.index.array;assert.equal(mesh.indices.length,indices.length);
        for(let i=0;i<indices.length;i+=3){assert.equal(mesh.indices[i],indices[i]);assert((mesh.indices[i+1]===indices[i+1]&&mesh.indices[i+2]===indices[i+2])||(mesh.indices[i+1]===indices[i+2]&&mesh.indices[i+2]===indices[i+1]),'same triangles, allowing the documented orientation correction');}
      }finally{old.geometry.dispose();old.material.dispose();}
      const file=`/${key}.stl`,writer=new oc.StlAPI_Writer();
      const progress=oc.createProgressRange();
      try{writer.SetASCIIMode?.(false);assert(writer.Write(shape,file,progress));const bytes=oc.FS.readFile(file);assert(bytes.length>84);console.log(JSON.stringify({key,...metrics,analyticVolume:volume,stlBytes:bytes.length}));}
      finally{progress?.delete?.();writer.delete();try{oc.FS.unlink(file);}catch{}}
    }finally{shape?.delete();original?.delete();}
  });
}
