export const parameters = [
  { key: 'angle', label: 'Included angle', unit: 'deg', group: 'paper', min: 50, max: 90, step: 0.01, default: 76.94 },
  { key: 'radius', label: 'Outer radius', unit: 'mm', group: 'paper', min: 100, max: 240, step: 1, default: 160 },
  { key: 'tip_cut', label: 'Bottom cut', unit: 'mm', group: 'paper', min: 0, max: 100, step: 0.5, default: 43 },
  { key: 'wall_height', label: 'Guide height', unit: 'mm', group: 'holder', min: 25, max: 55, step: 0.5, default: 35 },
  { key: 'wall_thickness', label: 'Wall thickness', unit: 'mm', group: 'holder', min: 2.4, max: 5, step: 0.1, default: 2.4 },
  { key: 'edge_radius', label: 'Outer edge radius', unit: 'mm', group: 'holder', min: 0.2, max: 1.1, step: 0.1, default: 1 },
  { key: 'usable_depth', label: 'Stack depth', unit: 'mm', group: 'holder', min: 10, max: 45, step: 0.5, default: 17 },
  { key: 'front_rise', label: 'Front rise', unit: 'mm', group: 'holder', min: 0, max: 16, step: 0.5, default: 15 },
  { key: 'clearance', label: 'Paper clearance', unit: 'mm', group: 'holder', min: 0, max: 3, step: 0.1, default: 1 },
  { key: 'paper_drop', label: 'Paper seating drop', unit: 'mm', group: 'holder', min: 0, max: 20, step: 0.5, default: 0 },
  { key: 'screw_spacing', label: 'Screw spacing', unit: 'mm', group: 'holder', min: 50, max: 120, step: 1, default: 70 }
];

export const defaults = Object.freeze({ layout: 'symmetric', ...Object.fromEntries(parameters.map(p => [p.key, p.default])) });

export function selectLayout(values, layout) {
  return { ...values, layout, paper_drop: layout === 'side_rest' ? 17 : defaults.paper_drop };
}

export function selectProfile(values, profile) {
  const paper = profile === 'measured' ? { angle: 76.94, radius: 160, tip_cut: 43 }
    : profile === 'right_angle' ? { angle: 90, radius: 160, tip_cut: 0 } : null;
  return paper ? { ...selectLayout(values, values.layout), ...paper } : { ...values };
}

export function validateParameters(values) {
  if (!values || !['symmetric', 'side_rest'].includes(values.layout)) throw new Error('Choose a valid holder layout.');
  const result = { layout: values.layout };
  for (const p of parameters) {
    const value = values[p.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < p.min || value > p.max) {
      throw new Error(`${p.label} must be between ${p.min} and ${p.max} ${p.unit}.`);
    }
    result[p.key] = value;
  }
  if (result.tip_cut >= result.radius - 20) throw new Error('Bottom cut must leave at least 20 mm of paper radius.');
  return result;
}
