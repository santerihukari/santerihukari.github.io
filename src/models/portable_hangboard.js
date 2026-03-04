import * as THREE from "three";

/**
 * Units: mm
 * Mesh-only rounded box placeholder (NOT B-rep).
 * Later replace with kernel B-rep box + fillet.
 */
export function buildPortableHangboard(params) {
  const p = normalizeParams(params);

  const geom = makeRoundedBoxGeometry(
    p.width,
    p.height,
    p.depth,
    p.radius,
    p.radiusSegments
  );

  return {
    kind: "geometry",
    geometry: geom,
    meta: { name: "portable_hangboard", units: "mm", params: p }
  };
}

function normalizeParams(params) {
  const width = clampNum(params?.width ?? 180, 60, 400);
  const height = clampNum(params?.height ?? 55, 20, 120);
  const depth = clampNum(params?.depth ?? 30, 10, 80);

  const maxR = 0.49 * Math.min(width, height, depth);
  const radius = clampNum(params?.radius ?? 6, 0, maxR);

  const radiusSegments = clampInt(params?.radiusSegments ?? 6, 1, 16);

  return { width, height, depth, radius, radiusSegments };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function clampInt(x, lo, hi) {
  const n = Math.floor(Number(x));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Rounded box by building a box and "spherifying" corner regions.
 * This produces true rounded corners/edges as a mesh approximation.
 */
function makeRoundedBoxGeometry(width, height, depth, radius, segments) {
  // If radius is 0, fall back to normal box.
  if (radius <= 0) return new THREE.BoxGeometry(width, height, depth, 1, 1, 1);

  // More segments improves curvature; distribute segments over the whole box.
  // Ensure at least 2 segments along each axis so rounding has vertices to work with.
  const seg = Math.max(2, segments * 2);

  const g = new THREE.BoxGeometry(width, height, depth, seg, seg, seg);
  const pos = g.attributes.position;

  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;

  const innerX = hx - radius;
  const innerY = hy - radius;
  const innerZ = hz - radius;

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Clamp to the inner box; delta is how far we are into the rounded zone.
    const cx = THREE.MathUtils.clamp(v.x, -innerX, innerX);
    const cy = THREE.MathUtils.clamp(v.y, -innerY, innerY);
    const cz = THREE.MathUtils.clamp(v.z, -innerZ, innerZ);

    n.set(v.x - cx, v.y - cy, v.z - cz);

    if (n.lengthSq() > 1e-12) {
      n.normalize().multiplyScalar(radius);
      v.set(cx + n.x, cy + n.y, cz + n.z);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
