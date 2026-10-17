export const definition = Object.freeze({
  slug:'crimp-hold', title:'Crimp climbing hold', meshBuilder:true, manualUpdate:true,
  purpose:'An incut crimp with a rounded dome body and printable grip texture. A first shape and mounting experiment; not physically validated.',
  validation:'Unvalidated printed prototype. No climbing-load, bolt-pull-through, fatigue or skin-comfort testing. Do not use for climbing until the material, print and mounting have been independently assessed.',
  basic:['width','grip_depth','incut_angle','edge_radius'],
  groups:[
    ['Body size', ['height','projection']],
    ['Grip texture and print layers', ['surface_texture','texture_layer_height']],
    ['M10 countersunk bolt seat', ['bolt_clearance','bolt_head_diameter','bolt_angle','bolt_web']],
    ['Anti-rotation screw seats', ['screw_count','screw_clearance','screw_head_diameter','screw_web']]
  ],
  load:()=>import('./model.mjs')
});
