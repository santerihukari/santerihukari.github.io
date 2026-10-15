import { validateParameters } from './parameters.mjs';

const tolerance = 0.0001;
export function printerBeds(config) {
  return config.printer_profiles.map(profile => ({ id: profile.id, label: profile.label, width: profile.changes.printer_bed_width, depth: profile.changes.printer_bed_depth, height: profile.changes.printer_height }));
}
export function parameterBed(parameters) {
  return { id: 'custom', label: 'Custom usable bed', width: parameters.printer_bed_width, depth: parameters.printer_bed_depth, height: parameters.printer_height };
}
export function printMargin(parameters) {
  return (parameters.brim_width ? parameters.brim_width + parameters.brim_separation : 0) + (parameters.separate_skirt_loops ? parameters.skirt_distance + parameters.separate_skirt_loops * parameters.skirt_line_width : 0);
}
export function rotatedBounds(mesh, degrees) {
  if (!mesh?.positions?.length || !mesh.indices?.length || !Number.isFinite(degrees)) throw new Error('A finite, nonempty printable mesh is required.');
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (const vertex of mesh.indices) {
    const i = vertex * 3, point = [mesh.positions[i] * c - mesh.positions[i + 1] * s, mesh.positions[i] * s + mesh.positions[i + 1] * c, mesh.positions[i + 2]];
    if (!point.every(Number.isFinite)) throw new Error('Printable mesh bounds are not finite.');
    for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis], point[axis]); high[axis] = Math.max(high[axis], point[axis]); }
  }
  return [low, high];
}
export function bedCheck(result, bed, rotation = result.parameters.print_rotation_z) {
  if (![bed.width, bed.depth, bed.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Usable bed dimensions must be positive finite numbers.');
  const margin = printMargin(result.parameters);
  const parts = Object.entries(result.exports).map(([key, mesh]) => {
    const bounds = rotatedBounds(mesh, rotation), size = bounds[1].map((value, axis) => value - bounds[0][axis]);
    const required = [size[0] + 2 * margin, size[1] + 2 * margin];
    const fits = required[0] <= bed.width + tolerance && required[1] <= bed.depth + tolerance && size[2] <= bed.height + tolerance;
    return { key, bounds, size, required, fits, rotation, margins: [(bed.width - required[0]) / 2, (bed.depth - required[1]) / 2] };
  });
  return { bed, parts, rotation, margin, fits: parts.length > 0 && parts.every(part => part.fits), scope: 'Each printable export checked separately, flat on its existing Z=0 print datum. Brim/skirt allowance is included; clips, purge lines, supports and physical qualification remain unchecked.' };
}
export function clearanceCheck(result, config) {
  const { parameters: p, report } = result, reasons = [];
  if (report.prop_clearance.body_status !== 'pass' || report.prop_clearance.adjacent_status !== 'pass') reasons.push('Selected prop-to-body or adjacent-prop clearance is not met.');
  if (report.overlapping_envelopes.length) reasons.push('Selected component envelopes overlap.');
  if (report.checks.some(row => row.status === 'fail' && row.component.replaceAll(' ', '_') !== row.motor)) reasons.push('A non-motor structure or component enters a prop sweep.');
  const motorPatternUnchanged = ['motor_pad_diameter', 'motor_mount_points', 'motor_mount_hole_diameter', 'motor_center_relief_diameter'].every(key => JSON.stringify(p[key]) === JSON.stringify(config.defaults[key]));
  if (report.unsupported_cutouts.length && !(p.motor_compact_pad && motorPatternUnchanged && report.unsupported_cutouts.every(owner => /^motor_(front|rear)_(left|right)$/.test(owner)))) reasons.push('New unsupported mounting-hole edge allowances need review.');
  if (report.motor_cables.status === 'fail') reasons.push('The selected cable allowance does not fit.');
  if (report.motor_screws.enabled && report.motor_screws.status === 'fail') reasons.push('Motor screw engagement is outside the selected limits.');
  if (report.lower_upper_intersection_mm3 > tolerance) reasons.push('Lower and upper printable solids intersect in the assembly.');
  if (report.controller_mount?.pin_to_roof_gap_mm < 0) reasons.push('Controller pins enter the upper deck.');
  return { acceptable: reasons.length === 0, reasons, caveat: 'Bed fit is geometric only. Existing motor/sweep-envelope and compact-pad edge-web warnings remain; purchased-part fit and flight readiness are unverified.' };
}
export function verifiedOrientation(result, bed, config) {
  const clearance = clearanceCheck(result, config);
  if (!clearance.acceptable) return null;
  const rotations = [...new Set([result.parameters.print_rotation_z, 0, 90, ...Array.from({ length: 36 }, (_, i) => i * 5)])];
  for (const rotation of rotations) { const check = bedCheck(result, bed, rotation); if (check.fits) return check; }
  return null;
}
export function fitCandidates(parameters, bed, config) {
  const p = structuredClone(parameters), margin = printMargin(p), radius = Math.max(p.prop_diameter / 2, config.datums.prop_reference_radius_mm);
  const minimum = radius + p.desired_prop_tip_gap / 2;
  const maxX = bed.width / 2 - p.motor_pad_diameter / 2 - margin, maxY = bed.depth / 2 - p.motor_pad_diameter / 2 - margin;
  const profile = config.printer_profiles.find(item => item.id === bed.id);
  const pairs = [[p.motor_x_offset, p.motor_y_offset], ...(profile ? [[profile.changes.motor_x_offset, profile.changes.motor_y_offset]] : []), ...config.printer_profiles.map(item => [item.changes.motor_x_offset, item.changes.motor_y_offset])];
  const xs = [...new Set([p.motor_x_offset, profile?.changes.motor_x_offset, maxX, maxY, minimum].filter(Number.isFinite))];
  const ys = [...new Set([p.motor_y_offset, profile?.changes.motor_y_offset, maxY, maxX, minimum].filter(Number.isFinite))];
  for (const x of xs) for (const y of ys) pairs.push([x, y]);
  const seen = new Set(), candidates = [];
  for (const [x, y] of pairs) {
    if (x < minimum - tolerance || y < minimum - tolerance || x > Math.max(maxX, maxY) + tolerance || y > Math.max(maxX, maxY) + tolerance) continue;
    const key = `${x}:${y}`; if (seen.has(key)) continue; seen.add(key);
    try { candidates.push(validateParameters({ ...p, motor_x_offset: x, motor_y_offset: y, printer_bed_width: bed.width, printer_bed_depth: bed.depth, printer_height: bed.height }, config)); } catch { /* Invalid geometry is never submitted as a fit candidate. */ }
  }
  return candidates;
}
