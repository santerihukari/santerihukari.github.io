// src/models/portable_hangboard.js

/**
 * Parametric fingerboard-like B-rep model using OpenCascade.js bindings.
 */
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

  // ---------- Attachment holes ----------
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
  if (p.fillet_r > 0.1) {
    shape = filletAllEdges(oc, shape, p.fillet_r);
  }

  // ---------- THE FLIP (Slot Upward) ----------
  const trsf = new oc.gp_Trsf_1();
  const center = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  const axis = new oc.gp_Ax1_2(center, new oc.gp_Dir_4(1, 0, 0));
  trsf.SetRotation_1(axis, Math.PI); 
  
  const transformer = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
  return transformer.Shape();
}

/* ----------------------------- Helpers ----------------------------- */

/**
 * Creates a ProgressRange instance. 
 * Since your build requires 1 arg for Build(), we must provide this.
 */
function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  if (oc.Message_ProgressRange_2) return new oc.Message_ProgressRange_2();
  return new oc.Message_ProgressRange();
}

function createLocalAxes(oc, originPnt, directionDir) {
  // Your build requires 3 parameters for gp_Ax2_2
  return new oc.gp_Ax2_2(originPnt, directionDir, new oc.gp_Dir_4(1, 0, 0));
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  poly.Add_1(new oc.gp_Pnt_3(x + dx, y, z));
  poly.Add_1(new oc.gp_Pnt_3(x + dx, y + dy, z));
  poly.Add_1(new oc.gp_Pnt_3(x, y + dy, z));
  poly.Close();
  const wire = poly.Wire();
  
  // (Shape, Vec, Copy, Canonize)
  const mk = new oc.BRepPrimAPI_MakePrism_1(wire, new oc.gp_Vec_4(0, 0, dz), true, true);
  return mk.Shape();
}

function makeLoftedCap(oc, d) {
  const mkPoly = (px, py, pz, pw, pd) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(px, py, pz));
    p.Add_1(new oc.gp_Pnt_3(px + pw, py, pz));
    p.Add_1(new oc.gp_Pnt_3(px + pw, py + pd, pz));
    p.Add_1(new oc.gp_Pnt_3(px, py + pd, pz));
    p.Close();
    return p.Wire();
  };
  const w0 = mkPoly(d.x0, d.y0, d.z0, d.w0, d.d0);
  const w1 = mkPoly(d.x1, d.y1, d.z1, d.w1, d.d1);

  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(w0);
  mk.AddWire(w1);
  // EXACT FIX: Pass the progress range to satisfy "expected 1 args"
  mk.Build(getProgress(oc)); 
  return mk.Shape();
}

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const origin = new oc.gp_Pnt_3(xc, -10, zc);
  const dirY = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = createLocalAxes(oc, origin, dirY);
  const mk = new oc.BRepPrimAPI_MakeCylinder_3(ax2, hole_d / 2, block_d + 20);
  return mk.Shape();
}

function makeConeY(oc, xc, y0, zc, h, r1, r2) {
  const origin = new oc.gp_Pnt_3(xc, y0, zc);
  const dirY = new oc.gp_Dir_4(0, 1, 0);
  const ax2 = createLocalAxes(oc, origin, dirY);
  const mk = new oc.BRepPrimAPI_MakeCone_2(ax2, r1, r2, h);
  return mk.Shape();
}

function makeHoleChamferConeFront(oc, xc, zc, hole_d, chamfer) {
  return makeConeY(oc, xc, -0.01, zc, chamfer + 0.02, (hole_d + 2 * chamfer) / 2, hole_d / 2);
}

function makeHoleChamferConeBack(oc, xc, zc, block_d, hole_d, chamfer) {
  return makeConeY(oc, xc, block_d - chamfer - 0.01, zc, chamfer + 0.02, hole_d / 2, (hole_d + 2 * chamfer) / 2);
}

/* ----------------------------- Booleans ----------------------------- */

function booleanCutAdaptive(oc, a, b) {
  const pr = getProgress(oc);
  let op;
  try { op = new oc.BRepAlgoAPI_Cut_3(a, b, pr); } 
  catch(_) { op = new oc.BRepAlgoAPI_Cut_2(a, b); }
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b) {
  const pr = getProgress(oc);
  let op;
  try { op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr); } 
  catch(_) { op = new oc.BRepAlgoAPI_Fuse_2(a, b); }
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

/* ----------------------------- Fillet ----------------------------- */

function filletAllEdges(oc, shape, radius) {
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, 0);
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) {
    mk.Add_2(radius, oc.TopoDS.Edge_1(exp.Current()));
  }
  const pr = getProgress(oc);
  mk.Build(pr);
  return mk.IsDone() ? mk.Shape() : shape;
}

/* ----------------------------- Params ----------------------------- */

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
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 45),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 45),
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 0, 60),
    hole_chamfer: c(params?.hole_chamfer ?? 1.0, 0, 6),
    fillet_r: c(params?.fillet_r ?? 2.0, 0, 8),
    eps: 0.1
  };
}
