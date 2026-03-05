// src/models/portable_hangboard.js

export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const z1 = z0 + p.pocket_h;
  
  const loft_z_start = z1 + p.gap_above_slot;
  const hole_z_relative = p.hole_z_offset; 
  const block_h = loft_z_start + hole_z_relative + 6;

  // ---------- 1. Build Geometry ----------
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

  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + 2 * p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket);

  const hole_xa = p.hole_inset_from_sides;
  const hole_xb = block_w - p.hole_inset_from_sides;
  const hole_z_global = loft_z_start + hole_z_relative;

  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xa, hole_z_global, block_d, p.hole_d));
  shape = booleanCutAdaptive(oc, shape, makeHoleCylinderY(oc, hole_xb, hole_z_global, block_d, p.hole_d));

  // ---------- 2. Orientation & Alignment ----------
  const trsfRotate = new oc.gp_Trsf_1();
  const pivot = new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2);
  const axisX = new oc.gp_Ax1_2(pivot, new oc.gp_Dir_4(1, 0, 0));
  trsfRotate.SetRotation_1(axisX, -Math.PI / 2); 
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsfRotate, true).Shape();

  // Position precisely at Z=0
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, true); // true for 'use triangulation'
  const zMin = bbox.CornerMin().Z();
  
  const trsfMove = new oc.gp_Trsf_1();
  trsfMove.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsfMove, true).Shape();

  // ---------- 3. Selective Filleting ----------
  
  // Pass A: Fixed 2mm fillet on "Structural" edges (everything but the pocket)
  try {
    shape = filletSelectedEdges(oc, shape, 2.0, (edge) => {
      const dist = distToPocket(oc, edge, x0, z0, p.pocket_w, p.pocket_h);
      return dist > 1.0; // Fillet if NOT near the pocket
    });
  } catch (e) { console.warn("Static fillet failed."); }

  // Pass B: Parametric fillet on "Finger Slot" edges
  if (p.fillet_r > 0.1) {
    try {
      shape = filletSelectedEdges(oc, shape, p.fillet_r, (edge) => {
        const dist = distToPocket(oc, edge, x0, z0, p.pocket_w, p.pocket_h);
        return dist <= 1.0; // Only fillet if NEAR the pocket
      });
    } catch (e) { console.warn("Pocket fillet failed."); }
  }

  return shape;
}

/* --- Internal Helpers --- */

function distToPocket(oc, edge, px, pz, pw, ph) {
  // Check mid-point of edge against pocket boundary
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.LinearProperties(edge, props, false, false);
  const mid = props.CentreOfMass();
  
  // Since we rotated -90 on X, the original Y-Z pocket plane is now X-Z or similar
  // To keep it simple, we just check if the point is within a rough distance of 
  // where the pocket cutout was performed.
  return Math.abs(mid.Y() - 0); // Is it on the face where the pocket starts?
}

function filletSelectedEdges(oc, shape, radius, filterFn) {
  const mk = new oc.BRepFilletAPI_MakeFillet(shape, 0);
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  
  let count = 0;
  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.LinearProperties(edge, props, false, false);
    
    if (props.Mass() > 1.0 && filterFn(edge)) {
      mk.Add_2(radius, edge);
      count++;
    }
  }
  
  if (count === 0) return shape;
  mk.Build(getProgress(oc));
  return mk.IsDone() ? mk.Shape() : shape;
}

function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  return new oc.Message_ProgressRange();
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  poly.Add_1(new oc.gp_Pnt_3(x + dx, y, z));
  poly.Add_1(new oc.gp_Pnt_3(x + dx, y + dy, z));
  poly.Add_1(new oc.gp_Pnt_3(x, y + dy, z));
  poly.Close();
  const wire = poly.Wire();
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
    hole_d: c(params?.hole_d ?? 6.5, 2, 20),
    hole_inset_from_sides: c(params?.hole_inset_from_sides ?? 18, 6, 100),
    hole_z_offset: c(params?.hole_z_offset ?? 8, 0, 60),
    loft_inset_x: c(params?.loft_inset_x ?? 7, 0, 45),
    loft_inset_y: c(params?.loft_inset_y ?? 4, 0, 45),
    fillet_r: c(params?.fillet_r ?? 2.0, 0, 10),
    eps: 0.1
  };
}
