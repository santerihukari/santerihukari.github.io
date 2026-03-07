export const meta = {
  name: "Symmetric Dual-Side Portable Hangboard",
  params: [
    { key: "finger_len_index", label: "Index length", min: 40, max: 110, default: 72 },
    { key: "finger_len_middle", label: "Middle length", min: 40, max: 120, default: 78 },
    { key: "finger_len_ring", label: "Ring length", min: 40, max: 110, default: 76 },
    { key: "finger_len_pinky", label: "Pinky length", min: 35, max: 100, default: 62 },

    { key: "finger_width_scale", label: "Finger width scale", min: 0.6, max: 1.6, default: 1.0 },
    { key: "pip_angle_deg", label: "PIP angle (deg)", min: 0, max: 90, default: 85 },

    { key: "slot_clearance_between_surfaces", label: "Clearance between slot surfaces", min: 4, max: 60, default: 20 },
    { key: "base_slot_height", label: "Base slot height", min: 8, max: 80, default: 28 },
    { key: "slot_depth_y", label: "Slot depth", min: 8, max: 80, default: 24 },

    { key: "side_wall_x", label: "Side wall", min: 4, max: 40, default: 16 },
    { key: "back_wall_y", label: "Back wall", min: 4, max: 60, default: 20 },
    { key: "bottom_wall_z", label: "Bottom wall", min: 4, max: 40, default: 10 },
    { key: "top_wall_z", label: "Top wall", min: 4, max: 40, default: 8 },

    { key: "zone_w_ring_index", label: "Ring/Index zone width", min: 8, max: 40, default: 19 },
    { key: "zone_w_middle", label: "Middle zone width", min: 8, max: 40, default: 20 },
    { key: "zone_w_pinky", label: "Pinky zone width", min: 8, max: 40, default: 16 },

    { key: "pinky_extra_forward_y", label: "Pinky extra forward", min: 0, max: 20, default: 5 },
    { key: "max_pinky_forward_y", label: "Max pinky forward", min: 0, max: 30, default: 16 },

    { key: "make_holes", label: "Make holes (0/1)", min: 0, max: 1, default: 1 },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7 },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "make_mass_removal", label: "Mass removal cuts (0/1)", min: 0, max: 1, default: 1 },
    { key: "left_cut_x_at_z0", label: "Left cut X at z=0", min: -20, max: 220, default: 80 },
    { key: "left_cut_z_at_x0", label: "Left cut Z at x=0", min: -40, max: 80, default: 30 },
    { key: "right_cut_x_at_z0", label: "Right cut X at z=0", min: -20, max: 220, default: 88 },
    { key: "right_cut_z_at_xmax", label: "Right cut Z at x=max", min: -40, max: 250, default: 20 },

    { key: "slot_edge_fillet_r", label: "Slot edge fillet", min: 0, max: 8, default: 2.5 },
    { key: "outer_vertical_fillet_r", label: "Outer vertical fillet", min: 0, max: 12, default: 5.0 },
    { key: "front_horizontal_fillet_r", label: "Front horizontal fillet", min: 0, max: 12, default: 5.0 },
    { key: "internal_riser_fillet_r", label: "Internal riser fillet", min: 0, max: 6, default: 1.0 },
    { key: "hole_chamfer", label: "Hole chamfer", min: 0, max: 3, default: 0.5 },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

export function build(oc, params) {
  const p = { ...params };

  const degToRad = (d) => d * Math.PI / 180.0;
  const bool01 = (v) => v >= 0.5;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const zoneTypes = [1, 2, 1, 0]; // 0: pinky, 1: ring/index, 2: middle
  const ringIndexLen = 0.5 * (p.finger_len_ring + p.finger_len_index);
  const angleRad = degToRad(p.pip_angle_deg);
  const s = Math.sin(angleRad);
  const c = Math.cos(angleRad);

  const riserHFromType = (t) => {
    if (t === 0) return 0;
    if (t === 1) return Math.max(0, ringIndexLen - p.finger_len_pinky) * s;
    return Math.max(0, p.finger_len_middle - p.finger_len_pinky) * s;
  };

  const pinkyForwardY = Math.min(
    p.max_pinky_forward_y,
    p.pinky_extra_forward_y + Math.max(0, p.finger_len_middle - p.finger_len_pinky) * c
  );

  const zoneWidths = zoneTypes.map((t) => {
    const nominal = t === 0 ? p.zone_w_pinky : (t === 1 ? p.zone_w_ring_index : p.zone_w_middle);
    return nominal * p.finger_width_scale;
  });

  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);
  const maxRiser = Math.max(riserHFromType(1), riserHFromType(2));
  const slotHeight = Math.max(p.base_slot_height, 2 * maxRiser + p.slot_clearance_between_surfaces);

  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = p.slot_depth_y + p.back_wall_y;
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z;

  const slotXStart = p.side_wall_x;
  const slotYFront = 0;
  const slotYBack = p.slot_depth_y;
  const holeZ = p.bottom_wall_z + 0.5 * slotHeight;
  const holeY = p.slot_depth_y + 0.5 * p.back_wall_y;

  const zoneXStart = (i) => {
    let acc = p.side_wall_x;
    for (let k = 0; k < i; k++) acc += zoneWidths[k];
    return acc;
  };

  let shape = makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

  if (pinkyForwardY > p.eps) {
    const pinkyX = zoneXStart(3);
    const ext = makePrismAt(
      oc,
      pinkyX,
      -pinkyForwardY,
      0,
      zoneWidths[3],
      pinkyForwardY + p.eps,
      blockHeightZ
    );
    shape = booleanFuseAdaptive(oc, shape, ext, p.boolean_fuzzy);
  }

  if (bool01(p.make_back_taper) && p.taper_top_inset > 0) {
    const taper = makeBackTaperCap(oc, {
      x0: 0,
      y0: Math.max(0, blockDepthY - 8),
      z0: 0,
      w0: blockWidthX,
      h0: blockHeightZ,
      x1: p.taper_top_inset,
      y1: Math.max(0, blockDepthY - p.eps),
      z1: p.taper_top_inset,
      w1: Math.max(0.5, blockWidthX - 2 * p.taper_top_inset),
      h1: Math.max(0.5, blockHeightZ - 2 * p.taper_top_inset)
    });
    shape = booleanFuseAdaptive(oc, shape, taper, p.boolean_fuzzy);
  }

  // Subtract the four finger channels.
  for (let i = 0; i < 4; i++) {
    const t = zoneTypes[i];
    const riser = riserHFromType(t);
    const yOff = t === 0 ? -pinkyForwardY : 0;
    const xPos = zoneXStart(i);
    const zStart = p.bottom_wall_z + riser;
    const cutH = Math.max(0.2, slotHeight - 2 * riser);
    const cutDepth = p.slot_depth_y - yOff;

    const slot = makePrismAt(
      oc,
      xPos - p.eps,
      yOff - p.eps,
      zStart,
      zoneWidths[i] + 2 * p.eps,
      cutDepth + 2 * p.eps,
      cutH
    );
    shape = booleanCutAdaptive(oc, shape, slot, p.boolean_fuzzy);
  }

  if (bool01(p.make_holes)) {
    const leftHoleX = 0.5 * p.side_wall_x;
    const rightHoleX = blockWidthX - 0.5 * p.side_wall_x;

    let leftHole = makeDiamondHoleY(oc, leftHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, pinkyForwardY, p.eps);
    let rightHole = makeDiamondHoleY(oc, rightHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, pinkyForwardY, p.eps);

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(oc, leftHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, pinkyForwardY, p.eps);
      const rightChamfers = makeDiamondHoleChamferPairY(oc, rightHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, pinkyForwardY, p.eps);

      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[0], p.boolean_fuzzy);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[1], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[0], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[1], p.boolean_fuzzy);
    }

    shape = booleanCutAdaptive(oc, shape, leftHole, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightHole, p.boolean_fuzzy);
  }

  if (bool01(p.make_mass_removal)) {
    const leftCut = makeMassRemovalPrismY(oc, [
      [0, -100],
      [p.left_cut_x_at_z0, -100],
      [0, p.left_cut_z_at_x0]
    ], -pinkyForwardY - p.eps, blockDepthY + pinkyForwardY + 2 * p.eps);

    const rightCut = makeMassRemovalPrismY(oc, [
      [p.right_cut_x_at_z0, -100],
      [blockWidthX + 100, -100],
      [blockWidthX + 100, p.right_cut_z_at_xmax]
    ], -pinkyForwardY - p.eps, blockDepthY + pinkyForwardY + 2 * p.eps);

    const leftCutTop = leftCut;
    const rightCutTop = rightCut;
    const leftCutBottom = makeMassRemovalPrismY(oc, mirrorPtsAcrossZMid([
      [0, -100],
      [p.left_cut_x_at_z0, -100],
      [0, p.left_cut_z_at_x0]
    ], blockHeightZ), -pinkyForwardY - p.eps, blockDepthY + pinkyForwardY + 2 * p.eps);

    const rightCutBottom = makeMassRemovalPrismY(oc, mirrorPtsAcrossZMid([
      [p.right_cut_x_at_z0, -100],
      [blockWidthX + 100, -100],
      [blockWidthX + 100, p.right_cut_z_at_xmax]
    ], blockHeightZ), -pinkyForwardY - p.eps, blockDepthY + pinkyForwardY + 2 * p.eps);

    shape = booleanCutAdaptive(oc, shape, leftCutTop, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightCutTop, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, leftCutBottom, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightCutBottom, p.boolean_fuzzy);
  }

  // Recommended ordering: larger global edge treatments first, then more local internal ones.
  if (p.outer_vertical_fillet_r > 0.05) {
    shape = filletEdgesByCentres(oc, shape, p.outer_vertical_fillet_r, (c) => {
      const nearLeft = c.X() < 1.0;
      const nearRight = c.X() > blockWidthX - 1.0;
      const nearFront = c.Y() < -pinkyForwardY + 1.0;
      const nearMainFront = c.Y() < 1.0;
      const nearBack = c.Y() > blockDepthY - 1.0;
      const verticalish = !nearTopOrBottomZ(c, blockHeightZ, 1.0);
      return verticalish && ((nearLeft && (nearMainFront || nearBack)) || (nearRight && (nearFront || nearBack)));
    });
  }

  if (p.front_horizontal_fillet_r > 0.05) {
    shape = filletEdgesByCentres(oc, shape, p.front_horizontal_fillet_r, (c) => {
      const nearFront = c.Y() < -pinkyForwardY + 1.0 || c.Y() < 1.0;
      const nearTop = c.Z() > blockHeightZ - 1.0;
      const nearBottom = c.Z() < 1.0;
      const awayFromExtremeSides = c.X() > 0.5 && c.X() < blockWidthX - 0.5;
      return nearFront && awayFromExtremeSides && (nearTop || nearBottom);
    });
  }

  if (p.slot_edge_fillet_r > 0.05) {
    shape = filletEdgesByCentres(oc, shape, p.slot_edge_fillet_r, (c) => {
      const insideSlotX = c.X() > slotXStart - 1.0 && c.X() < slotXStart + slotWidthX + 1.0;
      const nearFrontOrBack = (c.Y() > -pinkyForwardY - 1.0 && c.Y() < 1.0) || (c.Y() > slotYBack - 1.0 && c.Y() < slotYBack + 1.0);
      const notExteriorTopBottom = c.Z() > p.bottom_wall_z - 1.0 && c.Z() < p.bottom_wall_z + slotHeight + 1.0;
      return insideSlotX && nearFrontOrBack && notExteriorTopBottom;
    });
  }

  if (p.internal_riser_fillet_r > 0.05) {
    shape = filletEdgesByCentres(oc, shape, p.internal_riser_fillet_r, (c) => {
      const nearInternalX = zoneWidths.slice(0, 3).some((_, i) => {
        const x = zoneXStart(i + 1);
        return Math.abs(c.X() - x) < 1.0;
      });
      const inSlotYBand = c.Y() > -pinkyForwardY - 1.0 && c.Y() < p.slot_depth_y + 1.0;
      const notOuterZ = c.Z() > 0.5 && c.Z() < blockHeightZ - 0.5;
      return nearInternalX && inSlotYBand && notOuterZ;
    });
  }

  return shape;
}

function nearTopOrBottomZ(c, blockHeightZ, tol) {
  return c.Z() < tol || c.Z() > blockHeightZ - tol;
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function filletEdgesByCentres(oc, shape, radius, predicate) {
  try {
    const mk = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let count = 0;

    while (exp.More()) {
      const edge = oc.TopoDS.Edge_1(exp.Current());
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, props, false, false);
      const c = props.CentreOfMass();
      if (predicate(c)) {
        mk.Add_2(radius, edge);
        count++;
      }
      exp.Next();
    }

    if (count > 0) {
      mk.Build(oc.createProgressRange());
      if (mk.IsDone()) return mk.Shape();
    }
  } catch (e) {
    console.warn("Selective fillet failed.");
  }
  return shape;
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const mkW = (pz) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(x, y, pz));
    poly.Add_1(new oc.gp_Pnt_3(x + dx, y, pz));
    poly.Add_1(new oc.gp_Pnt_3(x + dx, y + dy, pz));
    poly.Add_1(new oc.gp_Pnt_3(x, y + dy, pz));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkW(z));
  mk.AddWire(mkW(z + dz));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeBackTaperCap(oc, d) {
  const mkXZWireAtY = (x, y, z, w, h) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
    poly.Add_1(new oc.gp_Pnt_3(x + w, y, z));
    poly.Add_1(new oc.gp_Pnt_3(x + w, y, z + h));
    poly.Add_1(new oc.gp_Pnt_3(x, y, z + h));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(mkXZWireAtY(d.x0, d.y0, d.z0, d.w0, d.h0));
  mk.AddWire(mkXZWireAtY(d.x1, d.y1, d.z1, d.w1, d.h1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}


function makeRoundedSlotCutAt(oc, x, y, z, dx, dy, dz, r) {
  const rr = Math.max(0, Math.min(r, 0.49 * dy, 0.49 * dz));

  const mkSlotProfileYZAtX = (px) => {
    const z0 = z;
    const z1 = z + dz;
    const y0 = y;
    const y1 = y + dy;

    const pts = [];
    const addArcPts = (cy, cz, rad, a0, a1, steps) => {
      for (let i = 0; i <= steps; i++) {
        const t = a0 + (a1 - a0) * (i / steps);
        pts.push([y0 + (cy - y0) + rad * Math.cos(t), cz + rad * Math.sin(t)]);
      }
    };

    if (rr <= 1e-6) {
      pts.push([y0, z0], [y1, z0], [y1, z1], [y0, z1]);
    } else {
      const steps = 8;
      pts.push([y0 + rr, z0]);
      pts.push([y1, z0]);
      pts.push([y1, z1]);
      pts.push([y0 + rr, z1]);
      for (let i = 1; i <= steps; i++) {
        const t = Math.PI / 2 + (Math.PI / 2) * (i / steps);
        pts.push([y0 + rr + rr * Math.cos(t), z1 - rr + rr * Math.sin(t)]);
      }
      pts.push([y0, z0 + rr]);
      for (let i = 1; i <= steps; i++) {
        const t = Math.PI + (Math.PI / 2) * (i / steps);
        pts.push([y0 + rr + rr * Math.cos(t), z0 + rr + rr * Math.sin(t)]);
      }
    }

    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    for (const [py, pz] of pts) poly.Add_1(new oc.gp_Pnt_3(px, py, pz));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkSlotProfileYZAtX(x));
  mk.AddWire(mkSlotProfileYZAtX(x + dx));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeDiamondHoleY(oc, xc, zc, wx, hz, blockDepthY, pinkyForwardY, eps) {
  const y0 = -pinkyForwardY - eps;
  const y1 = blockDepthY + eps;
  return makeDiamondPrismY(oc, xc, zc, wx, hz, y0, y1);
}

function makeDiamondHoleChamferPairY(oc, xc, yc, zc, wx, hz, chamfer, blockDepthY, pinkyForwardY, eps) {
  const frontY0 = -pinkyForwardY - eps;
  const frontY1 = frontY0 + chamfer;
  const backY1 = blockDepthY + eps;
  const backY0 = backY1 - chamfer;

  const expandedWx = wx + 2 * chamfer;
  const expandedHz = hz + 2 * chamfer;

  const front = makeDiamondLoftY(oc, xc, zc, wx, hz, frontY1, expandedWx, expandedHz, frontY0);
  const back = makeDiamondLoftY(oc, xc, zc, wx, hz, backY0, expandedWx, expandedHz, backY1);
  return [front, back];
}

function makeDiamondPrismY(oc, xc, zc, wx, hz, y0, y1) {
  const mkDiamondWireAtY = (py, w = wx, h = hz) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + h / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc + w / 2, py, zc));
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - h / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc - w / 2, py, zc));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkDiamondWireAtY(y0));
  mk.AddWire(mkDiamondWireAtY(y1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeDiamondLoftY(oc, xc, zc, w0, h0, y0, w1, h1, y1) {
  const mkDiamondWireAtY = (py, w, h) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + h / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc + w / 2, py, zc));
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - h / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc - w / 2, py, zc));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkDiamondWireAtY(y0, w0, h0));
  mk.AddWire(mkDiamondWireAtY(y1, w1, h1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeMassRemovalPrismY(oc, ptsXZ, y0, dy) {
  const mkWireAtY = (py) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    for (const [x, z] of ptsXZ) poly.Add_1(new oc.gp_Pnt_3(x, py, z));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkWireAtY(y0));
  mk.AddWire(mkWireAtY(y0 + dy));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function mirrorPtsAcrossZMid(ptsXZ, blockHeightZ) {
  return ptsXZ.map(([x, z]) => [x, blockHeightZ - z]);
}
