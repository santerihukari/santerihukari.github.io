// src/models/portable_hangboard.js

/**
 * Parametric B-rep model using OpenCascade.js bindings.
 * Units: mm
 *
 * Fingerboard-like tapered base (depthBottom -> depthTop) with a side-open finger slot
 * made by boolean-cutting a smaller tapered volume that deliberately protrudes out +X.
 *
 * Returns: oc.TopoDS_Shape
 */
export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Outer tapered body (loft between two rectangles)
  let outer = makeTaperedBlockLoft(oc, {
    width: p.width,
    height: p.height,
    depthBottom: p.depthBottom,
    depthTop: p.depthTop,
    // Outer block sits at x:[0..W], y:[0..D], z:[0..H]
    x0: 0,
    y0: 0,
    z0: 0
  });

  // Inner "negative" to create a finger slot opening on +X side.
  // It is inset in Y and Z by 'wall', and mostly inset in X, but its width is extended
  // by openSideExtra so it protrudes past x=width and opens the slot on one side.
  const inner = makeTaperedBlockLoft(oc, {
    width: Math.max(1, (p.width - 2 * p.wall) + p.openSideExtra),
    height: Math.max(1, p.height - 2 * p.wall),
    depthBottom: Math.max(1, p.depthBottom - 2 * p.wall),
    depthTop: Math.max(1, p.depthTop - 2 * p.wall),

    // Inset from left/back/bottom. Because width is extended, it exits on +X.
    x0: p.wall,
    y0: p.wall,
    z0: p.wall
  });

  let shape = cut(oc, outer, inner);

  // Optional fillet after cut (start conservative; post-boolean fillets can be fragile)
  if (p.radius > 1e-9) {
    shape = filletAllEdges(oc, shape, p.radius);
  }

  return shape;
}

/** Build a tapered block by lofting two rectangles at z=z0 and z=z0+height. */
function makeTaperedBlockLoft(oc, { width, height, depthBottom, depthTop, x0, y0, z0 }) {
  const w0 = makeRectangleWire(oc, x0, y0, z0, width, depthBottom);
  const w1 = makeRectangleWire(oc, x0, y0, z0 + height, width, depthTop);

  const Thru = oc.BRepOffsetAPI_ThruSections;
  if (typeof Thru !== "function") {
    throw new Error("oc.BRepOffsetAPI_ThruSections not available in this OpenCascade.js build.");
  }

  // Common signature: (isSolid, ruled, pres3dTol)
  const mk = makeThruSections(oc, true, false, 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w1]);
  callFirstExisting(mk, ["Build_1", "Build"], [new oc.Message_ProgressRange_1()]);

  if (typeof mk.IsDone === "function" && !mk.IsDone()) {
    throw new Error("ThruSections failed (IsDone() == false).");
  }
  if (typeof mk.Shape !== "function") {
    throw new Error("ThruSections builder has no Shape() method in this build.");
  }
  return mk.Shape();
}

function makeThruSections(oc, isSolid, ruled, tol) {
  const C = oc.BRepOffsetAPI_ThruSections;

  const ctors = [
    () => new C(isSolid, ruled, tol),
    () => new C(isSolid, ruled),
    () => new C(isSolid),
    () => new C()
  ];

  for (const fn of ctors) {
    try {
      const obj = fn();
      if (obj && (obj.AddWire || obj.AddWire_1) && typeof obj.Shape === "function") return obj;
    } catch (_) {
      // continue
    }
  }

  throw new Error("Could not construct BRepOffsetAPI_ThruSections with available overloads.");
}

/** Rectangle wire in XY plane at fixed Z: x:[x0..x0+w], y:[y0..y0+d]. */
function makeRectangleWire(oc, x0, y0, z, w, d) {
  const mkPoly = new oc.BRepBuilderAPI_MakePolygon_1();

  const p0 = new oc.gp_Pnt_3(x0, y0, z);
  const p1 = new oc.gp_Pnt_3(x0 + w, y0, z);
  const p2 = new oc.gp_Pnt_3(x0 + w, y0 + d, z);
  const p3 = new oc.gp_Pnt_3(x0, y0 + d, z);

  callFirstExisting(mkPoly, ["Add_1", "Add"], [p0]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p1]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p2]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p3]);

  callFirstExisting(mkPoly, ["Close_1", "Close"], []);
  if (typeof mkPoly.Wire !== "function") throw new Error("MakePolygon has no Wire() in this build.");
  return mkPoly.Wire();
}

function cut(oc, a, b) {
  const C = oc.BRepAlgoAPI_Cut;
  if (typeof C !== "function") throw new Error("oc.BRepAlgoAPI_Cut not available in this build.");

  const ctors = [() => new C(a, b), () => new C(a, b, new oc.Message_ProgressRange_1())];

  for (const fn of ctors) {
    try {
      const obj = fn();
      callFirstExisting(obj, ["Build_1", "Build"], [new oc.Message_ProgressRange_1()]);
      if (typeof obj.IsDone === "function" && !obj.IsDone()) continue;
      if (typeof obj.Shape === "function") return obj.Shape();
    } catch (_) {
      // continue
    }
  }

  throw new Error("Boolean cut failed (could not build or no Shape()).");
}

/* --- existing fillet helpers --- */

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

  const ctors = [() => new C(shape, filletMode), () => new C(shape)];

  for (const fn of ctors) {
    try {
      const obj = fn();
      // sanity check: must at least have Add and Shape methods
      if (obj && (obj.Add || obj.Add_1 || obj.Add_2) && typeof obj.Shape === "function") return obj;
    } catch (_) {
      // continue
    }
  }

  const keys = Object.keys(oc).filter((k) => k.includes("BRepFilletAPI_MakeFillet")).slice(0, 20);
  throw new Error(
    "Could not construct BRepFilletAPI_MakeFillet with available overloads. " +
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

  // Tapered depth
  const depthBottom = clampNum(params?.depthBottom ?? 22, 8, 120);
  const depthTop = clampNum(params?.depthTop ?? 14, 4, depthBottom);

  // Slot wall thickness + extra protrusion to open on +X side
  const wall = clampNum(params?.wall ?? 4, 1, 0.45 * Math.min(width, height, depthTop, depthBottom));
  const openSideExtra = clampNum(params?.openSideExtra ?? 6, 0.5, 30);

  // Fillet radius (keep conservative because post-boolean fillets can be fragile)
  const maxR = 0.2 * Math.min(width, height, depthTop, depthBottom);
  const radius = clampNum(params?.radius ?? 0, 0, maxR);

  return { width, height, depthBottom, depthTop, wall, openSideExtra, radius };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
