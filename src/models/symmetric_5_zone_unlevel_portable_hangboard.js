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
  /*
    Build strategy:
    - make the outer body
    - optionally fuse the rear taper
    - build one cavity cutter from a rounded XZ profile extruded through Y
    - cut the cavity once
    - optionally cut the side holes

    Notes:
    - slot_fillet_r is applied in the XZ cavity profile before extrusion
    - the profile rounding is created explicitly from points, not via MakeFillet2d
    - outer_fillet_r and riser_fillet_r are intentionally unused in this phase
  */

  const p = { ...params };
  const degToRad = (d) => d * Math.PI / 180.0;
  const bool01 = (v) => v >= 0.5;

  const zoneTypes = [1, 2, 1, 0]; // 0: pinky, 1: ring/index, 2: middle
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

  const riserHeightsRaw = zoneTypes.map((t) => riserHFromType(t));
  const maxRiser = Math.max(...riserHeightsRaw);
  const slotHeight = Math.max(p.base_slot_height, 2 * maxRiser + p.slot_clearance_between_surfaces);
  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);

  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = p.slot_depth_y + p.back_wall_y;
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z;

  const slotX0 = p.side_wall_x;
  const slotY0 = 0;
  const slotZ0 = p.bottom_wall_z;

  const riserLimit = Math.max(0, slotHeight / 2 - 0.4);
  const riserHeights = riserHeightsRaw.map((h) => Math.min(h, riserLimit));

  const leftHoleX = p.side_wall_x / 2;
  const rightHoleX = blockWidthX - p.side_wall_x / 2;
  const holeZ = slotZ0 + slotHeight / 2;
  const holeY = p.slot_depth_y + p.back_wall_y / 2;

  validateParameters(p, slotHeight, maxRiser, zoneWidths, riserHeights);

  let shape = makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

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

  const cavity = makeSlotCavityFromRoundedXZProfile(oc, {
    slotX0,
    slotZ0,
    slotHeight,
    zoneWidths,
    riserHeights,
    y0: slotY0 - p.eps,
    depthY: p.slot_depth_y + 2 * p.eps,
    filletR: p.slot_fillet_r
  });

  shape = booleanCutAdaptive(oc, shape, cavity, p.boolean_fuzzy);

  if (bool01(p.make_holes)) {
    let leftHole = makeDiamondHoleY(oc, leftHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY);
    let rightHole = makeDiamondHoleY(oc, rightHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY);

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(
        oc, leftHoleX, holeY, holeZ,
        p.hole_width_x, p.hole_height_z,
        p.hole_chamfer, blockDepthY, p.eps
      );
      const rightChamfers = makeDiamondHoleChamferPairY(
        oc, rightHoleX, holeY, holeZ,
        p.hole_width_x, p.hole_height_z,
        p.hole_chamfer, blockDepthY, p.eps
      );

      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[0], p.boolean_fuzzy);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[1], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[0], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[1], p.boolean_fuzzy);
    }

    shape = booleanCutAdaptive(oc, shape, leftHole, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightHole, p.boolean_fuzzy);
  }

  return shape;
}

function validateParameters(p, slotHeight, maxRiser, zoneWidths, riserHeights) {
  /*
    Stability warnings:
    - impossible or near-impossible slot clearance
    - aggressive taper
    - cavity fillet radius too large relative to local profile lengths
  */

  if (2 * maxRiser > slotHeight - 0.2) {
    console.warn(`slot_clearance_between_surfaces or base_slot_height is too small for the requested finger lengths. Increase clearance or reduce pip_angle_deg.`);
  }

  if (p.taper_top_inset > Math.min(p.side_wall_x, p.top_wall_z + p.bottom_wall_z)) {
    console.warn(`taper_top_inset is aggressive for the current body size and can destabilize later booleans.`);
  }

  const localStepHeights = [];
  for (let i = 0; i + 1 < riserHeights.length; i++) {
    localStepHeights.push(Math.abs(riserHeights[i + 1] - riserHeights[i]));
  }

  const limitingLengths = [
    ...zoneWidths,
    ...localStepHeights.filter((v) => v > 1e-6),
    slotHeight - 2 * Math.max(...riserHeights)
  ].filter((v) => v > 1e-6);

  if (limitingLengths.length > 0) {
    const localMin = Math.min(...limitingLengths);
    if (p.slot_fillet_r > 0.5 * localMin) {
      console.warn(`slot_fillet_r is large relative to local cavity profile features. Reduce slot_fillet_r if rounding collapses local steps.`);
    }
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

function makeSlotCavityFromRoundedXZProfile(oc, d) {
  /*
    Build one slot cavity cutter:
    - create the stepped XZ profile
    - round the orthogonal corners in XZ
    - create the same rounded wire at front and back Y
    - loft between the two wires into one solid cutter
  */

  const stepped = buildSteppedSlotProfileXZ(d);
  const rounded = roundOrthogonalClosedPolylineXZ(stepped, d.filletR, 4);

  const wire0 = makePolygonWireXZAtY(oc, rounded, d.y0);
  const wire1 = makePolygonWireXZAtY(oc, rounded, d.y0 + d.depthY);

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(wire0);
  mk.AddWire(wire1);
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function buildSteppedSlotProfileXZ(d) {
  /*
    Build the exact stepped cavity profile in XZ:
    - bottom envelope follows the lower riser heights
    - top envelope follows the mirrored upper riser heights
  */

  const n = d.zoneWidths.length;

  const xs = [d.slotX0];
  for (let i = 0; i < n; i++) xs.push(xs[xs.length - 1] + d.zoneWidths[i]);

  const bottomZ = d.riserHeights.map((h) => d.slotZ0 + h);
  const topZ = d.riserHeights.map((h) => d.slotZ0 + d.slotHeight - h);

  const pts = [];
  const push = (x, z) => {
    if (pts.length === 0) {
      pts.push({ x, z });
      return;
    }
    const q = pts[pts.length - 1];
    if (Math.abs(q.x - x) > 1e-9 || Math.abs(q.z - z) > 1e-9) {
      pts.push({ x, z });
    }
  };

  push(xs[0], bottomZ[0]);

  for (let i = 0; i < n; i++) {
    push(xs[i + 1], bottomZ[i]);
    if (i + 1 < n) push(xs[i + 1], bottomZ[i + 1]);
  }

  push(xs[n], topZ[n - 1]);

  for (let i = n - 1; i >= 0; i--) {
    push(xs[i], topZ[i]);
    if (i - 1 >= 0) push(xs[i], topZ[i - 1]);
  }

  return pts;
}

function roundOrthogonalClosedPolylineXZ(pts, radius, arcSteps = 4) {
  /*
    Replace each orthogonal corner of a closed XZ polygon with a short arc
    sampled into a few points.

    - low point count is intentional for performance
    - radius is clamped locally to avoid collapsing short segments
  */

  if (radius <= 0.05 || pts.length < 3) {
    return pts;
  }

  const n = pts.length;
  const area2 = signedArea2XZ(pts);
  const orientation = area2 >= 0 ? 1 : -1;
  const out = [];

  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];

    const e1 = { x: b.x - a.x, z: b.z - a.z };
    const e2 = { x: c.x - b.x, z: c.z - b.z };

    const l1 = Math.hypot(e1.x, e1.z);
    const l2 = Math.hypot(e2.x, e2.z);

    if (l1 < 1e-9 || l2 < 1e-9) {
      pushXZPoint(out, b);
      continue;
    }

    const d1 = { x: e1.x / l1, z: e1.z / l1 };
    const d2 = { x: e2.x / l2, z: e2.z / l2 };
    const cross = d1.x * d2.z - d1.z * d2.x;

    if (Math.abs(cross) < 1e-9) {
      pushXZPoint(out, b);
      continue;
    }

    const r = Math.min(radius, 0.499 * l1, 0.499 * l2);

    if (r <= 0.05) {
      pushXZPoint(out, b);
      continue;
    }

    const s = { x: b.x - d1.x * r, z: b.z - d1.z * r };
    const e = { x: b.x + d2.x * r, z: b.z + d2.z * r };

    const n1 = orientation > 0 ? leftNormalXZ(d1) : rightNormalXZ(d1);
    const n2 = orientation > 0 ? leftNormalXZ(d2) : rightNormalXZ(d2);

    const center = intersectLinesXZ(s, n1, e, n2);

    if (!center) {
      pushXZPoint(out, b);
      continue;
    }

    const a0 = Math.atan2(s.z - center.z, s.x - center.x);
    const a1 = Math.atan2(e.z - center.z, e.x - center.x);

    let delta = a1 - a0;
    if (cross > 0) {
      while (delta <= 0) delta += 2 * Math.PI;
    } else {
      while (delta >= 0) delta -= 2 * Math.PI;
    }

    const steps = Math.max(1, arcSteps);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const ang = a0 + delta * t;
      pushXZPoint(out, {
        x: center.x + r * Math.cos(ang),
        z: center.z + r * Math.sin(ang)
      });
    }
  }

  return out;
}

function signedArea2XZ(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.z - b.x * a.z;
  }
  return s;
}

function leftNormalXZ(v) {
  return { x: -v.z, z: v.x };
}

function rightNormalXZ(v) {
  return { x: v.z, z: -v.x };
}

function intersectLinesXZ(p, dp, q, dq) {
  const det = dp.x * dq.z - dp.z * dq.x;
  if (Math.abs(det) < 1e-12) return null;

  const rx = q.x - p.x;
  const rz = q.z - p.z;
  const t = (rx * dq.z - rz * dq.x) / det;

  return {
    x: p.x + t * dp.x,
    z: p.z + t * dp.z
  };
}

function pushXZPoint(arr, p) {
  if (arr.length === 0) {
    arr.push({ x: p.x, z: p.z });
    return;
  }

  const q = arr[arr.length - 1];
  if (Math.abs(q.x - p.x) > 1e-9 || Math.abs(q.z - p.z) > 1e-9) {
    arr.push({ x: p.x, z: p.z });
  }
}

function makePolygonWireXZAtY(oc, ptsXZ, y) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const p of ptsXZ) {
    poly.Add_1(new oc.gp_Pnt_3(p.x, y, p.z));
  }
  poly.Close();
  return poly.Wire();
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  /*
    Build an axis-aligned box-like solid from two rectangular wires.
  */

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
  /*
    Build the rear taper as a loft between two XZ rectangles at different Y.
  */

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
  /*
    Build one through-hole solid with a diamond XZ section.
  */

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
  /*
    Build front and back chamfer solids for the diamond hole.
  */

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
