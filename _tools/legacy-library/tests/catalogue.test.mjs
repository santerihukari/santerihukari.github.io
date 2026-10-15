import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogue,getModel,defaults} from '../../../src/legacy_library/catalogue.mjs';
import {validate,readLink,modelLink,visible,parseCurve} from '../../../src/legacy_library/parameters.mjs';
import {tessellate,tessellationOptions} from '../../../src/legacy_library/tessellate.mjs';

const source=await readFile(new URL('../../../src/app.js',import.meta.url),'utf8');
const publicKeys=JSON.parse(source.match(/const PUBLIC_MODEL_KEYS = (\[[\s\S]*?\]);/)[1]);

test('catalogue is exactly the old public allowlist',()=>{
  assert.deepEqual(Object.keys(catalogue),publicKeys);
  assert.throws(()=>getModel('keychain'));assert.throws(()=>getModel('crimp'));assert.throws(()=>getModel('__proto__'));
});
test('only the expensive hangboard uses manual parameter updates by default',()=>{
  assert.deepEqual(Object.keys(catalogue).filter(key=>catalogue[key].manualUpdate),['unlevel_hangboard_depth_taper']);
});

for(const [key,definition] of Object.entries(catalogue)){
  const model=await definition.load();
  test(`${key}: original function, complete metadata, exact defaults and route`,async()=>{
    const original=await import(new URL(`../../../src/models/${definition.file}.js`,import.meta.url));
    assert.equal(model.build,original.build);assert.equal(model.meta,original.meta);
    assert.deepEqual(defaults(model.meta),Object.fromEntries(original.meta.params.map(p=>[p.key,p.default])));
    const mapped=[...definition.basic,...definition.groups.flatMap(g=>g[1])];
    assert.equal(new Set(mapped).size,mapped.length);
    assert.deepEqual(mapped.slice().sort(),model.meta.params.map(p=>p.key).sort());
    assert(validate(model.meta,defaults(model.meta)).valid);
    const page=await readFile(new URL(`../../../legacy_${key}.markdown`,import.meta.url),'utf8');
    assert(page.includes(`permalink: /parametric-models/${definition.slug}/`));
    assert(page.includes(`model_key: ${key}`));assert(page.includes(`legacy_model: ${key}`));
    assert.match(definition.validation,/Unverified/);
  });
  test(`${key}: full canonical link, numeric option types, prefix and exact curves`,()=>{
    const params=defaults(model.meta);
    const link=modelLink(key,model.meta,params,'http://localhost:4000/preview/old/?bad=x#old','https://production.invalid/preview/src/legacy_library/parameters.mjs');
    const url=new URL(link);
    assert.equal(url.origin,'http://localhost:4000');assert.equal(url.pathname,`/preview/parametric-models/${definition.slug}/`);
    assert.equal(url.hash,'');assert.equal(url.searchParams.get('bad'),null);
    assert.equal(url.searchParams.size,model.meta.params.length+1);
    assert.deepEqual(readLink(model.meta,url),params);
    for(const param of model.meta.params){
      if(!param.type){for(const invalid of ['',NaN,Infinity,-Infinity,'NaN','Infinity',param.min-1,param.max+1])assert.equal(validate(model.meta,{...params,[param.key]:invalid}).valid,false,`${param.key}: ${invalid}`);}
      if(param.type==='select')assert.equal(validate(model.meta,{...params,[param.key]:'__missing__'}).valid,false);
    }
  });
}

test('conditional controls retain original value types and all comparison operators',()=>{
  const meta={params:[{key:'preset_index',type:'select',default:1,options:[{value:1},{value:8}]}]};
  const values=readLink(meta,new URL('https://example.invalid/?preset_index=8'));
  assert.equal(values.preset_index,8);assert(visible({visibleIf:{key:'preset_index',value:8}},values));
  for(const [op,value]of [['>=',8],['<=',8],['>',7],['<',9],['!=',1]])assert(visible({visibleIf:{key:'preset_index',op,value}},values));
  assert.equal(visible({visibleIf:{key:'__never__',value:true}},values),false);
});
test('invalid curve tokens are never silently repaired',()=>{
  const param={label:'Profile',yMin:0,yMax:100};
  for(const raw of ['0,1|1,NaN','0,1|0,2','0,1|1,Infinity','-1,2|1,3','0,1|1,101','0,|1,2','0,1'])assert.throws(()=>parseCurve(raw,param));
  assert.deepEqual(parseCurve('0,12.3456789|1,8',param),[{x:0,y:12.3456789},{x:1,y:8}]);
});

test('standalone tessellator and old application defaults stay distinct',()=>{
  assert.deepEqual(tessellationOptions({}),{linearDeflection:.15,angularDeflection:.2});
  const seen=[];
  const oc={BRepMesh_IncrementalMesh_2:class{constructor(...args){seen.push(args);}delete(){}},TopExp_Explorer_2:class{More(){return false;}delete(){}},TopAbs_ShapeEnum:{TopAbs_FACE:4,TopAbs_SHAPE:8}};
  assert.throws(()=>tessellate(oc,{}),/no finite mesh/);
  assert.deepEqual(seen[0].slice(1),[.25,false,.25,false]);
});

test('existing OCCT binaries remain byte-identical',async()=>{
  for(const [file,expected]of Object.entries({
    'opencascade.full.js':'6ab75c676c9fefffb422cd2a4bd84e8e8476bb3f2909f850baf806dc1e445a6b',
    'opencascade.full.wasm':'4b6a74398987eb3ca6bedc7d1b29d6a5af74d0613a9f3bf013a52d7d5d1b5937'
  }))assert.equal(createHash('sha256').update(await readFile(new URL(`../../../assets/occt/${file}`,import.meta.url))).digest('hex'),expected);
});
