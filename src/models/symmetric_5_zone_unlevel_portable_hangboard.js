export const meta = {
  name: "Symmetric Dual-Side Portable Hangboard",
  params: [
    { key: "finger_len_index", label: "Index length", min: 40, max: 110, default: 72 },
    { key: "finger_len_middle", label: "Middle length", min: 40, max: 120, default: 78 },
    { key: "finger_len_ring", label: "Ring length", min: 40, max: 110, default: 76 },
    { key: "finger_len_pinky", label: "Pinky length", min: 35, max: 100, default: 62 },

    { key: "finger_width_index", label: "Index width", min: 8, max: 32, default: 19 },
    { key: "finger_width_middle", label: "Middle width", min: 8, max: 36, default: 20 },
    { key: "finger_width_ring", label: "Ring width", min: 8, max: 32, default: 19 },
    { key: "finger_width_pinky", label: "Pinky width", min: 8, max: 28, default: 16 },
    { key: "finger_width_scale", label: "Finger width scale", min: 0.6, max: 1.6, default: 1.0 },

    { key: "pip_angle_deg", label: "PIP angle (deg)", min: 0, max: 90, default: 85 },

    { key: "base_slot_height", label: "Base slot height", min: 8, max: 80, default: 28 },
    { key: "extra_space_between_opposite_levels", label: "Extra space between opposite levels", min: 4, max: 60, default: 20 },
    { key: "slot_depth_y", label: "Slot depth", min: 8, max: 80, default: 24 },

    { key: "side_wall_x", label: "Side wall", min: 4, max: 40, default: 16 },
    { key: "back_wall_y", label: "Back wall depth", min: 4, max: 60, default: 20 },
    { key: "bottom_wall_z", label: "Bottom wall", min: 4, max: 40, default: 10 },
    { key: "top_wall_z", label: "Top wall", min: 4, max: 40, default: 8 },

    { key: "make_pinky_extrusion", label: "Make pinky extrusion (0/1)", min: 0, max: 1, default: 0 },
    { key: "pinky_extra_forward_y", label: "Pinky extrusion", min: 0, max: 20, default: 5 },
    { key: "max_pinky_forward_y", label: "Max pinky extrusion", min: 0, max: 30, default: 16 },

    { key: "make_holes", label: "Make holes (0/1)", min: 0, max: 1, default: 1 },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7 },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },
    { key: "taper_start_back_offset", label: "Taper start from back", min: 1, max: 30, default: 8 },

    { key: "make_mass_removal", label: "Mass removal cuts (0/1)", min: 0, max: 1, default: 0 },
    { key: "left_cut_x_at_z0", label: "Left cut X at z=0", min: -20, max: 220, default: 80 },
    { key: "left_cut_z_at_x0", label: "Left cut Z at x=0", min: -40, max: 80, default: 30 },
    { key: "right_cut_x_at_z0", label: "Right cut X at z=0", min: -20, max: 220, default: 88 },
    { key: "right_cut_z_at_xmax", label: "Right cut Z at x=max", min: -40, max: 250, default: 250 },

    { key: "slot_edge_fillet_r", label: "Slot edge fillet", min: 0, max: 8, default: 2.5 },
    { key: "outer_vertical_fillet_r", label: "Outer vertical fillet", min: 0, max: 12, default: 5.0 },
    { key: "front_horizontal_fillet_r", label: "Front horizontal fillet", min: 0, max: 12, default: 5.0 },
    { key: "internal_riser_fillet_r", label: "Internal riser fillet", min: 0, max: 6, default: 1.0 },
    { key: "pinky_transition_fillet_r", label: "Pinky transition fillet", min: 0, max: 8, default: 1.5 },
    { key: "hole_chamfer", label: "Hole chamfer", min: 0, max: 3, default: 0.5 },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

export function build(oc, params) {
  const p = { ...params };

  const degToRad = (d) => d * Math.PI / 180.0;
  const bool01 = (v) => v >= 0.5;

  const zoneTypes = [1, 2, 1, 0];
  const ringIndexLen = 0.5 * (p.finger_len_ring + p.finger_len_index);
  const ringIndexWidth = 0.5 * (p.finger_width_ring + p.finger_width_index);
  const angleRad = degToRad(p.pip_angle_deg);
  const angleSin = Math.sin(angleRad);
  const angleCos = Math.cos(angleRad);

  const riserHFromType = (t) => {
    if (t === 0) return 0;
    if (t === 1) return Math.max(0, ringIndexLen - p.finger_len_pinky) * angleSin;
    return Math.max(0, p.finger_len_middle - p.finger_len_pinky) * angleSin;
  };

  const pinkyForwardY = bool01(p.make_pinky_extrusion)
    ? Math.min(
        p.max_pinky_forward_y,
        p.pinky_extra_forward_y + Math.max(0, p.finger_len_middle - p.finger_len_pinky) * angleCos
      )
    : 0;

  const zoneWidths = zoneTypes.map((t) => {
    const nominal = t === 0 ? p.finger_width_pinky : (t === 1 ? ringIndexWidth : p.finger_width_middle);
    return nominal * p.finger_width_scale;
  });

  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);
  const maxRiser = Math.max(riserHFromType(1), riserHFromType(2));
  const slotHeight = Math.max(p.base_slot_height, 2 * maxRiser + p.extra_space_between_opposite_levels);

  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = p.slot_depth_y + p.back_wall_y;
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z;
  const holeZ = p.bottom_wall_z + 0.5 * slotHeight;
  const holeY = p.slot_depth_y + 0.5 * p.back_wall_y;

  const slotXStart = p.side_wall_x;
  const slotYFront = -pinkyForwardY;
  const slotYBack = p.slot_depth_y;

  const zoneXStart = (i) => {
    let acc = p.side_wall_x;
    for (let k = 0; k < i; k++) acc += zoneWidths[k];
    return acc;
  };

  emitGeometryWarnings(p, {
    zoneWidths,
    blockWidthX,
    blockDepthY,
    blockHeightZ,
    slotHeight,
    maxRiser,
    pinkyForwardY
  });

  let shape = makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

  if (pinkyForwardY > p.eps) {
    const pinkyX = zoneXStart(3);
    const pinkyExtension = makePrismAt(
      oc,
      pinkyX,
      -pinkyForwardY,
      0,
      zoneWidths[3],
      pinkyForwardY + p.eps,
      blockHeightZ
    );
    shape = booleanFuseAdaptive(oc, shape, pinkyExtension, p.boolean_fuzzy, "pinky extrusion");
  }

  shape = maybeFilletWithFallback(oc, shape, p.outer_vertical_fillet_r, {
    label: "outer vertical fillet",
    maxSuggested: 0.5 * Math.min(blockWidthX, blockDepthY, blockHeightZ),
    predicate: (c) => {
      const nearLeft = c.X() < 0.75;
      const nearRight = c.X() > blockWidthX - 0.75;
      const nearFront = c.Y() < 0.75;
      const nearBack = c.Y() > blockDepthY - 0.75;
      const notTopBottom = c.Z() > 0.75 && c.Z() < blockHeightZ - 0.75;
      return notTopBottom && ((nearLeft || nearRight) && (nearFront || nearBack));
    },
    reasonIfTooLarge: `reduce outer_vertical_fillet_r below side wall / back wall limits; current side_wall_x=${fmt(p.side_wall_x)}, back_wall_y=${fmt(p.back_wall_y)}`
  });

  shape = maybeFilletWithFallback(oc, shape, p.front_horizontal_fillet_r, {
    label: "front horizontal fillet",
    maxSuggested: Math.min(0.5 * p.bottom_wall_z, 0.5 * p.top_wall_z, Math.max(0.5, p.back_wall_y)),
    predicate: (c) => {
      const nearFront = c.Y() < 0.75;
      const nearTop = c.Z() > blockHeightZ - 0.75;
      const nearBottom = c.Z() < 0.75;
      const awayFromSides = c.X() > 0.75 && c.X() < blockWidthX - 0.75;
      return nearFront && awayFromSides && (nearTop || nearBottom);
    },
    reasonIfTooLarge: `reduce front_horizontal_fillet_r; it competes with top/bottom walls and the front face`
  });

  if (bool01(p.make_back_taper) && p.taper_top_inset > 0) {
    const taper = makeBackTaperCap(oc, {
      x0: 0,
      y0: Math.max(0, blockDepthY - p.taper_start_back_offset),
      z0: 0,
      w0: blockWidthX,
      h0: blockHeightZ,
      x1: p.taper_top_inset,
      y1: Math.max(0, blockDepthY - p.eps),
      z1: p.taper_top_inset,
      w1: Math.max(0.5, blockWidthX - 2 * p.taper_top_inset),
      h1: Math.max(0.5, blockHeightZ - 2 * p.taper_top_inset)
    });
    shape = booleanFuseAdaptive(oc, shape, taper, p.boolean_fuzzy, "back taper");
  }

  for (let i = 0; i < 4; i++) {
    const t = zoneTypes[i];
    const riser = riserHFromType(t);
    const yOff = t === 0 ? -pinkyForwardY : 0;
    const xPos = zoneXStart(i);
    const zStart = p.bottom_wall_z + riser;
    const cutH = Math.max(0.2, slotHeight - 2 * riser);
    const cutDepth = p.slot_depth_y - yOff;
    const slotRadius = Math.max(0, Math.min(p.slot_edge_fillet_r, 0.49 * cutH, 0.49 * cutDepth));

    const slot = makeRoundedSlotCutAt(
      oc,
      xPos - p.eps,
      yOff - p.eps,
      zStart,
      zoneWidths[i] + 2 * p.eps,
      cutDepth + 2 * p.eps,
      cutH,
      slotRadius
    );
    shape = booleanCutAdaptive(oc, shape, slot, p.boolean_fuzzy, `finger slot ${i + 1}`);
  }

  if (bool01(p.make_holes)) {
    const leftHoleX = 0.5 * p.side_wall_x;
    const rightHoleX = blockWidthX - 0.5 * p.side_wall_x;

    let leftHole = makeDiamondHoleY(oc, leftHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, pinkyForwardY, p.eps);
    let rightHole = makeDiamondHoleY(oc, rightHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, pinkyForwardY, p.eps);

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(oc, leftHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, pinkyForwardY, p.eps);
      const rightChamfers = makeDiamondHoleChamferPairY(oc, rightHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, pinkyForwardY, p.eps);

      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[0], p.boolean_fuzzy, "left hole front chamfer");
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[1], p.boolean_fuzzy, "left hole back chamfer");
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[0], p.boolean_fuzzy, "right hole front chamfer");
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[1], p.boolean_fuzzy, "right hole back chamfer");
    }

    shape = booleanCutAdaptive(oc, shape, leftHole, p.boolean_fuzzy, "left hole");
    shape = booleanCutAdaptive(oc, shape, rightHole, p.boolean_fuzzy, "right hole");
  }

  if (bool01(p.make_mass_removal)) {
    const inf = 100;
    const y0 = -pinkyForwardY - p.eps;
    const dy = blockDepthY + pinkyForwardY + 2 * p.eps;

    const leftPts = [
      [-inf, -inf],
      [p.left_cut_x_at_z0, -inf],
      [-inf, -p.left_cut_z_at_x0]
    ];

    const rightPts = [
      [p.right_cut_x_at_z0, -inf],
      [blockWidthX + inf, -inf],
      [blockWidthX + inf, p.right_cut_z_at_xmax]
    ];

    const leftCutTop = makeMassRemovalPrismY(oc, leftPts, y0, dy);
    const rightCutTop = makeMassRemovalPrismY(oc, rightPts, y0, dy);
    const leftCutBottom = makeMassRemovalPrismY(oc, mirrorPtsAcrossBlockZ(leftPts, blockHeightZ), y0, dy);
    const rightCutBottom = makeMassRemovalPrismY(oc, mirrorPtsAcrossBlockZ(rightPts, blockHeightZ), y0, dy);

    shape = booleanCutAdaptive(oc, shape, leftCutTop, p.boolean_fuzzy, "top left mass removal");
    shape = booleanCutAdaptive(oc, shape, rightCutTop, p.boolean_fuzzy, "top right mass removal");
    shape = booleanCutAdaptive(oc, shape, leftCutBottom, p.boolean_fuzzy, "bottom left mass removal");
    shape = booleanCutAdaptive(oc, shape, rightCutBottom, p.boolean_fuzzy, "bottom right mass removal");
  }

  shape = maybeFilletWithFallback(oc, shape, p.internal_riser_fillet_r, {
    label: "internal riser fillet",
    maxSuggested: 0.25 * Math.min(...zoneWidths),
    predicate: (c) => {
      const nearInternalX = zoneWidths.slice(0, 3).some((_, i) => Math.abs(c.X() - zoneXStart(i + 1)) < 0.75);
      const inSlotYBand = c.Y() > slotYFront - 0.75 && c.Y() < p.slot_depth_y + 0.75;
      const withinBodyZ = c.Z() > p.bottom_wall_z + 0.5 && c.Z() < p.bottom_wall_z + slotHeight - 0.5;
      return nearInternalX && inSlotYBand && withinBodyZ;
    },
    reasonIfTooLarge: `reduce internal_riser_fillet_r relative to the narrowest zone width; current narrowest zone=${fmt(Math.min(...zoneWidths))}`
  });

  shape = maybeFilletWithFallback(oc, shape, p.pinky_transition_fillet_r, {
    label: "pinky transition fillet",
    maxSuggested: 0.5 * Math.min(Math.max(pinkyForwardY, 0.5), zoneWidths[3], blockHeightZ),
    predicate: (c) => {
      const pinkyJoinX0 = zoneXStart(3) - 0.75;
      const pinkyJoinX1 = zoneXStart(3) + zoneWidths[3] + 0.75;
      const nearStepY = Math.abs(c.Y()) < 0.75;
      const awayFromTopBottom = c.Z() > 0.75 && c.Z() < blockHeightZ - 0.75;
      return pinkyForwardY > p.eps && c.X() > pinkyJoinX0 && c.X() < pinkyJoinX1 && nearStepY && awayFromTopBottom;
    },
    reasonIfTooLarge: `reduce pinky_transition_fillet_r or increase pinky extrusion; current pinky_forward_y=${fmt(pinkyForwardY)}`
  });

  return shape;
}

function emitGeometryWarnings(p, g) {
  if (p.slot_depth_y <= 0 || p.back_wall_y <= 0 || p.side_wall_x <= 0 || p.bottom_wall_z <= 0 || p.top_wall_z <= 0) {
    console.warn("Invalid positive wall/depth dimensions detected. Fillets and booleans may fail.");
  }
  if (g.slotHeight <= 2 * g.maxRiser + 0.2) {
    console.warn(`slot_height=${fmt(g.slotHeight)} is very tight relative to risers=${fmt(g.maxRiser)}. Increase base_slot_height or extra_space_between_opposite_levels. Native slot rounding may also clamp itself smaller.`);
  }
  if (p.hole_chamfer * 2 >= Math.min(p.hole_width_x, p.hole_height_z)) {
    console.warn(`hole_chamfer=${fmt(p.hole_chamfer)} is too large for hole size ${fmt(p.hole_width_x)} x ${fmt(p.hole_height_z)}. Reduce hole_chamfer.`);
  }
  if (p.taper_top_inset * 2 >= Math.min(g.blockWidthX, g.blockHeightZ)) {
    console.warn(`taper_top_inset=${fmt(p.taper_top_inset)} is too large for the block. Reduce taper_top_inset.`);
  }
}

function maybeFilletWithFallback(oc, shape, radius, options) {
  if (!(radius > 0.05)) return shape;

  if (options.maxSuggested > 0 && radius >= options.maxSuggested) {
    console.warn(`${options.label} skipped: radius ${fmt(radius)} is too large for local geometry. Suggested maximum is below ${fmt(options.maxSuggested)}; ${options.reasonIfTooLarge}.`);
    return shape;
  }

  const trialRadii = [radius, 0.8 * radius, 0.65 * radius, 0.5 * radius].filter((r, i, arr) => r > 0.05 && arr.indexOf(r) === i);
  let lastReason = `no candidate edges were found for ${options.label}`;
  for (const r of trialRadii) {
    const res = filletEdgesByCentres(oc, shape, r, options.predicate, options.label);
    if (res.ok) {
      if (r < radius - 1e-6) console.warn(`${options.label}: requested radius ${fmt(radius)} was reduced to ${fmt(r)} for robustness.`);
      return res.shape;
    }
    lastReason = res.reason;
  }

  console.warn(`${options.label} failed: ${lastReason}. Try a smaller radius, smaller boolean_fuzzy, or slightly larger walls / slot clearance.`);
  return shape;
}

function nearTopOrBottomZ(c, blockHeightZ, tol) {
  return c.Z() < tol || c.Z() > blockHeightZ - tol;
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0, label = "cut") {
  try {
    const pr = oc.createProgressRange();
    const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
    if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
    op.Build(pr);
    if (op.IsDone()) return op.Shape();
    console.warn(`Boolean cut failed for ${label}. Returning previous shape. Consider reducing boolean_fuzzy or increasing eps.`);
  } catch (e) {
    console.warn(`Boolean cut threw for ${label}: ${String(e)}`);
  }
  return a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0, label = "fuse") {
  try {
    const pr = oc.createProgressRange();
    const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
    if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
    op.Build(pr);
    if (op.IsDone()) return op.Shape();
    console.warn(`Boolean fuse failed for ${label}. Returning previous shape. Consider reducing boolean_fuzzy or increasing eps.`);
  } catch (e) {
    console.warn(`Boolean fuse threw for ${label}: ${String(e)}`);
  }
  return a;
}

function filletEdgesByCentres(oc, shape, radius, predicate, label) {
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

    if (count === 0) {
      return { ok: false, reason: `no candidate edges were found for ${label}` };
    }

    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return { ok: true, shape: mk.Shape() };
    return { ok: false, reason: `OpenCascade did not complete the fillet on ${count} selected edges` };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
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

function makeRoundedSlotCutAt(oc, x, y, z, dx, dy, dz, r) {
  const rr = Math.max(0, Math.min(r, 0.49 * dx, 0.49 * dy, 0.49 * dz));
  if (rr <= 0.01) return makePrismAt(oc, x, y, z, dx, dy, dz);

  const mkYZWireAtX = (px) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(px, y + rr, z));
    poly.Add_1(new oc.gp_Pnt_3(px, y + dy - rr, z));
    poly.Add_1(new oc.gp_Pnt_3(px, y + dy, z + rr));
    poly.Add_1(new oc.gp_Pnt_3(px, y + dy, z + dz - rr));
    poly.Add_1(new oc.gp_Pnt_3(px, y + dy - rr, z + dz));
    poly.Add_1(new oc.gp_Pnt_3(px, y + rr, z + dz));
    poly.Add_1(new oc.gp_Pnt_3(px, y, z + dz - rr));
    poly.Add_1(new oc.gp_Pnt_3(px, y, z + rr));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkYZWireAtX(x));
  mk.AddWire(mkYZWireAtX(x + dx));
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

function mirrorPtsAcrossBlockZ(ptsXZ, blockHeightZ) {
  return ptsXZ.map(([x, z]) => [x, blockHeightZ - z]);
}

function fmt(v) {
  return Number.isFinite(v) ? Number(v).toFixed(2) : String(v);
}
