import * as THREE from "three";

/**
 * “Parametric model” placeholder.
 * For now it returns a simple box geometry. Later this should return a B-rep shape
 * built by the kernel, but the outward interface stays stable.
 *
 * Units: millimeters (mm)
 */
export function buildPortableHangboard(params) {
  const p = normalizeParams(params);

  // Minimal geometry: a box sized by params
  const geom = new THREE.BoxGeometry(p.width, p.height, p.depth, 1, 1, 1);

  return {
    kind: "geometry", // later could be "brep"
    geometry: geom,
    meta: {
      name: "portable_hangboard",
      units: "mm",
      params: p
    }
  };
}

function normalizeParams(params) {
  const width = clampNum(params?.width ?? 180, 60, 400);
  const height = clampNum(params?.height ?? 55, 20, 120);
  const depth = clampNum(params?.depth ?? 30, 10, 80);

  return { width, height, depth };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
