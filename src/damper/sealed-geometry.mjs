import { DATUMS, glandDimensions, validateSettings } from './sealed-parameters.mjs';

const TAU = Math.PI * 2;
const TOLERANCE = 0.0001;
const REVISION = 'Sealed prototype V2 - untested O-ring / M3 clamp concept';

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]); max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function printMesh(mesh, direction) {
  const positions = [], indices = Array.from(mesh.indices);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const [x, y, z] = mesh.positions.slice(i, i + 3);
    positions.push(direction * z, y, -direction * x);
  }
  const box = bounds(positions);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= (box.min[0] + box.max[0]) / 2;
    positions[i + 1] -= (box.min[1] + box.max[1]) / 2;
    positions[i + 2] -= box.min[2];
  }
  return { positions, indices };
}

export function generateSealed(api, input, baselineModelJSON) {
  const s = validateSettings(input), glands = glandDimensions(s), baseline = baselineModelJSON;
  if (!baseline?.parameters || !Array.isArray(baseline.parts)) throw new Error('The complete legacy model JSON is required.');
  const sourcePart = name => {
    const part = baseline.parts.find(item => item.name === name);
    if (!part?.positions?.length || !part.indices?.length) throw new Error(`Missing legacy full mesh: ${name}.`);
    return part;
  };
  const p = { ...structuredClone(baseline.parameters), front_cap_thickness: s.cap_thickness_mm, rear_cap_thickness: s.cap_thickness_mm, front_guide_length: 0 };
  if (Math.abs(p.bore_nominal_diameter + p.bore_diameter_compensation - 20.4) > 1e-6 || Math.abs(p.piston_nominal_diameter + p.piston_diameter_compensation - 19.7) > 1e-6 || p.chamber_length !== 50 || p.axis_height !== 16 || p.shell_outer_diameter !== 28) throw new Error('Use the unchanged OD28 / bore20.40 / piston19.70 / X50 legacy baseline.');
  const maximum = p.rod_length - s.cap_thickness_mm;
  if (maximum <= p.working_stroke) throw new Error('The thicker cap leaves no reserve beyond the working stroke.');
  const M = api.Manifold, C = api.CrossSection, resources = [], registered = new Set();
  const own = value => { if (!registered.has(value)) { registered.add(value); resources.push(value); } return value; };
  const shift = (solid, at) => own(solid.translate(at));
  const rotate = (solid, degrees) => own(solid.rotate(degrees));
  const cube = (lo, hi) => shift(own(M.cube(hi.map((value, axis) => value - lo[axis]))), lo);
  const cx = (x0, x1, radius, y = 0, z = 16, endRadius = radius, segments = 128) => shift(rotate(own(M.cylinder(x1 - x0, radius, endRadius, segments)), [0, 90, 0]), [x0, y, z]);
  const cy = (y0, y1, radius, x, z = 16) => shift(rotate(own(M.cylinder(y1 - y0, radius, radius, 64)), [90, 0, 0]), [x, y1, z]);
  const union = (...solids) => own(M.union(solids));
  const cut = (solid, ...tools) => own(solid.subtract(tools.length === 1 ? tools[0] : union(...tools)));
  const intersect = (a, b) => own(M.intersection(a, b));
  const annulus = (x0, x1, inner, outer, y = 0, z = 16) => cut(cx(x0, x1, outer, y, z), cx(x0 - 0.01, x1 + 0.01, inner, y, z));
  const meshSolid = mesh => {
    const data = new api.Mesh({ numProp: 3, vertProperties: new Float32Array(mesh.positions), triVerts: new Uint32Array(mesh.indices) });
    data.merge(); const solid = own(new M(data));
    if (solid.status() !== 'NoError' || solid.volume() <= 0) throw new Error('A source or analytical mesh is not a closed positive solid.');
    return solid;
  };
  const payload = solid => {
    const mesh = solid.getMesh(), positions = [];
    for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp) positions.push(mesh.vertProperties[i], mesh.vertProperties[i + 1], mesh.vertProperties[i + 2]);
    return { positions, indices: Array.from(mesh.triVerts) };
  };
  const components = solid => { const bodies = solid.decompose(); for (const body of bodies) own(body); return bodies; };
  const volume = (a, b) => Math.max(0, intersect(a, b).volume());
  const parts = [], print_manifest = [], print_meshes = {}, solids = new Map();
  const sectionBox = () => cube([-100, 0, -50], [120, 80, 100]);
  function add(name, label, color, solid, { reference = false, moving = false, exact = null, direction = 1 } = {}) {
    if (solid.status() !== 'NoError' || solid.volume() <= 0) throw new Error(`${name} is not a positive solid.`);
    const mesh = exact ? { positions: Array.from(exact.positions), indices: Array.from(exact.indices) } : payload(solid);
    const section = reference ? { positions: [], indices: [] } : payload(intersect(solid, sectionBox()));
    parts.push({ name, label, color, reference, moving, ...mesh, section_positions: section.positions, section_indices: section.indices });
    solids.set(name, solid);
    if (!reference) {
      const count = components(solid).length;
      if (count !== 1) throw new Error(`${name} must be exactly one printable body, got ${count}.`);
      print_meshes[name] = printMesh(mesh, direction);
      print_manifest.push({ part: name, file: `sealed-${name}.stl`, quantity: 1, dimensions_mm: bounds(print_meshes[name].positions).size, volume_mm3: solid.volume(), watertight: true, bodies: count });
    }
  }
  function radialSolid(x0, x1, radius, steps, y = -6, z = 16, segments = 96) {
    const positions = [], indices = [];
    for (let i = 0; i <= steps; i++) for (let j = 0; j < segments; j++) {
      const x = x0 + (x1 - x0) * i / steps, angle = TAU * j / segments, r = radius(x, angle);
      positions.push(x, y + r * Math.cos(angle), z + r * Math.sin(angle));
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < segments; j++) {
      const a = i * segments + j, b = i * segments + (j + 1) % segments, c = a + segments, d = b + segments;
      indices.push(a, b, c, b, d, c);
    }
    const first = positions.length / 3; positions.push(x0, y, z, x1, y, z);
    for (let j = 0; j < segments; j++) indices.push(first, (j + 1) % segments, j, first + 1, steps * segments + j, steps * segments + (j + 1) % segments);
    return meshSolid({ positions, indices });
  }
  function torus(name, label, center, meanRadius, radialHalf, axialHalf, color, moving = false) {
    const positions = [], indices = [], n = 128, sides = 24;
    for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
      const angle = TAU * i / n, cross = TAU * j / sides, radius = meanRadius + radialHalf * Math.cos(cross);
      positions.push(center[0] + axialHalf * Math.sin(cross), center[1] + radius * Math.cos(angle), center[2] + radius * Math.sin(angle));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides, c = ((i + 1) % n) * sides + j, d = ((i + 1) % n) * sides + (j + 1) % sides;
      indices.push(a, c, b, b, c, d);
    }
    add(name, label, color, meshSolid({ positions, indices }), { reference: true, moving });
  }
  function capBlank(x0, x1) {
    return cut(union(cx(x0, x1, 14), cx(x0, x1, 4, -17), cx(x0, x1, 4, 17)), cx(x0 - .02, x1 + .02, 1.65, -17), cx(x0 - .02, x1 + .02, 1.65, 17));
  }
  function ringReference(name, label, x, inner, outer, axial, area, y = 0, moving = false) {
    const half = (outer - inner) / 2, axialHalf = Math.min(axial / 2 * .98, area / (Math.PI * half));
    torus(name, label, [x, y, 16], (outer + inner) / 2, half, axialHalf, '#63a995', moving);
  }
  function threadRadius(x, angle, female = false) {
    const phase = (x - 61.8) / 1.25 - angle / TAU;
    const distance = Math.abs(((phase + .5) % 1 + 1) % 1 - .5);
    const crest = Math.max(0, 1 - distance / .44);
    const fade = female ? 1 : Math.max(0, Math.min(1, (x - 61.8) / .35, (67.1 - x) / .35));
    return 3.25 + (female ? .225 : 0) + .75 * crest * fade;
  }
  const needleBody = seatingCone => {
    const tip = 51 - s.bleed_orifice_mm / 2, coneEnd = tip + 2.575;
    let needle = union(cx(tip, 51, 0, -6, 16, s.bleed_orifice_mm / 2), seatingCone, cx(coneEnd - .005, 61.81, 2.575, -6), radialSolid(61.8, 68.05, (x, a) => threadRadius(x, a), 250), cx(68, 71, 6, -6));
    needle = cut(needle, annulus(58, 59.3, 1.76, 3.1, -6));
    return needle;
  };
  const needlePose = (solid, opening) => opening === 0 ? solid : shift(rotate(shift(solid, [0, 6, -16]), [opening / 1.25 * 360, 0, 0]), [opening, -6, 16]);
  try {
    const housing = meshSolid(sourcePart('housing')), legacyPlunger = meshSolid(sourcePart('plunger'));
    let plunger = legacyPlunger;
    for (const x of glands.piston.centers_x_mm) plunger = cut(plunger, annulus(x - s.piston_gland_width_mm / 2, x + s.piston_gland_width_mm / 2, glands.piston.cad_root_mm / 2, 10.5));
    add('housing', 'Legacy housing - unchanged full mesh', '#e5e8e8', housing, { exact: sourcePart('housing'), direction: -1 });
    add('plunger', s.piston_rings ? `Legacy plunger with ${s.piston_rings} seal groove${s.piston_rings === 1 ? '' : 's'}` : 'Legacy plunger - exact original, no grooves', '#e77e57', plunger, { moving: true, exact: s.piston_rings ? null : sourcePart('plunger'), direction: -1 });
    let front = cut(capBlank(-s.cap_thickness_mm, 0), cx(-s.cap_thickness_mm - .02, .02, 3.15), cx(-s.cap_thickness_mm - .02, .02, .75, -7), cube([-.4, -7, 15.5], [.02, 0, 16.5]));
    if (s.front_face_seal) front = cut(front, annulus(-glands.face.depth_mm, .01, glands.face.inner_radius_mm, glands.face.outer_radius_mm));
    if (s.rod_seal) front = cut(front, cx(-s.cap_thickness_mm / 2 - glands.rod.width_mm / 2, -s.cap_thickness_mm / 2 + glands.rod.width_mm / 2, glands.rod.groove_diameter_cad_mm / 2));
    const upper = intersect(front, cube([-20, -30, 16], [1, 30, 40])), lower = intersect(front, cube([-20, -30, -10], [1, 30, 16]));
    add('front_cap_upper', 'Split front cap - upper half (vented)', '#559bb5', upper);
    add('front_cap_lower', 'Split front cap - lower half (vented)', '#7eb1c4', lower);
    const throat = cx(49.9, 51, s.bleed_orifice_mm / 2, -6);
    const tip = 51 - s.bleed_orifice_mm / 2, coneEnd = tip + 2.575;
    const seat = cx(51, coneEnd, s.bleed_orifice_mm / 2, -6, 16, 2.575);
    const guide = cx(coneEnd - .002, 61.85, 2.865, -6);
    const threadVoid = radialSolid(61.7, 68.6, (x, angle) => threadRadius(x, angle, true), 276);
    const exhaust = cy(-17, -6, .5, 54.5);
    let rear = union(capBlank(50, 50 + s.cap_thickness_mm), cx(48, 50.01, 2), cx(49.999 + s.cap_thickness_mm - .5, 68, 7, -6));
    rear = cut(rear, throat, seat, guide, threadVoid, exhaust, cx(49.99, 50 + s.cap_thickness_mm + .02, .75, 7), cx(49.99, 52.6, .8, 0, 23));
    if (s.rear_face_seal) rear = cut(rear, annulus(49.99, 50 + glands.face.depth_mm, glands.face.inner_radius_mm, glands.face.outer_radius_mm));
    const unposedNeedle = needleBody(seat), needle = needlePose(unposedNeedle, s.bleed_opening);
    // Use the identical seating mesh for the final contact surface, not a second tessellation.
    rear = cut(rear, unposedNeedle);
    add('rear_cap', 'Clamped rear cap with needle bleed and silicone reset', '#5d9e77', rear);
    add('bleed_needle', 'Printed needle / matched custom thread / knob', '#bc9052', needle, { direction: -1 });
    const pinStart = 50 - s.flap_thickness_mm - .6;
    const pin = union(cx(pinStart, pinStart + .6, 1.4, 0, 23), cx(pinStart + .595, pinStart + 3.1, .825, 0, 23));
    add('reed_pin', 'Blind push pin for silicone flap - trial press fit', '#d2a448', pin, { direction: -1 });

    for (const [i, x] of glands.piston.centers_x_mm.entries()) ringReference(`piston_ring_${i + 1}`, 'Piston O-ring - illustrative CAD gland envelope, not validated fit', x, glands.piston.cad_root_mm / 2, 10.2, s.piston_gland_width_mm, Math.PI * glands.piston.stretched_cs_mm ** 2 / 4, 0, true);
    if (s.rear_face_seal) ringReference('rear_face_ring', 'Rear face O-ring - approximate squeezed reference', 50 + glands.face.depth_mm / 2, glands.face.mean_radius_mm - s.cap_ring_cs_mm ** 2 / (2 * glands.face.depth_mm), glands.face.mean_radius_mm + s.cap_ring_cs_mm ** 2 / (2 * glands.face.depth_mm), glands.face.depth_mm, Math.PI * s.cap_ring_cs_mm ** 2 / 4);
    if (s.front_face_seal) ringReference('front_face_ring', 'Front face O-ring - split and vented joint is not airtight', -glands.face.depth_mm / 2, glands.face.mean_radius_mm - s.cap_ring_cs_mm ** 2 / (2 * glands.face.depth_mm), glands.face.mean_radius_mm + s.cap_ring_cs_mm ** 2 / (2 * glands.face.depth_mm), glands.face.depth_mm, Math.PI * s.cap_ring_cs_mm ** 2 / 4);
    if (s.rod_seal) ringReference('rod_ring', 'Optional rod ring - CAD diagram, predicted printed fit unverified', -s.cap_thickness_mm / 2, 3, glands.rod.groove_diameter_cad_mm / 2, glands.rod.width_mm, Math.PI * glands.rod.stretched_cs_mm ** 2 / 4);
    ringReference('needle_stem_ring', 'Needle stem O-ring - CAD gland envelope; expected-print squeeze differs', 58.65 + s.bleed_opening, 1.76, 2.865, 1.3, Math.PI * glands.stem.stretched_cs_mm ** 2 / 4, -6);

    const circle = (radius, center) => own(own(C.circle(radius, 128)).translate(center));
    const a = [0, 7], b = [7, 0], normal = [1.2 / Math.sqrt(8), 1.2 / Math.sqrt(8)];
    const neck = own(C.ofPolygons([[a.map((v, i) => v + normal[i]), b.map((v, i) => v + normal[i]), b.map((v, i) => v - normal[i]), a.map((v, i) => v - normal[i])].reverse()]));
    const flapSection = own(own(C.union([circle(1.6, a), circle(2, b), neck])).subtract(circle(.925, a)));
    const rawFlap = own(flapSection.extrude(s.flap_thickness_mm));
    const flap = shift(rotate(rawFlap, [90, 0, 90]), [50 - s.flap_thickness_mm, 0, 16]);
    if (components(flap).length !== 1) throw new Error('The silicone flap template must be one connected outline with its anchor hole.');
    add('reset_flap', 'Cut silicone reset flap - nonprinted reference', '#b78ac3', flap, { reference: true });
    const flapPolygons = flapSection.toPolygons(), flapPoints = flapPolygons.flat().map(([x, y]) => [x, -y]);
    const x0 = Math.min(...flapPoints.map(point => point[0])) - 2, y0 = Math.min(...flapPoints.map(point => point[1])) - 2;
    const width = Math.max(...flapPoints.map(point => point[0])) - x0 + 2, height = Math.max(...flapPoints.map(point => point[1])) - y0 + 5;
    const d = flapPolygons.map(polygon => polygon.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(6)},${(-y).toFixed(6)}`).join(' ') + ' Z').join(' ');
    const reset_template_svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${x0} ${y0} ${width} ${height}"><title>Silicone reset flap - 1:1 millimetres</title><desc>Original design copyright Santeri Hukari. Print at 100%, without fit-to-page. Cut the outside contour and the 1.85 mm anchor hole. Trial silicone thickness ${s.flap_thickness_mm} mm; closure and fatigue unverified.</desc><path d="${d}" fill="none" fill-rule="evenodd" stroke="black" stroke-width="0.08"/><path d="M${x0 + 1},${y0 + height - 2}h10m-10,-.4v.8m10,-.8v.8" fill="none" stroke="black" stroke-width="0.08"/><text x="${x0 + 1}" y="${y0 + height - .3}" font-size="1.2">10 mm; 100% scale</text></svg>`;

    const hardwareChecks = [];
    for (const [side, y] of [['left', -17], ['right', 17]]) for (const end of ['front', 'rear']) {
      const rearEnd = end === 'rear', face = rearEnd ? 50 + s.cap_thickness_mm : -s.cap_thickness_mm;
      const washer0 = rearEnd ? face : face - .5, washer1 = rearEnd ? face + .5 : face;
      const washer = annulus(washer0, washer1, 1.6, 3.5, y);
      const shaft0 = rearEnd ? face + .5 - 20 : face - .5, shaft1 = rearEnd ? face + .5 : face - .5 + 20;
      const head = cx(rearEnd ? face + .5 : face - 3.5, rearEnd ? face + 3.5 : face - .5, 2.75, y);
      const screw = union(cx(shaft0, shaft1, 1.5, y), head);
      const nut0 = rearEnd ? 39.6 : 8, nut1 = rearEnd ? 42 : 10.4;
      const hex = radialSolid(nut0, nut1, (_x, angle) => 2.75 / Math.cos(((angle + Math.PI / 6) % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6), 1, y, 16, 96);
      const nut = cut(hex, cx(nut0 - .01, nut1 + .01, 1.3, y));
      add(`${end}_screw_${side}`, 'M3 x 20 screw - approximate purchased-hardware reference', '#a7afb9', screw, { reference: true });
      add(`${end}_washer_${side}`, 'Head washer only - bridges split cap, not behind housing ears', '#c8ced4', washer, { reference: true });
      add(`${end}_nut_${side}`, 'M3 hex nut - flats parallel Y, corners along Z', '#7f8995', nut, { reference: true });
      hardwareChecks.push({ end, side, nut_to_housing_intersection_mm3: volume(nut, housing), washer_to_housing_intersection_mm3: volume(washer, housing), nut_inner_y_clearance_from_shell_mm: .25, screw_protrusion_beyond_nut_mm: rearEnd ? nut0 - shaft0 : shaft1 - nut1 });
    }
    const spring = sourcePart('spring');
    add('spring', 'Piano-wire spring - nonprinted legacy reference', '#7b848a', meshSolid(spring), { reference: true, exact: spring });

    const motion = [0, p.working_stroke, maximum].map(stroke => {
      const moving = shift(plunger, [stroke, 0, 0]);
      return { stroke_mm: stroke, intersections_mm3: Object.fromEntries([['housing', housing], ['front_cap_upper', upper], ['front_cap_lower', lower], ['rear_cap', rear]].map(([name, solid]) => [name, volume(moving, solid)])), spring_seat_spacing_mm: 50 - 22 - stroke, spring_solid_margin_mm: 50 - 22 - stroke - p.spring_solid_length, button_stop_gap_mm: maximum - stroke };
    });
    const needleChecks = [...new Set([0, 1, s.bleed_opening])].map(opening => {
      const posed = opening === s.bleed_opening ? needle : needlePose(unposedNeedle, opening);
      const contact = intersect(posed, rear), intersection = Math.max(0, contact.volume());
      return { opening_mm: opening, rotation_degrees: opening / 1.25 * 360,
        rear_cap_intersection_mm3: intersection, contact_bounds_mm: intersection > 1e-9 ? contact.boundingBox() : null,
        stem_ring_x_mm: [58 + opening, 59.3 + opening],
        remaining_thread_engagement_mm: Math.min(67.1 + opening, 68.5) - Math.max(61.8 + opening, 61.8) };
    });
    const airVoid = union(throat, seat, guide, threadVoid, exhaust);
    const inletProbe = cx(49.91, 50.05, .15, -6), outletProbe = cy(-16.5, -16, .15, 54.5), stemExitProbe = cx(68.4, 68.55, .12, -6 + 3.2);
    const flowProbe = opening => {
      const posed = needlePose(unposedNeedle, opening);
      const sealBarrier = annulus(58.1 + opening, 59.2 + opening, 1.70, 2.90, -6);
      const free = cut(airVoid, posed, sealBarrier), regions = components(free);
      const inletRegion = regions.find(region => volume(region, inletProbe) > 1e-6);
      return { opening_mm: opening, connected_inlet_to_exhaust: Boolean(inletRegion && volume(inletRegion, outletProbe) > 1e-6), inlet_to_stem_exit_with_nominal_seal: Boolean(inletRegion && volume(inletRegion, stemExitProbe) > 1e-6), void_bodies: regions.length };
    };
    const flow = { probes: [flowProbe(0), flowProbe(1)], current: flowProbe(s.bleed_opening), front_vent_open: true, reset_direction: 'outside -> rear chamber on return; silicone flap seats toward X50 on compression', seal_contact_assumption: 'Stem bypass probes include an ideal annular contact barrier overlapping the adjacent solids by at most 0.06 mm radially to avoid polygon-phase gaps. This is an assumed installed seal, not simulated elastomer deformation. O-ring reference volumes are CAD-gland diagrams; actual expected-print squeeze, friction and leakage are not simulated.', externally_pressurizable: false, cfd: false };
    const fixed = { housing_to_rear_cap_mm3: volume(housing, rear), housing_to_front_cap_mm3: volume(housing, front), split_halves_mm3: volume(upper, lower) };
    const collisions = [...motion.flatMap(row => Object.values(row.intersections_mm3)), ...needleChecks.map(row => row.rear_cap_intersection_mm3), ...hardwareChecks.flatMap(row => [row.nut_to_housing_intersection_mm3, row.washer_to_housing_intersection_mm3]), ...Object.values(fixed)];
    if (collisions.some(value => value > TOLERANCE)) throw new Error(`Sealed CAD has unintended solid intersection: ${Math.max(...collisions).toFixed(6)} mm3. ${JSON.stringify({ motion, needleChecks, hardwareChecks, fixed })}`);
    if (flow.probes[0].connected_inlet_to_exhaust || !flow.probes[1].connected_inlet_to_exhaust || flow.probes.some(row => row.inlet_to_stem_exit_with_nominal_seal)) throw new Error(`The geometric needle flow/closure or stem bypass probe failed: ${JSON.stringify(flow)}.`);
    const warnings = [
      'Experimental cabinet air damper, not a pressure vessel. Never connect external compressed air.',
      'Dry-fit without forcing parts. No damping, FEA, pressure rating or service-life certification is provided.',
      'The 20.07 mm bore estimate, +0.08 mm piston bias, 5.65 mm rod measurement and small-hole compensation are not universal printer calibration.',
      'Roughness, ovality, layer lines, friction, ring wear and actual body sealing are unverified. Test the sealed moving fit before installing the caps.',
      'Seal references are approximate CAD-gland envelopes, not validated elastomer deformation. Squeeze and fill are calculated on expected-print dimensions.',
      'Front cap is deliberately split and vented. Its optional face/rod seals do not make it an airtight pressure boundary.',
      'Printed 8/6.5 mm, 1.25 mm-pitch adjuster threads are a matched custom pair, not ISO M8. Printed thread fit, creep and retention require a bench test.',
      'Installing the 3.5 mm stem ring over the 5.15 mm stem temporarily stretches its inside diameter by about 47%. Check permissible assembly stretch with the elastomer supplier; avoid cuts and do not force it.',
      'M3 hardware references are approximate. Measure actual screw, head, nut and washer dimensions. Washers go only under heads, never behind the housing ears into the shell.',
      'Silicone stock, thickness, flap closure, fatigue and blind push-pin retention are unverified. The flap is cut sheet, not printed PLA.',
      'PLA clamped caps can creep and leak. Tighten evenly by hand without a specified torque; check clamps and mating faces regularly.',
      ...(s.piston_rings === 0 ? ['Zero piston rings retains the exact legacy piston and permits uncontrolled bore-gap leakage.'] : []),
      ...(s.rod_seal ? [`The optional closed rod ring cannot simply be laid around the captive rod. Passing the integral 12 mm button needs about ${((12 / s.rod_ring_id_mm - 1) * 100).toFixed(0)}% temporary diameter stretch. Installation is unvalidated; leave it off unless a suitable supplier-approved method is established.`] : []),
      ...(!s.rear_face_seal ? ['Rear face O-ring is disabled: the cap joint has no defined airtight gasket.'] : []),
      ...(s.bleed_opening === 0 ? ['Needle is nominally closed: trapped air can resist motion and force leaks. Start bench testing with the bleed open; do not force compression.'] : [])
    ];
    const instructions = [
      'Print the complete matching sealed set; the housing and ungrooved plunger geometry remain the legacy source meshes. Do not scale finished meshes.',
      'Housing and plunger keep the legacy axial print orientation for comparison with the measured-fit trial. Rear cap is boss-down with the sealing face up; supports beneath the wide outer cap may be required. Keep support scars off sealing lands and needle seat.',
      'Fit the piston rings from the piston end, then slide the piston into the bore. Assemble both front-cap halves around the captive button rod; bridge each split ear with the head washer.',
      'Use four M3 x 20 screws, four M3 nuts with flats facing Y and corners along Z, and four head washers. Put the nuts behind the housing ears without washers; confirm clearance and at least one thread beyond each nut.',
      'Cut the silicone flap from the 1:1 SVG at 100% scale. Its pad covers Y7 reset inlet and its blind anchor is Y0/Z23. Use the printed push pin only after checking retention; the pilot must not be drilled through the rear cap.',
      'Install the 3.5 x 1 mm stem O-ring over the cone end into X58..59.3, then gently thread the matching needle into its boss. Rotation withdraws it by 1.25 mm per turn; the model covers only 0..1 mm withdrawal.',
      'Buy O-rings only after measuring a printed gland coupon or trial part and checking the supplier nominal ID, cross-section and elastomer compatibility. Ring availability has not been checked.',
      'Verify vent, bleed and one-way reset by gentle manual cycling off the cabinet, initially with the needle open. Do not use external compressed air. Check door load, return spring and mounting independently.'
    ];
    const bom = [
      { name: 'M3 x 20 screw', quantity: 4, detail: 'Approximate socket-head reference; measure actual purchased hardware, no torque rating.' },
      { name: 'M3 hex nut', quantity: 4, detail: 'Nominal 5.5 mm flats / 2.4 mm thickness; flats face Y, corners along Z; no washer behind housing ear.' },
      { name: 'M3 head washer', quantity: 4, detail: 'Nominal OD7 / ID3.2 / 0.5 mm, under screw heads only, bridging front-cap split.' },
      { name: `Piston O-ring ${s.piston_ring_id_mm} x ${s.piston_ring_cs_mm} mm`, quantity: s.piston_rings, detail: 'ID x cross-section; stock and material unconfirmed. Expected-print squeeze, not a measured fit.' },
      { name: `Face O-ring ${s.cap_ring_id_mm} x ${s.cap_ring_cs_mm} mm`, quantity: Number(s.front_face_seal) + Number(s.rear_face_seal), detail: 'Rear pressure-side cap; optional front face remains split and vented.' },
      { name: 'Needle stem O-ring 3.5 x 1 mm', quantity: 1, detail: 'Always fitted. Install over cone end before threading; print-fit estimate only.' },
      ...(s.rod_seal ? [{ name: `Rod O-ring ${s.rod_ring_id_mm} x ${s.rod_ring_cs_mm} mm`, quantity: 1, detail: 'Optional, increases friction; based on earlier 5.65 mm printed rod measurement.' }] : []),
      { name: `Silicone sheet ${s.flap_thickness_mm} mm`, quantity: 1, detail: 'Cut the supplied exact-mm flap template. Not a printable mesh; fatigue and closure unverified.' },
      { name: 'Piano-wire spring and mounting tape', quantity: 1, detail: 'Legacy spring reference and flat mounting base; spring rate, load, adhesion and door trajectory remain unverified.' }
    ];
    const report = { geometry_status: 'pass', performance_simulated: false, sealed: {
      glands, printable: print_manifest, motion, needle: { checks: needleChecks, thread: { major_mm: 8, root_mm: 6.5, pitch_mm: 1.25, diameter_clearance_mm: .45, iso_compatible: false }, throat_mm: s.bleed_orifice_mm, seat_half_angle_degrees: 45, maximum_withdrawal_mm: 1, nominal_closed_tip_x_mm: tip, guide_cad_mm: 5.73, guide_expected_mm: 5.4, temporary_ring_assembly_stretch_percent: (5.15 / 3.5 - 1) * 100 }, flow, fixed, hardware: hardwareChecks, warnings, instructions,
      baseline: { housing_full_mesh_exact: true, zero_ring_plunger_full_mesh_exact: s.piston_rings === 0, original_button_and_rod_preserved: true, legacy_revision: baseline.revision },
      source: { copyright: 'Santeri Hukari', basis: 'Original cabinet air damper V1, public measured-fit full meshes; new analytical caps, glands and matched printed needle.', legacy_fit_trial: baseline.report?.fit_trial || null, third_party_geometry_added: false }
    } };
    return { revision: REVISION, parameters: p, sealed_parameters: s, parts, print_manifest, print_meshes, report, bom, maximum_stroke_mm: maximum, reset_template_svg,
      air_paths: { gap: [[23, 0, 5.82], [-1, 0, 5.82]], vent: [[-s.cap_thickness_mm, -7, 16], [0, -7, 16], [0, -3.15, 16]], reset: [[52 + s.cap_thickness_mm, 7, 16], [49, 7, 16]], bleed: [[49, -6, 16], [51, -6, 16], [54.5, -8.7, 16], [54.5, -17, 16]] }, copyright: 'Santeri Hukari' };
  } finally { for (const resource of resources.reverse()) resource.delete(); }
}
