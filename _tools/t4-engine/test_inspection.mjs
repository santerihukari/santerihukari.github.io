import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectionScopes,scopeIncludes} from '../../src/t4-engine/release-2026-10-20/inspection.mjs';

test('inspection scopes retain engine, starter, gearbox, wheel and vehicle boundaries',()=>{
  assert.deepEqual(inspectionScopes.map(([id])=>id),['all','engine','clutch','gearbox','final-drive','axles','wheels','vehicle']);
  assert.equal(new Set(inspectionScopes.map(([id])=>id)).size,inspectionScopes.length);
  for(const id of ['starter','starter_solenoid','starter_pinion'])for(const scope of ['clutch','gearbox'])assert(scopeIncludes({id,group:'accessories'},scope));
  for(const id of ['drive_engine_backplate','drive_input_shaft'])assert(scopeIncludes({id,group:'transmission'},'clutch'));
  for(const [id,group] of [['drive_gearcase','transmission'],['drive_output_extension','differential'],['drive_shaft_bracket','axles'],['drive_intermediate','axles']])assert(scopeIncludes({id,group},'gearbox'));
  assert(!scopeIncludes({id:'drive_tyre_left',group:'wheels'},'gearbox'));
  assert(!scopeIncludes({id:'block',group:'structure'},'final-drive'));
  assert(scopeIncludes({id:'vehicle_radiator',group:'vehicle_chassis'},'vehicle'));
  assert(!scopeIncludes({id:'vehicle_radiator',group:'vehicle_chassis'},'engine'));
  assert(scopeIncludes({id:'drive_shaft_left',group:'axles'},'axles'));
});

for(const [directory,count] of [['vw-t4-engine/r9',271],['vw-t4-powertrain/r13',400],['vw-t4-vehicle/r13',435]]){
  test(`${directory}: scopes use current manifest mesh IDs without duplicates`,()=>{
    const m=JSON.parse(readFileSync(new URL(`../../assets/models/${directory}/manifest.json`,import.meta.url),'utf8'));
    assert.equal(m.parts.filter(p=>scopeIncludes(p,'all')).length,count);
    assert.equal(m.parts.filter(p=>scopeIncludes(p,'engine')).length,271);
    for(const [scope] of inspectionScopes){
      const ids=m.parts.filter(p=>scopeIncludes(p,scope)).map(p=>p.id);
      assert.equal(new Set(ids).size,ids.length);
      if(scope==='gearbox')assert(!ids.some(id=>id.startsWith('vehicle_')));
      if(scope==='engine')assert(!ids.some(id=>/^(drive_|vehicle_)/.test(id)));
    }
    if(count>271){
      const gearbox=m.parts.filter(p=>scopeIncludes(p,'gearbox')).map(p=>p.id);
      for(const id of ['drive_engine_backplate','drive_output_extension','drive_shaft_bracket','drive_flange_right','starter_pinion'])assert(gearbox.includes(id),id);
    }
  });
}
