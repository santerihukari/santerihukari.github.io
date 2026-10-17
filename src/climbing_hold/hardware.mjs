export const BOLT=Object.freeze({
  name:'IKH PUK10040109A M10x40 10.9 countersunk',
  source:'https://www.ikh.fi/fi/kuusiokoloruuvi-m10x40-10-9-10kpl-uppo-din7991-puk10040109a',
  diameter:10,pitch:1.5,length:40,head:22.4,headHeight:6.2,angle:90,hex:6,propertyClass:'10.9'
});
export const WOOD_SCREW=Object.freeze({
  name:'5 mm / TX25 countersunk wood screw (provisional reference)',
  source:'https://essve.com/en/products/construction-and-wood-screws/wood-screws/countersunk/wood-screw-c4-countersunk-head-c4-surface-treatment/wood-screw-cs-5-0x50-c4',
  diameter:5,head:10,angle:90,confirmed:false
});

export function seatDimensions(hole){
  const coneDepth=(hole.head-hole.bore)/2/Math.tan(hole.angle*Math.PI/360);
  return {bore_mm:hole.bore,access_diameter_mm:hole.head,countersink_angle_degrees:hole.angle,
    countersink_depth_mm:coneDepth,web_mm:hole.web,mouth_from_wall_mm:hole.web+coneDepth};
}

export function boltPlacement(hole){
  if(hole.head<BOLT.head||hole.bore<BOLT.diameter||Math.abs(hole.angle-BOLT.angle)>1e-7)return null;
  // At equal 90-degree angles the head bears on the cone, not the recess lip.
  const headTop=hole.web+(BOLT.head-hole.bore)/2;
  return {reference:BOLT,head_top_from_wall_mm:headTop,head_bottom_from_wall_mm:headTop-BOLT.headHeight,
    tip_from_wall_mm:headTop-BOLT.length,projection_behind_hold_mm:BOLT.length-headTop,
    wall_and_tnut_engagement_verified:false};
}
