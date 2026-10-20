import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partSearchText,retailerProducts,hasRetailerReplacement,retailerLabel} from '../../src/t4-engine/release-2026-10-20/service.mjs';

for(const [directory,mapped,meshes,families] of [['vw-t4-engine/r9',109,101,37],['vw-t4-powertrain/r13',145,176,49],['vw-t4-vehicle/r13',180,185,55]]){
  const base=new URL(`../../assets/models/${directory}/`,import.meta.url);
  const json=file=>JSON.parse(readFileSync(new URL(file,base),'utf8'));
  test(`${directory}: retailer source evidence, restricted variants and relationship-aware counts`,()=>{
    const c=json('service_catalogue.json'),r=json('motonet_research.json'),products=r.products;
    assert.deepEqual(c.retailer_research,r);
    assert.equal(Object.keys(products).length,229);
    for(const [field,value] of Object.entries({categories_inspected:36,distinct_listings_reviewed:229,candidate_listings_total:180,
      candidate_listings_mapped_to_this_model:mapped,screened_out_listings:32,not_selected_listings:17,
      parts_with_replacement_candidates:meshes,replacement_families_mapped:families,confirmed_fitted_matches:0}))assert.equal(r.summary[field],value,field);
    const direct=new Set();
    for(const [sku,p] of Object.entries(products)){
      assert.equal(p.sku,sku);const url=new URL(p.url);
      assert.equal(url.protocol,'https:');assert.equal(url.hostname,'www.motonet.fi');
      assert(url.pathname.startsWith('/tuote/'));assert.equal(url.searchParams.get('product'),sku);
      assert.equal(p.fitment_status,'unverified');assert.equal(p.fitted_vehicle_match_confirmed,false);
      assert(p.checked_on);assert(p.category_evidence.length>0);
      assert(!p.listed_fields.some(([key,value])=>/momentti|\bNm\b/i.test(key+' '+value)));
      for(const match of p.matches)for(const id of match.part_ids){
        assert(Object.hasOwn(c.parts,id),`${sku}: ${id}`);
        assert(c.parts[id].retailer_product_ids.includes(sku));
        if(p.screening_status==='candidate'&&match.relation!=='related_item')direct.add(id);
      }
    }
    assert.equal(direct.size,meshes);
    assert.equal(Object.values(c.parts).filter(card=>hasRetailerReplacement(card,products)).length,meshes);
    for(const sku of ['13-2219','13-2454','15-0167','15-0168','30-0518','17-4340','95-58280'])assert.equal(products[sku].screening_status,'screened_out',sku);
    for(const sku of ['26-00041','26-1504','19-8905'])assert.equal(products[sku].screening_status,'not_selected',sku);
    assert.equal(products['13-2300'].screening_status,'candidate');
    assert(products['13-2300'].listed_fields.some(([key,value])=>key==='Valmistusvuosi alkaen'&&value==='1998.11'));
    assert(products['25-9268'].listed_fields.some(([key,value])=>key==='Moottorinumerosta'&&value==='ABL 029320'));
    assert(products['25-9014'].listed_fields.some(([key,value])=>key==='Moottorinumeroon'&&value==='ABL 029319'));
    assert.equal(products['26-1601'].catalogue_torque_requires_separate_review,true);
    assert(products['25-00068'].listed_fields.some(([,value])=>value==='10'));
    assert(products['25-00068'].matches.some(m=>m.note.includes('only 8')));
    assert.equal(Object.keys(c.parts).filter(id=>id.startsWith('head_bolt_')).length,8);
    for(const id of ['block','flywheel','exhaust_manifold','egr_valve','drive_gearcase'].filter(id=>c.parts[id])){
      assert(retailerProducts(c.parts[id],products).length>0,id);
      assert.equal(hasRetailerReplacement(c.parts[id],products),false,id);
      assert.equal(retailerLabel(c.parts[id],products),'No Motonet replacement identified');
    }
    assert.deepEqual(retailerProducts(c.parts.injector_0,products),[]);
    assert(retailerProducts(c.parts.injector_seal_0,products).length>0);
    assert.deepEqual(retailerProducts(c.parts.piston_0,products),[]);
    assert(retailerProducts(c.parts.piston_ring_0_0,products).length>0);
    for(const term of ['13-2300','028 903 029 m','0120485036']){
      const matches=Object.entries(c.parts).filter(([id,card])=>partSearchText({id,name:card.name},card,products).includes(term));
      assert.equal(matches.length,4,term);assert(matches.some(([id])=>id==='alternator_rotor'));
    }
    assert.equal(retailerLabel(c.parts.alternator,products),'Motonet candidate: 13-2300');
    const csv=readFileSync(new URL('motonet_replacements.csv',base),'utf8');
    for(const term of ['supplier_sku','13-2300','screened_out','related_item','https://www.motonet.fi/tuote/'])assert(csv.includes(term),term);
    const report=readFileSync(new URL('motonet_research.md',base),'utf8');
    assert(report.includes('ZERO confirmed fitted matches'));assert(report.includes('Screened Out'));
  });
}

test('per-part relationships do not leak from another mesh or screened product',()=>{
  const card={part_id:'case',retailer_product_ids:['mixed','excluded','missing']};
  const products={mixed:{sku:'mixed',screening_status:'candidate',matches:[
    {relation:'replacement',part_ids:['seal']},{relation:'related_item',part_ids:['case']}]},
    excluded:{sku:'excluded',screening_status:'screened_out',matches:[{relation:'replacement',part_ids:['case']}]}};
  assert.equal(hasRetailerReplacement(card,products),false);
  assert.equal(retailerProducts(card,products).length,2);
  assert(retailerProducts(card,products)[0].matches.every(m=>m.part_ids.includes('case')));
  assert.equal(hasRetailerReplacement({...card,part_id:'seal'},products),true);
  assert.equal(hasRetailerReplacement(undefined,products),false);
});
