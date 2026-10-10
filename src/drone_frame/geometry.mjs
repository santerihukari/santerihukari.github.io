import { validateParameters } from './parameters.mjs';

const rad = Math.PI / 180;
export const rotateXY = (x, y, angle) => [x * Math.cos(angle * rad) - y * Math.sin(angle * rad), x * Math.sin(angle * rad) + y * Math.cos(angle * rad)];
const length = (x, y) => Math.hypot(x, y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const motorCenters = p => Object.fromEntries([['front_right', 1, 1], ['front_left', -1, 1], ['rear_left', -1, -1], ['rear_right', 1, -1]].map(([name, x, y]) => [`motor_${name}`, [x * p.motor_x_offset, y * p.motor_y_offset]]));
export const motorPadActive = p => p.frame_variant === 'drone_frame_v1' && (p.motor_compact_pad || p.motor_recess_enabled);
export const motorMountZ = p => motorPadActive(p) ? p.motor_platform_thickness : p.frame_thickness;

export function rotorEnvelope(p, config) {
  const plane = motorMountZ(p) + (p.prop_seat_on_shaft ? config.datums.motor_seat_z - config.datums.hub_seat_z : p.prop_plane_above_mount);
  const offsets = config.datums.prop_bounds_offset_mm;
  return { plane, radius: Math.max(p.prop_diameter / 2, config.datums.prop_reference_radius_mm), minimum: plane + Math.min(-p.prop_blade_thickness / 2, offsets[0]) - p.prop_deflection_allowance, maximum: plane + Math.max(p.prop_blade_thickness / 2, offsets[1]) + p.prop_deflection_allowance };
}

export function cableSlotGeometry(p) {
  const outer = p.arm_width / 2 - p.root_side_thickness, inner = outer - p.motor_cable_port_width;
  const bottom = p.frame_thickness + p.motor_cable_port_floor, top = p.frame_thickness + p.clear_bay_height;
  return { s_range: [p.root_boss_station - p.root_boss_diameter / 2 - 1, p.root_boss_station + p.root_boss_diameter / 2 + 1], t_range: [inner, outer], bottom_z: bottom, top_z: top, cut_top_z: top + p.joint_lip_height + 0.05, center_t: (inner + outer) / 2, open_top: true, usable_height_mm: top - bottom, boss_clearance_mm: inner - p.root_boss_diameter / 2, bolt_wall_mm: inner - p.root_hole_diameter / 2, full_bolt_boss_protected: inner >= p.root_boss_diameter / 2 + p.motor_cable_boss_clearance - 1e-6 };
}

export function cableSlotReport(p) {
  if (p.frame_variant !== 'drone_frame_v1' || !p.motor_cable_ports_enabled) return { enabled: false };
  const g = cableSlotGeometry(p), d = p.motor_cable_wire_diameter, first = g.bottom_z + d / 2 + 0.1, step = (d + p.motor_cable_wire_gap) / 2;
  const candidates = { triangle: [[g.center_t - step, first], [g.center_t + step, first], [g.center_t, first + Math.sqrt(3) * step]], vertical_stack: [0, 1, 2].map(i => [g.center_t, first + i * (d + p.motor_cable_wire_gap)]) };
  const clearance = wires => Math.min(...wires.map(([t, z]) => Math.min(t - g.t_range[0], g.t_range[1] - t, z - g.bottom_z, g.top_z - z) - d / 2));
  const [packing, wires] = Object.entries(candidates).reduce((best, item) => clearance(item[1]) > clearance(best[1]) ? item : best);
  const gap = clearance(wires), z = wires.reduce((sum, [, height]) => sum + height, 0) / 3;
  const routes = Object.entries(motorCenters(p)).map(([motor, [mx, my]]) => {
    const world = (s, t, height) => [...rotateXY(s, t, Math.atan2(my, mx) / rad), height];
    return { motor, port_entry: world(g.s_range[0], g.center_t, z), port_exit: world(g.s_range[1], g.center_t, z), local_wire_centers_tz: wires, guide_points: [world(28, g.center_t, z), world(g.s_range[0], g.center_t, z), world(g.s_range[1], g.center_t, z), world(Math.hypot(mx, my) - p.motor_pad_diameter / 2 - 3, 0, z)] };
  });
  return { enabled: true, ...g, count: 4, nominal_wire_outer_diameter_mm: d, nominal_three_wire_clearance_mm: gap, nominal_wire_fit: gap >= 0 ? 'pass' : 'fail', nominal_wire_packing: packing, routes, status: gap >= 0 ? 'unresolved' : 'fail', note: 'Open-top slots accept already-soldered leads before the upper deck is fitted. The full bolt bosses and outer H-webs remain uncut. Wire dimensions, bends, retention, pinching and root strength require physical testing.' };
}

function printFootprint(p, mesh) {
  const xy = Array.from({ length: mesh.positions.length / 3 }, (_, i) => rotateXY(mesh.positions[i * 3], mesh.positions[i * 3 + 1], p.print_rotation_z));
  const size = [0, 1].map(axis => Math.max(...xy.map(point => point[axis])) - Math.min(...xy.map(point => point[axis])));
  const extension = (p.brim_width ? p.brim_width + p.brim_separation : 0) + (p.separate_skirt_loops ? p.skirt_distance + p.separate_skirt_loops * p.skirt_line_width : 0);
  const required = size.map(v => v + 2 * extension), margins = [(p.printer_bed_width - required[0]) / 2, (p.printer_bed_depth - required[1]) / 2], height = mesh.bounds[1][2] - mesh.bounds[0][2];
  return { status: margins.every(v => v >= -1e-6) && height <= p.printer_height ? 'pass' : 'fail', mesh_xy_mm: size, required_xy_mm: required, centered_margins_mm: margins, height_mm: height, rotation_z_deg: p.print_rotation_z };
}

export function constrainedProfile(start, end, top, base, constraints) {
  if (end <= start || top <= base) throw new Error('Lower ribs need outward reach and positive root height.');
  for (const [entry, ceiling] of constraints) {
    if (ceiling <= base) throw new Error('Blade envelope leaves no height above the base for lower ribs.');
    if (entry <= start + 1e-6 && ceiling < top - 1e-6) throw new Error('Blade envelope reaches the tall root; change root reach or prop geometry.');
  }
  const limits = constraints.filter(([entry, ceiling]) => ceiling < top && entry > start);
  const stations = [...new Set([start, end, ...limits.map(([entry]) => entry).filter(entry => entry > start && entry < end)])].sort((a, b) => a - b);
  const points = new Set(stations), slope = (base - top) / (end - start), nominal = [slope, top - slope * start];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1], lines = [nominal, ...limits.map(([entry, ceiling]) => { const m = (ceiling - top) / (entry - start); return a < entry ? [m, top - m * start] : [0, ceiling]; })];
    for (let j = 0; j < lines.length; j++) for (const [m2, c2] of lines.slice(j + 1)) { const [m1, c1] = lines[j]; if (Math.abs(m1 - m2) < 1e-12) continue; const x = (c2 - c1) / (m1 - m2); if (a + 1e-8 < x && x < b - 1e-8) points.add(x); }
  }
  const profile = [];
  for (const x of [...points].sort((a, b) => a - b)) {
    const z = Math.min(nominal[0] * x + nominal[1], ...limits.map(([entry, ceiling]) => top + (ceiling - top) * Math.min(1, (x - start) / (entry - start))));
    profile.push([x, z]);
    while (profile.length >= 3) { const [a, b, c] = profile.slice(-3); if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-8) break; profile.splice(-2, 1); }
  }
  profile[profile.length - 1] = [end, base]; return profile;
}

export function upperArmPath(p) {
  const start = p.upper_lobe_station, end = p.upper_arm_end_station;
  const bottom = p.frame_thickness + p.clear_bay_height, top = bottom + p.upper_deck_thickness;
  const shoe = p.frame_thickness + p.upper_arm_shoe_height;
  const k = (top - shoe) / (end - start), r = p.upper_arm_inside_radius, norm = Math.hypot(k, 1);
  const cz = shoe + r, cs = (bottom + k * start - cz - r * norm) / k;
  const a = Math.atan2(1, k), arcStart = [cs + r * k / norm, cz + r / norm], arcEnd = [cs, cz - r];
  if (arcEnd[0] <= end - p.upper_arm_contact_length || arcStart[0] >= end) throw new Error('Inside fillet must fit between shoe edges.');
  const arc = Array.from({ length: 129 }, (_, i) => { const angle = a + (-Math.PI / 2 - a) * i / 128; return [cs + r * Math.cos(angle), cz + r * Math.sin(angle)]; });
  return { points: [[start - 1, bottom], [start, bottom], ...arc, [end - p.upper_arm_contact_length, shoe], [end - p.upper_arm_contact_length, p.frame_thickness], [end, p.frame_thickness], [end, shoe], [start, top], [start - 1, top]], arcStart, arcEnd, top, bottom, shoe };
}

// Mirrors the Python generator's planar sections, boolean operations and print datums.
export function buildDrone(module, values, config) {
  const p = validateParameters(values, config), owned = [];
  const own = value => { owned.push(value); return value; };
  const C = module.CrossSection, M = module.Manifold;
  const sq = (size, center = [0, 0]) => own(own(C.square(size, true)).translate(center));
  const circle = (radius, center = [0, 0], segments = 96) => own(own(C.circle(radius, segments)).translate(center));
  const poly = points => own(C.ofPolygons([points]));
  const union = list => own(C.union(list));
  const add = (a, b) => own(a.add(b));
  const sub = (a, b) => own(a.subtract(b));
  const intersect = (a, b) => own(a.intersect(b));
  const shift = (a, v) => own(a.translate(v));
  const rotate = (a, degrees) => own(a.rotate(degrees));
  const extrude = (section, height, z = 0) => shift(own(section.extrude(height)), [0, 0, z]);
  const simple = solid => own(solid.simplify(0.00001));
  const centers = motorCenters(p), radius = length(p.motor_x_offset, p.motor_y_offset);
  const v1 = p.frame_variant === 'drone_frame_v1', under = v1 && p.controller_mount_style === 'integrated_under', integrated = under && p.carrier_enabled;
  const top = v1 && p.controller_mount_style === 'integrated_top' && p.carrier_enabled, separate = p.carrier_enabled && !integrated && !top;
  const lowerLength = v1 && p.lower_body_length ? p.lower_body_length : p.plate_length;
  const compact = motorPadActive(p);
  const recessed = v1 && p.motor_recess_enabled, mountZ = motorMountZ(p);
  const motorPoints = p.motor_mount_points.map(xy => rotateXY(...xy, p.motor_rotation_z));
  const motorPad = () => union([circle(p.motor_pad_diameter / 2, [0, 0], 128), ...(recessed ? motorPoints.map(xy => circle(p.motor_head_pocket_diameter / 2 + p.motor_head_rim, xy)) : [])]);
  const roofBottom = p.frame_thickness + p.clear_bay_height, roofTop = roofBottom + p.upper_deck_thickness;
  const atBoard = a => shift(rotate(a, p.esp32_rotation_z), [p.esp32_center_x, p.esp32_center_y]);
  const atLocal = (name, s0, s1, t0, t1) => { const [x, y] = centers[name]; return rotate(sq([s1 - s0, t1 - t0], [(s0 + s1) / 2, (t0 + t1) / 2]), Math.atan2(y, x) / rad); };
  const sectionFor = part => part.shape === 'cylinder' ? circle(part.size[0] / 2, part.center.slice(0, 2)) : shift(rotate(sq(part.size.slice(0, 2)), part.rotation_z), part.center.slice(0, 2));
  function rounded(h = p.plate_length) {
    const w = p.plate_width, r = p.body_corner_radius;
    return !r ? sq([w, h]) : union([sq([w - 2 * r, h]), sq([w, h - 2 * r]), ...[-1, 1].flatMap(x => [-1, 1].map(y => circle(r, [x * (w / 2 - r), y * (h / 2 - r)], 128)))]);
  }
  let outline;
  const lowerParts = Object.entries(centers).map(([name, [x, y]]) => ({ name, shape: 'cylinder', center: [x, y, mountZ + p.motor_envelope_height / 2], size: [p.motor_envelope_diameter, p.motor_envelope_diameter, p.motor_envelope_height], rotation_z: p.motor_rotation_z, color: config.colors[name], label: name.replaceAll('_', ' ') }));
  for (const [name, prefix, bottom] of [['esc', 'esc', p.frame_thickness + p.esc_standoff_height], ['battery', 'battery', -p.battery_underside_gap - p.battery_size_z], ['imu', 'imu', p.frame_thickness + p.small_board_standoff_height], ['bec_placeholder', 'bec', p.frame_thickness + p.small_board_standoff_height]]) {
    const size = ['x', 'y', 'z'].map(axis => p[`${prefix}_size_${axis}`]);
    lowerParts.push({ name, label: name === 'bec_placeholder' ? 'Regulator' : name.toUpperCase(), shape: 'box', center: [p[`${prefix}_center_x`], p[`${prefix}_center_y`], bottom + size[2] / 2], size, rotation_z: p[`${prefix}_rotation_z`], color: config.colors[name] });
  }
  const antenna = p.controller_antenna_length ? atBoard(sq([p.controller_antenna_length + 2 * p.controller_antenna_margin, p.esp32_size_y + 2 * p.controller_antenna_margin], [p.esp32_size_x / 2 - p.controller_antenna_length / 2, 0])) : null;
  let underGeometry, topGeometry, keeperGeometry, carrier;
  function topside() {
    if (topGeometry) return topGeometry;
    const c = p.carrier_board_clearance, t = p.carrier_wall_thickness, sx = p.esp32_size_x, sy = p.esp32_size_y;
    const start = -sx / 2 + p.controller_access_end_length, end = sx / 2 - Math.max(p.controller_opposite_access_length, p.controller_antenna_length ? p.controller_antenna_length + p.controller_antenna_margin : 0);
    if (end - start < 8) throw new Error('USB/antenna allowances leave too little top rail length.');
    const pcb = roofTop + p.controller_underside_projection + p.carrier_pin_clearance + p.carrier_extra_height, seat = pcb - Math.min(p.under_mount_header_seat_depth, p.controller_underside_projection), ledgeBottom = seat - p.under_mount_ledge_thickness;
    if (ledgeBottom < roofTop) throw new Error('Top header support intersects the roof; increase pin clearance.');
    let rails = union([-1, 1].map(sign => sq([end - start, t], [(start + end) / 2, sign * (sy / 2 + c + t / 2)])));
    let ledges = union([-1, 1].map(sign => { const width = t + c + p.controller_edge_overlap; return sq([end - start, width], [(start + end) / 2, sign * (sy / 2 - p.controller_edge_overlap + width / 2)]); }));
    if (p.controller_antenna_length) {
      const rf = sq([p.controller_antenna_length + 2 * p.controller_antenna_margin, sy + 2 * p.controller_antenna_margin], [sx / 2 - p.controller_antenna_length / 2, 0]);
      rails = sub(rails, rf); ledges = sub(ledges, rf);
    }
    rails = atBoard(rails); ledges = atBoard(ledges);
    const solid = add(extrude(rails, pcb + p.controller_pcb_thickness - roofTop + 0.01, roofTop - 0.01), extrude(ledges, p.under_mount_ledge_thickness, ledgeBottom));
    const reliefLength = p.controller_antenna_length + p.controller_access_end_length;
    const relief = p.controller_antenna_length ? atBoard(sq([reliefLength, sy + 2 * c], [sx / 2 - p.controller_antenna_length + reliefLength / 2, 0])) : null;
    return topGeometry = { solid: simple(solid), pcb, rails, ledges, relief, start, end };
  }
  function underside() {
    if (underGeometry) return underGeometry;
    const c = p.carrier_board_clearance, t = p.carrier_wall_thickness, sx = p.esp32_size_x, sy = p.esp32_size_y;
    const start = -sx / 2 + p.controller_access_end_length;
    let end = sx / 2 - Math.max(p.controller_opposite_access_length, p.controller_antenna_length ? p.controller_antenna_length + p.controller_antenna_margin : 0);
    if (p.under_keeper_opposite_end) end = Math.min(end, sx / 2 - p.under_keeper_length - 0.1);
    if (end - start < 8) throw new Error('USB/antenna allowances leave too little underside rail length.');
    const pcb = roofBottom - p.controller_roof_gap - p.esp32_size_z, seat = pcb - Math.min(p.under_mount_header_seat_depth, p.controller_underside_projection), bottom = seat - p.under_mount_ledge_thickness;
    if (bottom <= p.frame_thickness) throw new Error('Controller rails reach the lower frame; increase bay height.');
    let rails = union([-1, 1].map(sign => sq([end - start, t], [(start + end) / 2, sign * (sy / 2 + c + t / 2)])));
    let ledges = union([-1, 1].map(sign => { const width = t + c + p.controller_edge_overlap; return sq([end - start, width], [(start + end) / 2, sign * (sy / 2 - p.controller_edge_overlap + width / 2)]); }));
    if (antenna) { const localRF = sq([p.controller_antenna_length + 2 * p.controller_antenna_margin, sy + 2 * p.controller_antenna_margin], [sx / 2 - p.controller_antenna_length / 2, 0]); rails = sub(rails, localRF); ledges = sub(ledges, localRF); }
    let solid = add(extrude(rails, roofBottom - seat, seat), extrude(add(rails, ledges), p.under_mount_ledge_thickness, bottom));
    solid = shift(rotate(solid, [0, 0, p.esp32_rotation_z]), [p.esp32_center_x, p.esp32_center_y, 0]);
    const reliefLength = p.controller_antenna_length + p.controller_access_end_length;
    const relief = p.controller_antenna_length ? atBoard(sq([reliefLength, sy + 2 * c], [sx / 2 - p.controller_antenna_length + reliefLength / 2, 0])) : null;
    underGeometry = { solid: simple(solid), pcb, bottom, rails: atBoard(rails), ledges: atBoard(ledges), relief, start, end };
    return underGeometry;
  }
  function controllerTies() {
    if (!(integrated || top) || !p.under_controller_ties_enabled) return { enabled: false, slots: [], stations: [], section: union([]) };
    const g = top ? topside() : underside(), length = g.end - g.start;
    if (length < 2 * p.under_tie_slot_length + 2) throw new Error('Controller rail length is too short for two tie loops; reduce slot length or disable roof ties.');
    const stations = [g.start + length / 4, g.end - length / 4], y = p.esp32_size_y / 2 + p.carrier_board_clearance + p.carrier_wall_thickness + p.under_tie_edge_gap + p.under_tie_slot_width / 2;
    const slots = stations.flatMap(station => [-1, 1].map(sign => { const local = [station, sign * y], xy = rotateXY(...local, p.esp32_rotation_z); return { center: [xy[0] + p.esp32_center_x, xy[1] + p.esp32_center_y], size: [p.under_tie_slot_length, p.under_tie_slot_width], rotation_z: p.esp32_rotation_z, board_local_center: local }; }));
    return { enabled: true, slots, stations, section: union(slots.map(slot => shift(rotate(sq(slot.size), slot.rotation_z), slot.center))) };
  }
  function keepers() {
    if (keeperGeometry) return keeperGeometry;
    const g = underside(), c = p.carrier_board_clearance, t = p.carrier_wall_thickness;
    const sx = p.esp32_size_x, sy = p.esp32_size_y, thickness = p.under_keeper_thickness;
    const pcbTop = g.pcb + p.controller_pcb_thickness, top = pcbTop + thickness;
    if (top + 0.2 >= roofBottom || p.under_keeper_boss_diameter < p.under_keeper_hole_diameter + 3 || p.under_keeper_length + c >= p.controller_access_end_length) throw new Error('Keeper clips need roof clearance, fastener wall and USB-end space.');
    const x0 = -sx / 2 - c - thickness, x1 = -sx / 2 + p.under_keeper_length, screwX = (x0 + x1) / 2;
    const bossY = sy / 2 + c + t + p.under_keeper_boss_diameter / 2;
    const clips = [], bosses = [], holes = [], sections = [];
    for (const end of p.under_keeper_opposite_end ? [-1, 1] : [-1]) for (const sign of [-1, 1]) {
      const mirror = -end, inner = sy / 2 - p.controller_edge_overlap, outer = bossY + p.under_keeper_boss_diameter / 2;
      const section = sq([x1 - x0, outer - inner], [mirror * (x0 + x1) / 2, sign * (outer + inner) / 2]);
      const outside = sq([x1 - x0, outer - sy / 2 - c], [mirror * (x0 + x1) / 2, sign * (outer + sy / 2 + c) / 2]);
      const stop = sq([thickness, outer - inner], [end * (sx / 2 + c + thickness / 2), sign * (outer + inner) / 2]);
      let clip = add(add(extrude(section, p.under_mount_ledge_thickness, g.bottom), extrude(section, thickness, pcbTop)), extrude(add(outside, stop), top - g.bottom, g.bottom));
      clip = shift(rotate(clip, [0, 0, p.esp32_rotation_z]), [p.esp32_center_x, p.esp32_center_y, 0]);
      const hole = atBoard(circle(p.under_keeper_hole_diameter / 2, [mirror * screwX, sign * bossY], 64));
      clips.push(simple(sub(clip, extrude(hole, top - g.bottom + 2, g.bottom - 1))));
      holes.push(hole); bosses.push(atBoard(sq([x1 - x0, p.under_keeper_boss_diameter], [mirror * screwX, sign * bossY]))); sections.push(atBoard(section));
    }
    keeperGeometry = { clips, bosses: union(bosses), holes: union(holes), bossBottom: top + 0.2, rfOverlap: antenna && sections.some(section => intersect(section, antenna).area() > 1e-6) };
    return keeperGeometry;
  }
  function carrierGeometry() {
    if (carrier) return carrier;
    const c = p.carrier_board_clearance, t = p.carrier_wall_thickness, sx = p.esp32_size_x, sy = p.esp32_size_y;
    let start = -sx / 2 + p.controller_access_end_length;
    const end = sx / 2 - Math.max(p.controller_opposite_access_length, p.controller_antenna_length ? p.controller_antenna_length + p.controller_antenna_margin : 0), accessStart = start;
    if (end - start < 2 * t + 3) throw new Error('Controller openings leave too little carrier length.');
    const width = Math.max(sy + 2 * (c + t), p.carrier_width_override), depth = Math.max(end - start, p.carrier_length_override);
    start = end - depth;
    const mid = (start + end) / 2, tray = atBoard(sq([depth, width], [mid, 0]));
    const baseZ = v1 ? roofTop : null, supportOutline = v1 ? upperBody() : outline;
    const stack = p.esc_mount_points.map(point => { const [x, y] = rotateXY(...point, p.esc_rotation_z); return [x + p.esc_center_x, y + p.esc_center_y]; });
    const electronics = lowerParts.filter(part => part.shape === 'box' && part.name !== 'battery');
    const holeR = p.carrier_support_hole_diameter / 2, bossR = p.carrier_support_boss_diameter / 2, postR = p.carrier_standoff_diameter / 2;
    let candidates = p.carrier_support_points.length ? p.carrier_support_points : [...stack].sort((a, b) => rotateXY(a[0] - p.esp32_center_x, a[1] - p.esp32_center_y, -p.esp32_rotation_z)[0] - rotateXY(b[0] - p.esp32_center_x, b[1] - p.esp32_center_y, -p.esp32_rotation_z)[0]).slice(0, 2);
    if (!p.carrier_support_points.length) { const x = p.plate_width / 2 - holeR - 2.2; candidates = [...candidates, ...[0, ...[5, 10, 15, 20, 25, 30].flatMap(d => [-d, d])].flatMap(d => [-1, 1].map(sign => [sign * x, p.esp32_center_y + d]))]; }
    const supports = [];
    for (const xy of candidates) {
      if (supports.length >= 4 && !p.carrier_support_points.length) break;
      const kind = v1 ? 'upper_deck' : stack.some(point => length(point[0] - xy[0], point[1] - xy[1]) < 1e-5) ? 'esc_stack' : 'frame';
      const disk = circle(Math.max(bossR, p.carrier_fastener_head_diameter / 2) + 0.5, xy, 64);
      const blocked = antenna && intersect(disk, antenna).area() > 1e-6;
      const outside = sub(circle(holeR + 2, xy, 64), supportOutline).area() > 1e-6;
      const collides = kind !== 'esc_stack' && electronics.some(part => (!v1 || part.center[2] + part.size[2] / 2 > roofTop + 1e-6) && intersect(circle(postR + 1, xy, 64), sectionFor(part)).area() > 1e-6);
      const overlaps = supports.some(old => length(xy[0] - old.center[0], xy[1] - old.center[1]) < 2 * bossR + 1);
      if (blocked || outside || collides || overlaps) { if (p.carrier_support_points.length) throw new Error('Manual carrier supports intersect keepouts or insufficient material.'); continue; }
      supports.push({ center: xy, base: baseZ ?? (kind === 'esc_stack' ? p.frame_thickness + p.esc_standoff_height + p.esc_size_z : p.frame_thickness) });
    }
    if (supports.length < 3) throw new Error('Could not find three clear carrier supports.');
    const shapes = [tray], slots = [];
    for (const support of supports) {
      const xy = support.center, local = rotateXY(xy[0] - p.esp32_center_x, xy[1] - p.esp32_center_y, -p.esp32_rotation_z);
      const offset = rotateXY(clamp(local[0], start + t, end - t), clamp(local[1], -width / 2 + t / 2, width / 2 - t / 2), p.esp32_rotation_z);
      const target = [offset[0] + p.esp32_center_x, offset[1] + p.esp32_center_y], dx = target[0] - xy[0], dy = target[1] - xy[1], w = 2 * t + 2;
      shapes.push(circle(bossR, xy), shift(rotate(sq([length(dx, dy) + w, w]), Math.atan2(dy, dx) / rad), [(target[0] + xy[0]) / 2, (target[1] + xy[1]) / 2]));
    }
    for (const station of [start + depth * 0.3, start + depth * 0.65]) for (const sign of [-1, 1]) { const center = [station, sign * (width / 2 + 2)]; shapes.push(atBoard(sq([p.carrier_tie_width + 4, 7], center))); slots.push(atBoard(sq([p.carrier_tie_width, 2], center))); }
    let profile = sub(union(shapes), atBoard(sq([depth - 2 * t, sy - 2 * p.controller_edge_overlap], [mid, 0])));
    if (antenna) profile = sub(profile, antenna);
    profile = sub(profile, union([...supports.map(support => circle(holeR, support.center)), ...slots]));
    let rails = union([-1, 1].map(sign => atBoard(sq([end - accessStart, t], [(accessStart + end) / 2, sign * (sy / 2 + c + t / 2)]))));
    const ledgeWidth = t + c + p.controller_edge_overlap;
    let ledges = union([-1, 1].map(sign => atBoard(sq([end - accessStart, ledgeWidth], [(accessStart + end) / 2, sign * (sy / 2 - p.controller_edge_overlap + ledgeWidth / 2)]))));
    if (antenna) { rails = sub(rails, antenna); ledges = sub(ledges, antenna); }
    const contextualParts = v1 ? [...lowerParts, { shape: 'box', center: [0, 0, roofBottom + p.upper_deck_thickness / 2], size: [p.plate_width, p.plate_length, p.upper_deck_thickness], rotation_z: 0 }] : lowerParts;
    const occupied = add(profile, atBoard(sq([sx, sy]))), below = contextualParts.filter(part => intersect(occupied, sectionFor(part)).area() > 1e-6);
    const topBelow = Math.max(p.frame_thickness, ...below.map(part => part.center[2] + part.size[2] / 2));
    const seat = p.carrier_plate_thickness + p.controller_underside_projection + p.carrier_pin_clearance;
    let bottom = topBelow + p.carrier_clearance_below + p.carrier_extra_height;
    if (antenna) bottom = Math.max(bottom, Math.max(p.frame_thickness, ...contextualParts.filter(part => intersect(antenna, sectionFor(part)).area() > 1e-6).map(part => part.center[2] + part.size[2] / 2)) + p.controller_antenna_margin + 0.5 - seat);
    for (const support of supports) { support.height = bottom - support.base; if (support.height < 1) throw new Error('Carrier must clear support seats by at least 1 mm.'); const head = circle(p.carrier_fastener_head_diameter / 2, support.center); if (intersect(head, atBoard(sq([sx, sy]))).area() > 1e-6 && p.carrier_plate_thickness + p.carrier_fastener_head_height + 0.5 > seat) throw new Error('Carrier screw head reaches PCB underside.'); }
    const access = union(supports.map(support => circle(p.carrier_fastener_head_diameter / 2, support.center)));
    const wallTop = seat + p.controller_pcb_thickness + 0.5;
    const solid = simple(add(add(extrude(profile, p.carrier_plate_thickness), extrude(sub(rails, access), wallTop - p.carrier_plate_thickness, p.carrier_plate_thickness)), extrude(sub(ledges, access), 1, seat - 1)));
    if (p.controller_mount_points.length) throw new Error('This carrier has no verified board-hole adapter.');
    carrier = { solid, pcb: bottom + seat, bottom, supports };
    return carrier;
  }
  function upperBody() {
    let result = union([rounded(), ...Object.keys(centers).map(name => atLocal(name, 0, p.upper_lobe_station, -p.arm_width / 2, p.arm_width / 2))]);
    if (p.upper_arm_extensions) result = add(result, union(Object.keys(centers).map(name => armPlan(name, 0, p.upper_lobe_station))));
    return result;
  }
  const armPlan = (name, start, end) => intersect(outline, atLocal(name, start, end, -Math.max(p.arm_width, p.root_inner_width) / 2, Math.max(p.arm_width, p.root_inner_width) / 2));
  const jointStation = p.upper_arm_end_station - p.upper_arm_contact_length / 2;
  const jointCenters = Object.values(centers).map(([x, y]) => [x * jointStation / radius, y * jointStation / radius]);
  const keys = pocket => union(Object.keys(centers).map(name => { const c = pocket ? p.upper_arm_key_clearance : 0; return atLocal(name, jointStation - p.upper_arm_key_length / 2 - c, jointStation + p.upper_arm_key_length / 2 + c, -p.upper_arm_key_width / 2 - c, p.upper_arm_key_width / 2 + c); }));
  const lips = groove => union(Object.keys(centers).flatMap(name => [-1, 1].map(sign => { const c = groove ? p.joint_clearance : 0; return atLocal(name, p.joint_lip_start - c, p.joint_lip_end + c, sign * p.joint_lip_center - p.joint_lip_width / 2 - c, sign * p.joint_lip_center + p.joint_lip_width / 2 + c); })));
  try {
    const armShapes = Object.entries(centers).flatMap(([name, [mx, my]]) => {
      const angle = Math.atan2(my, mx) / rad;
      const padRadius = p.motor_pad_diameter / 2, end = compact ? radius - padRadius : radius;
      const blend = compact ? [rotate(poly([[end, -p.arm_width / 2], [radius, -padRadius], [radius, padRadius], [end, p.arm_width / 2]]), angle)] : [];
      return [rotate(poly([[0, -p.arm_width / 2], [end, -p.arm_width / 2], [end, p.arm_width / 2], [0, p.arm_width / 2]]), angle), ...blend, rotate(poly([[p.root_inner_s, -p.root_inner_width / 2], [p.root_outer_s, -p.arm_width / 2], [p.root_outer_s, p.arm_width / 2], [p.root_inner_s, p.root_inner_width / 2]]), angle), compact ? shift(motorPad(), centers[name]) : circle(p.motor_pad_diameter / 2, centers[name], 128)];
    });
    outline = union([rounded(lowerLength), ...armShapes]);
    const holes = [];
    for (const [name, [mx, my]] of Object.entries(centers)) {
      if (p.motor_center_relief_diameter) holes.push({ owner: name, center: [mx, my], diameter: p.motor_center_relief_diameter });
      for (const point of p.motor_mount_points) { const [dx, dy] = rotateXY(...point, p.motor_rotation_z); holes.push({ owner: name, center: [mx + dx, my + dy], diameter: p.motor_mount_hole_diameter }); }
    }
    for (const point of p.esc_mount_points) { const [dx, dy] = rotateXY(...point, p.esc_rotation_z); holes.push({ owner: 'esc', center: [p.esc_center_x + dx, p.esc_center_y + dy], diameter: p.esc_mount_hole_diameter }); }
    if (!v1 && p.carrier_enabled) for (const support of carrierGeometry().supports) if (support.base === p.frame_thickness) holes.push({ owner: 'carrier', center: support.center, diameter: p.carrier_support_hole_diameter });
    if (v1 && separate) for (const xy of p.legacy_carrier_holes) holes.push({ owner: 'legacy_carrier', center: xy, diameter: p.carrier_support_hole_diameter });
    if (v1 && p.upper_arm_extensions && p.upper_arm_joint_style === 'bolted') jointCenters.forEach(xy => holes.push({ owner: 'arm_pad', center: xy, diameter: p.upper_arm_bolt_diameter }));
    if (v1 && p.imu_mount_enabled) for (const point of p.imu_mount_points) { const xy = rotateXY(...point, p.imu_rotation_z); holes.push({ owner: 'imu', center: [p.imu_center_x + xy[0], p.imu_center_y + xy[1]], diameter: p.imu_mount_hole_diameter }); }
    const slots = [];
    const addSlots = (owner, prefix, points, size) => points.forEach(point => { const xy = rotateXY(...point, p[`${prefix}_rotation_z`]); slots.push({ owner, center: [p[`${prefix}_center_x`] + xy[0], p[`${prefix}_center_y`] + xy[1]], size, rotation_z: p[`${prefix}_rotation_z`] }); });
    if (p.generic_mounts_enabled) {
      if (!v1) addSlots('battery', 'battery', [-1, 1].flatMap(x => [-1, 1].map(y => [x * (p.battery_size_x / 2 + p.battery_slot_side_gap), y * (p.battery_size_y / 2 - p.battery_slot_end_inset)])), [p.battery_slot_width_x, p.battery_slot_length_y]);
      addSlots('esp32_s3', 'esp32', [-1, 1].flatMap(x => [-1, 1].map(y => [x * p.esp32_strap_x, y * (p.esp32_size_y / 2 + p.esp32_slot_gap_y)])), [p.esp32_slot_length_x, p.esp32_slot_width_y]);
      if (!(v1 && p.small_board_mounts)) for (const [name, prefix] of [['imu', 'imu'], ['bec_placeholder', 'bec']]) addSlots(name, prefix, [-1, 1].map(sign => [0, sign * (p[`${prefix}_size_y`] / 2 + p.small_board_slot_gap_y)]), [p.small_board_slot_length_x, p.small_board_slot_width_y]);
    }
    if (v1 && p.battery_ties_enabled) addSlots('battery', 'battery', [-1, 1].flatMap(x => [-1, 1].map(y => [x * (p.battery_size_x / 2 + p.battery_slot_side_gap), y * (p.battery_size_y / 2 - p.battery_slot_end_inset)])), [p.battery_slot_width_x, p.battery_slot_length_y]);
    if (v1 && p.small_board_mounts) for (const [name, prefix] of [['imu', 'imu'], ['bec_placeholder', 'bec']]) addSlots(name, prefix, [-1, 1].map(sign => [sign * (p[`${prefix}_size_x`] / 2 + p.small_board_tie_side_gap), 0]), [p.small_board_tie_slot_width, p.small_board_tie_slot_length]);
    const cuts = union([...holes.map(hole => circle(hole.diameter / 2, hole.center)), ...slots.map(sectionFor)]);
    let lower = extrude(sub(outline, cuts), p.frame_thickness), upper, roots = [], ribs = [];
    if (compact) for (const [x, y] of Object.values(centers)) {
      if (recessed) for (const [dx, dy] of motorPoints) lower = sub(lower, extrude(circle(p.motor_head_pocket_diameter / 2, [x + dx, y + dy]), p.motor_head_pocket_depth + 0.01, -0.01));
      if (mountZ < p.frame_thickness) {
        const end = radius - Math.max(p.motor_pad_diameter / 2, p.motor_envelope_diameter / 2 * Math.SQRT2 + 0.2);
        lower = sub(lower, extrude(rotate(sq([100, 100], [end + 50, 0]), Math.atan2(y, x) / rad), p.frame_thickness - mountZ + 0.01, mountZ));
      }
    }
    if (v1) {
      if (p.small_board_mounts) lower = add(lower, extrude(sub(union(lowerParts.filter(part => ['imu', 'bec_placeholder'].includes(part.name)).map(sectionFor)), cuts), p.small_board_standoff_height, p.frame_thickness));
      roots = Object.entries(centers).map(([name, [x, y]]) => { const xy = [x * p.root_boss_station / radius, y * p.root_boss_station / radius], h = p.arm_width / 2; return { name, xy, section: union([atLocal(name, p.root_side_start, p.root_side_end, -h, -h + p.root_side_thickness), atLocal(name, p.root_side_start, p.root_side_end, h - p.root_side_thickness, h), atLocal(name, p.root_boss_station - p.root_cross_width / 2, p.root_boss_station + p.root_cross_width / 2, -h, h), circle(p.root_boss_diameter / 2, xy)]) }; });
      lower = add(add(lower, extrude(union(roots.map(root => root.section)), p.clear_bay_height, p.frame_thickness)), extrude(lips(false), p.joint_lip_height, roofBottom));
      if (p.lower_arm_braces) {
        const envelope = rotorEnvelope(p, config), start = p.root_side_end, limit = radius - p.motor_pad_diameter / 2 - p.lower_arm_brace_pad_gap, end = start + (limit - start) * p.lower_arm_brace_reach, base = Math.min(p.frame_thickness, mountZ);
        for (const [name, [x, y]] of Object.entries(centers)) for (const [t0, t1] of [[-p.arm_width / 2, -p.arm_width / 2 + p.root_side_thickness], [p.arm_width / 2 - p.root_side_thickness, p.arm_width / 2]]) {
          const plan = intersect(atLocal(name, start, end, t0, t1), outline), constraints = [], hits = [];
          for (const [motor, xy] of Object.entries(centers)) {
            const overlap = intersect(plan, circle(envelope.radius / Math.cos(Math.PI / 512), xy, 512));
            if (overlap.isEmpty()) continue;
            const stations = overlap.toPolygons().flat().map(([sx, sy]) => (sx * x + sy * y) / radius), entry = Math.min(...stations);
            constraints.push([entry, envelope.minimum - p.lower_arm_brace_blade_gap]); hits.push({ motor, entry });
          }
          const profile = [[start - 1, roofBottom], ...constrainedProfile(start, end, roofBottom, base, constraints)];
          const polygon = [[start - 1, base], [end, base], ...profile.slice(0, -1).reverse()];
          const angle = Math.atan2(y, x) / rad;
          const solid = rotate(shift(rotate(extrude(poly(polygon), t1 - t0), [90, 0, 0]), [0, t1, 0]), [0, 0, angle]);
          lower = add(lower, sub(solid, extrude(cuts, roofTop + 1)));
          ribs.push({ arm: name, side: t0 < 0 ? 1 : 2, profile, hits, minimum_gap_mm: p.lower_arm_brace_blade_gap });
        }
      }
      if (p.upper_arm_extensions && p.upper_arm_joint_style === 'keyed') lower = add(lower, extrude(keys(false), p.upper_arm_key_height, p.frame_thickness));
      if (integrated) {
        const keeper = keepers(), low = keeper.bossBottom - p.joint_clearance;
        lower = sub(lower, extrude(own(keeper.bosses.offset(p.joint_clearance)), roofBottom - low, low));
      }
      lower = simple(sub(lower, extrude(union(roots.map(root => circle(p.root_hole_diameter / 2, root.xy))), roofBottom + p.joint_lip_height + 1)));
      if (p.motor_cable_ports_enabled) {
        const g = cableSlotGeometry(p);
        const slots = union(Object.keys(centers).map(name => atLocal(name, ...g.s_range, ...g.t_range)));
        lower = simple(sub(lower, extrude(slots, g.cut_top_z - g.bottom_z, g.bottom_z)));
      }
      let roof = upperBody();
      if (under && underside().relief) roof = sub(roof, underside().relief);
      if (top && topside().relief) roof = sub(roof, topside().relief);
      const upperHoles = roots.map(root => circle(p.root_hole_diameter / 2, root.xy));
      if (separate) upperHoles.push(...carrierGeometry().supports.map(support => circle(p.carrier_support_hole_diameter / 2, support.center)));
      upper = sub(extrude(sub(roof, union(upperHoles)), p.upper_deck_thickness, roofBottom), extrude(lips(true), p.joint_groove_depth, roofBottom));
      if (p.upper_arm_extensions) {
        const path = upperArmPath(p), width = Math.max(p.arm_width, p.root_inner_width);
        const prism = shift(rotate(extrude(poly(path.points), width), [90, 0, 0]), [0, width / 2, 0]);
        const arms = Object.entries(centers).map(([name, [x, y]]) => intersect(rotate(prism, [0, 0, Math.atan2(y, x) / rad]), extrude(armPlan(name, p.upper_lobe_station - 1, p.upper_arm_end_station), roofTop + 1)));
        upper = add(upper, own(M.union(arms)));
      }
      if (integrated) {
        const g = underside(), keeper = keepers(), ties = controllerTies();
        if (ties.enabled) {
          const allowance = own(ties.section.offset(1)), protectedParts = add(add(keeper.bosses, lips(true)), union(roots.map(root => circle(p.root_hole_diameter / 2 + 1, root.xy))));
          if (sub(allowance, upperBody()).area() > 1e-6) throw new Error('Controller tie slots need at least 1 mm of roof around them; move/rotate the board or widen the roof.');
          if (intersect(allowance, protectedParts).area() > 1e-6) throw new Error('Controller tie slots conflict with roof fasteners or locating grooves; move/rotate the board.');
        }
        upper = add(add(upper, g.solid), extrude(keeper.bosses, roofBottom - keeper.bossBottom + 0.01, keeper.bossBottom));
        upper = sub(upper, extrude(keeper.holes, p.upper_deck_thickness + roofBottom - keeper.bossBottom + 1, keeper.bossBottom));
        if (ties.enabled) upper = sub(upper, extrude(ties.section, p.upper_deck_thickness + 0.02, roofBottom - 0.01));
      }
      if (top) {
        const g = topside(), ties = controllerTies(), protectedParts = add(lips(true), union(roots.map(root => circle(p.root_hole_diameter / 2 + 1, root.xy))));
        if (sub(add(g.rails, g.ledges), roof).area() > 1e-6) throw new Error('Top controller rails must be supported by the upper roof.');
        if (ties.enabled && (sub(own(ties.section.offset(1)), roof).area() > 1e-6 || intersect(own(ties.section.offset(1)), protectedParts).area() > 1e-6)) throw new Error('Controller tie slots need 1 mm roof web clear of fasteners and grooves.');
        upper = add(upper, g.solid);
        if (ties.enabled) upper = sub(upper, extrude(ties.section, p.upper_deck_thickness + 0.02, roofBottom - 0.01));
      }
      if (p.upper_arm_extensions && p.upper_arm_joint_style !== 'contact_only') {
        let jointCuts;
        if (p.upper_arm_joint_style === 'keyed') jointCuts = extrude(keys(true), p.upper_arm_key_height + p.upper_arm_key_clearance, p.frame_thickness);
        else jointCuts = add(extrude(union(jointCenters.map(xy => circle(p.upper_arm_bolt_diameter / 2, xy))), roofTop + 1), extrude(union(jointCenters.map(xy => circle(p.upper_arm_bolt_head_diameter / 2, xy))), roofTop + 1, p.frame_thickness + p.upper_arm_shoe_height - p.upper_arm_bolt_head_height));
        upper = sub(upper, jointCuts);
      }
      upper = simple(upper);
    }
    const parts = [], exports = {};
    const meshData = (solid, connected = true) => {
      // Collapse coplanar boolean seams before float32 mesh/STL conversion.
      solid = own(own(solid.asOriginal()).simplify(0.0001));
      const components = solid.decompose(); components.forEach(own);
      if (solid.status() !== 'NoError' || (connected && components.length !== 1) || solid.isEmpty()) throw new Error('Selected parameters did not produce a connected valid printable solid.');
      const mesh = solid.getMesh(), positions = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++) positions.set(mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3), i * 3);
      const bounds = solid.boundingBox();
      return { positions, indices: new Uint32Array(mesh.triVerts), bounds: [bounds.min, bounds.max], volume: solid.volume(), genus: solid.genus(), components: components.length };
    };
    const pushPrint = (name, label, solid, printSolid, color = '#ffffff') => { const mesh = meshData(solid); parts.push({ name, label, shape: 'mesh', mesh, color, printable: true }); exports[name] = meshData(printSolid ?? solid); };
    pushPrint('lower', 'Lower frame', lower);
    if (upper) { const print = under ? shift(rotate(shift(upper, [0, 0, -roofBottom]), [180, 0, 0]), [0, 0, p.upper_deck_thickness]) : shift(upper, [0, 0, -upper.boundingBox().min[2]]); pushPrint('upper', 'Upper deck', upper, simple(print)); }
    if (integrated) {
      const printable = []; let cursor = 0;
      keepers().clips.forEach((clip, index) => { let print = rotate(clip, [0, 0, -p.esp32_rotation_z]); print = shift(print, print.boundingBox().min.map(x => -x)); pushPrint(`keeper-${index + 1}`, `Controller keeper ${index + 1}`, clip, print, '#e2b84b'); const size = print.boundingBox(); printable.push(shift(print, [cursor, 0, 0])); cursor += size.max[0] - size.min[0] + 5; });
      exports.keepers = meshData(own(M.union(printable)), false);
    }
    if (separate) { const g = carrierGeometry(); pushPrint('carrier', 'Controller carrier', shift(g.solid, [0, 0, g.bottom]), g.solid, '#d6dce0'); g.supports.forEach((support, index) => { const ring = extrude(sub(circle(p.carrier_standoff_diameter / 2), circle(p.carrier_support_hole_diameter / 2)), support.height); pushPrint(`spacer-${index + 1}`, `Carrier spacer ${index + 1}`, shift(ring, [...support.center, support.base]), ring, '#71838b'); }); }
    const pcb = top ? topside().pcb : under ? underside().pcb : separate ? carrierGeometry().pcb : (v1 ? roofTop : p.frame_thickness) + p.esp32_standoff_height;
    const projection = p.carrier_enabled || under ? p.controller_underside_projection : 0;
    const components = [...lowerParts, { name: 'esp32_s3', label: config.controllers[p.controller_preset].label, shape: 'box', center: [p.esp32_center_x, p.esp32_center_y, pcb + (p.esp32_size_z - projection) / 2], size: [p.esp32_size_x, p.esp32_size_y, p.esp32_size_z + projection], rotation_z: p.esp32_rotation_z, color: config.colors.esp32_s3 }];
    components.forEach(part => parts.push({ ...part, printable: false, note: 'Generic fit envelope; purchased hardware match unverified.' }));
    const propPlane = motorMountZ(p) + (p.prop_seat_on_shaft ? config.datums.motor_seat_z - config.datums.hub_seat_z : p.prop_plane_above_mount);
    for (const [name, xy] of Object.entries(centers)) {
      const hubBottom = propPlane + config.datums.hub_seat_z, hubTop = propPlane + config.datums.hub_top_z;
      parts.push({ name: name.replace('motor_', 'propeller_'), label: 'Illustrative propeller', shape: 'propeller', center: [...xy, propPlane], size: [p.prop_diameter, p.prop_diameter, 5], rotation_z: p.motor_rotation_z, color: config.colors[name], clockwise: xy[0] * xy[1] > 0, note: 'Illustrative only. Not an aerodynamic model or printable flight part.' });
      if (p.prop_nuts_enabled && p.prop_seat_on_shaft) {
        const hex = sub(circle(p.prop_nut_across_flats / (2 * Math.cos(Math.PI / 6)), [0, 0], 6), circle(p.prop_nut_bore_diameter / 2, [0, 0], 64));
        const collar = sub(circle(p.prop_nut_across_flats * 0.47, [0, 0], 64), circle(p.prop_nut_bore_diameter / 2, [0, 0], 64));
        const solid = add(extrude(hex, p.prop_nut_height * 0.64, hubTop), extrude(collar, p.prop_nut_height * 0.36, hubTop + p.prop_nut_height * 0.64));
        parts.push({ name: name.replace('motor_', 'prop_nut_'), label: 'Illustrative prop nut', shape: 'mesh', mesh: meshData(shift(rotate(solid, [0, 0, p.motor_rotation_z]), [...xy, 0])), color: '#747b82', printable: false, note: 'Unthreaded visual nut. Not printable hardware.' });
      }
      if (v1 && p.root_hardware_preview) for (const root of roots.filter(row => row.name === name)) for (const [kind, diameter, z, h, segments] of [['shank', 3, 0, roofTop + p.root_washer_thickness, 32], ['head', p.root_head_diameter, roofTop + p.root_washer_thickness, p.root_head_height, 32], ['washer_top', p.root_washer_diameter, roofTop, p.root_washer_thickness, 32], ['washer_bottom', p.root_washer_diameter, -p.root_washer_thickness, p.root_washer_thickness, 32], ['nut', p.root_nut_across_flats / Math.cos(Math.PI / 6), -p.root_washer_thickness - p.root_nut_height, p.root_nut_height, 6]]) parts.push({ name: `${name}_${kind}`, label: `Root ${kind}`, shape: 'cylinder', segments, center: [...root.xy, z + h / 2], size: [diameter, diameter, h], rotation_z: 0, color: '#7c8790', printable: false, note: 'Illustrative fastener envelope; screw length not selected.' });
    }
    const couponCuts = union([...p.motor_mount_points.map(point => circle(p.motor_mount_hole_diameter / 2, rotateXY(...point, p.motor_rotation_z))), ...(p.motor_center_relief_diameter ? [circle(p.motor_center_relief_diameter / 2)] : [])]);
    let coupon = extrude(sub(compact ? motorPad() : circle(p.motor_pad_diameter / 2, [0, 0], 128), couponCuts), mountZ);
    if (recessed) for (const xy of motorPoints) coupon = sub(coupon, extrude(circle(p.motor_head_pocket_diameter / 2, xy), p.motor_head_pocket_depth));
    exports.coupon = meshData(coupon);
    const report = fitReport(p, config, { parts, exports, lowerLength, outline, upper, roots, ribs, holes, slots, roofBottom, roofTop, propPlane, antenna, keepers: keeperGeometry, sectionFor, circle, union, intersect, sub, armPlan, own, lower });
    const ties = controllerTies();
    report.controller_ties = { enabled: ties.enabled, count: ties.slots.length, loop_count: ties.stations.length, slots: ties.slots, status: 'unverified physical routing' };
    report.controller_mount = { enabled: integrated || top || separate, style: p.controller_mount_style, pcb_bottom_z: pcb, pin_to_roof_gap_mm: top ? p.carrier_pin_clearance + p.carrier_extra_height : null, physical_fit: 'unverified' };
    return { parameters: p, parts, exports, report, propPlane, holes, slots, roofBottom, roofTop };
  } finally { for (const item of owned.reverse()) item.delete(); }
}

function distanceToSection(section, xy) {
  let inside = false, distance = Infinity;
  for (const polygon of section.toPolygons()) {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = clamp(((xy[0] - a[0]) * dx + (xy[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      distance = Math.min(distance, length(xy[0] - a[0] - t * dx, xy[1] - a[1] - t * dy));
      if ((a[1] > xy[1]) !== (b[1] > xy[1]) && xy[0] < (b[0] - a[0]) * (xy[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
  }
  return inside ? 0 : distance;
}

function fitReport(p, config, ctx) {
  const centers = Object.entries(motorCenters(p)), envelope = rotorEnvelope(p, config), propR = envelope.radius;
  const minZ = envelope.minimum, maxZ = envelope.maximum;
  const checks = [], collisions = [], cutoutWarnings = [];
  const upper = p.frame_variant === 'drone_frame_v1';
  const componentNames = new Set([...centers.map(([name]) => name), 'esc', 'battery', 'imu', 'bec_placeholder', 'esp32_s3']);
  const envelopes = ctx.parts.filter(part => componentNames.has(part.name) && ['box', 'cylinder'].includes(part.shape));
  function check(name, section, bottom, top) {
    for (const [motor, xy] of centers) { const gap = distanceToSection(section, xy) - propR; const zGap = Math.max(minZ - top, bottom - maxZ); checks.push({ component: name, motor, xy_gap: gap, vertical_gap: zGap, status: gap < -1e-6 && zGap < -1e-6 ? 'fail' : 'unresolved' }); }
  }
  check('lower frame', ctx.outline, 0, p.frame_thickness);
  for (const part of envelopes) check(part.label, ctx.sectionFor(part), part.center[2] - part.size[2] / 2, part.center[2] + part.size[2] / 2);
  if (upper) {
    for (const root of ctx.roots) check('root supports', root.section, p.frame_thickness, ctx.roofBottom + p.joint_lip_height);
    for (const root of ctx.roots) check('root fastener envelope', ctx.circle(Math.max(p.root_washer_diameter, p.root_head_diameter, p.root_nut_across_flats / Math.cos(Math.PI / 6)) / 2, root.xy), -p.root_washer_thickness - p.root_nut_height, ctx.roofTop + p.root_washer_thickness + p.root_head_height);
    if (p.upper_arm_extensions) for (const [arm, [ax, ay]] of centers) {
      const plan = ctx.armPlan(arm, p.upper_lobe_station - 1, p.upper_arm_end_station);
      for (const [motor, xy] of centers) {
        const cut = ctx.intersect(plan, ctx.circle(propR / Math.cos(Math.PI / 512), xy, 512));
        if (cut.isEmpty()) continue;
        const stations = cut.toPolygons().flat().map(([x, y]) => (x * ax + y * ay) / Math.hypot(ax, ay));
        const heights = stations.map(s => ctx.roofTop - (ctx.roofTop - p.frame_thickness - p.upper_arm_shoe_height) * clamp((s - p.upper_lobe_station) / (p.upper_arm_end_station - p.upper_lobe_station), 0, 1));
        const zGap = Math.max(minZ - Math.max(...heights), Math.min(...heights) - maxZ);
        checks.push({ component: 'upper arm', arm, motor, xy_gap: distanceToSection(plan, xy) - propR, vertical_gap: zGap, status: zGap < -1e-6 ? 'fail' : 'unresolved' });
      }
    }
    // Roof, rails and keepers are checked against their full projected solid bounds.
    if (ctx.upper) { const projection = ctx.own(ctx.upper.project()), bounds = ctx.upper.boundingBox(); check('upper deck / controller mount', projection, bounds.min[2], bounds.max[2]); }
  }
  for (let i = 0; i < envelopes.length; i++) for (const other of envelopes.slice(i + 1)) {
    const one = envelopes[i], overlap = Math.min(one.center[2] + one.size[2] / 2, other.center[2] + other.size[2] / 2) - Math.max(one.center[2] - one.size[2] / 2, other.center[2] - other.size[2] / 2);
    if (overlap > 1e-6 && ctx.intersect(ctx.sectionFor(one), ctx.sectionFor(other)).area() > 1e-6) collisions.push([one.label, other.label]);
  }
  for (const hole of ctx.holes) if (ctx.sub(ctx.circle(hole.diameter / 2 + 2, hole.center), ctx.outline).area() > 1e-6) cutoutWarnings.push(hole.owner);
  const upperArmGap = Math.min(Infinity, ...checks.filter(row => row.component === 'upper arm').map(row => row.vertical_gap));
  const pairGap = Math.min(2 * p.motor_x_offset, 2 * p.motor_y_offset) - p.prop_diameter;
  const bodyFootprints = [{ center: [0, 0], size: [p.plate_width, p.plate_length], rotation_z: 0, radius: p.body_corner_radius }, ...envelopes.filter(part => part.shape === 'box')];
  for (const part of ctx.parts.filter(part => part.name === 'carrier')) { const [lo, hi] = part.mesh.bounds; bodyFootprints.push({ center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], size: [hi[0] - lo[0], hi[1] - lo[1]], rotation_z: 0 }); }
  const bodySections = [...ctx.roots.map(root => root.section), ...(ctx.upper ? [ctx.own(ctx.upper.project())] : [])];
  const bodyGap = Math.min(...centers.flatMap(([, xy]) => [...bodySections.map(section => distanceToSection(section, xy) - propR), ...bodyFootprints.map(fp => { const [x, y] = rotateXY(xy[0] - fp.center[0], xy[1] - fp.center[1], -fp.rotation_z), r = fp.radius || 0, qx = Math.abs(x) - fp.size[0] / 2 + r, qy = Math.abs(y) - fp.size[1] / 2 + r; return Math.max(0, Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r) - propR; })]));
  const lowerPrint = printFootprint(p, ctx.exports.lower), upperPrint = ctx.exports.upper ? printFootprint(p, ctx.exports.upper) : null;
  const cables = cableSlotReport(p);
  const failed = pairGap < p.desired_prop_tip_gap || bodyGap < p.desired_body_tip_gap || checks.some(row => row.status === 'fail') || collisions.length || cutoutWarnings.length || lowerPrint.status === 'fail' || upperPrint?.status === 'fail' || cables.status === 'fail';
  return {
    scope: 'Browser generic-envelope checks, not the original detailed-reference CAD qualification.', status: failed ? 'fail' : 'unresolved',
    wheelbase_mm: 2 * Math.hypot(p.motor_x_offset, p.motor_y_offset), body_tip_gap_mm: bodyGap, adjacent_tip_gap_mm: pairGap,
    upper_arm_vertical_gap_mm: Number.isFinite(upperArmGap) ? upperArmGap : null, prop_envelope_mm: [minZ, maxZ], checks, overlapping_envelopes: collisions, unsupported_cutouts: cutoutWarnings,
    body_lengths_mm: { lower: ctx.lowerLength, upper: p.plate_length },
    printer: { ...lowerPrint, lower_height_mm: lowerPrint.height_mm, upper: upperPrint },
    motor_cables: cables,
    motor_screws: motorScrewReport(p),
    lower_upper_intersection_mm3: ctx.upper ? ctx.own(ctx.lower.intersect(ctx.upper)).volume() : 0,
    antenna_keepout: { status: 'unresolved', keeper_overlap: Boolean(ctx.keepers?.rfOverlap) },
    lower_ribs: { enabled: Boolean(p.lower_arm_braces && upper), ribs: ctx.ribs, minimum_calculated_gap_mm: ctx.ribs.length ? p.lower_arm_brace_blade_gap : null },
    source_configuration_warning: p.lower_arm_braces && upper ? 'The current lower-rib revision replaces the legacy upper-arm clearance failure. Rib profiles retain scalar bounds from the source propeller sweep plus explicit deflection and rib clearance. Motor envelopes still overlap the sweep; real hardware, RF and flight loads remain unverified.' : p.upper_arm_extensions && upper ? 'The legacy upper-arm configuration fails its conservative blade-envelope check: source gap -1.435342 mm with 3 mm deflection allowance. Generic envelopes and visibility changes do not clear this warning.' : 'Generic envelopes are not detailed-reference CAD qualification. Hardware, RF and flight loads remain unverified.',
    unresolved: ['Experimental layout / fit prototype, not flight-ready.', 'Purchased motor, ESC, battery, controller, IMU and regulator matches are unverified.', 'RF, connector access, wiring, cooling and battery restraint need physical checks.', 'Four M3 root bolts are required regardless of arm joint style. Keys are not vertical latches.', 'Use matching lower and upper parts; this layout changes root-bolt positions.', 'Verify screw engagement and bottoming with a physical coupon. Root fastener lengths are not selected.', 'Bed clips, purge lines and real printing clearances are not checked.', 'Printed stiffness, thrust capacity, fatigue, vibration and flight behavior have not been tested.'],
    copyright: 'Santeri Hukari'
  };
}

export function motorScrewReport(p) {
  const enabled = motorPadActive(p), recessed = enabled && p.motor_recess_enabled;
  const depth = recessed ? p.motor_head_pocket_depth : 0, material = motorMountZ(p) - depth;
  const underHead = p.motor_bolt_total_length - p.motor_bolt_head_height;
  const engagement = underHead - material - p.motor_washer_thickness;
  return { enabled, status: p.motor_engagement_max > 0 ? (engagement >= p.motor_engagement_min - 1e-6 && engagement <= p.motor_engagement_max + 1e-6 && engagement <= p.motor_thread_depth + 1e-6 ? 'pass' : 'fail') : 'unresolved', mount_plane_z_mm: motorMountZ(p), nominal_pad_diameter_mm: p.motor_pad_diameter, bolt_total_length_mm: p.motor_bolt_total_length, bolt_head_height_mm: p.motor_bolt_head_height, bolt_under_head_length_mm: underHead, head_recess_enabled: recessed, head_pocket_diameter_mm: p.motor_head_pocket_diameter, head_pocket_depth_mm: depth, head_bottom_z_mm: depth - p.motor_bolt_head_height, material_above_pocket_mm: material, calculated_engagement_mm: engagement, engagement_range_mm: [p.motor_engagement_min, p.motor_engagement_max], motor_thread_depth_mm: p.motor_thread_depth, remaining_thread_depth_mm: p.motor_thread_depth - engagement, nominal_pad_hole_edge_web_mm: p.motor_pad_diameter / 2 - Math.max(...p.motor_mount_points.map(xy => Math.hypot(...xy))) - p.motor_mount_hole_diameter / 2, minimum_rim_mm: p.motor_head_rim, hole_pattern_user_print_tested: p.motor_mount_verified, note: 'User reports 3 mm motor thread depth and measured bolts. Without recesses the heads protrude below the base. Confirm actual grip and bottoming clearance; no flight/load validation.' };
}
