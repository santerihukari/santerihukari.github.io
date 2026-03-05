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

  // ... (Chamfers removed for brevity, keep your existing chamfer logic here if needed)

  // ---------- Global fillet ----------
  if (p.fillet_r > 1e-9) {
    shape = filletAllEdges(oc, shape, p.fillet_r);
  }

  // ---------- THE FLIP ----------
  // Create a transformation to rotate 180 degrees around the X-axis
  const trsf = new oc.gp_Trsf_1();
  const axis = new oc.gp_Ax1_2(
    new oc.gp_Pnt_3(block_w / 2, block_d / 2, block_h / 2), // Rotate around the center
    new oc.gp_Dir_4(1, 0, 0) // X-axis
  );
  
  // Math.PI is 180 degrees
  trsf.SetRotation_1(axis, Math.PI); 
  
  const transformer = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
  return transformer.Shape();
}
