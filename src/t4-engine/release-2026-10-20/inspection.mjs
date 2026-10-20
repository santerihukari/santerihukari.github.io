export const inspectionScopes = [
  ['all','All components'],['engine','Engine'],['clutch','Clutch & starter'],
  ['gearbox','Gearbox internals'],['final-drive','Final drive'],['axles','CV shafts'],
  ['wheels','Wheel ends'],['vehicle','Vehicle context']
];

export function scopeIncludes(part, scope='all') {
  if(scope==='all')return true;
  if(scope==='engine')return !part.id.startsWith('drive_')&&!part.id.startsWith('vehicle_');
  if(scope==='clutch')return part.group==='clutch'||['flywheel','starter_ring','starter','starter_solenoid','starter_pinion','drive_bellhousing','drive_engine_backplate','drive_input_shaft'].includes(part.id);
  if(scope==='gearbox')return ['transmission','clutch','differential'].includes(part.group)||['starter','starter_solenoid','starter_pinion','drive_intermediate','drive_support_bearing','drive_shaft_bracket'].includes(part.id);
  if(scope==='final-drive')return part.group==='differential'||['drive_output_shaft','drive_gearcase','drive_bellhousing'].includes(part.id);
  if(scope==='axles')return ['axles','differential'].includes(part.group);
  if(scope==='wheels')return ['wheels','rear_wheels','vehicle_brakes'].includes(part.group);
  if(scope==='vehicle')return part.id.startsWith('vehicle_')||['wheels','axles'].includes(part.group);
  return true;
}
