/**
 * Parametric B-rep model using OpenCascade.js bindings.
 * Units: mm
 *
 * Returns: oc.TopoDS_Shape
 */
export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  const mkBox = new oc.BRepPrimAPI_MakeBox_2(p.width, p.height, p.depth);
  let shape = mkBox.Shape();

  if (p.radius > 1e-9) {
    shape = filletAllEdges(oc, shape, p.radius);
  }

  return shape;
}

function filletAllEdges(oc, shape, radius) {
  const filletShapeEnum = pickFilletShapeEnum(oc);

  // IMPORTANT: your bindings require 2 ctor params
  // BRepFilletAPI_MakeFillet_2(TopoDS_Shape, ChFi3d_FilletShape)
  const mk = new oc.BRepFilletAPI_MakeFillet_2(shape, filletShapeEnum);

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    mk.Add_2(radius, edge);
  }

  mk.Build(new oc.Message_ProgressRange_1());
  if (!mk.IsDone()) {
    throw new Error("Fillet failed (mk.IsDone() == false). Try a smaller radius.");
  }

  return mk.Shape();
}

function pickFilletShapeEnum(oc) {
  // Different OpenCascade.js builds expose enums differently.
  // Prefer the most common constants if present.
  const e = oc.ChFi3d_FilletShape;

  if (e && typeof e === "object") {
    if ("ChFi3d_Rational" in e) return e.ChFi3d_Rational;
    if ("ChFi3d_QuasiAngular" in e) return e.ChFi3d_QuasiAngular;
    if ("ChFi3d_Polynomial" in e) return e.ChFi3d_Polynomial;
    if ("ChFi3d_ConstThroat" in e) return e.ChFi3d_ConstThroat;
  }

  // Fallback: many bindings map enums to integers; 0 is often a valid default.
  return 0;
}

function normalizeParams(params) {
  const width = clampNum(params?.width ?? 180, 60, 400);
  const height = clampNum(params?.height ?? 55, 20, 120);
  const depth = clampNum(params?.depth ?? 30, 10, 80);

  const maxR = 0.49 * Math.min(width, height, depth);
  const radius = clampNum(params?.radius ?? 6, 0, maxR);

  return { width, height, depth, radius };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
