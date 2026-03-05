// src/models/portable_hangboard.js

/**
 * Parametric fingerboard-like B-rep model using OpenCascade.js bindings.
 */
export function buildPortableHangboardBrep(oc, params) {
  // Use the internal helper defined at the bottom of this file
  const p = normalizeParams(params);

  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const loft_z_start = z0 + p.pocket_h + p.gap_above_slot;
  const block_h = loft_z_start + p.top_extra;

  // 1. Build Base
  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);

  // 2. Build Cap
  const cap = makeLoftedCap(oc, {
    w0: block_w, d0: block_d, z0: loft_z_start, x0: 0, y0: 0,
    w1: block_w - 2 * p.loft_inset_x,
    d1: block_d - 2 * p.loft_inset_y,
    z1: block_h,
    x1: p.loft_inset_x,
    y1: p.loft_inset_y
  });

  let shape = booleanFuseAdaptive(oc, base, cap);

  // 3. Build Pocket
  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket);

  // 4. Build Holes
  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;
  const hole_z = loft_z_start + p.hole_z_offset;

  const h1 = makeHoleCylinderY(oc, hole_xa, hole_z, block_d, p.hole_d);
  const h2 = makeHoleCylinderY(oc, hole_xb, hole_z, block_d, p.hole_d);
  shape = booleanCutAdaptive(oc, shape, h1);
  shape = booleanCutAdaptive(oc, shape, h2);

  // 5. Fillet
  if (p.fillet_r > 0.1) {
    try {
      shape = filletAllEdges(oc, shape, p.fillet_r);
    } catch (e) {
      console.warn("Fillet failed. Radius might be too large.");
    }
  }

  // 6. Flip
  const trsf = new oc.gp_Trsf_1();
  const center = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  const axis = new oc.gp_Ax1_2(center, new oc.gp_Dir_4(1, 0, 0));
  trsf.SetRotation_1(axis, Math.PI);
  
  const transformer = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
  return transformer.Shape();
}

/* --- Internal Helpers --- */

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
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 40),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 40),
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 0, 60),
    fillet_r: c(params?.fillet_r ?? 2.0, 0, 5),
    eps: 0.1
  };
}

function createLocalAxes(oc, originPnt, directionDir) {
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
  
  const vec = new oc.gp_Vec_4(0, 0, dz);

  // FIX: Added a fourth parameter (true) for Canonize
  // Overload: (Shape, Vec, Copy, Canonize)
  const mk = new oc.BRepPrimAPI_MakePrism_1(wire, vec, true, true); 
  
  return mk.Shape();
}

function makeLoftedCap(oc, d) {
  const mkPoly = (x, y, z, w, depth) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(x, y, z));
    p.Add_1(new oc.gp_Pnt_3(x + w, y, z));
    p.Add_1(new oc.gp_Pnt_3(x + w, y + depth, z));
    p.Add_1(new oc.gp_Pnt_3(x, y + depth, z));
    p.Close();
    return p.Wire();
  };
  const w0 = mkPoly(d.x0, d.y0, d.z0, d.w0, d.d0);
  const w1 = mkPoly(d.x1, d.y1, d.z1, d.w1, d.d1);
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(w0);
  mk.AddWire(w1);
  mk.Build(new oc.Message_ProgressRange());
  return mk.Shape();
}

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const ax2 = createLocalAxes(oc, new oc.gp_Pnt_3(xc, -10, zc), new oc.gp_Dir_4(0, 1, 0));
  const mk = new oc.BRepPrimAPI_MakeCylinder_3(ax2, hole_d / 2, block_d + 20);
  return mk.Shape();
}

function booleanCutAdaptive(oc, a, b) {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, new oc.Message_ProgressRange());
  op.Build(new oc.Message_ProgressRange());
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b) {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, new oc.Message_ProgressRange());
  op.Build(new oc.Message_ProgressRange());
  return op.IsDone() ? op.Shape() : a;
}

function filletAllEdges(oc, shape, radius) {
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, 0);
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) {
    mk.Add_2(radius, oc.TopoDS.Edge_1(exp.Current()));
  }
  mk.Build(new oc.Message_ProgressRange());
  return mk.IsDone() ? mk.Shape() : shape;
}
