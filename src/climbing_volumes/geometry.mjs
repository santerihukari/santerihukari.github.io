import { Vector3 } from '../../assets/cad/coffee-filter/three/build/three.module.js';
import { ConvexHull } from '../../assets/cad/coffee-filter/three/examples/jsm/math/ConvexHull.js';
import { validateParameters } from './parameters.mjs';

const rad = Math.PI / 180, deg = 1 / rad, tolerance = 1e-6;
export const colors = ['#db7964', '#4c9fa6', '#d7ac48', '#8289b5', '#7aa76c', '#be789d', '#52788c', '#b7ae68', '#799cb5', '#c89464', '#78a795', '#989ca4'];
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(...a), unit = a => mul(a, 1 / norm(a));
const mean = points => mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
const clamp = v => Math.min(1, Math.max(-1, v)), label = i => String.fromCharCode(65 + i);
const bounds = vertices => [0, 1].map(end => [0, 1, 2].map(axis => (end ? Math.max : Math.min)(...vertices.map(v => v[axis]))));
const plane = (normal, limit, name, contact = null) => { const length = norm(normal); if (length < 1e-12) throw new Error('Coincident face planes have no usable miter.'); return { normal: mul(normal, 1 / length), limit: limit / length, name, contact }; };
const miter = (planes, i, j) => plane(sub(planes[j].normal, planes[i].normal), planes[j].limit - planes[i].limit, `Panel ${label(j)}`, j);

// Solve bounded convex halfspaces analytically; Three.js supplies the proven hull triangulation.
export function clipSolid(constraints) {
  const vertices = [];
  for (let i = 0; i < constraints.length; i++) for (let j = i + 1; j < constraints.length; j++) for (let k = j + 1; k < constraints.length; k++) {
    const [a, b, c] = [constraints[i], constraints[j], constraints[k]], bc = cross(b.normal, c.normal), determinant = dot(a.normal, bc);
    if (Math.abs(determinant) < 1e-10) continue;
    const point = mul(add(add(mul(bc, a.limit), mul(cross(c.normal, a.normal), b.limit)), mul(cross(a.normal, b.normal), c.limit)), 1 / determinant);
    if (constraints.some(face => dot(point, face.normal) > face.limit + tolerance)) continue;
    if (!vertices.some(old => norm(sub(point, old)) < tolerance)) vertices.push(point);
  }
  if (vertices.length < 4) throw new Error('A plywood panel has no usable solid interior. Change thickness or shape.');
  const center = mean(vertices);
  if (constraints.some(face => face.limit - dot(face.normal, center) <= 1e-8)) throw new Error('The selected geometry collapses a panel.');
  const hull = new ConvexHull().setFromPoints(vertices.map(v => new Vector3(...v)));
  const used = [], indices = [], vertexIndex = new Map();
  for (const face of hull.faces) {
    let edge = face.edge;
    do { const point = edge.head().point; if (!vertexIndex.has(point)) { vertexIndex.set(point, used.length); used.push(point.toArray()); } indices.push(vertexIndex.get(point)); edge = edge.next; } while (edge !== face.edge);
  }
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) volume += dot(used[indices[i]], cross(used[indices[i + 1]], used[indices[i + 2]])) / 6;
  if (!Number.isFinite(volume) || volume < 1e-7) throw new Error('The selected shape has no usable volume.');
  return { vertices: used, indices, bounds: bounds(used), volume };
}

export function planePolygon(mesh, face) {
  const points = mesh.vertices.filter(point => Math.abs(dot(point, face.normal) - face.limit) < tolerance);
  if (points.length < 3) return [];
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const center = mean(points), u = unit(sub(points[0], center)), v = cross(face.normal, u);
  points.sort((a, b) => Math.atan2(dot(sub(a, center), v), dot(sub(a, center), u)) - Math.atan2(dot(sub(b, center), v), dot(sub(b, center), u)));
  const area = norm(points.reduce((s, point, i) => add(s, cross(sub(point, center), sub(points[(i + 1) % points.length], center))), [0, 0, 0])) / 2;
  return area > 1e-6 ? points : [];
}

function cornerLayout(p) {
  const r = p.brace_reach, h = r / Math.SQRT2 * Math.tan(p.opening_angle * rad / 2), middle = h * p.corner_mid_height_ratio, endReach = r * (1 - p.corner_mid_height_ratio), count = p.corner_segments;
  if (count > 0 && p.corner_bulge_ratio >= p.corner_mid_height_ratio / 2) throw new Error('Front bulge must be less than half the middle-height ratio to keep triangular end caps.');
  if (count > 1 && p.corner_bulge_ratio < 1e-6) throw new Error('Multiple side bands need a positive bulge. Use one band for a rectangular front.');
  if (p.corner_flat_faces && (count < 2 || p.corner_bulge_ratio <= 0)) throw new Error('Mirrored flat faces need at least two bands and a positive bulge.');
  const z = Array.from({ length: count + 1 }, (_, i) => middle - (count ? 2 * middle * i / count : 0)), q = z.map(value => endReach + r * p.corner_bulge_ratio * (1 - (value / middle) ** 2));
  const planes = [plane([h / r, h / r, 1], h, 'Panel A'), plane([h / r, h / r, -1], h, 'Panel B')], roles = ['end_cap', 'end_cap'];
  for (let i = 0; i < count; i++) { const slope = (q[i + 1] - q[i]) / (z[i + 1] - z[i]); planes.push(plane([1, 1, -slope], q[i] - slope * z[i], `Panel ${label(planes.length)}`)); roles.push('side_band'); }
  if (p.corner_flat_faces) { const limit = endReach + (Math.max(...q) - endReach) * p.cap_depth_ratio; planes.push(plane([0, 1, 0], limit, `Panel ${label(planes.length)}`), plane([1, 0, 0], limit, `Panel ${label(planes.length + 1)}`)); roles.push('flat_to_plane_1', 'flat_to_plane_2'); }
  const references = [plane([0, -1, 0], 0, 'Plane 1'), plane([-1, 0, 0], 0, 'Plane 2')], envelope = clipSolid([...references, ...planes]);
  return { planes, references, roles, bounds: envelope.bounds, halfHeight: h, nominalHalfHeight: h, projection: envelope.bounds[1][1], nominalTilts: planes.map(face => Math.acos(clamp(face.normal[1])) * deg) };
}

export function cyclicBase(lengths, rotation) {
  const longest = lengths.indexOf(Math.max(...lengths)), sum = lengths.reduce((a, b) => a + b, 0);
  if (lengths[longest] >= sum - lengths[longest] - 1e-7) throw new Error('Wall-edge lengths cannot close: the longest side must be shorter than all other sides combined.');
  const angles = radius => lengths.map(length => 2 * Math.asin(Math.min(1, length / (2 * radius))));
  const low = lengths[longest] / 2, residual = angles(low).reduce((a, b) => a + b, 0) - 2 * Math.PI, major = residual < -1e-10;
  const error = radius => { const a = angles(radius); return a.reduce((s, v) => s + v, 0) - (major ? 2 * a[longest] : 2 * Math.PI); };
  let radius = low;
  if (Math.abs(residual) > 1e-10) {
    let lo = low, hi = low * 2, left = error(lo);
    while (left * error(hi) > 0) { hi *= 2; if (hi > 1e9) throw new Error('Wall-edge lengths make an almost collapsed base. Use a less extreme combination.'); }
    // Bounded bisection reproduces the source's cyclic-polygon root without a numerical backend.
    for (let i = 0; i < 100 && hi - lo > 1e-10; i++) { const mid = (lo + hi) / 2, value = error(mid); if (left * value <= 0) hi = mid; else { lo = mid; left = value; } }
    radius = (lo + hi) / 2;
  }
  const turns = angles(radius); if (major) turns[longest] = 2 * Math.PI - turns[longest];
  let phi = rotation;
  const points = turns.map(turn => { const point = [radius * Math.cos(phi), radius * Math.sin(phi)]; phi += turn; return point; }), center = [0, 1].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
  return points.map(point => point.map((v, axis) => v - center[axis]));
}

function flatLayout(p) {
  const count = p.surface_count, rotation = p.footprint_rotation * rad, reach = p.brace_reach;
  if (p.panel_tilts.includes(90) || p.panel_wall_lengths.some(length => length !== null)) {
    const angles = (p.panel_tilts.length ? p.panel_tilts : Array(count).fill(null)).map(angle => angle ?? p.flat_slope_angle);
    if (angles.includes(0) || !angles.some(angle => angle > 0 && angle < 90)) throw new Error('Perpendicular panels need at least one angled face below 90 degrees, and cannot use historical zero caps.');
    const chord = 2 * reach * Math.sin(Math.PI / count), lengths = (p.panel_wall_lengths.length ? p.panel_wall_lengths : Array(count).fill(null)).map(length => length ?? chord), points = cyclicBase(lengths, rotation), references = [plane([0, -1, 0], 0, 'Plane 1')];
    const planes = angles.map((angle, i) => {
      const point = points[i], edge = points[(i + 1) % count].map((v, axis) => v - point[axis]), length = Math.hypot(...edge), normal = [edge[1] / length, -edge[0] / length], distance = normal[0] * point[0] + normal[1] * point[1], radial = Math.sin(angle * rad);
      return plane([normal[0] * radial, angle === 90 ? 0 : Math.cos(angle * rad), normal[1] * radial], distance * radial, `Panel ${label(i)}`);
    });
    const envelope = clipSolid([...references, ...planes]);
    if (planes.some(face => planePolygon(envelope, face).length < 3)) throw new Error('Selected tilts remove a panel from the volume. Change the angles.');
    return { planes, references, roles: angles.map(angle => angle === 90 ? 'perpendicular' : 'primary'), bounds: envelope.bounds, halfHeight: (envelope.bounds[1][2] - envelope.bounds[0][2]) / 2, nominalHalfHeight: (envelope.bounds[1][2] - envelope.bounds[0][2]) / 2, projection: envelope.bounds[1][1], nominalTilts: Array(count).fill(p.flat_slope_angle) };
  }
  let wall = Array.from({ length: count }, (_, i) => [reach * Math.cos(rotation + i * 2 * Math.PI / count), 0, reach * Math.sin(rotation + i * 2 * Math.PI / count)]);
  const apex = [0, reach * Math.cos(Math.PI / count) * Math.tan(p.flat_slope_angle * rad), 0], interior = mean([...wall, apex]);
  const planes = wall.map((point, i) => {
    let normal = unit(cross(sub(wall[(i + 1) % count], point), sub(apex, point)));
    if (dot(normal, sub(mean([point, wall[(i + 1) % count], apex]), interior)) < 0) normal = mul(normal, -1);
    return plane(normal, dot(normal, point), `Panel ${label(i)}`);
  });
  const nominalTilts = planes.map(face => Math.acos(clamp(face.normal[1])) * deg), nominalBounds = bounds([...wall, apex]);
  const references = [plane([0, -1, 0], 0, 'Plane 1')];
  if (p.panel_tilts.some(angle => angle !== null)) {
    p.panel_tilts.forEach((angle, i) => { if (angle === null || angle === 0) return; const radial = unit([planes[i].normal[0], 0, planes[i].normal[2]]), beta = angle * rad, normal = [radial[0] * Math.sin(beta), Math.cos(beta), radial[2] * Math.sin(beta)]; planes[i] = plane(normal, dot(normal, apex), `Panel ${label(i)}`); });
    wall = wall.map((_, i) => { const a = planes[(i - 1 + count) % count], b = planes[i], determinant = a.normal[0] * b.normal[2] - a.normal[2] * b.normal[0]; if (Math.abs(determinant) < 1e-10) throw new Error('Selected tilts make adjacent faces parallel.'); return [(a.limit * b.normal[2] - a.normal[2] * b.limit) / determinant, 0, (a.normal[0] * b.limit - a.limit * b.normal[0]) / determinant]; });
    const vertices = [...wall, apex], epsilon = Math.max(1, ...vertices.flat().map(Math.abs)) * 1e-8;
    if (planes.some(face => vertices.some(v => dot(v, face.normal) > face.limit + epsilon))) throw new Error('Selected tilts make a triangle disappear or reverse. Use a closer combination of angles.');
  }
  const box = bounds([...wall, apex]), capDepth = p.panel_tilts.includes(0) ? apex[1] * p.cap_depth_ratio : null;
  if (capDepth !== null && capDepth <= p.plywood_thickness) throw new Error('Flat cap depth must exceed plywood thickness.');
  return { planes, references, bounds: box, halfHeight: (box[1][2] - box[0][2]) / 2, nominalHalfHeight: (nominalBounds[1][2] - nominalBounds[0][2]) / 2, projection: capDepth ?? apex[1], nominalTilts, capDepth };
}

function buildPanels(p, raw) {
  const planes = [...raw.planes], refs = raw.references, zeros = p.panel_tilts.flatMap((angle, i) => angle === 0 ? [i] : []), assignments = [];
  if (p.mounting_faces === 2) planes.forEach((_, i) => assignments.push({ index: i, face: i, seams: [], role: raw.roles[i], source: i }));
  else {
    const cap = planes.length;
    if (zeros.length) planes.push(plane([0, 1, 0], raw.capDepth, 'Flat front cap'));
    const anchors = Object.fromEntries(zeros.map(i => [i, unit([raw.planes[i].normal[0], 0, raw.planes[i].normal[2]])]));
    for (let i = 0; i < p.surface_count; i++) assignments.push({ index: i, face: zeros.includes(i) ? cap : i, seams: zeros.includes(i) ? zeros.filter(j => j !== i).map(j => plane(sub(anchors[j], anchors[i]), 0, `Panel ${label(j)}`, j)) : [], role: zeros.includes(i) ? 'flat_front_cap' : (raw.roles?.[i] ?? 'primary'), source: zeros.length ? i : null });
    zeros.forEach((i, k) => assignments.push({ index: p.surface_count + k, face: i, seams: [], role: 'transition', source: i }));
  }
  if (p.plywood_thickness >= Math.min(...planes.map(face => face.limit))) throw new Error('Thickness consumes a face. Reduce thickness or increase the volume size.');
  const owners = new Map(planes.map((_, i) => [i, assignments.filter(a => a.face === i).map(a => a.index)]));
  const panels = assignments.map(a => {
    const own = planes[a.face], bisectors = planes.flatMap((_, j) => j === a.face ? [] : [miter(planes, a.face, j)]), innerPlane = plane(own.normal, own.limit - p.plywood_thickness, 'Short face');
    const mesh = clipSolid([...refs, ...planes, ...bisectors, ...a.seams, plane(mul(innerPlane.normal, -1), -innerPlane.limit, 'Inside')]);
    const outer = planePolygon(mesh, own), inner = planePolygon(mesh, innerPlane);
    if (outer.length < 3 || inner.length < 3) throw new Error(`Panel ${label(a.index)} loses a face. Reduce thickness or change the profile.`);
    return { ...a, plane: own, mesh, outer, inner, rawCuts: [...refs, ...bisectors, ...a.seams].filter(cut => planePolygon(mesh, cut).length >= 3), cuts: [], contacts: [], edges: [], extra: [] };
  });
  for (const panel of panels) {
    for (const cut of panel.rawCuts) {
      const ids = panel.seams.includes(cut) ? [cut.contact] : cut.contact === null ? [] : owners.get(cut.contact);
      if (!ids.length) { panel.cuts.push(cut); panel.contacts.push({ name: cut.name, contact_panel: null, vertices_mm: planePolygon(panel.mesh, cut) }); }
      for (const other of ids) {
        const polygon = planePolygon(ids.length === 1 ? panel.mesh : panels[other].mesh, cut);
        if (polygon.length < 3) continue;
        const contact = { ...cut, name: `Panel ${label(other)}`, contact: other }; panel.cuts.push(contact); panel.contacts.push({ name: contact.name, contact_panel: label(other), vertices_mm: polygon });
      }
    }
    panel.edges = panel.outer.map((point, i) => { const cut = panel.cuts.find(face => [point, panel.outer[(i + 1) % panel.outer.length]].every(v => Math.abs(dot(v, face.normal) - face.limit) < tolerance)); if (!cut) throw new Error(`Panel ${label(panel.index)} has an unmatched edge.`); return cut; });
    panel.extra = panel.cuts.filter(cut => !panel.edges.some(edge => norm(sub(edge.normal, cut.normal)) < 1e-8 && Math.abs(edge.limit - cut.limit) < 1e-8));
  }
  return panels;
}

function outline(points) {
  const u = unit(sub(points[1], points[0])), n = unit(cross(sub(points[1], points[0]), sub(points[2], points[0]))), v = cross(n, u);
  return points.map(point => [dot(sub(point, points[0]), u), dot(sub(point, points[0]), v)]);
}
function panelReport(panel, raw) {
  const count = panel.outer.length, bevel = cut => Math.asin(clamp(Math.abs(dot(panel.plane.normal, cut.normal)))) * deg;
  const tilt = Math.acos(clamp(panel.plane.normal[1])) * deg;
  return { id: label(panel.index), role: panel.role, source_index: panel.source, shape: count === 3 ? 'triangle' : count === 4 ? 'quadrilateral' : `${count}-sided polygon`,
    corner_angles_deg: panel.outer.map((point, i) => { const a = sub(panel.outer[(i + 1) % count], point), b = sub(panel.outer[(i - 1 + count) % count], point); return Math.acos(clamp(dot(a, b) / norm(a) / norm(b))) * deg; }),
    outer_outline_xy_mm: outline(panel.outer), local_long_face_vertices_mm: panel.outer, local_short_face_vertices_mm: panel.inner, normal: panel.plane.normal, long_face_plane_mm: panel.plane.limit,
    edges: panel.edges.map((cut, i) => { const short = panel.inner.filter(point => Math.abs(dot(point, cut.normal) - cut.limit) < tolerance); return { name: cut.name, contact_panel: cut.contact === null ? null : label(cut.contact), long_edge_mm: norm(sub(panel.outer[(i + 1) % count], panel.outer[i])), short_edge_mm: Math.max(0, ...short.flatMap(a => short.map(b => norm(sub(a, b))))), bevel_from_square_deg: bevel(cut), cut_plane_to_face_deg: 90 - bevel(cut), cut_plane_normal: cut.normal, cut_plane_limit_mm: cut.limit }; }),
    extra_cuts: panel.extra.map(cut => ({ name: `Apex / ${cut.name}`, contact_panel: cut.contact === null ? null : label(cut.contact), bevel_from_square_deg: bevel(cut), cut_plane_normal: cut.normal, cut_plane_limit_mm: cut.limit, contact_polygon_mm: planePolygon(panel.mesh, cut) })),
    cut_faces: panel.contacts, panel_volume_mm3: panel.mesh.volume, panel_watertight: true, color: colors[panel.index % colors.length], tilt_to_plane_1_deg: tilt, nominal_tilt_deg: raw.nominalTilts[panel.source ?? panel.index], tilt_reference_plane: panel.role === 'flat_to_plane_2' ? 2 : 1, tilt_to_reference_deg: panel.role === 'flat_to_plane_2' ? 0 : tilt };
}

export function buildVolume(values, config) {
  const p = validateParameters(values, config), raw = p.mounting_faces === 2 ? cornerLayout(p) : flatLayout(p), panels = buildPanels(p, raw), reports = panels.map(panel => panelReport(panel, raw));
  for (const report of reports) report.wall_edge_lengths_mm = report.edges.filter(edge => edge.name === 'Plane 1').map(edge => edge.long_edge_mm);
  const joints = panels.flatMap(panel => panel.cuts.filter(cut => cut.contact !== null && cut.contact > panel.index).map(cut => ({ panels: [label(panel.index), label(cut.contact)], included_angle_deg: 180 - Math.acos(clamp(dot(panel.plane.normal, panels[cut.contact].plane.normal))) * deg })));
  const tilts = reports.map(r => r.tilt_to_plane_1_deg), originalPair = panels.length === 2 && tilts.every((value, i) => Math.abs(value - raw.nominalTilts[i]) < 1e-7), identical = Math.max(...tilts) - Math.min(...tilts) < 1e-7 && (p.mounting_faces === 1 || Math.abs(raw.nominalHalfHeight - p.brace_reach) < 1e-8 || originalPair);
  const report = { model: 'climbing_crack_brace', parameters: p, units: 'mm', surface_mode: p.mounting_faces === 2 ? 'corner' : 'flat', surface_count: p.surface_count, minimum_surface_count: p.mounting_faces === 2 ? 2 : 3, reference_surface_count: p.mounting_faces, reference_planes: raw.references.map(face => ({ name: face.name, normal_local: face.normal, limit_mm: face.limit })), mounting_plane_angle_deg: p.mounting_faces === 2 ? 90 : null, pair_included_angle_deg: p.mounting_faces === 2 && !p.corner_segments ? p.opening_angle : null, pair_height_mm: 2 * raw.halfHeight, ridge_distance_mm: p.brace_reach / Math.SQRT2, volume_height_mm: 2 * raw.halfHeight, projection_mm: raw.projection, panels_per_volume: panels.length, total_panels: panels.length, end_cap_count: p.mounting_faces === 2 ? 2 : 0, end_caps_identical: p.mounting_faces === 2, mirror_symmetric: p.mounting_faces === 2, zero_tilt_cap: p.panel_tilts.includes(0), identical_triangles: identical, identical_panel_solids: identical, independent_tilts: p.panel_tilts.some(angle => angle !== null), tilt_reference: 'Acute dihedral angle of each long face to Plane 1 (Y=0).', preview_convention: 'Corner preview mirrors local X. STL and cut planes use local X >= 0, Y >= 0.', placement: originalPair && p.mounting_faces === 2 ? 'Rotate the second identical panel 180 degrees about local x=y; reference-plane edges exchange places.' : identical && p.mounting_faces === 1 ? 'Regular pyramid panels rotate about the reference-plane normal by 360 / panel count degrees.' : "Use each panel's own outline, bevels and any extra apex cuts.", panels: reports, joint_angles: joints, all_panels_watertight: true, extra_apex_cuts: reports.reduce((sum, panel) => sum + panel.extra_cuts.length, 0), structural_status: 'NOT VERIFIED - geometry only', angle_convention: 'Bevel from square: 0 degrees is perpendicular to the plywood face. Corner angles are long-face interior angles, not saw miter-dial settings. Polygon and cap joints can require additional trims; use the complete report.', assumptions: [p.mounting_faces === 2 ? 'Two ideal planes intersect at exactly 90 degrees.' : 'One ideal flat mounting plane.', 'Zero assembly clearance and no kerf allowance.', 'Reference planes are zero-thickness previews, not backing material.'], unresolved: ['Fasteners and connections to supporting structure', 'Load cases, dynamic climbing forces, deflection and stability', 'Plywood grade, grain, weather exposure and local structural requirements', 'Real plane alignment, saw setup, tolerances and cut test-fit'], copyright: 'Santeri Hukari' };
  const footprintRadius = Math.max(...panels.flatMap(panel => panel.mesh.vertices.map(v => Math.hypot(v[0], v[2]))));
  report.base_radius_reference = { center_mm: [0, 0, 0], plane: 'XZ', radius_mm: footprintRadius, diameter_mm: 2 * footprintRadius, nominal_radius_mm: p.brace_reach, basis: 'Enclosing circle of actual panel vertices projected onto the mounting plane; preview only' };
  report.independent_wall_lengths = p.panel_wall_lengths.some(length => length !== null);
  for (const key of ['corner_angles_deg', 'outer_outline_xy_mm', 'local_long_face_vertices_mm', 'local_short_face_vertices_mm', 'edges', 'panel_volume_mm3', 'panel_watertight']) report[key] = reports[0][key];
  const parts = panels.map(panel => {
    const mirror = p.mounting_faces === 2, vertices = panel.mesh.vertices.map(point => [mirror ? -point[0] : point[0], point[1], point[2]]), indices = [...panel.mesh.indices];
    if (mirror) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    return { name: `panel_${label(panel.index)}`, panel_id: label(panel.index), vertices, indices, color: reports[panel.index].color, explode_direction: [mirror ? -panel.plane.normal[0] : panel.plane.normal[0], ...panel.plane.normal.slice(1)] };
  });
  const box = structuredClone(raw.bounds); if (p.mounting_faces === 2) { box[0][0] = -raw.bounds[1][0]; box[1][0] = -raw.bounds[0][0]; }
  const margin = p.brace_reach * 0.3, lo = box[0].map(v => v - margin), hi = box[1].map(v => v + margin);
  parts.push({ name: 'mount_plane_1', reference: true, color: '#cbd4d7', vertices: [[lo[0], 0, lo[2]], [hi[0], 0, lo[2]], [hi[0], 0, hi[2]], [lo[0], 0, hi[2]]], indices: [0, 1, 2, 0, 2, 3] });
  if (p.mounting_faces === 2) parts.push({ name: 'mount_plane_2', reference: true, color: '#b4c8b7', vertices: [[0, 0, lo[2]], [0, hi[1], lo[2]], [0, hi[1], hi[2]], [0, 0, hi[2]]], indices: [0, 1, 2, 0, 2, 3] });
  return { parameters: p, report, parts, meshes: panels.map(panel => panel.mesh) };
}
