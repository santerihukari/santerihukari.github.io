export const DEFAULTS = Object.freeze({
  piston_rings: 1,
  piston_ring_id_mm: 17,
  piston_ring_cs_mm: 1.5,
  piston_gland_width_mm: 2,
  dynamic_squeeze_percent: 8,
  static_squeeze_percent: 20,
  cap_ring_id_mm: 23,
  cap_ring_cs_mm: 1.5,
  cap_gland_width_mm: 2,
  front_face_seal: false,
  rear_face_seal: true,
  rod_seal: false,
  rod_ring_id_mm: 5.5,
  rod_ring_cs_mm: 1,
  cap_thickness_mm: 6,
  bleed_opening: 0.5,
  bleed_orifice_mm: 1,
  flap_thickness_mm: 0.5
});

const numeric = (key, label, min, max, step, type = 'number') => ({ key, label, type, min, max, step });
const toggle = (key, label) => ({ key, label, type: 'boolean' });
export const CONTROLS = [
  { title: 'Piston seals', fields: [
    numeric('piston_rings', 'Piston O-rings', 0, 2, 1, 'integer'),
    numeric('piston_ring_id_mm', 'Piston ring inside diameter (mm)', 15, 19, 0.1),
    numeric('piston_ring_cs_mm', 'Piston ring cross-section (mm)', 1, 2, 0.1),
    numeric('piston_gland_width_mm', 'Piston groove width (mm)', 1.2, 3.5, 0.1),
    numeric('dynamic_squeeze_percent', 'Dynamic squeeze (%)', 5, 15, 1)
  ] },
  { title: 'Cap seals and clamp', fields: [
    numeric('cap_thickness_mm', 'Cap thickness (mm)', 6, 8, 0.5),
    toggle('rear_face_seal', 'Rear cap face O-ring'),
    toggle('front_face_seal', 'Front face O-ring (vented, split cap)'),
    numeric('cap_ring_id_mm', 'Face ring inside diameter (mm)', 21, 25, 0.1),
    numeric('cap_ring_cs_mm', 'Face ring cross-section (mm)', 1, 2, 0.1),
    numeric('cap_gland_width_mm', 'Face groove width (mm)', 1.2, 3, 0.1),
    numeric('static_squeeze_percent', 'Static squeeze (%)', 15, 25, 1),
    toggle('rod_seal', 'Optional rod O-ring (adds friction)'),
    numeric('rod_ring_id_mm', 'Rod ring inside diameter (mm)', 5.4, 6, 0.1),
    numeric('rod_ring_cs_mm', 'Rod ring cross-section (mm)', 0.8, 1.5, 0.1)
  ] },
  { title: 'Bleed and reset valve', fields: [
    numeric('bleed_opening', 'Needle withdrawal (mm)', 0, 1, 0.05),
    numeric('bleed_orifice_mm', 'CAD bleed throat diameter (mm)', 0.8, 1, 0.05),
    numeric('flap_thickness_mm', 'Silicone reset flap thickness (mm)', 0.3, 0.8, 0.1)
  ] }
];

export const DATUMS = Object.freeze({
  bore_cad_mm: 20.4, bore_mouth_cad_mm: 21.2, bore_expected_mm: 20.07, piston_cad_mm: 19.7,
  piston_external_bias_mm: 0.08, small_hole_compensation_mm: 0.33,
  rod_cad_mm: 6, rod_measured_mm: 5.65, axis_z_mm: 16,
  chamber_length_mm: 50, piston_length_mm: 22, shell_od_mm: 28,
  stem_guide_cad_mm: 5.73, stem_guide_expected_mm: 5.4,
  stem_root_cad_mm: 3.52, stem_root_expected_mm: 3.6,
  stem_ring_id_mm: 3.5, stem_ring_cs_mm: 1,
  thread_pitch_mm: 1.25, thread_major_mm: 8, thread_root_mm: 6.5,
  thread_diametral_clearance_mm: 0.45
});

function requireFit(condition, message) { if (!condition) throw new Error(message); }
function dynamicRing(id, cs, rootExpected, radialSpace, width) {
  const stretch = rootExpected / id - 1;
  const thinned = cs / Math.sqrt(1 + stretch);
  return { id_mm: id, cs_mm: cs, expected_root_mm: rootExpected,
    stretch_percent: stretch * 100, stretched_cs_mm: thinned,
    radial_space_mm: radialSpace, squeeze_percent: (1 - radialSpace / thinned) * 100,
    width_mm: width, fill_percent: Math.PI * thinned ** 2 / (4 * width * radialSpace) * 100 };
}

export function glandDimensions(settings) {
  const s = settings, squeeze = s.dynamic_squeeze_percent / 100;
  let root = DATUMS.bore_expected_mm - 2 * s.piston_ring_cs_mm * (1 - squeeze);
  for (let i = 0; i < 40; i++) root = DATUMS.bore_expected_mm - 2 * s.piston_ring_cs_mm / Math.sqrt(root / s.piston_ring_id_mm) * (1 - squeeze);
  const piston = dynamicRing(s.piston_ring_id_mm, s.piston_ring_cs_mm, root, (DATUMS.bore_expected_mm - root) / 2, s.piston_gland_width_mm);
  piston.cad_root_mm = root - DATUMS.piston_external_bias_mm;
  piston.depth_cad_mm = (DATUMS.piston_cad_mm - piston.cad_root_mm) / 2;
  piston.centers_x_mm = s.piston_rings === 2 ? [6, 16] : s.piston_rings === 1 ? [11] : [];
  piston.minimum_axial_land_mm = s.piston_rings ? Math.min(...piston.centers_x_mm.map(x => Math.min(x, 22 - x) - s.piston_gland_width_mm / 2), ...(s.piston_rings === 2 ? [10 - s.piston_gland_width_mm] : [])) : null;
  const depth = s.cap_ring_cs_mm * (1 - s.static_squeeze_percent / 100);
  const mean = (s.cap_ring_id_mm + s.cap_ring_cs_mm) / 2;
  const face = { id_mm: s.cap_ring_id_mm, cs_mm: s.cap_ring_cs_mm, depth_mm: depth,
    width_mm: s.cap_gland_width_mm, inner_radius_mm: mean - s.cap_gland_width_mm / 2,
    outer_radius_mm: mean + s.cap_gland_width_mm / 2, mean_radius_mm: mean,
    inner_land_mm: mean - s.cap_gland_width_mm / 2 - DATUMS.bore_mouth_cad_mm / 2,
    outer_land_mm: 14 - mean - s.cap_gland_width_mm / 2,
    squeeze_percent: s.static_squeeze_percent, stretch_percent: 0,
    fill_percent: Math.PI * s.cap_ring_cs_mm ** 2 / (4 * s.cap_gland_width_mm * depth) * 100 };
  const rodCs = s.rod_ring_cs_mm / Math.sqrt(DATUMS.rod_measured_mm / s.rod_ring_id_mm);
  const rod = dynamicRing(s.rod_ring_id_mm, s.rod_ring_cs_mm, DATUMS.rod_measured_mm, rodCs * (1 - squeeze), s.rod_ring_cs_mm * 1.5);
  rod.groove_diameter_cad_mm = DATUMS.rod_measured_mm + 2 * rod.radial_space_mm + DATUMS.small_hole_compensation_mm;
  const stem = dynamicRing(3.5, 1, 3.6, (5.4 - 3.6) / 2, 1.3);
  stem.cad_root_mm = 3.52;
  return { piston, face, rod, stem };
}

export function validateSettings(input = {}) {
  requireFit(input && typeof input === 'object' && !Array.isArray(input), 'Sealed settings must be an object.');
  for (const key of Object.keys(input)) requireFit(Object.hasOwn(DEFAULTS, key), `Unknown sealed setting: ${key}.`);
  const settings = { ...DEFAULTS, ...input };
  for (const field of CONTROLS.flatMap(group => group.fields)) {
    const value = settings[field.key];
    if (field.type === 'boolean') requireFit(typeof value === 'boolean', `${field.label} must be true or false.`);
    else {
      requireFit(typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max, `${field.label} must be between ${field.min} and ${field.max}.`);
      if (field.type === 'integer') requireFit(Number.isInteger(value), `${field.label} must be an integer.`);
    }
  }
  const glands = glandDimensions(settings);
  const ringCheck = (ring, label) => {
    requireFit(ring.stretch_percent >= -0.00001 && ring.stretch_percent <= 6, `${label}: free-ring stretch must be between 0 and 6%.`);
    requireFit(ring.fill_percent > 0 && ring.fill_percent <= 85, `${label}: gland fill must not exceed 85%.`);
    requireFit(ring.width_mm >= ring.stretched_cs_mm * 1.1, `${label}: leave axial room for the squeezed ring.`);
  };
  if (settings.piston_rings) {
    ringCheck(glands.piston, 'Piston ring');
    requireFit(glands.piston.depth_cad_mm >= 0.25 && glands.piston.cad_root_mm >= 12, 'Piston groove must leave a useful groove and a solid piston core.');
    requireFit(glands.piston.minimum_axial_land_mm >= 1.5, 'Piston grooves must leave at least 1.5 mm of axial land.');
  }
  if (settings.front_face_seal || settings.rear_face_seal) {
    ringCheck({ ...glands.face, stretched_cs_mm: settings.cap_ring_cs_mm }, 'Cap face ring');
    requireFit(glands.face.inner_land_mm >= 0.6 && glands.face.outer_land_mm >= 0.6, 'Face groove must leave at least 0.6 mm of inner and outer sealing land.');
    requireFit(settings.cap_thickness_mm - glands.face.depth_mm >= 2, 'Face groove must leave at least 2 mm of cap floor.');
  }
  if (settings.rod_seal) {
    ringCheck(glands.rod, 'Rod ring');
    requireFit(glands.rod.groove_diameter_cad_mm > 6.5 && glands.rod.groove_diameter_cad_mm < 10, 'Rod groove must open beyond the guide while retaining its surrounding cap.');
  }
  ringCheck(glands.stem, 'Adjuster stem ring');
  return settings;
}
