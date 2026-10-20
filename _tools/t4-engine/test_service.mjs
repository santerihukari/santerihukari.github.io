import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {procedurePublishable,partSearchText,referenceLabel,safeWebUrl} from '../../src/t4-engine/release-2026-10-20/service.mjs';
import {matchingCatalogue} from '../../src/t4-engine/service-panel.mjs';

const json=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
for(const [directory,count] of [['vw-t4-engine/r9',271],['vw-t4-powertrain/r13',400],['vw-t4-vehicle/r13',435]]){
  test(`${directory}: exact component cards, unknown joints and uncaptured plans`,()=>{
    const base=`../../assets/models/${directory}/`,c=json(base+'service_catalogue.json'),m=json(base+'manifest.json');
    assert.equal(matchingCatalogue(c,m),true);
    assert.deepEqual(Object.keys(c.parts).sort(),m.parts.map(p=>p.id).sort());
    assert.equal(c.summary.part_count,count);assert.equal(c.summary.identified_fitted_parts,0);
    assert.equal(c.summary.verified_tightening_procedures,0);
    assert.equal(c.summary.joint_count,Object.keys(c.joints).length);
    assert.deepEqual(c.capture_plan,json(base+'capture_plan.json'));
    const jobs=new Set(c.capture_plan.jobs.map(j=>j.id));
    assert.deepEqual([...jobs].sort(),['identity','engine_bay','alternator_area','front_underbody','remaining_underfloor'].sort());
    for(const job of c.capture_plan.jobs){
      assert.equal(job.status,'not_captured');
      for(const id of job.part_ids)assert(Object.hasOwn(c.parts,id),id);
      assert(job.shots.length>0);assert(job.measurements.length>0);
    }
    for(const [id,card] of Object.entries(c.parts)){
      assert.equal(card.part_id,id);assert.equal(card.identity_status,'unidentified');
      assert.equal(card.fitted_part_number,null);assert.equal(card.identity_evidence,null);
      for(const example of card.examples){
        assert.equal(example.status,'candidate');assert.equal(example.scope,'parent_assembly');
        assert(Object.hasOwn(c.sources,example.source_id));
        assert(safeWebUrl(c.sources[example.source_id].url));
      }
      for(const joint of card.joint_ids)assert(c.joints[joint].part_ids.includes(id));
      for(const job of card.capture_job_ids)assert(jobs.has(job));
      for(const source of card.research_source_ids)assert(Object.hasOwn(c.sources,source));
    }
    for(const [id,joint] of Object.entries(c.joints)){
      assert.equal(joint.id,id);assert.equal(joint.installed_quantity,null);
      assert(Object.values(joint.fastener).every(v=>v===null));
      assert(Object.values(joint.tools).every(v=>v===null));
      assert.equal(procedurePublishable(joint.tightening),false);
      assert.deepEqual(joint.tightening.stages,[]);
      assert.equal(joint.modelled_fastener_ids.length,joint.modelled_fastener_count);
      for(const part of joint.part_ids)assert(Object.hasOwn(c.parts,part));
    }
    assert.equal(c.joints.head_to_block.modelled_fastener_count,8);
    assert.equal(c.joints.main_caps.modelled_fastener_count,10);
    assert(!Object.values(c.joints).some(j=>j.modelled_fastener_ids.includes('valve_cover_gasket')));
    assert(partSearchText({id:'alternator',name:'Alternator'},c.parts.alternator).includes('0120485036'));
    assert.equal(referenceLabel(c.parts.alternator_rotor),'Assembly example: A0006');
    assert.equal(referenceLabel(c.parts.block),'Fitted part: unidentified');
    assert.equal(c.parts.alternator_bracket.examples.length,0);
    if(c.parts.drive_gearcase){
      assert.match(c.parts.drive_gearcase.examples[0].fitment_note,/1995/);
      assert.equal(c.sources.gearbox_listing.availability,'recheck_unavailable');
    }
  });
}

test('torque gate rejects partial, generic, non-fitted and invalid procedures',()=>{
  const p={status:'verified',joint_id:'synthetic_fixture_only',reviewed_on:'2026-10-19',
    source:{kind:'workshop_manual',url:'https://example.invalid/synthetic',document:'Synthetic test, not repair advice',section:'Test'},
    applicability:{engine_or_gearbox_code:'TEST',fastener:'TEST',configuration:'TEST',matched_to_fitted_vehicle:true},
    conditions:'Synthetic only',sequence:'Synthetic only',replace_fastener:true,stages:[{value:1,unit:'Nm'},{value:1,unit:'deg'}]};
  assert.equal(procedurePublishable(p),true);
  assert.equal(procedurePublishable({...p,replace_fastener:false}),true);
  for(const key of Object.keys(p)){const broken=structuredClone(p);delete broken[key];assert.equal(procedurePublishable(broken),false,key);}
  for(const field of ['source','applicability'])for(const key of Object.keys(p[field])){
    const broken=structuredClone(p);delete broken[field][key];assert.equal(procedurePublishable(broken),false,`${field}.${key}`);
  }
  for(const value of [NaN,Infinity,-Infinity,-1,0,true,false,'1',null,undefined]){
    assert.equal(procedurePublishable({...p,stages:[{value,unit:'Nm'}]}),false,String(value));
  }
  for(const unit of ['N m','nm','lb-ft','',null])assert.equal(procedurePublishable({...p,stages:[{value:1,unit}]}),false);
  for(const kind of ['manufacturer_product','generic_bolt_table','retailer',''])assert.equal(procedurePublishable({...p,source:{...p.source,kind}}),false);
  for(const matched_to_fitted_vehicle of [false,1,'true',null]){
    assert.equal(procedurePublishable({...p,applicability:{...p.applicability,matched_to_fitted_vehicle}}),false);
  }
  assert.equal(procedurePublishable({...p,source:{...p.source,url:'http://example.invalid'}}),false);
  assert.equal(procedurePublishable({...p,stages:[]}),false);assert.equal(procedurePublishable(),false);
});

test('source links reject unsafe schemes and local relative routes',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','file:///F:/private','http://example.invalid','/local/path','//example.invalid','#part','']){
    assert.equal(safeWebUrl(url),null,url);
  }
  assert.equal(safeWebUrl('https://as-pl.com/en/p/A0006'),'https://as-pl.com/en/p/A0006');
  assert.equal(referenceLabel(undefined),'Fitted part: unidentified');
});

test('site metadata guard rejects missing, stale and wrong-mesh catalogues',()=>{
  const base='../../assets/models/vw-t4-powertrain/r13/',c=json(base+'service_catalogue.json'),m=json(base+'manifest.json');
  for(const broken of [null,undefined,{}, {...c,schema_version:0},{...c,model:'wrong-model'},
    {...c,model_revision:8},{...c,summary:{...c.summary,part_count:398}},{...c,parts:{}}])assert.equal(matchingCatalogue(broken,m),false);
  const wrongId=structuredClone(c);wrongId.parts.not_a_mesh=wrongId.parts.alternator;delete wrongId.parts.alternator;
  assert.equal(matchingCatalogue(wrongId,m),false);
  for(const field of ['part_id','examples','joint_ids','research_source_ids','capture_job_ids']){
    const broken=structuredClone(c);delete broken.parts.alternator[field];assert.equal(matchingCatalogue(broken,m),false,field);
  }
  for(const directory of ['vw-t4-engine/r9','vw-t4-vehicle/r13']){
    const wrongAssembly=json(`../../assets/models/${directory}/service_catalogue.json`);assert.equal(matchingCatalogue(wrongAssembly,m),false);
  }
});
