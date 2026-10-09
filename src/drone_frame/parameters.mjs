const points = new Set(['motor_mount_points', 'esc_mount_points', 'carrier_support_points', 'controller_mount_points', 'legacy_carrier_holes', 'imu_mount_points']);
const nonnegative = new Set(['body_corner_radius', 'motor_center_relief_diameter', 'desired_body_tip_gap', 'desired_prop_tip_gap', 'prop_deflection_allowance', 'brim_width', 'brim_separation', 'separate_skirt_loops', 'skirt_distance', 'motor_engagement_min', 'motor_engagement_max', 'motor_washer_thickness', 'controller_underside_projection', 'controller_antenna_length', 'controller_antenna_margin', 'controller_opposite_access_length', 'carrier_width_override', 'carrier_length_override', 'carrier_extra_height', 'upper_arm_tip_clearance']);
export const referenceChoices = {
  radio_module: ['esp32_s3_wroom1_module'],
  power_connector: ['xt60_m_reference', 'xt60_f_reference']
};

export function validateParameters(values, config) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Expected model parameters.');
  const keys = Object.keys(config.defaults);
  if (Object.keys(values).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(values, key))) throw new Error('The model link needs a complete, supported configuration.');
  const bounds = new Map(config.groups.flatMap(group => group.fields.map(field => [field.key, field])));
  const p = structuredClone(values);
  for (const [key, value] of Object.entries(p)) {
    const original = config.defaults[key];
    if (key === 'component_references') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid component references.');
      for (const [slot, setting] of Object.entries(value)) {
        if (!referenceChoices[slot] || !setting || typeof setting !== 'object' || Array.isArray(setting) || !referenceChoices[slot].includes(setting.model_id) || Object.keys(setting).some(key => !['model_id', 'position', 'rotation'].includes(key))) throw new Error('Only approved module and connector references are available.');
        for (const key of ['position', 'rotation']) {
          if (!Array.isArray(setting[key]) || setting[key].length !== 3 || setting[key].some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > (key === 'position' ? 500 : 360))) throw new Error(`Reference ${key} needs three bounded finite numbers.`);
        }
      }
    } else if (points.has(key)) {
      if (!Array.isArray(value) || value.length > 32 || value.some(point => !Array.isArray(point) || point.length !== 2 || point.some(x => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 200))) throw new Error(`${key} needs at most 32 finite [x, y] points.`);
    } else if (typeof original === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${key} must be true or false.`);
    } else if (typeof original === 'string') {
      const choices = key === 'frame_variant' ? ['drone_frame_v1', 'drone_frame_v0'] : key === 'controller_mount_style' ? ['integrated_under', 'separate_above'] : key === 'upper_arm_joint_style' ? ['keyed', 'bolted', 'contact_only'] : Object.keys(config.controllers);
      if (!choices.includes(value)) throw new Error(`Unsupported ${key}.`);
    } else {
      const field = bounds.get(key);
      const low = field?.min ?? (key.includes('center_') || key.endsWith('rotation_z') ? -200 : nonnegative.has(key) ? 0 : 0.000001);
      const high = field?.max ?? 250;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw new Error(`${key} must be between ${low} and ${high}.`);
    }
  }
  const require = (test, message) => { if (!test) throw new Error(message); };
  require(p.body_corner_radius < Math.min(p.plate_width, p.plate_length) / 2, 'Body radius must fit the body.');
  require(p.root_outer_s > p.root_inner_s && p.root_outer_s < Math.hypot(p.motor_x_offset, p.motor_y_offset), 'Root taper must end before the motor centers.');
  require(Number.isInteger(p.separate_skirt_loops), 'Skirt loops must be an integer.');
  if (!(p.frame_variant === 'drone_frame_v1' && p.motor_recess_enabled)) require(p.motor_pad_diameter >= p.motor_envelope_diameter, 'Legacy motor pads must fit the motor envelopes.');
  require(!p.motor_engagement_max || p.motor_engagement_min <= p.motor_engagement_max, 'Motor engagement limits are reversed.');
  require(p.carrier_standoff_diameter > p.carrier_support_hole_diameter + 2 && p.carrier_fastener_head_diameter > p.carrier_support_hole_diameter && p.carrier_support_boss_diameter >= p.carrier_fastener_head_diameter + 2, 'Carrier fasteners need sufficient wall and head clearance.');
  require(p.controller_pcb_thickness < p.esp32_size_z && p.controller_edge_overlap < p.esp32_size_y / 2, 'Controller envelope and support overlap must fit the PCB.');
  require(p.prop_nut_bore_diameter < p.prop_nut_across_flats * 0.9, 'Prop nut bore must leave material.');
  if (p.frame_variant === 'drone_frame_v1') {
    if (p.motor_recess_enabled) {
      require(p.motor_platform_thickness <= p.frame_thickness, 'Motor platform must not be thicker than the lower base.');
      require(p.motor_head_pocket_diameter >= p.motor_bolt_head_diameter + 0.1 && p.motor_head_pocket_depth >= p.motor_bolt_head_height, 'Head pockets must clear and fully recess the measured bolt heads.');
      require(p.motor_platform_thickness - p.motor_head_pocket_depth >= 2, 'Leave at least 2 mm above head pockets.');
      require(p.motor_bolt_total_length > p.motor_bolt_head_height, 'Bolt total length must exceed its head height.');
      require(p.motor_mount_points.every(([x, y]) => Math.hypot(x, y) - p.motor_head_pocket_diameter / 2 - p.motor_center_relief_diameter / 2 >= 0.5), 'Head pockets need at least 0.5 mm web to shaft relief.');
    }
    require(!(p.lower_arm_braces && p.upper_arm_extensions), 'Use base-grown lower ribs or legacy upper arms, not both.');
    require(p.lower_arm_brace_reach > 0 && p.lower_arm_brace_reach <= 1, 'Lower-rib reach must be greater than zero and at most one.');
    if (p.lower_arm_braces) require(Math.hypot(p.motor_x_offset, p.motor_y_offset) - p.motor_pad_diameter / 2 - p.lower_arm_brace_pad_gap > p.root_side_end + 1, 'Lower ribs need room before the motor pads.');
    require(p.root_side_start < p.root_side_end && p.root_side_end <= p.upper_lobe_station && p.root_side_thickness < p.arm_width / 2, 'Root webs must fit within the upper lobes.');
    require(p.root_side_start < p.root_boss_station - p.root_boss_diameter / 2 && p.root_boss_station + p.root_boss_diameter / 2 < p.root_side_end, 'Root boss must fit between the web ends.');
    require(p.root_boss_diameter >= p.root_hole_diameter + 3 && Math.max(p.root_washer_diameter, p.root_head_diameter, p.root_nut_across_flats / Math.cos(Math.PI / 6)) <= p.root_boss_diameter && p.root_tool_diameter <= p.arm_width, 'Root fasteners need sufficient material and tool access.');
    require(p.joint_groove_depth > p.joint_lip_height && p.joint_groove_depth < p.upper_deck_thickness - 1, 'Groove must clear the lip and retain deck thickness.');
    require(p.root_side_start <= p.joint_lip_start && p.joint_lip_start < p.joint_lip_end && p.joint_lip_end <= p.root_side_end, 'Locating lips must stay on the webs.');
    require(p.joint_lip_center - p.joint_lip_width / 2 >= p.arm_width / 2 - p.root_side_thickness - 1e-6 && p.joint_lip_center + p.joint_lip_width / 2 + p.joint_clearance <= p.arm_width / 2 - 1, 'Lip grooves need at least 1 mm outer wall.');
    require(p.upper_arm_end_station > p.upper_lobe_station && p.upper_arm_shoe_height < p.clear_bay_height, 'Shoe must lie outward of the roof and below its underside.');
    if (p.upper_arm_extensions) {
      require(p.upper_arm_end_station <= Math.hypot(p.motor_x_offset, p.motor_y_offset) - p.motor_pad_diameter / 2 - p.upper_motor_pad_gap && p.upper_arm_end_station - p.upper_arm_contact_length > p.root_side_end + p.joint_clearance, 'Shoes must fit beyond the braces and before the motor pads.');
      if (p.upper_arm_joint_style === 'keyed') require(p.upper_arm_key_length + 2 * p.upper_arm_key_clearance + 3 <= p.upper_arm_contact_length && p.upper_arm_key_width + 2 * p.upper_arm_key_clearance + 3 <= p.arm_width && p.upper_arm_key_height + p.upper_arm_key_clearance + 2 <= p.upper_arm_shoe_height, 'Key pockets need sufficient pad material.');
      if (p.upper_arm_joint_style === 'bolted') require(p.upper_arm_bolt_head_diameter >= p.upper_arm_bolt_diameter + 2 && p.upper_arm_bolt_head_diameter + 3 <= Math.min(p.upper_arm_contact_length, p.arm_width) && p.upper_arm_shoe_height - p.upper_arm_bolt_head_height >= 2, 'Pad bolt seats need sufficient wall and thickness.');
    }
    if (p.imu_mount_enabled) require(p.imu_mount_points.every(([x, y]) => Math.abs(x) + p.imu_mount_hole_diameter / 2 + 1 <= p.imu_size_x / 2 && Math.abs(y) + p.imu_mount_hole_diameter / 2 + 1 <= p.imu_size_y / 2), 'IMU holes need 1 mm edge clearance.');
  }
  return p;
}

export function modelLink(address, parameters, config) {
  const p = validateParameters(parameters, config);
  const url = new URL(address);
  url.search = '';
  url.hash = `drone-v1=${encodeURIComponent(JSON.stringify(p))}`;
  return url.href;
}

export function readLink(address, config) {
  const hash = new URL(address).hash;
  if (!hash) return structuredClone(config.defaults);
  if (!hash.startsWith('#drone-v1=') || hash.length > 32768) throw new Error('Unsupported or oversized drone model link.');
  const values = JSON.parse(decodeURIComponent(hash.slice(10)));
  // Old shared links retain their original flat motor pads rather than adopting the new recesses.
  if (values && typeof values === 'object' && !Object.hasOwn(values, 'motor_recess_enabled') && Object.hasOwn(values, 'frame_variant')) {
    for (const key of ['motor_recess_enabled', 'motor_platform_thickness', 'motor_bolt_total_length', 'motor_bolt_head_height', 'motor_bolt_head_diameter', 'motor_head_pocket_diameter', 'motor_head_pocket_depth', 'motor_head_rim']) values[key] = key === 'motor_recess_enabled' ? false : config.defaults[key];
  }
  if (values && typeof values === 'object' && !Object.hasOwn(values, 'under_controller_ties_enabled') && Object.hasOwn(values, 'frame_variant')) {
    for (const key of ['under_controller_ties_enabled', 'under_tie_slot_length', 'under_tie_slot_width', 'under_tie_edge_gap']) values[key] = key === 'under_controller_ties_enabled' ? false : config.defaults[key];
  }
  return validateParameters(values, config);
}
