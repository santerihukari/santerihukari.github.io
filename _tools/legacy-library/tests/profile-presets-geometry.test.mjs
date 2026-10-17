import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {meta,build} from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
import {profilePresets,presetChanges} from '../../../src/legacy_library/profile-presets.mjs';
import {defaults} from '../../../src/legacy_library/catalogue.mjs';
import {validate} from '../../../src/legacy_library/parameters.mjs';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import {tessellate,meshMetrics} from '../../../src/legacy_library/tessellate.mjs';
const directory=new URL('../../../assets/occt/',import.meta.url),source=await readFile(new URL('opencascade.full.js',directory),'utf8');
const factory=new Function('require','__dirname',source.replace(/export default Module;\s*$/,'return Module;'))(createRequire(import.meta.url),fileURLToPath(directory));
let kernel;
for(const [kind,presets]of Object.entries(profilePresets))for(const preset of presets){
  if(process.env.PRESET_CASE&&process.env.PRESET_CASE!==`${kind}/${preset.id}`)continue;
  test(`${kind}/${preset.id}: real CAD, connected solid and finite preview`,{timeout:180000},async()=>{
    kernel||=withProgressCompatibility(await factory({wasmBinary:await readFile(new URL('opencascade.full.wasm',directory))}));
    const key=kind==='depth'?'depth_taper_curve':'width_taper_curve',amountKey=kind==='depth'?'depth_taper_amount_mm':'width_taper_amount_mm';
    const base={...defaults(meta),attachment_method:'diamond',slot_count:kind==='depth'?1:2,slot_depth_y:16,upper_slot_depth_y:24,back_wall_y:kind==='depth'?0:2};
    const p={...base,...presetChanges({kind,amountKey},preset.id,base,key)};
    assert(validate(meta,p).valid,JSON.stringify(validate(meta,p).errors));console.log('BUILD '+kind+'/'+preset.id);
    const shape=build(kernel,p);
    try{
      const check=new kernel.BRepCheck_Analyzer(shape,true,false);try{assert(check.IsValid_2());}finally{check.delete();}
      const iterator=new kernel.TopExp_Explorer_2(shape,kernel.TopAbs_ShapeEnum.TopAbs_SOLID,kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);let count=0;
      try{while(iterator.More()){count++;iterator.Next();}}finally{iterator.delete();}assert.equal(count,1);
      const mesh=tessellate(kernel,shape,meta.tessellation),metrics=meshMetrics(mesh);
      assert(metrics.volume>0);assert(metrics.triangles>100);assert([...metrics.min,...metrics.max].every(Number.isFinite));
    }finally{shape.delete();}
  });
}
