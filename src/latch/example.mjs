// Demonstration fixture only. These are not measured door/frame dimensions.
export const EXAMPLE_DEFAULTS=Object.freeze({door_thickness:4,frame_edge_x:31,frame_clearance:.3});
export const EXAMPLE_CONTROLS=[
  ['door_thickness','Door panel thickness',1,10,.5],
  ['frame_edge_x','Frame catching edge X',25,45,.5],
  ['frame_clearance','Arm-to-frame gap',0,3,.1],
];
export function exampleLayout(p,input={},nutCount=1) {
  if(![1,2].includes(nutCount))throw new Error('Unsupported nut quantity.');
  const s={...EXAMPLE_DEFAULTS,...input};
  for(const [key,v] of Object.entries(s))if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw new Error(`${key} is not a valid example dimension.`);
  if(s.door_thickness<.5)throw new Error('Example panel thickness must be at least 0.5 mm.');
  const hole=p.major_d+.4,doorGap=1,doorRight=s.frame_edge_x-doorGap;
  if(doorRight<=hole/2+1)throw new Error('The example mounting hole must fit inside the door edge.');
  const armBottom=p.thread_height+(p.latch_gap??p.upper_stop_gap);
  const frameBack=armBottom-s.frame_clearance;
  if(frameBack<=0)throw new Error('The example frame depth must be positive.');
  const nutPositions=Array.from({length:nutCount},(_,i)=>s.door_thickness+i*p.nut_thickness);
  const nuts=nutPositions.map((z,i)=>({id:`nut_${i+1}`,position:[0,0,z],angle_deg:((360*z/p.pitch)%360+360)%360}));
  const end=p.thread_height-(p.smooth_upper_length??0),stackTop=s.door_thickness+nutCount*p.nut_thickness;
  const reach=p.latch_reach??p.upper_stop_x,footBearing=(p.major_d+p.foot_extra_d-hole)/2;
  const nutRadius=p.nut_across_flats/Math.sqrt(3);
  const issues=[];
  if(stackTop>end+1e-6)issues.push(`Panel and ${nutCount===1?'the nut':'both archived nuts'} exceed the available threaded length.`);
  if(reach<=s.frame_edge_x)issues.push('The latch arm does not overlap the frame.');
  if(s.frame_edge_x<=Math.max((p.major_d+p.foot_extra_d)/2,nutRadius))issues.push('The frame intrudes into the mounting envelope.');
  if(footBearing<=0)issues.push('The body foot does not cover the mounting hole.');
  return {settings:s,reference_only:true,nuts,threaded_length_mm:end,mount_stack_height_mm:stackTop,
    mounting_fit:stackTop<=end,issues,nominal_latch_overlap_mm:reach-s.frame_edge_x,
    frame_catch_z:frameBack,body_foot_bearing_width_mm:footBearing,
    door:{id:'door',name:'Example door panel',color:'#d5dedc',left:-90,right:doorRight,bottom:-60,top:60,
      thickness:s.door_thickness,hole_diameter:hole,anchor:[-65,0,s.door_thickness/2]},
    frame:{id:'frame',name:'Example frame jamb',color:'#73898a',min:[s.frame_edge_x,-70,-2],max:[s.frame_edge_x+18,70,frameBack],anchor:[s.frame_edge_x+18,0,frameBack/2]}};
}
export function exampleLatchState(p,layout,angleDeg) {
  const r=(p.inner_d-2*p.insert_radial_clearance)/2,reach=p.latch_reach??p.upper_stop_x;
  const armX=r+Math.max(0,(reach-r)*Math.cos(angleDeg*Math.PI/180));
  const overlap=armX-layout.settings.frame_edge_x;
  return {overlap_mm:overlap,latched:overlap>0};
}
