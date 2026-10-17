import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PATTERNS} from '../../../src/legacy_library/texture-patterns.mjs';
import {texturedMesh,validateTexturedMesh,textureSTL} from '../../../src/legacy_library/contact-texture.mjs';
import {tessellate,meshMetrics} from '../../../src/legacy_library/tessellate.mjs';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import * as model from '../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
const directory=new URL('../../../assets/occt/',import.meta.url),factorySource=await readFile(new URL('opencascade.full.js',directory),'utf8');
const factory=new Function('require','__dirname',factorySource.replace(/export default Module;\s*$/,'return Module;'))(createRequire(import.meta.url),fileURLToPath(directory));
const output=new URL('../../../output/legacy-library/textures/',import.meta.url);await mkdir(output,{recursive:true});
const oc=withProgressCompatibility(await factory({wasmBinary:await readFile(new URL('opencascade.full.wasm',directory))}));
const defaults=Object.fromEntries(model.meta.params.map(field=>[field.key,field.default]));

for(const [name,change]of Object.entries({default:{},curvedMono:{slot_count:1,slot_width_1:80,slot_depth_y:16,upper_slot_depth_y:24,back_wall_y:0,width_taper_curve:'0,1|0.25,1.25|0.5,1.5|0.75,1.25|1,1',depth_taper_curve:'0,1|0.25,0.75|0.5,0.5|0.75,0.75|1,1'}})){
  if(process.env.TEXTURE_CASE&&process.env.TEXTURE_CASE!==name)continue;
  test(name+': physical relief on actual hangboard, closed mesh, protected rope/body and exports',{timeout:600000},async()=>{
    const p={...defaults,...change},warnings=[],warn=console.warn;let shape;
    try{console.warn=(...args)=>warnings.push(args.join(' '));shape=model.build(oc,p);}finally{console.warn=warn;}
    let base;
    try{base=tessellate(oc,shape,model.meta.tessellation);}finally{shape.delete();}
    const regions=model.contactTextureRegions(p),baseMetrics=meshMetrics(base),reports=[];
    const aggressive=process.env.TEXTURE_SET==='aggressive',prefix=aggressive?'aggressive-':'';
    const candidates=PATTERNS.filter(pattern=>process.env.TEXTURE_PATTERN?pattern.slug===process.env.TEXTURE_PATTERN:aggressive?(name==='default'?pattern.aggressive:pattern.slug==='layer-random-waves'):(name==='default'?pattern.slug!=='none'&&!pattern.aggressive:pattern.slug==='fine-stone'));
    const protectedPoints=[];
    for(let i=0;i<base.positions.length;i+=3)if(base.positions[i]<2||base.positions[i]>baseMetrics.max[0]-2)protectedPoints.push(Array.from(base.positions.subarray(i,i+3)).join(','));
    for(const pattern of candidates){
      const started=performance.now(),result=texturedMesh(base,regions,pattern.slug);await validateTexturedMesh(result.mesh);
      assert(result.report.affected_vertices.lower>100);assert(result.report.affected_vertices.upper>100);
      assert(result.report.maximum_applied_relief_mm>Math.abs(pattern.height)*0.4);
      const metrics=meshMetrics(result.mesh);assert(metrics.triangles>baseMetrics.triangles);
      assert(pattern.height>0?metrics.volume>baseMetrics.volume:metrics.volume<baseMetrics.volume);
      const positions=new Set();for(let i=0;i<result.mesh.positions.length;i+=3)positions.add(Array.from(result.mesh.positions.subarray(i,i+3)).join(','));
      for(const point of protectedPoints)assert(positions.has(point),'Rope channel or outer side geometry changed');
      reports.push({...result.report,metrics,parameters:p,ms:performance.now()-started});
      if(name==='curvedMono'||['fine-stone','blunt-cones','shallow-dimples','layer-random-waves','sharp-cones','alternating-triangles'].includes(pattern.slug))await writeFile(new URL(`${prefix}${name}--${pattern.slug}.stl`,output),textureSTL(result.mesh));
      console.log(name+' / '+pattern.slug+': '+metrics.triangles+' triangles, '+Math.round(performance.now()-started)+' ms');
    }
    await writeFile(new URL(prefix+name+'.json',output),JSON.stringify({baseMetrics,reports},null,2));
  });
}
