// src/models/portable_hangboard.js

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Structural Dimensions
  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const z1 = z0 + p.pocket_h;
  const loft_z_start = z1 + p.gap_above_slot;
  const block_h = loft_z_start + p.hole_z_offset + 8; // Slightly more meat for stability

  // ---------- 1. CLEAN GEOMETRY GENERATION ----------
  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);
  const cap = makeLoftedCap(oc, {
    w0: block_w, d0: block_d, z0: loft_z_start, x0: 0, y0: 0,
    w1: block_w - 2 * p.loft_inset_x,
    d1: block_d - 2 * p.loft_inset_y,
    z1: block_h,
    x1: p.loft_inset_x,
    y1: p.loft_inset_y
  });

  // Use a higher FuzzyValue to eliminate sliver edges during fusion
  let shape = booleanFuseAdaptive(oc, base, cap, 0.1);

  // Pocket Cut - We make the pocket slightly wider than the cutout to avoid 
  // perfectly tangent edges that break fillets.
  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + 2 * p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket, 0.1);

  // Holes
  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;
  const hole_z_global = loft_z_start + p.hole_z_offset;

  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xa, hole_z_global, block_d, p.hole_d), 0.1);
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xb, hole_z_global, block_d, p.hole_d), 0.1);

  // ---------- 2. ORIENTATION ----------
  const trsfRotate = new oc.gp_Trsf_1();
  const pivot = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  const axisX = new oc.gp_Ax1_2(pivot, new oc.gp_Dir_4(1, 0, 0));
  trsfRotate.SetRotation_1(axisX, -Math.PI / 2); 
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsfRotate, true).Shape();

  // Alignment to Z=0
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false); 
  const zMin = bbox.CornerMin().Z();
  const trsfMove = new oc.gp_Trsf_1();
  trsfMove.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsfMove, true).Shape();

  // ---------- 3. STAGED FILLETING (The Robust Way) ----------

  // We only proceed if radius is at least 2.5mm as requested.
  const r = Math.max(2.5, p.fillet_r);

  const mk = new oc.BRepFilletAPI_MakeFillet(shape, 0);
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  
  let addedCount = 0;
  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.LinearProperties(edge, props, false, false);
    
    // HEURISTIC: We fillet everything that isn't a "dangerous" tiny edge.
    // Dangerous edges are those created by the intersection of holes and the loft.
    if (props.Mass() > r * 1.2) { 
      mk.Add_2(r, edge);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    try {
      mk.Build(getProgress(oc));
      if (mk.IsDone()) {
        shape = mk.Shape();
      } else {
        console.error("Fillet failed: Topology too complex for " + r + "mm");
      }
    } catch (e) {
      console.error("Fillet crashed.");
    }
  }

  return shape;
}

/* ----------------------------- Helpers ----------------------------- */

function booleanCutAdaptive(oc, a, b, fuzzy = 0.0) {
  const pr = getProgress(oc);
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0.0) {
  const pr = getProgress(oc);
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  return new oc.Message_ProgressRange();
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const mkPoly = (px, py, pz, pw, pd) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(px, py, pz));
    poly.Add_1(new oc.gp_Pnt_3(px + pw, py, pz));
    poly.Add_1(new oc.gp_Pnt_3(px + pw, py + pd, pz));
    poly.Add_1(new oc.gp_Pnt_3(px, py + pd, pz));
    poly.Close();
    return poly.Wire();
  };
  const w0 = mkPoly(x, y, z, dx, dy);
  const w1 = mkPoly(x, y, z + dz, dx, dy);
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

function makeHoleCylinderY(oc, xc, zc, block_d, hole_d) {
  const ax2 = new oc.gp_Ax2_2(new oc.gp_Pnt_3(xc, -10, zc), new oc.gp_Dir_4(0, 1, 0), new oc.gp_Dir_4(1, 0, 0));
  const mk = new oc.BRepPrimAPI_MakeCylinder_3(ax2, hole_d / 2, block_d + 20);
  return mk.Shape();
}

function normalizeParams(params) {
  const c = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || lo));
  return {
    pocket_w: c(params?.pocket_w ?? 80, 30, 200),
    pocket_h: c(params?.pocket_h ?? 20, 8, 60),
    pocket_d: c(params?.pocket_d ?? 20, 8, 80),
    side_wall: c(params?.side_wall ?? 8, 5, 30), // Increased min wall for fillet stability
    bottom_wall: c(params?.bottom_wall ?? 8, 5, 30),
    back_wall: c(params?.back_wall ?? 10, 5, 50),
    gap_above_slot: c(params?.gap_above_slot ?? 4, 2, 30),
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 0, 60),
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 45),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 45),
    fillet_r: c(params?.fillet_r ?? 3.0, 2.5, 10), // Enforced 2.5mm minimum
    eps: 0.1
  };
}
