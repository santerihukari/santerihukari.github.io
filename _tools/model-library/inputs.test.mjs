import test from 'node:test';
import assert from 'node:assert/strict';
import {gestureDirection,numericValue,rangeValue} from '../../src/cad-inputs.mjs';
import {profilePresets,matchingPreset,presetChanges} from '../../src/legacy_library/profile-presets.mjs';
import {meta} from '../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
import {defaults} from '../../src/legacy_library/catalogue.mjs';
import {validate,modelLink,readLink} from '../../src/legacy_library/parameters.mjs';

test('touch intent requires a deliberate dominant horizontal or vertical movement',()=>{
  assert.equal(gestureDirection(4,3),null);assert.equal(gestureDirection(20,19),null);
  assert.equal(gestureDirection(-20,3),'horizontal');assert.equal(gestureDirection(3,-20),'vertical');
});
test('numeric entry supports decimal commas, signed values and rejects partial or nonfinite values',()=>{
  for(const [raw,value]of [['1,25',1.25],['-0.125',-.125],[' 12 ',12],['.5',.5]])assert.equal(numericValue(raw),value);
  for(const raw of ['','-','1..2','Infinity','1,000.5'])assert(Number.isNaN(numericValue(raw)));
});
test('touch ranges clamp and quantize without changing their bounds or keyboard semantics',()=>{
  const bounds={left:10,width:120};assert.equal(rangeValue(20,bounds,1,6,1),1);
  assert.equal(rangeValue(120,bounds,1,6,1),6);assert.equal(rangeValue(65,bounds,1,6,1),3);
  assert.equal(rangeValue(-100,bounds,1,6,1),1);assert.equal(rangeValue(1000,bounds,1,6,1),6);
});
test('preset recognition preserves saved custom curves and does not depend on decimal formatting',()=>{
  assert.equal(matchingPreset('depth','0.000,1.000|0.500,1.000|1.000,1.000'),'flat');
  assert.equal(matchingPreset('width','0,1|0.4,0.9|1,1'),'custom');
  for(const [kind,presets]of Object.entries(profilePresets))for(const preset of presets)assert.equal(matchingPreset(kind,preset.curve),preset.id);
});
test('all presets validate for mono and two-finger grips, and round-trip as existing curve parameters',()=>{
  for(const count of [1,2])for(const [kind,presets]of Object.entries(profilePresets))for(const preset of presets){
    const key=kind==='depth'?'depth_taper_curve':'width_taper_curve',amountKey=kind==='depth'?'depth_taper_amount_mm':'width_taper_amount_mm';
    const config={kind,amountKey},initial={...defaults(meta),slot_count:count,slot_depth_y:16,upper_slot_depth_y:24};
    const values={...initial,...presetChanges(config,preset.id,initial,key)};
    assert(validate(meta,values).valid,`${count} slots, ${kind}/${preset.id}: ${JSON.stringify(validate(meta,values).errors)}`);
    const link=modelLink('unlevel_hangboard_depth_taper',meta,values,'https://example.invalid/');
    assert.deepEqual(readLink(meta,new URL(link)),values);
    if(preset.id!=='flat')assert.equal(values[amountKey],kind==='depth'?1:0.75);
  }
});
test('changing a non-flat preset retains the selected variation amount',()=>{
  const config={kind:'width',amountKey:'width_taper_amount_mm'};
  assert.deepEqual(presetChanges(config,'domed',{width_taper_curve:profilePresets.width[1].curve,width_taper_amount_mm:1.5},'width_taper_curve'),{width_taper_curve:profilePresets.width[2].curve});
});

test('new hangboards default to rope attachment, flat surfaces and rounded edges',()=>{
  const values=defaults(meta);
  assert.equal(values.attachment_method,'rope_groove');
  assert.equal(matchingPreset('width',values.width_taper_curve),'flat');assert.equal(values.width_taper_amount_mm,0.75);
  assert.equal(matchingPreset('depth',values.depth_taper_curve),'flat');assert.equal(values.depth_taper_amount_mm,1);
  assert.equal(values.slot_fillet_r,3);assert.equal(values.riser_fillet_r,4);
  assert(validate(meta,values).valid);
  for(const version of [1,2]){
    const old=readLink(meta,new URL(`https://example.invalid/?depth_profile_version=${version}`));
    assert.equal(old.attachment_method,'diamond');assert.equal(matchingPreset('width',old.width_taper_curve),'flat');
    assert.equal(matchingPreset('depth',old.depth_taper_curve),'flat');assert.equal(old.width_taper_amount_mm,3);assert.equal(old.depth_taper_amount_mm,10);
    assert.equal(old.slot_fillet_r,2);
  }
});

test('one continuous flat grip supports 80-120 mm without changing explicit saved choices',()=>{
  const base={...defaults(meta),slot_count:1,width_taper_curve:profilePresets.width[0].curve,depth_taper_curve:profilePresets.depth[0].curve,riser_height_1:0};
  for(let i=1;i<=6;i++)assert.equal(meta.params.find(p=>p.key===`slot_width_${i}`).max,120);
  for(const width of [80,120]){
    const values={...base,slot_width_1:width};assert(validate(meta,values).valid,JSON.stringify(validate(meta,values).errors));
    const link=modelLink('unlevel_hangboard_depth_taper',meta,values,'https://example.invalid/');assert.deepEqual(readLink(meta,new URL(link)),values);
  }
  assert(!validate(meta,{...base,slot_width_1:120.001}).valid);
  const saved={...base,attachment_method:'diamond',width_taper_amount_mm:3,depth_taper_amount_mm:10};
  assert.deepEqual(readLink(meta,new URL(modelLink('unlevel_hangboard_depth_taper',meta,saved,'https://example.invalid/'))),saved);
});

test('rope shell validation includes raised grips but still rejects thin side walls',()=>{
  const values={...defaults(meta),slot_count:2,slot_depth_y:16,upper_slot_depth_y:24};
  assert(validate(meta,values).valid);
  const thin=validate(meta,{...values,rope_side_wall_x:4});
  assert(!thin.valid);assert.match(thin.errors.rope_crown_rise_mm,/3 mm nominal shell/);
});
