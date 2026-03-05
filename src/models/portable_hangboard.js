
// src/models/portable_hangboard.js

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

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
    w0: block_w, d0: block_d, z0: loft_z_start, x0: 0, y0: 0,
    w1: block_w - 2 * p.loft_inset_x,
    d1: block_d - 2 * p.loft_inset_y,
    z1: block_h,
    x1: p.loft_inset_x,
    y1: p.loft_inset_y
  });

  let shape = booleanFuseAdaptive(oc, base, cap);

  // ---------- Pocket cut ----------
  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + 2 * p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket);

  // ---------- Attachment holes + chamfers ----------
  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;
  const hole_z = loft_z_start + p.hole_z_offset;

  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xa, hole_z, block_d, p.hole_d));
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xb, hole_z, block_d, p.hole_d));

  if (p.hole_chamfer > 1e-9) {
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeFront(oc, hole_xa, hole_z, p.hole_d, p.hole_chamfer));
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeFront(oc, hole_xb, hole_z, p.hole_d, p.hole_chamfer));
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeBack(oc, hole_xa, hole_z, block_d, p.hole_d, p.hole_chamfer));
    shape = booleanCutAdaptive(oc, shape, makeHoleChamferConeBack(oc, hole_xb, hole_z, block_d, p.hole_d, p.hole_chamfer));
  }

  // ---------- Global fillet ----------
  if (p.fillet_r > 1e-9) {
    shape = filletAllEdges(oc, shape, p.fillet_r);
  }

  return shape;
}

/* ----------------------------- Primitives ----------------------------- */

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const w0 = makeRectangleWire(oc, x, y, z, dx, dy);
  const w1 = makeRectangleWire(oc, x, y, z + dz, dx, dy);
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(w0);
  mk.AddWire(w1);
  const pr = safeNewProgressRange(oc);
  if (pr) mk.Build(pr); else mk.Build();
  return mk.Shape();
}

function makeLoftedCap(oc, { w0, d0, z0, x0, y0, w1, d1, z1, x1, y1 }) {
  const wire0 = makeRectangleWire(oc, x0, y0, z0, w0, d0);
  const wire1 = makeRectangleWire(oc, x1, y1, z1, w1, d1);
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(wire0);
  mk.AddWire(wire1);
  const pr = safeNewProgressRange(oc);
  if (pr) mk.Build(pr); else mk.Build();
  return mk.Shape();
}

function makeRectangleWire(oc, x0, y0, z, w, d) {
  const mkPoly = new oc.BRepBuilderAPI_MakePolygon_1();
  const pnts = [
    new oc.gp_Pnt_3(x0, y0, z),
    new oc.gp_Pnt_3(x0 + w, y0, z),
    new oc.gp_Pnt_3(x0 + w, y0 + d, z),
    new oc.gp_Pnt_3(x0, y0 + d, z)
  ];
  pnts.forEach(p => mkPoly.Add_1(p));
  mkPoly.Close();
  return mkPoly.Wire();
}

/* ----------------------------- Hole Helpers ----------------------------- */

function createLocalAxes(oc, originPnt, directionDir) {
  // Primary axis is directionDir. We need a secondary direction (X) that is not parallel.
  // Since our holes are along Y (0,1,0), we use (1,0,0) as the X direction.
  const xDir = new oc.gp_Dir_4(1, 0, 0);
  
  // Explicitly passing 3 arguments to gp_Ax2_2 as requested by the error
  return new oc.gp_Ax2_2(originPnt, directionDir, xDir);
}

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const origin = new oc.gp_Pnt_3(xc, -30, zc);
  const dirY = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = createLocalAxes(oc, origin, dirY);

  const mk = new oc.BRepPrimAPI_MakeCylinder_3(ax2, hole_d / 2, block_d + 60);
  return mk.Shape();
}

function makeHoleChamferConeFront(oc, xc, zc, hole_d, chamfer) {
  return makeConeY(oc, xc, -0.01, zc, chamfer + 0.02, (hole_d + 2 * chamfer) / 2, hole_d / 2);
}

function makeHoleChamferConeBack(oc, xc, zc, block_d, hole_d, chamfer) {
  return makeConeY(oc, xc, block_d - chamfer - 0.01, zc, chamfer + 0.02, hole_d / 2, (hole_d + 2 * chamfer) / 2);
}

function makeConeY(oc, xc, y0, zc, h, r1, r2) {
  const origin = new oc.gp_Pnt_3(xc, y0, zc);
  const dirY = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = createLocalAxes(oc, origin, dirY);

  const mk = new oc.BRepPrimAPI_MakeCone_2(ax2, r1, r2, h);
  return mk.Shape();
}

/* ----------------------------- Booleans ----------------------------- */

function booleanCutAdaptive(oc, a, b) {
  const pr = safeNewProgressRange(oc) || new oc.Message_ProgressRange();
  let op;
  try { op = new oc.BRepAlgoAPI_Cut_3(a, b, pr); } 
  catch(_) { try { op = new oc.BRepAlgoAPI_Cut_2(a, b); } catch(__) { op = new oc.BRepAlgoAPI_Cut(a, b); } }

  try { op.Build(pr); } catch(_) { op.Build(); }
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b) {
  const pr = safeNewProgressRange(oc) || new oc.Message_ProgressRange();
  let op;
  try { op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr); } 
  catch(_) { try { op = new oc.BRepAlgoAPI_Fuse_2(a, b); } catch(__) { op = new oc.BRepAlgoAPI_Fuse(a, b); } }

  try { op.Build(pr); } catch(_) { op.Build(); }
  return op.IsDone() ? op.Shape() : a;
}

/* ----------------------------- Fillet ----------------------------- */

function filletAllEdges(oc, shape, radius) {
  const filletMode = oc.ChFi3d_FilletShape ? oc.ChFi3d_FilletShape.ChFi3d_Rational : 0;
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, filletMode);
  
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    mk.Add_2(radius, edge);
  }
  
  const pr = safeNewProgressRange(oc) || new oc.Message_ProgressRange();
  try { mk.Build(pr); } catch(_) { mk.Build(); }
  
  return mk.IsDone() ? mk.Shape() : shape;
}

/* ----------------------------- Helpers ----------------------------- */

function safeNewProgressRange(oc) {
  try { return new oc.Message_ProgressRange_1(); } catch(_) { 
    try { return new oc.Message_ProgressRange(); } catch(__) { return null; }
  }
}

function normalizeParams(params) {
  const c = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || lo));
  return {
    pocket_w: c(params?.pocket_w ?? 80, 30, 200),
    pocket_h: c(params?.pocket_h ?? 20, 8, 60),
    pocket_d: c(params?.pocket_d ?? 20, 8, 80),
    side_wall: c(params?.side_wall ?? 5, 2, 30),
    bottom_wall: c(params?.bottom_wall ?? 5, 2, 30),
    back_wall: c(params?.back_wall ?? 6, 2, 50),
    gap_above_slot: c(params?.gap_above_slot ?? 2, 0, 30),
    top_extra: c(params?.top_extra ?? 14, 2, 80),
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 50),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 50),
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 0, 60),
    hole_chamfer: c(params?.hole_chamfer ?? 1.0, 0, 6),
    fillet_r: c(params?.fillet_r ?? 2.0, 0, 8),
    eps: 0.3
  };
}
