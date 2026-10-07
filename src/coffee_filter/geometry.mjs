import { validateParameters } from './parameters.mjs';

const { sin, cos, tan, sqrt, min, max, hypot, atan2, asin, acos, PI } = Math;
const DEG = PI / 180;
const STEPS = 6;

function requireGeometry(condition, message) {
  if (!condition) throw new Error(message);
}

function sideContact(p) {
  const guideRadius = p.radius + p.clearance;
  const halfSpan = (p.radius + p.tip_cut) / 2;
  const tilt = atan2(halfSpan, guideRadius) - asin(9 / hypot(guideRadius, halfSpan));
  const mid = (p.radius - p.tip_cut) * cos(tilt) / 2 + 9 + p.paper_drop;
  return { contact: mid - p.wall_height / 2, tilt: acos(mid / hypot(p.radius, guideRadius)) - atan2(guideRadius, p.radius) };
}

function guideFaces(p, contact, tilt, h) {
  const z = contact + h;
  const arc = -p.radius * sin(tilt) + sqrt((p.radius + p.clearance) ** 2 - (z - p.radius * cos(tilt)) ** 2);
  const straight = -z * tan(tilt) - p.clearance / cos(tilt);
  return [-arc, -straight];
}

function paperOutline(p, tilt) {
  const points = [];
  const half = p.angle * DEG / 2;
  const point = (distance, angle) => {
    const x = distance * sin(angle);
    const z = distance * cos(angle);
    if (p.layout === 'symmetric') return [x, z];
    const height = p.radius - z;
    return [-(x * cos(tilt) - height * sin(tilt)), x * sin(tilt) + height * cos(tilt)];
  };
  const start = p.layout === 'symmetric' ? -half : 0;
  const span = 2 * half;
  points.push(point(p.tip_cut, start));
  for (let i = 0; i <= 180; i++) points.push(point(p.radius, start + span * i / 180));
  points.push(point(p.tip_cut, start + span));
  return points;
}

// Direct port of the Python builders' layer, exterior-rounding and rim topology.
function shellMesh(p, facesAt) {
  const r = p.edge_radius;
  let heights = Array.from({ length: 7 }, (_, i) => r * i / STEPS)
    .concat(Array.from({ length: 7 }, (_, i) => p.wall_height - r + r * i / STEPS));
  if (p.layout === 'side_rest') {
    heights = [...new Set(heights.concat(Array.from({ length: 36 }, (_, i) => p.wall_height * i / 35)).map(h => Number(h.toFixed(8))))].sort((a, b) => a - b);
  }
  const vertices = [], triangles = [], rim = [];
  let outerCount = 0;
  for (const h of heights) {
    const distance = min(h, p.wall_height - h);
    const setback = distance < r ? r - sqrt(max(0, r * r - (r - distance) ** 2)) : 0;
    const [left, right] = facesAt(h);
    const outerLeft = left - p.wall_thickness + setback;
    const outerRight = right + p.wall_thickness - setback;
    const rear = -p.wall_thickness + setback;
    const front = p.usable_depth + p.wall_thickness - setback;
    const corner = r;
    const outer = [];
    const add = (x, y) => { outer.push([x, y]); return outer.length - 1; };
    const arc = (cx, cy, start) => Array.from({ length: STEPS }, (_, i) => add(cx + corner * cos(start + PI * (i + 1) / (2 * STEPS)), cy + corner * sin(start + PI * (i + 1) / (2 * STEPS))));
    const bl = add(outerLeft + corner, rear);
    const br = add(outerRight - corner, rear);
    const backRight = [br, ...arc(outerRight - corner, rear + corner, -PI / 2)];
    const rr = add(outerRight, 0);
    const rf = add(outerRight, p.usable_depth);
    const frontRight = [rf, add(outerRight, front - corner), ...arc(outerRight - corner, front - corner, 0)];
    const fr = frontRight.at(-1);
    const fl = add(outerLeft + corner, front);
    const frontLeft = [fl, ...arc(outerLeft + corner, front - corner, PI / 2)];
    const lf = add(outerLeft, p.usable_depth);
    const lr = add(outerLeft, 0);
    const backLeft = [lr, add(outerLeft, rear + corner)];
    for (let i = 1; i < STEPS; i++) backLeft.push(add(outerLeft + corner + corner * cos(PI + PI * i / (2 * STEPS)), rear + corner + corner * sin(PI + PI * i / (2 * STEPS))));
    backLeft.push(bl);
    if (!outerCount) {
      outerCount = outer.length;
      const [il, ir, ifr, ifl] = [0, 1, 2, 3].map(i => outerCount + i);
      const quad = (a, b, c, d) => rim.push([a, b, c], [a, c, d]);
      const fan = (route, inner) => { for (let i = 0; i < route.length - 1; i++) rim.push([route[i], route[i + 1], inner]); };
      quad(bl, br, ir, il); fan([...backRight, rr], ir);
      quad(rr, rf, ifr, ir); fan(frontRight, ifr);
      quad(fr, fl, ifl, ifr); fan([...frontLeft, lf], ifl);
      quad(lf, lr, il, ifl); fan(backLeft, il);
    }
    for (const [x, y] of [...outer, [left, 0], [right, 0], [right, p.usable_depth], [left, p.usable_depth]]) {
      vertices.push(x, y, p.front_rise * min(max(y, 0), p.usable_depth) / p.usable_depth + h);
    }
  }
  const stride = outerCount + 4;
  const quad = (a, b, c, d) => triangles.push(a, b, c, a, c, d);
  for (let layer = 0; layer < heights.length - 1; layer++) {
    const low = stride * layer, high = low + stride;
    for (let i = 0; i < outerCount; i++) {
      const next = (i + 1) % outerCount;
      quad(low + i, low + next, high + next, high + i);
    }
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      quad(low + outerCount + next, low + outerCount + i, high + outerCount + i, high + outerCount + next);
    }
  }
  for (const [layer, reverse] of [[0, true], [heights.length - 1, false]]) {
    for (const face of rim) triangles.push(...(reverse ? [...face].reverse() : face).map(i => stride * layer + i));
  }
  return { numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles) };
}

export function buildHolder(module, values) {
  const p = validateParameters(values);
  const half = p.angle * DEG / 2;
  const lowZ = p.tip_cut * cos(half);
  const side = p.layout === 'side_rest' ? sideContact(p) : null;
  const contact = side ? side.contact : (lowZ + p.radius - p.wall_height) / 2 + p.paper_drop;
  const tilt = side?.tilt || 0;
  const facesAt = side ? h => guideFaces(p, contact, tilt, h) : h => {
    const width = (contact + h) * tan(half) + p.clearance;
    return [-width, width];
  };
  requireGeometry(p.edge_radius < p.wall_thickness / 2 && p.edge_radius < p.wall_thickness - p.edge_radius, 'Exterior rounding must fit inside the wall thickness.');
  requireGeometry(p.wall_thickness - 1.7 >= 0.6, 'Countersinks need at least 0.6 mm of back-wall material.');
  if (side) {
    requireGeometry(p.front_rise < min(25, p.wall_height - 6.6), 'Front rise must leave space for the access holes.');
    const arcTop = p.radius * (cos(tilt) - cos(p.angle * DEG + tilt));
    const edgeTop = (p.radius - p.tip_cut) * cos(tilt);
    requireGeometry(contact >= 0 && contact + p.wall_height <= min(edgeTop, arcTop), 'Guide height and paper seating must keep the guides on both paper edges.');
  } else {
    requireGeometry(contact >= lowZ && contact + p.wall_height <= p.radius, 'Guide height and paper seating must keep the guides on the straight paper edges.');
  }
  const holeZ = min(25, p.wall_height - 6.6);
  const holeFaces = facesAt(holeZ);
  const center = side ? (holeFaces[0] + holeFaces[1]) / 2 : 0;
  const holeXs = [center - p.screw_spacing / 2, center + p.screw_spacing / 2];
  for (const [h, radius] of [[holeZ, 3.4], [holeZ - p.front_rise, 4]]) {
    const [left, right] = facesAt(h);
    requireGeometry(h - radius >= 3 && p.wall_height - h - radius >= 3, 'Mounting holes need at least 3 mm of wall above and below. Reduce front rise or increase guide height.');
    for (const x of holeXs) requireGeometry(x - left - radius >= 3 && right - x - radius >= 3, 'Mounting holes need at least 3 mm from the guides. Reduce screw spacing or increase the paper profile.');
  }

  const owned = [];
  const own = object => { owned.push(object); return object; };
  const cylinder = (length, low, high, x, y, z) => own(own(own(module.Manifold.cylinder(length, low, high, 64)).rotate([-90, 0, 0])).translate([x, y, z]));
  try {
    let solid = own(module.Manifold.ofMesh(new module.Mesh(shellMesh(p, facesAt))));
    requireGeometry(solid.status() === 'NoError', 'The shell could not form a valid solid.');
    for (const x of holeXs) {
      const holes = [
        cylinder(p.wall_thickness + 2, 1.7, 1.7, x, -p.wall_thickness - 1, holeZ),
        cylinder(1.85, 1.7, 3.55, x, -1.7, holeZ),
        cylinder(p.wall_thickness + 2, 4, 4, x, p.usable_depth - 1, holeZ)
      ];
      for (const hole of holes) solid = own(solid.subtract(hole));
    }
    const components = solid.decompose();
    components.forEach(own);
    requireGeometry(solid.status() === 'NoError' && components.length === 1 && solid.genus() === 5, 'The selected parameters did not produce one valid open-bottom holder with four mounting passages.');
    const mesh = solid.getMesh();
    const positions = new Float32Array(mesh.numVert * 3);
    for (let i = 0; i < mesh.numVert; i++) positions.set(mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3), i * 3);
    const box = solid.boundingBox();
    return {
      positions, indices: new Uint32Array(mesh.triVerts),
      paper_outline: paperOutline(p, tilt), contact_z: contact,
      bounds: [...box.min, ...box.max], volume: solid.volume(), genus: solid.genus(),
      hole_xs: holeXs, hole_z: holeZ, parameters: p
    };
  } finally {
    for (const object of owned.reverse()) object.delete();
  }
}
