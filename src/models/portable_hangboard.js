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

  // Always ensure something is visible even if fillet fails:
  // If radius is 0 => no fillet.
  if (p.radius > 1e-9) {
    shape = filletAllEdges(oc, shape, p.radius);
  }

  return shape;
}

function filletAllEdges(oc, shape, radius) {
  const filletMode = pickFilletShapeEnum(oc);

  const mk = makeMakeFillet(oc, shape, filletMode);

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    callFirstExisting(mk, ["Add_2", "Add_1", "Add"], [radius, edge]);
  }

  callFirstExisting(mk, ["Build_1", "Build"], [new oc.Message_ProgressRange_1()]);

  const isDone = mk.IsDone ? mk.IsDone() : true;
  if (!isDone) {
    throw new Error("Fillet failed (IsDone() == false). Try a smaller radius.");
  }

  if (typeof mk.Shape !== "function") {
    throw new Error("Fillet builder has no Shape() method in this build.");
  }

  return mk.Shape();
}

function makeMakeFillet(oc, shape, filletMode) {
  const C = oc.BRepFilletAPI_MakeFillet;
  if (typeof C !== "function") {
    throw new Error("oc.BRepFilletAPI_MakeFillet not available in this OpenCascade.js build.");
  }

  // Try likely ctor signatures in order.
  // Different builds expose overloads differently; some accept (shape),
  // others require (shape, mode).
  const ctors = [
    () => new C(shape, filletMode),
    () => new C(shape),
  ];

  for (const fn of ctors) {
    try {
      const obj = fn();
      // sanity check: must at least have Add and Shape methods
      if (obj && (obj.Add || obj.Add_1 || obj.Add_2) && typeof obj.Shape === "function") return obj;
    } catch (_) {
      // continue
    }
  }

  // If it still fails, provide a helpful hint for debugging.
  const keys = Object.keys(oc).filter((k) => k.includes("BRepFilletAPI_MakeFillet")).slice(0, 20);
  throw new Error(
    "Could not construct BRepFilletAPI_MakeFillet with available overloads. " +
      "OpenCascade.js overload naming differs in this build. " +
      `Seen keys: ${keys.join(", ")}`
  );
}

function callFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  throw new Error(`Missing method. Tried: ${methodNames.join(", ")}`);
}

function pickFilletShapeEnum(oc) {
  // Optional: only used when build requires a fillet mode.
  const e = oc.ChFi3d_FilletShape;
  if (e && typeof e === "object") {
    if ("ChFi3d_Rational" in e) return e.ChFi3d_Rational;
    if ("ChFi3d_QuasiAngular" in e) return e.ChFi3d_QuasiAngular;
    if ("ChFi3d_Polynomial" in e) return e.ChFi3d_Polynomial;
    if ("ChFi3d_ConstThroat" in e) return e.ChFi3d_ConstThroat;
  }
  // Fallback int enum value (often OK)
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
