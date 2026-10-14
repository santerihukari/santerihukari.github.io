// Browser and Node share this geometry source. All coordinates and STL values are mm.
export const DEFAULTS = Object.freeze({
  major_d: 22, root_d: 20.5, thread_height: 15, smooth_upper_length: 3, pitch: 1.5,
  thread_half_pitch_span: .5, inner_d: 14, max_xy: 19.9, min_square_wall: 2.5,
  foot_extra_d: 5, foot_height: 3, foot_edge_r: .5,
  insert_radial_clearance: .35, insert_foot_d: 18, insert_foot_height: 3,
  lever_gap: .35, upper_lip_d: 15.65, upper_lip_height: 1, upper_lip_gap: .35,
  latch_reach: 35, latch_thickness: 6, latch_gap: 2,
  stop_x: 1.5, stop_y: 2, stop_y_gap: .4, shell_stop_height: 1.6, insert_stop_drop: 1.6,
  stop_style: 'arc', stop_arc_degrees: 88, shaft_top_radius: 6,
  nut_thickness: 4, nut_across_flats: 32, nut_thread_clearance: .3, nut_lead_in: .35,
  handle_style: 'ergonomic', handle_width: 42, handle_depth: 16,
  handle_thickness: 12, handle_edge_r: 1.2,
});
export const HANDLE_PRESETS = Object.freeze({
  ergonomic: { handle_width: 42, handle_depth: 16, handle_thickness: 12, handle_edge_r: 1.2 },
  half_round: { handle_width: 18, handle_depth: 9, handle_thickness: 3, handle_edge_r: .35 },
});
export const CONTROLS = [
  ['Latch & handle', [
    ['latch_reach', 'Latch arm reach', 20, 60, .5], ['latch_thickness', 'Arm thickness', 3, 8, .1],
    ['latch_gap', 'Arm height above threads', 1.5, 10, .1],
    ['handle_width', 'Handle width', 18, 60, .5], ['handle_depth', 'Lower handle curve depth', 8, 25, .5],
    ['handle_thickness', 'Handle thickness', 3, 18, .1], ['handle_edge_r', 'Handle edge radius', 0, 3, .05],
    ['shaft_top_radius', 'Shaft top relief radius', 0, 6.65, .05],
  ]],
  ['Threads & fit', [
    ['major_d', 'Thread major diameter', 18, 30, .1], ['root_d', 'Thread root diameter', 17, 29, .1],
    ['pitch', 'Thread pitch', 1, 3, .1], ['thread_height', 'Outer body height', 10, 30, .5],
    ['smooth_upper_length', 'Smooth upper section', 0, 10, .5],
    ['max_xy', 'Square-cut width', 17, 28, .1], ['inner_d', 'Bore diameter', 10, 20, .1],
    ['insert_radial_clearance', 'Shaft radial clearance', .15, .6, .05],
    ['nut_thread_clearance', 'Nut diameter clearance', .1, .6, .05],
    ['nut_thickness', 'Nut thickness', 3, 8, .5], ['nut_across_flats', 'Nut across flats', 28, 42, .5],
  ]],
  ['Feet & capture', [
    ['foot_extra_d', 'Body foot extra diameter', 2, 12, .5], ['foot_height', 'Body foot height', 2, 6, .1],
    ['foot_edge_r', 'Body foot bottom radius', 0, 1, .05],
    ['insert_foot_d', 'Insert foot diameter', 16, 26, .5], ['insert_foot_height', 'Insert foot height', 2, 6, .1],
    ['lever_gap', 'Lower axial clearance', .15, .6, .05], ['upper_lip_d', 'Capture lip diameter', 14.5, 22, .1],
    ['upper_lip_height', 'Capture lip height', .5, 3, .1], ['upper_lip_gap', 'Upper axial clearance', .15, .6, .05],
    ['stop_x', 'Stop length', .5, 4, .1], ['stop_y', 'Stop width', 1, 5, .1],
    ['stop_arc_degrees', 'Stop sweep', 20, 90, .5],
    ['stop_y_gap', 'Stop side gap', .2, 1, .05], ['shell_stop_height', 'Body stop height', .5, 3, .1],
  ]],
];

export function parameters(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Parameters must be an object.');
  for (const key of Object.keys(input)) if (!(key in DEFAULTS)) throw new Error(`Unknown parameter: ${key}`);
  const p = { ...DEFAULTS, ...input };
  for (const [key, value] of Object.entries(p)) {
    if (key === 'handle_style' || key === 'stop_style') continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
    if (value < 0 || value > 100) throw new Error(`${key} must be between 0 and 100 mm.`);
  }
  if (!(p.handle_style in HANDLE_PRESETS)) throw new Error('Unknown handle style.');
  if (!['arc','rectangular'].includes(p.stop_style)) throw new Error('Unknown stop style.');
  if (p.handle_style === 'half_round') p.handle_depth = p.handle_width/2;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  check(p.root_d < p.major_d && p.root_d > p.inner_d, 'Thread diameters must satisfy bore < root < major.');
  check(p.pitch >= .5 && p.thread_height >= 3 && p.thread_height / p.pitch <= 60, 'Use pitch >= 0.5 mm, thread length >= 3 mm and at most 60 turns.');
  check(p.thread_height-p.smooth_upper_length >= Math.max(p.nut_thickness,2*p.pitch), 'Leave at least one nut thickness and two pitches of threaded length.');
  check(p.thread_half_pitch_span > 0 && p.thread_half_pitch_span <= .5, 'Thread profile span must be in (0, 0.5].');
  check(p.max_xy <= p.major_d && p.max_xy > p.major_d / Math.SQRT2, 'Square cut must preserve thread engagement at the corners.');
  check((p.max_xy-p.inner_d)/2 >= p.min_square_wall, 'The bore leaves too little material at the square-cut faces.');
  check(p.inner_d >= 4 && p.insert_radial_clearance >= .1 && p.insert_radial_clearance < p.inner_d/4, 'Invalid bore or shaft clearance.');
  check(p.insert_foot_d > p.inner_d && p.upper_lip_d > p.inner_d, 'Both capture flanges must exceed the bore diameter.');
  check(p.insert_foot_height >= 1 && p.foot_height >= 1 && p.upper_lip_height >= .5, 'Feet and capture lip are too thin.');
  check(p.lever_gap >= .1 && p.upper_lip_gap >= .1, 'Axial clearances must be at least 0.1 mm.');
  check(p.upper_lip_gap+p.upper_lip_height <= p.latch_gap, 'The capture lip must end at or below the latch arm.');
  check(p.latch_reach > p.inner_d && p.latch_thickness >= 2, 'Latch arm is too short or thin.');
  check(p.stop_x >= .25 && p.stop_y >= .25 && p.stop_y_gap >= .1, 'Anti-drop stop dimensions/gap are too small.');
  check(p.stop_x < p.max_xy/2 && p.stop_y+p.stop_y_gap/2 < (p.inner_d-2*p.insert_radial_clearance)/2, 'Stops must remain within the arm width and square cut.');
  check(p.stop_arc_degrees >= 1 && p.stop_arc_degrees <= 90, 'Each stop sweep must be between 1 and 90 degrees.');
  check(p.stop_y_gap/2 < p.max_xy/2-p.stop_x, 'Stop gap exceeds the inner stop radius.');
  check(p.shell_stop_height < p.latch_gap, 'The body stop must end before the latch arm.');
  check(p.shell_stop_height > p.upper_lip_gap+p.upper_lip_gap+p.lever_gap, 'Anti-drop stops need enough vertical overlap across the axial play.');
  check(p.upper_lip_d/2 < p.max_xy/2-p.stop_x, 'The capture lip must stay inside the body stop inner radius.');
  check(p.nut_thickness >= 2 && p.nut_across_flats >= p.major_d+4 && p.nut_thread_clearance >= .05, 'Nut walls, thickness or thread clearance are too small.');
  check(p.nut_lead_in < p.nut_thickness/2, 'Nut lead-in is too large.');
  check(p.handle_width >= 8 && p.handle_depth >= 4 && p.handle_thickness >= 2, 'Handle dimensions are too small.');
  const depth = p.handle_style === 'half_round' ? p.handle_width/2 : p.handle_depth;
  check(p.handle_edge_r < Math.min(p.handle_thickness/2, p.handle_width/4, depth/2), 'Handle radius must be smaller than half the thickness.');
  check(p.shaft_top_radius <= Math.min((p.inner_d-2*p.insert_radial_clearance)/2,p.latch_thickness), 'Top relief radius must fit inside the shaft radius and arm height.');
  return p;
}

export function generate(api, input = {}) {
  const p = parameters(input), M = api.Manifold, resources = [], registered = new Set();
  const threadEnd=p.thread_height-p.smooth_upper_length;
  const keep = (value) => { if(!registered.has(value)){resources.push(value);registered.add(value);} return value; };
  const cube = (size, at = [0, 0, 0]) => keep(keep(M.cube(size)).translate(at));
  const cylinder = (h, r, at = [0, 0, 0], segments = 128) => keep(keep(M.cylinder(h, r, r, segments)).translate(at));
  const union = (...shapes) => keep(M.union(shapes));
  const cut = (a, b) => keep(a.subtract(b));
  const clip = (a, b) => keep(M.intersection(a, b));
  const meshSolid = (vertices, faces) => {
    const mesh = new api.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices.flat()), triVerts: new Uint32Array(faces.flat()) });
    mesh.merge(); return keep(new M(mesh));
  };
  function roundedFoot(h, r, edge, bottom) {
    const e = Math.min(edge, h/2, r), rings = [];
    if (e <= 1e-6) return cylinder(h, r, [0, 0, bottom]);
    rings.push(cylinder(h-e, r, [0, 0, bottom+e]));
    for (let i=0; i<8; i++) {
      const dz=e/8, y=e-(i+.5)*dz;
      rings.push(cylinder(dz, r-e+Math.sqrt(e*e-y*y), [0, 0, bottom+i*dz]));
    }
    return union(...rings);
  }
  function threadRib() {
    const turns=threadEnd/p.pitch, steps=Math.max(12, Math.round(turns*96));
    const vertices=[], faces=[], root=p.root_d/2;
    for (let i=0; i<=steps; i++) {
      const t=i/steps, a=t*turns*2*Math.PI, z=t*threadEnd;
      const fade=Math.min(1, t*turns/.5, (1-t)*turns/.5), r=root+(p.major_d/2-root)*fade;
      vertices.push([root*Math.cos(a),root*Math.sin(a),z-p.pitch*p.thread_half_pitch_span],
        [r*Math.cos(a),r*Math.sin(a),z], [root*Math.cos(a),root*Math.sin(a),z+p.pitch*p.thread_half_pitch_span]);
    }
    for (let i=0; i<steps; i++) for (let j=0; j<3; j++) {
      const a=i*3+j,b=i*3+(j+1)%3,c=(i+1)*3+j,d=(i+1)*3+(j+1)%3;
      faces.push([a,c,d],[a,d,b]);
    }
    faces.push([0,1,2],[steps*3,steps*3+2,steps*3+1]);
    return clip(meshSolid(vertices,faces), cylinder(threadEnd,p.major_d/2));
  }
  function nut() {
    const n=96, steps=Math.max(1, Math.round(p.nut_thickness/p.pitch*48)), vertices=[], faces=[];
    const root=(p.root_d+p.nut_thread_clearance)/2, major=(p.major_d+p.nut_thread_clearance)/2;
    for (const z of [0,p.nut_thickness]) for (let i=0;i<n;i++) {
      const a=2*Math.PI*i/n, flat=Math.round(a/(Math.PI/3))*Math.PI/3;
      const r=p.nut_across_flats/2/Math.cos(a-flat); vertices.push([r*Math.cos(a),r*Math.sin(a),z]);
    }
    for (let j=0;j<=steps;j++) for (let i=0;i<n;i++) {
      const z=p.nut_thickness*j/steps,a=2*Math.PI*i/n,phase=z/p.pitch-i/n;
      const distance=Math.abs(((phase+.5)%1+1)%1-.5), crest=Math.max(0,1-distance/p.thread_half_pitch_span);
      let r=root+(major-root)*crest;
      if(p.nut_lead_in>0) r=Math.max(r,root+(major+.1-root)*Math.max(0,1-Math.min(z,p.nut_thickness-z)/p.nut_lead_in));
      vertices.push([r*Math.cos(a),r*Math.sin(a),z]);
    }
    const b=2*n,t=b+steps*n;
    for(let i=0;i<n;i++) {const j=(i+1)%n;
      faces.push([i,j,n+j],[i,n+j,n+i],[i,b+i,b+j],[i,b+j,j],
        [n+i,n+j,t+j],[n+i,t+j,t+i]);
    }
    for(let s=0;s<steps;s++) for(let i=0;i<n;i++){const j=(i+1)%n,l=b+s*n,h=l+n;
      faces.push([l+i,h+i,h+j],[l+i,h+j,l+j]);
    }
    return meshSolid(vertices,faces);
  }
  function handle(bottom) {
    // Rounded elliptical extrusion, then a sharp half-plane cut at the foot joint.
    const ry=p.handle_width/2, rz=p.handle_style==='half_round'?ry:p.handle_depth;
    const half=p.handle_thickness/2, e=p.handle_edge_r, sections=[];
    if(e>1e-6) {
      for(let k=0;k<=8;k++){const a=k*Math.PI/16; sections.push([-half+e*(1-Math.cos(a)),e*(1-Math.sin(a))]);}
      for(let k=8;k>=0;k--){const a=k*Math.PI/16; sections.push([half-e*(1-Math.cos(a)),e*(1-Math.sin(a))]);}
    } else sections.push([-half,0],[half,0]);
    const extension=p.handle_style==='ergonomic'?p.insert_foot_height:0;
    const profile=[];
    for(let i=0;i<128;i++) {
      const a=2*Math.PI*i/128;
      if(i===0 && extension>0) profile.push({a,z:0});
      profile.push({a,z:rz*Math.sin(a)+(i<=64?extension:0)});
      if(i===64 && extension>0) profile.push({a,z:0});
    }
    const n=profile.length,vertices=[],faces=[];
    for(const [x,inset] of sections) for(const {a,z} of profile) {
      const ny=Math.cos(a)/ry,nz=Math.sin(a)/rz,length=Math.hypot(ny,nz);
      vertices.push([x,ry*Math.cos(a)-inset*ny/length,bottom+z-inset*nz/length]);
    }
    for(let k=0;k<sections.length-1;k++)for(let i=0;i<n;i++) {const j=(i+1)%n,l=k*n,h=l+n;
      faces.push([l+i,l+j,h+j],[l+i,h+j,h+i]);
    }
    const low=vertices.length;vertices.push([-half,0,bottom],[half,0,bottom]);
    const high=(sections.length-1)*n;
    for(let i=0;i<n;i++){const j=(i+1)%n; faces.push([low,j,i],[low+1,high+i,high+j]);}
    return clip(meshSolid(vertices,faces),cube([p.handle_thickness+2,p.handle_width+2,rz+1+(extension||.15)],[ -half-1,-ry-1,bottom-rz-1]));
  }
  const stopStart=Math.asin(p.stop_y_gap/2/(p.max_xy/2-p.stop_x))*180/Math.PI;
  function stop(sign,z,height,integralLip=false) {
    const outer=p.max_xy/2;
    let inner=integralLip?(p.inner_d-2*p.insert_radial_clearance)/2-.15:p.max_xy/2-p.stop_x;
    if(p.stop_style==='rectangular'){
      if(integralLip)inner=Math.sqrt(inner*inner-(p.stop_y+p.stop_y_gap/2)**2);
      return cube([outer-inner,p.stop_y,height],[inner,sign<0?-p.stop_y_gap/2-p.stop_y:p.stop_y_gap/2,z]);
    }
    const points=[],steps=Math.max(8,Math.ceil(p.stop_arc_degrees/2));
    for(let i=0;i<=steps;i++){const a=sign*(stopStart+p.stop_arc_degrees*i/steps)*Math.PI/180;points.push([outer*Math.cos(a),outer*Math.sin(a)]);}
    for(let i=steps;i>=0;i--){const a=sign*(stopStart+p.stop_arc_degrees*i/steps)*Math.PI/180;points.push([inner*Math.cos(a),inner*Math.sin(a)]);}
    if(sign<0)points.reverse();
    const section=keep(new api.CrossSection([points]));
    return keep(keep(section.extrude(height)).translate([0,0,z]));
  }
  try {
    const square=cube([p.max_xy,p.max_xy,p.thread_height],[-p.max_xy/2,-p.max_xy/2,0]);
    const core=clip(cylinder(threadEnd,p.root_d/2+.05),square);
    const upper=p.smooth_upper_length>0?clip(cylinder(p.smooth_upper_length+.1,p.root_d/2,[0,0,threadEnd-.1]),square):null;
    const body=cut(union(core,...(upper?[upper]:[]),clip(threadRib(),square),
      roundedFoot(p.foot_height,(p.major_d+p.foot_extra_d)/2,p.foot_edge_r,-p.foot_height),
      stop(-1,p.thread_height-.15,p.shell_stop_height+.15)),
      cylinder(p.thread_height+p.foot_height+.2,p.inner_d/2,[0,0,-p.foot_height-.1]));
    const r=(p.inner_d-2*p.insert_radial_clearance)/2;
    const footTop=-p.foot_height-p.lever_gap,footBottom=footTop-p.insert_foot_height;
    const armBottom=p.thread_height+p.latch_gap, armTop=armBottom+p.latch_thickness;
    const lipBottom=p.thread_height+p.upper_lip_gap;
    const insertStopTop=Math.max(lipBottom+p.upper_lip_height,armBottom+.15);
    let shaft=cylinder(armTop-footBottom,r,[0,0,footBottom]);
    if(p.shaft_top_radius>1e-6) {
      const radius=p.shaft_top_radius,cx=-r+radius,cz=armTop-radius;
      const upperLeft=cube([radius+1,2*r+2,radius+1],[-r-1,-r-1,cz]);
      const round=keep(cylinder(2*r+2,radius).rotate([90,0,0]));
      const roundAt=keep(round.translate([cx,r+1,cz]));
      shaft=cut(shaft,cut(upperLeft,roundAt));
    }
    const insert=union(shaft,
      cylinder(p.insert_foot_height,p.insert_foot_d/2,[0,0,footBottom]),
      cylinder(p.upper_lip_height,p.upper_lip_d/2,[0,0,p.thread_height+p.upper_lip_gap]),
      handle(footBottom),cube([p.latch_reach-r,2*r,p.latch_thickness],[0,-r,armBottom]),
      cylinder(p.latch_thickness,r,[p.latch_reach-r,0,armBottom]),
      stop(1,lipBottom,insertStopTop-lipBottom,true));
    const hex=nut(), solids={body,insert,nut_1:hex,nut_2:hex};
    const payload=inspection(p,solids);
    const collision=keep(M.intersection(body,insert)).volume();
    if(collision>1e-5) throw new Error(`Body and insert intersect by ${collision.toFixed(3)} mm3.`);
    const report={intersection_mm3:collision,square_wall_mm:(p.max_xy-p.inner_d)/2,
      shaft_radial_clearance_mm:p.insert_radial_clearance,axial_play_mm:p.upper_lip_gap+p.lever_gap,
      body_stop_to_arm_mm:p.latch_gap-p.shell_stop_height,insert_stop_to_body_mm:p.upper_lip_gap,
      stop_vertical_overlap_mm:p.shell_stop_height-p.upper_lip_gap,
      insert_stop_base_z:lipBottom,insert_stop_top_z:insertStopTop,
      insert_stop_local_height_mm:insertStopTop-lipBottom,
      insert_stop_connection_inner_radius_mm:r-.15,
      handle_depth_mm:p.handle_style==='half_round'?p.handle_width/2:p.handle_depth+p.insert_foot_height,
      handle_top_z:p.handle_style==='half_round'?footBottom+.15:footTop,
      body_foot_to_handle_gap_mm:p.handle_style==='ergonomic'?p.lever_gap:null,
      top_relief_radius_mm:p.shaft_top_radius,
      stop_outer_diameter_mm:p.max_xy,
      rotation_limits_degrees:p.stop_style==='arc'?[-2*stopStart,360-2*stopStart-2*p.stop_arc_degrees]:null,
      available_rotation_degrees:p.stop_style==='arc'?360-2*p.stop_arc_degrees:null,
      threaded_length_mm:threadEnd,smooth_upper_length_mm:p.smooth_upper_length,
      smooth_upper_diameter_mm:p.root_d,
      smooth_to_nut_nominal_radial_clearance_mm:p.nut_thread_clearance/2,
      remaining_thread_covers_two_nuts:threadEnd>=2*p.nut_thickness,
      thread_turns:threadEnd/p.pitch,magnet_pocket:false,
      warnings:['Print-in-place release and printed nut fit require a physical test.',
        'Thread changes require matching nuts. Old 1 mm-pitch parts do not match this revision.',
        'The anti-drop stops restrict rotation; use the reported geometric range, not a full turn.',
        'Door/frame contact and handle comfort have not been physically tested.',
        ...(threadEnd<2*p.nut_thickness?['Remaining threaded length is shorter than two full nut thicknesses.']:[])]};
    return {...payload,report};
  } finally { for(const value of resources.reverse()) value.delete(); }
}

function inspection(p,solids) {
  const r=(p.inner_d-2*p.insert_radial_clearance)/2,footTop=-p.foot_height-p.lever_gap;
  const footBottom=footTop-p.insert_foot_height,lip=p.thread_height+p.upper_lip_gap,arm=p.thread_height+p.latch_gap;
  const threadEnd=p.thread_height-p.smooth_upper_length,insertStopTop=Math.max(lip+p.upper_lip_height,arm+.15);
  const tx=p.max_xy/2-p.stop_x/2,ty=p.stop_y_gap/2+p.stop_y/2;
  const features=[],ids={};
  const add=(id,name,part,anchor,whole=false)=>{ids[id]=features.length;features.push({id,name,part,anchor,whole_part:whole});};
  add('body','Threaded body','body',[-p.max_xy/2,-3,threadEnd/2],true);
  add('body_foot','Body foot','body',[0,-(p.major_d+p.foot_extra_d)/2,-p.foot_height/2]);
  add('square_cuts','Square-cut faces','body',[p.max_xy/2,0,threadEnd/2]);
  if(p.smooth_upper_length>0)add('smooth_upper','Smooth outer shaft','body',[-p.max_xy/2,0,threadEnd+p.smooth_upper_length/2]);
  const midAngle=(Math.asin(p.stop_y_gap/2/(p.max_xy/2-p.stop_x))+p.stop_arc_degrees*Math.PI/360);
  const midRadius=p.max_xy/2-p.stop_x/2;
  add('body_tab','Body anti-drop tab','body',p.stop_style==='arc'?[midRadius*Math.cos(midAngle),-midRadius*Math.sin(midAngle),p.thread_height+p.shell_stop_height]:[tx,-ty,p.thread_height+p.shell_stop_height]);
  add('insert','Rotating insert','insert',[12,-r,arm+p.latch_thickness/2],true);
  add('shaft','Inner shaft','insert',[0,-r,p.thread_height/2]);
  if(p.shaft_top_radius>0)add('shaft_top','Quarter-round shaft top','insert',[-r+p.shaft_top_radius*(1-Math.SQRT1_2),0,arm+p.latch_thickness-p.shaft_top_radius*(1-Math.SQRT1_2)]);
  add('insert_foot','Insert foot','insert',[0,-p.insert_foot_d/2,footBottom+p.insert_foot_height/2]);
  add('handle',p.handle_style==='half_round'?'Half-round handle':'Ergonomic handle','insert',[0,0,footBottom-(p.handle_style==='half_round'?p.handle_width/2:p.handle_depth)]);
  add('capture_lip','Upper capture lip','insert',[0,-p.upper_lip_d/2,lip+p.upper_lip_height/2]);
  add('latch_arm','Latch arm','insert',[p.latch_reach-2,0,arm+p.latch_thickness]);
  add('insert_tab','Insert anti-drop tab','insert',p.stop_style==='arc'?[midRadius*Math.cos(midAngle),midRadius*Math.sin(midAngle),lip]:[tx,ty,lip]);
  features[ids.insert_tab].parent_feature='capture_lip';
  for(const key of ['nut_1','nut_2']) {
    add(key,`Threaded nut ${key.slice(-1)}`,key,[0,0,p.nut_thickness],true);
    add(key+'_thread',`Nut ${key.slice(-1)} internal thread`,key,[(p.root_d+p.nut_thread_clearance)/2,0,p.nut_thickness/2]);
  }
  const colors={body:'#819aaa',insert:'#db855e',nut_1:'#5eac85',nut_2:'#aa89bb'};
  const offset=p.nut_across_flats/2+(p.major_d+p.foot_extra_d)/2+9;
  const display={body:[0,0,0],insert:[0,0,0],nut_1:[-offset,-p.nut_across_flats*.75,0],nut_2:[-offset,p.nut_across_flats*.75,0]};
  const explode={body:[0,0,0],insert:[.5,0,1],nut_1:[-.25,-.25,0],nut_2:[-.25,.25,0]};
  const parts=[];
  for(const [key,solid] of Object.entries(solids)) {
    if(solid.status()!=='NoError' || solid.volume()<=0) throw new Error(`${key} is not a valid solid: ${solid.status()}`);
    const bodies=solid.decompose(); const count=bodies.length; bodies.forEach((b)=>b.delete());
    if(count!==1) throw new Error(`${key} contains ${count} disconnected bodies.`);
    const mesh=solid.getMesh(),vertices=[],faces=[],regions=[],remap=[],unique=new Map();
    // Float32 conversion can collapse Boolean slivers; weld exact positions before STL export.
    for(let i=0;i<mesh.vertProperties.length;i+=mesh.numProp){
      const vertex=Array.from(mesh.vertProperties.slice(i,i+3)),key=JSON.stringify(vertex);
      if(!unique.has(key)){unique.set(key,vertices.length);vertices.push(vertex);}
      remap.push(unique.get(key));
    }
    for(let i=0;i<mesh.triVerts.length;i+=3) {
      const f=Array.from(mesh.triVerts.slice(i,i+3),(index)=>remap[index]);
      if(new Set(f).size<3)continue;
      faces.push(f);
      const c=[0,1,2].map((a)=>(vertices[f[0]][a]+vertices[f[1]][a]+vertices[f[2]][a])/3);
      const [x,y,z]=c,radial=Math.hypot(x,y); let id=key;
      if(key==='body') {
        if(z<-.001 || (z<=.001 && radial>p.major_d/2))id='body_foot';
        if((Math.abs(Math.abs(x)-p.max_xy/2)<1e-4 || Math.abs(Math.abs(y)-p.max_xy/2)<1e-4)&&z>=0&&z<=p.thread_height)id='square_cuts';
        if(p.smooth_upper_length>0&&z>threadEnd+.001&&z<=p.thread_height+.001)id='smooth_upper';
        if(p.stop_style==='arc'?(radial>=p.max_xy/2-p.stop_x-.02&&y<0&&z>=p.thread_height-.001):(x>=p.max_xy/2-p.stop_x-.001&&y< -p.stop_y_gap/2+.001&&y>=-p.stop_y_gap/2-p.stop_y-.001&&z>=p.thread_height-.15))id='body_tab';
      } else if(key==='insert') {
        id='shaft'; if(z<footTop+.001&&radial>r+.001)id='insert_foot';
        if(z<footBottom-.001||(p.handle_style==='ergonomic'&&z<=footTop+.001&&Math.abs(x)<=p.handle_thickness/2+.001&&radial>p.insert_foot_d/2+.001))id='handle';
        if(p.shaft_top_radius>0&&x<0&&z>arm+p.latch_thickness-p.shaft_top_radius+.001)id='shaft_top';
        if(z>=lip-.001&&z<=lip+p.upper_lip_height+.001&&radial>r+.001)id='capture_lip';
        if(z>=arm-.001&&x>=-.001)id='latch_arm';
        const stopInner=r-.15;
        const theta=Math.atan2(y,x)*180/Math.PI,stopAngleStart=Math.asin(p.stop_y_gap/2/(p.max_xy/2-p.stop_x))*180/Math.PI;
        if(p.stop_style==='arc'?(radial>=stopInner-.02&&theta>=stopAngleStart-.01&&theta<=stopAngleStart+p.stop_arc_degrees+.01&&z>=lip-.001&&z<=insertStopTop+.001):(x>=Math.sqrt(stopInner*stopInner-(p.stop_y+p.stop_y_gap/2)**2)-.001&&x<=p.max_xy/2+.001&&y>=p.stop_y_gap/2-.001&&y<=p.stop_y_gap/2+p.stop_y+.001&&z>=lip-.001&&z<=insertStopTop+.001))id='insert_tab';
      } else if(radial<(p.major_d+p.nut_thread_clearance)/2+.15) id=key+'_thread';
      regions.push(ids[id]);
    }
    const edges=new Map();
    for(const f of faces)for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`;edges.set(key,(edges.get(key)||0)+1);}
    if([...edges.values()].some((count)=>count!==2))throw new Error(`${key} mesh is not watertight after float conversion.`);
    const bounds=solid.boundingBox();
    parts.push({id:key,name:features[ids[key]].name,color:colors[key],vertices,faces,face_features:regions,
      display_position:display[key],explode_direction:explode[key],volume_mm3:solid.volume(),watertight:true,
      dimensions_mm:bounds.max.map((v,i)=>v-bounds.min[i])});
  }
  features.forEach((f,i)=>{const part=parts.find((p)=>p.id===f.part);f.face_count=f.whole_part?part.faces.length:part.face_features.filter((v)=>v===i).length;
    if(!f.face_count)throw new Error(`No faces for ${f.name}.`);});
  return {id:'door_frame_latch_v3',parameters:p,parts,features,
    presentation:{nuts:'shown alongside, not installed',joined_features:'inspection regions, not separate printable parts'}};
}

export function stlBuffer(parts) {
  const triangles=parts.reduce((n,p)=>n+p.faces.length,0),buffer=new ArrayBuffer(84+triangles*50),view=new DataView(buffer);
  new Uint8Array(buffer,0,80).set(new TextEncoder().encode('door_frame_latch_v3; units=mm; parametric browser geometry'));
  view.setUint32(80,triangles,true);let at=84;
  for(const part of parts)for(const face of part.faces) {
    const [a,b,c]=face.map((i)=>part.vertices[i]); const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal)||1;
    for(const value of [...normal.map((q)=>q/length),...a,...b,...c]){view.setFloat32(at,value,true);at+=4;}
    view.setUint16(at,0,true);at+=2;
  }
  return buffer;
}
