/**
 * Parametric B-rep model using OpenCascade.js bindings.
 * Units: millimeters (mm)
 *
 * Returns: oc.TopoDS_Shape
 */

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Base solid: box with corner at origin (0,0,0)
  // Use BRepPrimAPI_MakeBox with dx, dy, dz
  const mkBox = new oc.BRepPrimAPI_MakeBox_2(p.width, p.height, p.depth);
  let shape = mkBox.Shape();

  // Fillet all edges if radius > 0
  if (p.radius > 1e-9) {
    shape = filletAllEdges(oc, shape, p.radius);
  }

  return shape;
}

function filletAllEdges(oc, shape, radius) {
  const mk = new oc.BRepFilletAPI_MakeFillet(shape);

  // Iterate edges: TopExp_Explorer over TopAbs_EDGE
  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    // Add_2(radius, edge) is commonly exposed in bindings.
    mk.Add_2(radius, edge);
  }

  mk.Build(new oc.Message_ProgressRange_1());
  if (!mk.IsDone()) {
    throw new Error("Fillet failed (mk.IsDone() == false). Try a smaller radius.");
  }

  return mk.Shape();
}

function normalizeParams(params) {
  const width = clampNum(params?.width ?? 180, 60, 400);
  const height = clampNum(params?.height ?? 55, 20, 120);
  const depth = clampNum(params?.depth ?? 30, 10, 80);

  // Fillet radius: must be smaller than half the minimum dimension (roughly).
  const maxR = 0.49 * Math.min(width, height, depth);
  const radius = clampNum(params?.radius ?? 6, 0, maxR);

  return { width, height, depth, radius };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
