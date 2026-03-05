// src/models/portable_hangboard.js

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const z1 = z0 + p.pocket_h;
  const loft_z_start = z1 + p.gap_above_slot;
  const block_h = loft_z_start + p.hole_z_offset + 8;

  // ---------- 1. BUILD MAIN BODY ----------
  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);
  const cap = makeLoftedCap(oc, {
    w0: block_w, d0: block_d, z0: loft_z_start, x0: 0, y0: 0,
    w1: block_w - 2 * p.loft_inset_x,
    d1: block_d - 2 * p.loft_inset_y,
    z1: block_h,
    x1: p.loft_inset_x,
    y1: p.loft_inset_y
  });

  let shape = booleanFuseAdaptive(oc, base, cap, 0.1);

  // ---------- 2. STATIC FILLET (2mm on main body) ----------
  // We do this before cutting the pocket so the internal pocket edges stay sharp
  // or receive their own parametric fillet later.
  try {
    const mkStatic = new oc.BRepFilletAPI_MakeFillet(shape, 0);
    const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (exp.More()) {
      mkStatic.Add_2(2.0, oc.TopoDS.Edge_1(exp.Current()));
      exp.Next();
    }
    mkStatic.Build(getProgress(oc));
    if (mkStatic.IsDone()) shape = mkStatic.Shape();
  } catch (e) { console.warn("Static body fillet failed."); }

  // ---------- 3. POCKET CUT ----------
  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + 2 * p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket, 0.1);

  // ---------- 4. PARAMETRIC FILLET (Finger Slot Only) ----------
  if (p.fillet_r > 0.1) {
    try {
      const mkParam = new oc.BRepFilletAPI_MakeFillet(shape, 0);
      const expP = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let foundPocketEdges = 0;
      while (expP.More()) {
        const edge = oc.TopoDS.Edge_1(expP.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        
        // Find edges that belong to the pocket opening (Z approx z0 or z1)
        const zPos = props.CentreOfMass().Z();
        if (Math.abs(zPos - z1) < 1.0 || Math.abs(zPos - z0) < 1.0) {
            mkParam.Add_2(p.fillet_r, edge);
            foundPocketEdges++;
        }
        expP.Next();
      }
      if (foundPocketEdges > 0) {
        mkParam.Build(getProgress(oc));
        if (mkParam.IsDone()) shape = mkParam.Shape();
      }
    } catch (e) { console.warn("Parametric pocket fillet failed."); }
  }

  // ---------- 5. TRANSFORM (Rotate and Align) ----------
  const trsf = new oc.gp_Trsf_1();
  const pivot = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  const axisX = new oc.gp_Ax1_2(pivot, new oc.gp_Dir_4(1, 0, 0));
  trsf.SetRotation_1(axisX, -Math.PI / 2); 
  
  // Calculate Z-shift to ground it
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false); 
  const zMin = bbox.CornerMin().Z();
  
  const move = new oc.gp_Trsf_1();
  move.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  shape = new oc.BRepBuilderAPI_Transform_2(shape, move, true).Shape();

  // ---------- 6. ATTACHMENT HOLES (Applied in final space) ----------
  // We re-calculate the hole positions based on the same rotation/shift
  const hole_z_orig = loft_z_start + p.hole_z_offset;
  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;

  const makeFinalHole = (xc) => {
    const pnt = new oc.gp_Pnt_3(xc, -20, hole_z_orig); // Orig space
    const dir = new oc.gp_Dir_4(0, 1, 0);
    const ax = new oc.gp_Ax2_2(pnt, dir, new oc.gp_Dir_4(1, 0, 0));
    const cyl = new oc.BRepPrimAPI_MakeCylinder_3(ax, p.hole_d / 2, block_d + 40).Shape();
    
    // Apply SAME rotation and SAME move as the block
    let hShape = new oc.BRepBuilderAPI_Transform_2(cyl, trsf, true).Shape();
    return new oc.BRepBuilderAPI_Transform_2(hShape, move, true).Shape();
  };

  shape = booleanCutAdaptive(oc, shape, makeFinalHole(hole_xa));
  shape = booleanCutAdaptive(oc, shape, makeFinalHole(hole_xb));

  return shape;
}

/* ----------------------------- Helpers ----------------------------- */

function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  return new oc.Message_ProgressRange();
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, getProgress(oc));
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(getProgress(oc));
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, getProgress(oc));
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(getProgress(oc));
  return op.IsDone() ? op.Shape() : a;
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

function normalizeParams(params) {
  const c = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || lo));
  return {
    pocket_w: c(params?.pocket_w ?? 80, 30, 200),
    pocket_h: c(params?.pocket_h ?? 20, 8, 60),
    pocket_d: c(params?.pocket_d ?? 20, 8, 80),
    side_wall: c(params?.side_wall ?? 10, 6, 30),
    bottom_wall: c(params?.bottom_wall ?? 10, 6, 30),
    back_wall: c(params?.back_wall ?? 10, 6, 50),
    gap_above_slot: c(params?.gap_above_slot ?? 5, 3, 30),
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 4, 60),
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 45),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 45),
    fillet_r: c(params?.fillet_r ?? 2.5, 0.5, 10),
    eps: 0.1
  };
}
