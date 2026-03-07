export const meta = {
  name: "Symmetric Dual-Side Portable Hangboard",
  params: [
    { key: "finger_len_index", label: "Index length", min: 40, max: 110, default: 72 },
    { key: "finger_len_middle", label: "Middle length", min: 40, max: 120, default: 78 },
    { key: "finger_len_ring", label: "Ring length", min: 40, max: 110, default: 76 },
    { key: "finger_len_pinky", label: "Pinky length", min: 35, max: 100, default: 62 },

    { key: "finger_width_scale", label: "Finger width scale", min: 0.6, max: 1.6, default: 1.0 },
    { key: "pip_angle_deg", label: "PIP angle (deg)", min: 0, max: 90, default: 85 },
    
    { key: "pinky_forward_y", label: "Pinky forward extension", min: 0, max: 40, default: 12 },

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

    { key: "make_holes", label: "Make holes (0/1)", min: 0, max: 1, default: 1 },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7 },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "outer_fillet_r", label: "Outer fillet", min: 0, max: 8, default: 2.0 },
    { key: "slot_fillet_r", label: "Slot fillet", min: 0, max: 8, default: 2.0 },
    { key: "riser_fillet_r", label: "Riser fillet", min: 0, max: 8, default: 1.0 },
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
  const angleSin = Math.sin(degToRad(p.pip_angle_deg));

  const riserHFromType = (t) => {
    if (t === 0) return 0;
    if (t === 1) return Math.max(0, ringIndexLen - p.finger_len_pinky) * angleSin;
    return Math.max(0, p.finger_len_middle - p.finger_len_pinky) * angleSin;
  };

  const zoneWidths = zoneTypes.map((t) => {
    const nominal = t === 0 ? p.zone_w_pinky : (t === 1 ? p.zone_w_ring_index : p.zone_w_middle);
    return nominal * p.finger_width_scale;
  });

  const riserHeights = zoneTypes.map((t) => riserHFromType(t));
  const maxRiser = Math.max(...riserHeights);
  const slotHeight = Math.max(p.base_slot_height, 2 * maxRiser + p.slot_clearance_between_surfaces);
  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);

  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = p.slot_depth_y + p.back_wall_y;
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z;

  const slotX0 = p.side_wall_x;
  const slotY0 = 0;
  const slotZ0 = p.bottom_wall_z;

  const leftHoleX = p.side_wall_x / 2;
  const rightHoleX = blockWidthX - p.side_wall_x / 2;
  const holeZ = slotZ0 + slotHeight / 2;
  const holeY = p.slot_depth_y + p.back_wall_y / 2;

  const zoneXStart = (i) => {
    let s = slotX0;
    for (let k = 0; k < i; k++) s += zoneWidths[k];
    return s;
  };

  validateParameters(p, slotHeight, maxRiser);

  let shape = makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

  if (p.pinky_forward_y > 0.01) {
    for (let i = 0; i < zoneTypes.length; i++) {
      if (zoneTypes[i] === 0) {
        const extBlock = makePrismAt(oc, zoneXStart(i), -p.pinky_forward_y, 0, zoneWidths[i], p.pinky_forward_y + p.eps, blockHeightZ);
        shape = booleanFuseAdaptive(oc, shape, extBlock, p.boolean_fuzzy);
      }
    }
  }

  if (bool01(p.make_back_taper) && p.taper_top_inset > 0) {
    const taper = makeBackTaperCap(oc, {
      x0: 0,
      y0: Math.max(0, blockDepthY - 8),
      z0: 0,
      w0: blockWidthX,
      h0: blockHeightZ,
      x1: p.taper_top_inset,
      y1: Math.max(0, blockDepthY - 1),
      z1: p.taper_top_inset,
      w1: Math.max(0.5, blockWidthX - 2 * p.taper_top_inset),
      h1: Math.max(0.5, blockHeightZ - p.taper_top_inset)
    });
    shape = booleanFuseAdaptive(oc, shape, taper, p.boolean_fuzzy);
  }

  if (p.outer_fillet_r > 0.1) {
    shape = tryFilletWithFallback(
      oc,
      shape,
      [p.outer_fillet_r, 0.75 * p.outer_fillet_r, 0.5 * p.outer_fillet_r],
      (c) => {
        // FIX: Ignore the concave corners where the pinky extension meets the board
        const isConcaveCorner = c.Y() > -1 && c.Y() < 1 && c.X() > 1 && c.X() < blockWidthX - 1;
        if (isConcaveCorner) return false;

        const nearOuterX = c.X() < 1 || c.X() > blockWidthX - 1;
        const nearOuterY = c.Y() < 1 || c.Y() > blockDepthY - 1; 
        const nearOuterZ = c.Z() < 1 || c.Z() > blockHeightZ - 1;
        return nearOuterX || nearOuterY || nearOuterZ;
      },
      `Outer fillet failed. Reduce outer_fillet_r, taper_top_inset, or boolean_fuzzy.`
    );
  }

  let fullSlot = makePrismAt(
    oc,
    slotX0,
    slotY0 - p.eps,
    slotZ0,
    slotWidthX,
    p.slot_depth_y + 2 * p.eps,
    slotHeight + p.eps
  );

  if (p.pinky_forward_y > 0.01) {
    for (let i = 0; i < zoneTypes.length; i++) {
      if (zoneTypes[i] === 0) {
        const slotExt = makePrismAt(oc, zoneXStart(i), -p.pinky_forward_y - p.eps, slotZ0, zoneWidths[i], p.pinky_forward_y + 2 * p.eps, slotHeight + p.eps);
        fullSlot = booleanFuseAdaptive(oc, fullSlot, slotExt, p.boolean_fuzzy);
      }
    }
  }

  shape = booleanCutAdaptive(oc, shape, fullSlot, p.boolean_fuzzy);

  if (bool01(p.make_holes)) {
    let leftHole = makeDiamondHoleY(oc, leftHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY);
    let rightHole = makeDiamondHoleY(oc, rightHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY);

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(oc, leftHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, p.eps);
      const rightChamfers = makeDiamondHoleChamferPairY(oc, rightHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, p.eps);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[0], p.boolean_fuzzy);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[1], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[0], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[1], p.boolean_fuzzy);
    }

    shape = booleanCutAdaptive(oc, shape, leftHole, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightHole, p.boolean_fuzzy);
  }

  if (p.slot_fillet_r > 0.1) {
    shape = tryFilletWithFallback(
      oc,
      shape,
      [p.slot_fillet_r, 0.75 * p.slot_fillet_r, 0.5 * p.slot_fillet_r, 0.25 * p.slot_fillet_r],
      (c) => {
        // FIX: Ignore the concave corners inside the slot where the step occurs
        const isConcaveSlotCorner = c.Y() > -1 && c.Y() < 1 && c.X() > 1 && c.X() < blockWidthX - 1;
        if (isConcaveSlotCorner) return false;

        const insideSlotX = c.X() > slotX0 - 1 && c.X() < slotX0 + slotWidthX + 1;
        const nearSlotY = c.Y() > -p.pinky_forward_y - 1 && c.Y() < p.slot_depth_y + 1; 
        const nearSlotZ = c.Z() > slotZ0 - 1 && c.Z() < slotZ0 + slotHeight + 1;
        return insideSlotX && nearSlotY && nearSlotZ;
      },
      `Slot fillet failed. Reduce slot_fillet_r or boolean_fuzzy, or increase slot_clearance_between_surfaces.`
    );
  }

  for (let i = 0; i < zoneTypes.length; i++) {
    const riserH = Math.min(riserHeights[i], slotHeight / 2 - 0.4);
    if (riserH > 0.01) {
      const x0 = zoneXStart(i);
      const w = zoneWidths[i];
      const isPinky = zoneTypes[i] === 0;

      const yStart = isPinky ? -p.pinky_forward_y : slotY0;
      const yDepth = isPinky ? blockDepthY + p.pinky_forward_y : blockDepthY;

      let bottomRiser = makePrismAt(oc, x0, yStart, slotZ0, w, yDepth, riserH);
      let topRiser = makePrismAt(oc, x0, yStart, slotZ0 + slotHeight - riserH, w, yDepth, riserH);

      if (p.riser_fillet_r > 0.1) {
        bottomRiser = tryFilletWithFallback(
          oc,
          bottomRiser,
          [p.riser_fillet_r, 0.75 * p.riser_fillet_r, 0.5 * p.riser_fillet_r],
          (c) => {
            const nearTop = c.Z() > riserH - 1.0;
            const nearFront = c.Y() < 1.0; 
            const nearBack = c.Y() > blockDepthY - 1.0;
            const withinX = c.X() > x0 - 1 && c.X() < x0 + w + 1;
            return withinX && (nearTop || nearFront || nearBack);
          },
          `Bottom riser fillet failed for zone ${i + 1}. Reduce riser_fillet_r.`
        );

        topRiser = tryFilletWithFallback(
          oc,
          topRiser,
          [p.riser_fillet_r, 0.75 * p.riser_fillet_r, 0.5 * p.riser_fillet_r],
          (c) => {
            const nearBottom = c.Z() < slotZ0 + slotHeight - riserH + 1.0;
            const nearFront = c.Y() < 1.0; 
            const nearBack = c.Y() > blockDepthY - 1.0;
            const withinX = c.X() > x0 - 1 && c.X() < x0 + w + 1;
            return withinX && (nearBottom || nearFront || nearBack);
          },
          `Top riser fillet failed for zone ${i + 1}. Reduce riser_fillet_r.`
        );
      }

      shape = booleanFuseAdaptive(oc, shape, bottomRiser, p.boolean_fuzzy);
      shape = booleanFuseAdaptive(oc, shape, topRiser, p.boolean_fuzzy);
    }
  }

  return shape;
}

function validateParameters(p, slotHeight, maxRiser) {
  if (2 * maxRiser > slotHeight - 0.2) {
    console.warn(`slot_clearance_between_surfaces or base_slot_height is too small for the requested finger lengths. Increase clearance or reduce pip_angle_deg.`);
  }
  if (p.slot_fillet_r > 0.5 * Math.min(p.slot_depth_y, slotHeight)) {
    console.warn(`slot_fillet_r is large relative to slot dimensions. Reduce slot_fillet_r if the blend fails.`);
  }
  if (p.riser_fillet_r > 0.5 * p.top_wall_z || p.riser_fillet_r > 0.5 * p.bottom_wall_z) {
    console.warn(`riser_fillet_r is large relative to wall thickness. Reduce riser_fillet_r if riser blends fail.`);
  }
  if (p.taper_top_inset > Math.min(p.side_wall_x, p.top_wall_z + p.bottom_wall_z)) {
    console.warn(`taper_top_inset is aggressive for the current body size and can destabilize later blends.`);
  }
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

function tryFilletWithFallback(oc, shape, radii, predicate, warningText) {
  for (const r of radii) {
    if (r <= 0.05) continue;
    const out = filletEdgesByCentres(oc, shape, r, predicate);
    if (out !== shape) return out;
  }
  console.warn(warningText);
  return shape;
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

    if (count === 0) return shape;
    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return mk.Shape();
  } catch (e) {
    // Silent here
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

function makeDiamondHoleY(oc, xc, zc, wx, hz, blockDepthY) {
  const y0 = -1;
  const y1 = blockDepthY + 1;

  const mkDiamondWireAtY = (py, scale = 1.0) => {
    const ww = wx * scale;
    const hh = hz * scale;
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + hh / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc + ww / 2, py, zc));
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - hh / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc - ww / 2, py, zc));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkDiamondWireAtY(y0));
  mk.AddWire(mkDiamondWireAtY(y1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeDiamondHoleChamferPairY(oc, xc, yc, zc, wx, hz, chamfer, blockDepthY, eps) {
  const frontY = yc - blockDepthY / 2;
  const backY = yc + blockDepthY / 2;

  const mkFrustum = (yA, yB, scaleA, scaleB) => {
    const mkWire = (py, scale) => {
      const ww = wx * scale;
      const hh = hz * scale;
      const poly = new oc.BRepBuilderAPI_MakePolygon_1();
      poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + hh / 2));
      poly.Add_1(new oc.gp_Pnt_3(xc + ww / 2, py, zc));
      poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - hh / 2));
      poly.Add_1(new oc.gp_Pnt_3(xc - ww / 2, py, zc));
      poly.Close();
      return poly.Wire();
    };

    const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
    mk.AddWire(mkWire(yA, scaleA));
    mk.AddWire(mkWire(yB, scaleB));
    mk.Build(oc.createProgressRange());
    return mk.Shape();
  };

  const scaleOuter = 1 + Math.max(0.01, 2 * chamfer / Math.max(wx, hz));
  const front = mkFrustum(frontY - eps, frontY + chamfer, scaleOuter, 1.0);
  const back = mkFrustum(backY - chamfer, backY + eps, 1.0, scaleOuter);
  return [front, back];
}
