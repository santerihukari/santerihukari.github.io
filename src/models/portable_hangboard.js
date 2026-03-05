// src/models/portable_hangboard.js

/**
 * Parametric fingerboard-like B-rep model using OpenCascade.js bindings.
 * Units: mm
 *
 * IMPORTANT for your OCCT build:
 * - BRepPrimAPI_MakeBox placement overloads are NOT available (only MakeBox_2 at origin).
 * - Therefore, ALL “boxes” are built via ThruSections between two rectangle wires at the desired coordinates.
 *
 * Design (OpenSCAD-inspired):
 *  - Outer body: base prism up to loft_z_start + tapered cap (loft to an inset rectangle)
 *  - Pocket: rectangular void cut from the FRONT (y=0) spanning pocket height
 *  - Attachment holes: through cylinders (Y axis) + entry chamfers as cones (if available)
 *  - Global fillet: fillet ALL edges of the final solid (includes pocket edges + hole entrances)
 *
 * Returns: oc.TopoDS_Shape
 */
export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Derived dimensions / coordinates (matching the OpenSCAD intent)
  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;

  const x0 = p.side_wall;
  const z0 = p.bottom_wall;

  const z1 = z0 + p.pocket_h;
  const loft_z_start = z1 + p.gap_above_slot;
  const block_h = loft_z_start + p.top_extra;

  // ---------- Outer body ----------
  // Base prism: [0..block_w] x [0..block_d] x [0..loft_z_start]
  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);

  // Tapered cap: loft between full rectangle at z=loft_z_start
  // and inset rectangle at z=block_h
  const cap = makeLoftedCap(oc, {
    w0: block_w,
    d0: block_d,
    z0: loft_z_start,
    x0: 0,
    y0: 0,

    w1: block_w - 2 * p.loft_inset_x,
    d1: block_d - 2 * p.loft_inset_y,
    z1: block_h,
    x1: p.loft_inset_x,
    y1: p.loft_inset_y
  });

  let shape = booleanFuseAdaptive(oc, base, cap);

  // ---------- Pocket cut ----------
  // Pocket starts at front (y=0) and extends to y=pocket_d.
  // Robustness: extend slightly out of front (negative y) and slightly past pocket depth.
  const pocket = makePrismAt(
    oc,
    x0,
    -p.eps,
    z0,
    p.pocket_w,
    p.pocket_d + 2 * p.eps,
    p.pocket_h
  );

  shape = booleanCutAdaptive(oc, shape, pocket);

  // ---------- Attachment holes + chamfers ----------
  // These rely on MakeCylinder/MakeCone with gp_Ax2 placement. If unavailable, remove these calls.
  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;
  const hole_z = loft_z_start + p.hole_z_offset;

  // Through holes (Y axis)
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xa, hole_z, block_d, p.hole_d));
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xb, hole_z, block_d, p.hole_d));

  // Entry chamfers as conical cuts
  if (p.hole_chamfer > 1e-9) {
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeFront(oc, hole_xa, hole_z, p.hole_d, p.hole_chamfer));
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeFront(oc, hole_xb, hole_z, p.hole_d, p.hole_chamfer));

    shape = booleanCutAdaptive(
      oc,
      shape,
      makeHoleChamferConeBack(oc, hole_xa, hole_z, block_d, p.hole_d, p.hole_chamfer)
    );
    shape = booleanCutAdaptive(
      oc,
      shape,
      makeHoleChamferConeBack(oc, hole_xb, hole_z, block_d, p.hole_d, p.hole_chamfer)
    );
  }

  // ---------- Global fillet (ALL edges) ----------
  // This will fillet outer edges + pocket edges + hole entry edges.
  if (p.fillet_r > 1e-9) {
    shape = filletAllEdges(oc, shape, p.fillet_r);
  }

  return shape;
}

/* ----------------------------- “Boxes” via ruled loft prisms ----------------------------- */

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  if (dx <= 0 || dy <= 0 || dz <= 0) throw new Error("makePrismAt: non-positive dimensions.");

  const w0 = makeRectangleWire(oc, x, y, z, dx, dy);
  const w1 = makeRectangleWire(oc, x, y, z + dz, dx, dy);

  const Thru = oc.BRepOffsetAPI_ThruSections;
  if (typeof Thru !== "function") {
    throw new Error("oc.BRepOffsetAPI_ThruSections not available in this OpenCascade.js build.");
  }

  // Ruled loft between identical wires -> prism. Solid=true is critical.
  const mk = makeThruSections(oc, /*isSolid*/ true, /*ruled*/ true, /*tol*/ 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w1]);

  tryCallFirstExisting(mk, ["CheckCompatibility_1", "CheckCompatibility"], [true]);

  const pr = safeNewProgressRange(oc);
  if (pr) tryCallFirstExisting(mk, ["Build_1", "Build"], [pr]);
  tryCallFirstExisting(mk, ["Build"], []);

  if (typeof mk.IsDone === "function" && !mk.IsDone()) {
    throw new Error("makePrismAt: ThruSections failed (IsDone() == false).");
  }
  if (typeof mk.Shape !== "function") {
    throw new Error("makePrismAt: ThruSections builder has no Shape() method in this build.");
  }

  return mk.Shape();
}

/* ----------------------------- Outer cap (loft) ----------------------------- */

function makeLoftedCap(oc, { w0, d0, z0, x0, y0, w1, d1, z1, x1, y1 }) {
  if (w1 <= 0 || d1 <= 0) {
    throw new Error("Invalid loft inset: top rectangle became non-positive.");
  }

  const wire0 = makeRectangleWire(oc, x0, y0, z0, w0, d0);
  const wire1 = makeRectangleWire(oc, x1, y1, z1, w1, d1);

  const Thru = oc.BRepOffsetAPI_ThruSections;
  if (typeof Thru !== "function") {
    throw new Error("oc.BRepOffsetAPI_ThruSections not available in this OpenCascade.js build.");
  }

  const mk = makeThruSections(oc, /*isSolid*/ true, /*ruled*/ false, /*tol*/ 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [wire0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [wire1]);

  tryCallFirstExisting(mk, ["CheckCompatibility_1", "CheckCompatibility"], [true]);

  const pr = safeNewProgressRange(oc);
  if (pr) tryCallFirstExisting(mk, ["Build_1", "Build"], [pr]);
  tryCallFirstExisting(mk, ["Build"], []);

  if (typeof mk.IsDone === "function" && !mk.IsDone()) {
    throw new Error("Cap loft failed (IsDone() == false).");
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
      if (obj && (obj.AddWire || obj.AddWire_1) && typeof obj.Shape === "function") {
        // If ctor did not accept flags, try setters (no-op if missing)
        tryCallFirstExisting(obj, ["SetSolid_1", "SetSolid"], [!!isSolid]);
        tryCallFirstExisting(obj, ["SetRuled_1", "SetRuled"], [!!ruled]);
        if (Number.isFinite(tol)) tryCallFirstExisting(obj, ["SetPres3d_1", "SetPres3d"], [tol]);
        return obj;
      }
    } catch (_) {
      // continue
    }
  }

  throw new Error("Could not construct BRepOffsetAPI_ThruSections with available overloads.");
}

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

/* ----------------------------- Holes (Y-axis primitives) ----------------------------- */

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const r = hole_d / 2;

  const Cyl = oc.BRepPrimAPI_MakeCylinder;
  if (typeof Cyl !== "function") throw new Error("oc.BRepPrimAPI_MakeCylinder not available.");

  // Axis along +Y starting before the block and going past it
  const yStart = -30;
  const h = block_d + 60;

  const origin = new oc.gp_Pnt_3(xc, yStart, zc);
  const dir = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = new oc.gp_Ax2_2(origin, dir);

  const ctors = [
    () => new Cyl(ax2, r, h),
    () => new Cyl(ax2, r),
    () => new Cyl(r, h),
    () => new Cyl(r)
  ];

  for (const fn of ctors) {
    try {
      const mk = fn();
      if (mk && typeof mk.Shape === "function") return mk.Shape();
    } catch (_) {}
  }

  throw new Error("Could not construct BRepPrimAPI_MakeCylinder with available overloads.");
}

function makeHoleChamferConeFront(oc, xc, zc, hole_d, chamfer) {
  // Near y=0 (front). Cone axis along +Y, small height ~ chamfer.
  // d1 = hole_d + 2*chamfer -> d2 = hole_d
  return makeConeY(oc, xc, /*y*/ -0.01, zc, /*h*/ chamfer + 0.02, (hole_d + 2 * chamfer) / 2, hole_d / 2);
}

function makeHoleChamferConeBack(oc, xc, zc, block_d, hole_d, chamfer) {
  // Near y=block_d (back). Cone axis along +Y.
  // d1 = hole_d -> d2 = hole_d + 2*chamfer
  return makeConeY(
    oc,
    xc,
    /*y*/ block_d - chamfer - 0.01,
    zc,
    /*h*/ chamfer + 0.02,
    hole_d / 2,
    (hole_d + 2 * chamfer) / 2
  );
}

function makeConeY(oc, xc, y0, zc, h, r1, r2) {
  const Cone = oc.BRepPrimAPI_MakeCone;
  if (typeof Cone !== "function") throw new Error("oc.BRepPrimAPI_MakeCone not available.");

  const origin = new oc.gp_Pnt_3(xc, y0, zc);
  const dir = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = new oc.gp_Ax2_2(origin, dir);

  const ctors = [() => new Cone(ax2, r1, r2, h), () => new Cone(r1, r2, h)];

  for (const fn of ctors) {
    try {
      const mk = fn();
      if (mk && typeof mk.Shape === "function") return mk.Shape();
    } catch (_) {}
  }

  throw new Error("Could not construct BRepPrimAPI_MakeCone with available overloads.");
}

/* ----------------------------- Boolean ops (adaptive) ----------------------------- */

function booleanCutAdaptive(oc, a, b) {
  const candidates = [];

  if (typeof oc.BRepAlgoAPI_Cut === "function") candidates.push(oc.BRepAlgoAPI_Cut);
  for (let i = 1; i <= 9; i++) {
    const k = `BRepAlgoAPI_Cut_${i}`;
    if (typeof oc[k] === "function") candidates.push(oc[k]);
  }

  if (candidates.length === 0) {
    const hint = Object.keys(oc).filter((k) => k.includes("BRepAlgoAPI")).slice(0, 80);
    throw new Error(`No BRepAlgoAPI_Cut constructor found. Seen keys: ${hint.join(", ")}`);
  }

  const progress = safeNewProgressRange(oc);

  for (const C of candidates) {
    const ctors = [() => new C(a, b), () => (progress ? new C(a, b, progress) : null), () => new C()].filter(Boolean);

    for (const make of ctors) {
      let op = null;
      try {
        op = make();
      } catch (_) {
        continue;
      }
      if (!op) continue;

      trySetArgsAndTools(oc, op, a, b);

      if (progress) tryCallFirstExisting(op, ["Build_1", "Build"], [progress]);
      tryCallFirstExisting(op, ["Build"], []);

      if (typeof op.IsDone === "function" && !op.IsDone()) continue;
      if (typeof op.Shape === "function") {
        try {
          const out = op.Shape();
          if (out) return out;
        } catch (_) {}
      }
    }
  }

  const seen = Object.keys(oc)
    .filter((k) => k.includes("BRepAlgoAPI_Cut") || k.includes("BOPAlgo") || k.includes("Boolean"))
    .slice(0, 120);

  throw new Error(
    "Boolean cut failed (could not build or no Shape()). " + `Seen boolean-related keys: ${seen.join(", ")}`
  );
}

function booleanFuseAdaptive(oc, a, b) {
  const candidates = [];

  if (typeof oc.BRepAlgoAPI_Fuse === "function") candidates.push(oc.BRepAlgoAPI_Fuse);
  for (let i = 1; i <= 9; i++) {
    const k = `BRepAlgoAPI_Fuse_${i}`;
    if (typeof oc[k] === "function") candidates.push(oc[k]);
  }

  if (candidates.length === 0) {
    const hint = Object.keys(oc).filter((k) => k.includes("BRepAlgoAPI")).slice(0, 80);
    throw new Error(`No BRepAlgoAPI_Fuse constructor found. Seen keys: ${hint.join(", ")}`);
  }

  const progress = safeNewProgressRange(oc);

  for (const C of candidates) {
    const ctors = [() => new C(a, b), () => (progress ? new C(a, b, progress) : null), () => new C()].filter(Boolean);

    for (const make of ctors) {
      let op = null;
      try {
        op = make();
      } catch (_) {
        continue;
      }
      if (!op) continue;

      trySetArgsAndTools(oc, op, a, b);

      if (progress) tryCallFirstExisting(op, ["Build_1", "Build"], [progress]);
      tryCallFirstExisting(op, ["Build"], []);

      if (typeof op.IsDone === "function" && !op.IsDone()) continue;
      if (typeof op.Shape === "function") {
        try {
          const out = op.Shape();
          if (out) return out;
        } catch (_) {}
      }
    }
  }

  const seen = Object.keys(oc)
    .filter((k) => k.includes("BRepAlgoAPI_Fuse") || k.includes("BOPAlgo") || k.includes("Boolean"))
    .slice(0, 120);

  throw new Error(
    "Boolean fuse failed (could not build or no Shape()). " + `Seen boolean-related keys: ${seen.join(", ")}`
  );
}

function trySetArgsAndTools(oc, op, a, b) {
  if (typeof op.SetArguments === "function") {
    const list = makeShapeList(oc, [a]);
    if (list) {
      try {
        op.SetArguments(list);
      } catch (_) {}
    }
  }
  if (typeof op.SetTools === "function") {
    const list = makeShapeList(oc, [b]);
    if (list) {
      try {
        op.SetTools(list);
      } catch (_) {}
    }
  }

  tryCallFirstExisting(op, ["SetShape1_1", "SetShape1"], [a]);
  tryCallFirstExisting(op, ["SetShape2_1", "SetShape2"], [b]);

  tryCallFirstExisting(op, ["SetArgument_1", "SetArgument"], [a]);
  tryCallFirstExisting(op, ["SetTool_1", "SetTool"], [b]);

  tryCallFirstExisting(op, ["SetFuzzyValue_1", "SetFuzzyValue"], [1e-6]);
}

function makeShapeList(oc, shapes) {
  const listCands = ["TopTools_ListOfShape", "TopTools_ListOfShape_1"];
  for (const name of listCands) {
    const L = oc[name];
    if (typeof L !== "function") continue;
    try {
      const list = new L();
      for (const s of shapes) {
        const ok = tryCallFirstExisting(list, ["Append_1", "Append", "Push_1", "Push"], [s]);
        if (!ok) return null;
      }
      return list;
    } catch (_) {}
  }
  return null;
}

function safeNewProgressRange(oc) {
  try {
    if (typeof oc.Message_ProgressRange_1 === "function") return new oc.Message_ProgressRange_1();
    if (typeof oc.Message_ProgressRange === "function") return new oc.Message_ProgressRange();
  } catch (_) {}
  return null;
}

/* ----------------------------- Fillet ALL edges ----------------------------- */

function filletAllEdges(oc, shape, radius) {
  const filletMode = pickFilletShapeEnum(oc);
  const mk = makeMakeFillet(oc, shape, filletMode);

  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    callFirstExisting(mk, ["Add_2", "Add_1", "Add"], [radius, edge]);
  }

  const pr = safeNewProgressRange(oc);
  if (pr) tryCallFirstExisting(mk, ["Build_1", "Build"], [pr]);
  tryCallFirstExisting(mk, ["Build"], []);

  const isDone = mk.IsDone ? mk.IsDone() : true;
  if (!isDone) {
    throw new Error("Fillet failed (IsDone() == false). Try a smaller fillet radius.");
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
      if (obj && (obj.Add || obj.Add_1 || obj.Add_2) && typeof obj.Shape === "function") return obj;
    } catch (_) {}
  }

  const keys = Object.keys(oc).filter((k) => k.includes("BRepFilletAPI_MakeFillet")).slice(0, 30);
  throw new Error("Could not construct BRepFilletAPI_MakeFillet with available overloads. " + `Seen keys: ${keys.join(", ")}`);
}

function pickFilletShapeEnum(oc) {
  const e = oc.ChFi3d_FilletShape;
  if (e && typeof e === "object") {
    if ("ChFi3d_Rational" in e) return e.ChFi3d_Rational;
    if ("ChFi3d_QuasiAngular" in e) return e.ChFi3d_QuasiAngular;
    if ("ChFi3d_Polynomial" in e) return e.ChFi3d_Polynomial;
    if ("ChFi3d_ConstThroat" in e) return e.ChFi3d_ConstThroat;
  }
  return 0;
}

/* ----------------------------- Small utilities ----------------------------- */

function callFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  throw new Error(`Missing method. Tried: ${methodNames.join(", ")}`);
}

function tryCallFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") {
      try {
        return fn.apply(obj, args);
      } catch (_) {
        return null;
      }
    }
  }
  return null;
}

function normalizeParams(params) {
  // Pocket
  const pocket_w = clampNum(params?.pocket_w ?? 80, 30, 200);
  const pocket_h = clampNum(params?.pocket_h ?? 20, 8, 60);
  const pocket_d = clampNum(params?.pocket_d ?? 20, 8, 80);

  // Structure
  const side_wall = clampNum(params?.side_wall ?? 5, 2, 30);
  const bottom_wall = clampNum(params?.bottom_wall ?? 5, 2, 30);
  const back_wall = clampNum(params?.back_wall ?? 6, 2, 50);

  const gap_above_slot = clampNum(params?.gap_above_slot ?? 2, 0, 30);
  const top_extra = clampNum(params?.top_extra ?? 14, 2, 80);

  // Taper (cap inset)
  const block_w = pocket_w + 2 * side_wall;
  const block_d = pocket_d + back_wall;

  const loft_inset_x = clampNum(params?.loft_inset_x ?? 7, 0, block_w * 0.45);
  const loft_inset_y = clampNum(params?.loft_inset_y ?? 4, 0, block_d * 0.45);

  // Holes
  const hole_d = clampNum(params?.hole_d ?? 6.5, 2, 20);
  const hole_inset_from_sides = clampNum(params?.hole_inset_from_sides ?? 18, 6, block_w * 0.45);
  const hole_z_offset = clampNum(params?.hole_z_offset ?? 8, 0, 60);
  const hole_chamfer = clampNum(params?.hole_chamfer ?? 1.0, 0, 6);

  // Global fillet (all edges)
  const fillet_r = clampNum(params?.fillet_r ?? 2.0, 0, 8);

  // Robustness
  const eps = clampNum(params?.eps ?? 0.30, 0.0, 2.0);

  return {
    pocket_w,
    pocket_h,
    pocket_d,

    side_wall,
    bottom_wall,
    back_wall,

    gap_above_slot,
    top_extra,

    loft_inset_x,
    loft_inset_y,

    hole_d,
    hole_inset_from_sides,
    hole_z_offset,
    hole_chamfer,

    fillet_r,

    eps
  };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
