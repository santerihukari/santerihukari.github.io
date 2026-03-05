// src/models/portable_hangboard.js

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const z1 = z0 + p.pocket_h;
  
  const loft_z_start = z1 + p.gap_above_slot;

  // FIX: Adjust total height so it's strictly based on the hole position + a small buffer
  // This prevents the "too high" forehead issue.
  const hole_z_relative = p.hole_z_offset; 
  const block_h = loft_z_start + hole_z_relative + 6; // 6mm buffer above hole center

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
  
  // The hole is placed relative to where the loft starts
  const hole_z_global = loft_z_start + hole_z_relative;

  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xa, hole_z_global, block_d, p.hole_d));
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xb, hole_z_global, block_d, p.hole_d));

  // ---------- Global fillet ----------
  if (p.fillet_r > 0.1) {
    shape = filletAllEdges(oc, shape, p.fillet_r);
  }

  // ---------- THE FLIP (Slot Upward) ----------
  const trsf = new oc.gp_Trsf_1();
  // Pivot around the Y-axis to flip the front-facing pocket to be top-facing
  const pivot = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  
  // We rotate -90 degrees around X to bring the "Front" face (Pocket) to the "Top"
  const axisX = new oc.gp_Ax1_2(pivot, new oc.gp_Dir_4(1, 0, 0));
  trsf.SetRotation_1(axisX, -Math.PI / 2); 
  
  const transformer = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
  return transformer.Shape();
}

/* --- Internal Helpers (Maintain these from previous working version) --- */

function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  if (oc.Message_ProgressRange_2) return new oc.Message_ProgressRange_2();
  return new oc.Message_ProgressRange();
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const w0 = makeRectangleWire(oc, x, y, z, dx, dy);
  const w1 = makeRectangleWire(oc, x, y, z + dz, dx, dy);
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(w0);
  mk.AddWire(w1);
  mk.Build(getProgress(oc)); 
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
  const wire0 = mkPoly(d.x0, d.y0, d.z0, d.w0, d.d0);
  const wire1 = mkPoly(d.x1, d.y1, d.z1, d.w1, d.d1);
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(wire0);
  mk.AddWire(wire1);
  mk.Build(getProgress(oc));
  return mk.Shape();
}

function makeRectangleWire(oc, x0, y0, z, w, d) {
  const mkPoly = new oc.BRepBuilderAPI_MakePolygon_1();
  mkPoly.Add_1(new oc.gp_Pnt_3(x0, y0, z));
  mkPoly.Add_1(new oc.gp_Pnt_3(x0 + w, y0, z));
  mkPoly.Add_1(new oc.gp_Pnt_3(x0 + w, y0 + d, z));
  mkPoly.Add_1(new oc.gp_Pnt_3(x0, y0 + d, z));
  mkPoly.Close();
  return mkPoly.Wire();
}

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const ax2 = new oc.gp_Ax2_2(new oc.gp_Pnt_3(xc, -10, zc), new oc.gp_Dir_4(0, 1, 0), new oc.gp_Dir_4(1, 0, 0));
  const mk = new oc.BRepPrimAPI_MakeCylinder_3(ax2, hole_d / 2, block_d + 20);
  return mk.Shape();
}

function booleanCutAdaptive(oc, a, b) {
  const pr = getProgress(oc);
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b) {
  const pr = getProgress(oc);
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

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
    fillet_r: c(params?.fillet_r ?? 2.0, 0, 8),
    eps: 0.1
  };
}
