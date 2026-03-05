// src/models/portable_hangboard.js

/**
 * Parametric fingerboard-like B-rep model using OpenCascade.js bindings.
 * Units: mm
 */
export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Derived dimensions / coordinates
  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;

  const x0 = p.side_wall;
  const z0 = p.bottom_wall;

  const z1 = z0 + p.pocket_h;
  const loft_z_start = z1 + p.gap_above_slot;
  const block_h = loft_z_start + p.top_extra;

  // ---------- Outer body ----------
  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);

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

  const mk = makeThruSections(oc, true, true, 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w1]);

  tryCallFirstExisting(mk, ["CheckCompatibility_1", "CheckCompatibility"], [true]);

  const pr = safeNewProgressRange(oc);
  if (pr) tryCallFirstExisting(mk, ["Build_1", "Build"], [pr]);
  tryCallFirstExisting(mk, ["Build"], []);

  return mk.Shape();
}

function makeLoftedCap(oc, { w0, d0, z0, x0, y0, w1, d1, z1, x1, y1 }) {
  const wire0 = makeRectangleWire(oc, x0, y0, z0, w0, d0);
  const wire1 = makeRectangleWire(oc, x1, y1, z1, w1, d1);

  const mk = makeThruSections(oc, true, false, 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [wire0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [wire1]);

  tryCallFirstExisting(mk, ["CheckCompatibility_1", "CheckCompatibility"], [true]);

  const pr = safeNewProgressRange(oc);
  if (pr) tryCallFirstExisting(mk, ["Build_1", "Build"], [pr]);
  tryCallFirstExisting(mk, ["Build"], []);

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
      if (obj && (obj.AddWire || obj.AddWire_1)) {
        tryCallFirstExisting(obj, ["SetSolid_1", "SetSolid"], [!!isSolid]);
        tryCallFirstExisting(obj, ["SetRuled_1", "SetRuled"], [!!ruled]);
        if (Number.isFinite(tol)) tryCallFirstExisting(obj, ["SetPres3d_1", "SetPres3d"], [tol]);
        return obj;
      }
    } catch (_) {}
  }
  throw new Error("Could not construct BRepOffsetAPI_ThruSections.");
}

function makeRectangleWire(oc, x0, y0, z, w, d) {
  const mkPoly = new oc.BRepBuilderAPI_MakePolygon_1();
  const pnts = [
    new oc.gp_Pnt_3(x0, y0, z),
    new oc.gp_Pnt_3(x0 + w, y0, z),
    new oc.gp_Pnt_3(x0 + w, y0 + d, z),
    new oc.gp_Pnt_3(x0, y0 + d, z)
  ];

  pnts.forEach(p => callFirstExisting(mkPoly, ["Add_1", "Add"], [p]));
  callFirstExisting(mkPoly, ["Close_1", "Close"], []);

  return mkPoly.Wire();
}

/* ----------------------------- Holes (Y-axis primitives) ----------------------------- */

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const r = hole_d / 2;
  const yStart = -30;
  const h = block_d + 60;

  const origin = new oc.gp_Pnt_3(xc, yStart, zc);
  const dirNormal = new oc.gp_Dir_4(0, 1, 0); 
  const dirX = new oc.gp_Dir_4(1, 0, 0);      
  
  const ax2 = new oc.gp_Ax2_3(origin, dirNormal, dirX);

  const Cyl = oc.BRepPrimAPI_MakeCylinder;
  const ctors = [
    () => new Cyl(ax2, r, h),
    () => new Cyl(r, h)
  ];

  for (const fn of ctors) {
    try {
      const mk = fn();
      if (mk && typeof mk.Shape === "function") return mk.Shape();
    } catch (_) {}
  }
  throw new Error("Could not construct BRepPrimAPI_MakeCylinder.");
}

function makeHoleChamferConeFront(oc, xc, zc, hole_d, chamfer) {
  return makeConeY(oc, xc, -0.01, zc, chamfer + 0.02, (hole_d + 2 * chamfer) / 2, hole_d / 2);
}

function makeHoleChamferConeBack(oc, xc, zc, block_d, hole_d, chamfer) {
  return makeConeY(oc, xc, block_d - chamfer - 0.01, zc, chamfer + 0.02, hole_d / 2, (hole_d + 2 * chamfer) / 2);
}

function makeConeY(oc, xc, y0, zc, h, r1, r2) {
  const origin = new oc.gp_Pnt_3(xc, y0, zc);
  const dirNormal = new oc.gp_Dir_4(0, 1, 0);
  const dirX = new oc.gp_Dir_4(1, 0, 0);
  
  const ax2 = new oc.gp_Ax2_3(origin, dirNormal, dirX);

  const Cone = oc.BRepPrimAPI_MakeCone;
  const ctors = [
    () => new Cone(ax2, r1, r2, h),
    () => new Cone(r1, r2, h)
  ];

  for (const fn of ctors) {
    try {
      const mk = fn();
      if (mk && typeof mk.Shape === "function") return mk.Shape();
    } catch (_) {}
  }
  throw new Error("Could not construct BRepPrimAPI_MakeCone.");
}

/* ----------------------------- Boolean ops ----------------------------- */

function booleanCutAdaptive(oc, a, b) {
  const pr = safeNewProgressRange(oc) || new oc.Message_ProgressRange();
  // Try constructor with ProgressRange, then without
  const ctors = [
    () => new oc.BRepAlgoAPI_Cut_3(a, b, pr),
    () => new oc.BRepAlgoAPI_Cut_3(a, b),
    () => new oc.BRepAlgoAPI_Cut_2(a, b),
    () => new oc.BRepAlgoAPI_Cut(a, b)
  ];

  for (const fn of ctors) {
    try {
      const op = fn();
      op.Build();
      if (op.IsDone()) return op.Shape();
    } catch (_) {}
  }
  throw new Error("Boolean Cut failed.");
}

function booleanFuseAdaptive(oc, a, b) {
  const pr = safeNewProgressRange(oc) || new oc.Message_ProgressRange();
  const ctors = [
    () => new oc.BRepAlgoAPI_Fuse_3(a, b, pr),
    () => new oc.BRepAlgoAPI_Fuse_3(a, b),
    () => new oc.BRepAlgoAPI_Fuse_2(a, b),
    () => new oc.BRepAlgoAPI_Fuse(a, b)
  ];

  for (const fn of ctors) {
    try {
      const op = fn();
      op.Build();
      if (op.IsDone()) return op.Shape();
    } catch (_) {}
  }
  throw new Error("Boolean Fuse failed.");
}

/* ----------------------------- Fillet ----------------------------- */

function filletAllEdges(oc, shape, radius) {
  const filletMode = pickFilletShapeEnum(oc);
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, filletMode);

  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    callFirstExisting(mk, ["Add_2", "Add_1", "Add"], [radius, edge]);
  }

  mk.Build();
  if (!mk.IsDone()) throw new Error("Fillet failed.");
  return mk.Shape();
}

function pickFilletShapeEnum(oc) {
  const e = oc.ChFi3d_FilletShape;
  if (e) {
    return e.ChFi3d_Rational || e.ChFi3d_QuasiAngular || 0;
  }
  return 0;
}

/* ----------------------------- Helpers ----------------------------- */

function callFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  throw new Error(`Missing method: ${methodNames[0]}`);
}

function tryCallFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") {
      try { return fn.apply(obj, args); } catch (_) {}
    }
  }
  return null;
}

function safeNewProgressRange(oc) {
  try { 
    if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
    if (oc.Message_ProgressRange) return new oc.Message_ProgressRange();
  } catch (_) {}
  return null;
}

function normalizeParams(params) {
  const clampNum = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || lo));
  return {
    pocket_w: clampNum(params?.pocket_w ?? 80, 30, 200),
    pocket_h: clampNum(params?.pocket_h ?? 20, 8, 60),
    pocket_d: clampNum(params?.pocket_d ?? 20, 8, 80),
    side_wall: clampNum(params?.side_wall ?? 5, 2, 30),
    bottom_wall: clampNum(params?.bottom_wall ?? 5, 2, 30),
    back_wall: clampNum(params?.back_wall ?? 6, 2, 50),
    gap_above_slot: clampNum(params?.gap_above_slot ?? 2, 0, 30),
    top_extra: clampNum(params?.top_extra ?? 14, 2, 80),
    loft_inset_x: clampNum(params?.loft_inset_x ?? 7, 0, 50),
    loft_inset_y: clampNum(params?.loft_inset_y ?? 4, 0, 50),
    hole_d: clampNum(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: clampNum(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: clampNum(params?.hole_z_offset ?? 8, 0, 60),
    hole_chamfer: clampNum(params?.hole_chamfer ?? 1.0, 0, 6),
    fillet_r: clampNum(params?.fillet_r ?? 2.0, 0, 8),
    eps: 0.3
  };
}
