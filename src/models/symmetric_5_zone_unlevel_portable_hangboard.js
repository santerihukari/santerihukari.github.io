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
    { key: "hole_chamfer", label: "Hole chamfer", min: 0, max: 3, default: 0.5 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "slot_mouth_radius", label: "Slot mouth radius", min: 0, max: 8, default: 2.5 },
    { key: "slot_mouth_segments", label: "Slot mouth segments", min: 2, max: 24, default: 10 },

    { key: "make_entrance_relief", label: "Entrance relief (0/1)", min: 0, max: 1, default: 1 },
    { key: "entrance_relief_depth", label: "Entrance relief depth", min: 0, max: 10, default: 1.5 },
    { key: "entrance_relief_extra_height", label: "Entrance relief extra height", min: 0, max: 8, default: 0.8 },
    { key: "entrance_relief_radius", label: "Entrance relief radius", min: 0, max: 8, default: 1.2 },

    { key: "flip_model", label: "Flip model (0/1)", min: 0, max: 1, default: 1 },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const degToRad = (d) => d * Math.PI / 180.0;
  const bool01 = (v) => v >= 0.5;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const zoneTypes = [1, 2, 1, 0]; // ring/index, middle, ring/index, pinky
  const ringIndexLen = 0.5 * (p.finger_len_ring + p.finger_len_index);
  const angleRad = degToRad(p.pip_angle_deg);
  const s = Math.sin(angleRad);

  const riserHFromType = (t) => {
    if (t === 0) return 0;
    if (t === 1) return Math.max(0, ringIndexLen - p.finger_len_pinky) * s;
    return Math.max(0, p.finger_len_middle - p.finger_len_pinky) * s;
  };

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

  const holeZ = p.bottom_wall_z + 0.5 * slotHeight;
  const holeY = p.slot_depth_y + 0.5 * p.back_wall_y;

  const zoneXStart = (i) => {
    let acc = p.side_wall_x;
    for (let k = 0; k < i; k++) acc += zoneWidths[k];
    return acc;
  };

  let shape = makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

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

  for (let i = 0; i < 4; i++) {
    const t = zoneTypes[i];
    const riser = riserHFromType(t);
    const x0 = zoneXStart(i) - p.eps;
    const x1 = zoneXStart(i) + zoneWidths[i] + p.eps;
    const z0 = p.bottom_wall_z + riser;
    const z1 = p.bottom_wall_z + slotHeight - riser;

    const maxAllowedRadius = Math.max(0, Math.min(0.5 * p.slot_depth_y - 0.25, 0.5 * (z1 - z0) - 0.25));
    const mouthR = clamp(p.slot_mouth_radius, 0, maxAllowedRadius);
    if (p.slot_mouth_radius > maxAllowedRadius + 1e-6) {
      console.warn(`slot_mouth_radius clamped in zone ${i + 1} from ${p.slot_mouth_radius.toFixed(3)} to ${mouthR.toFixed(3)}. Reduce slot_mouth_radius or increase slot_depth_y / local opening height.`);
    }

    const slotCut = makeProfiledSlotCutX(
      oc,
      x0,
      x1,
      -p.eps,
      p.slot_depth_y + p.eps,
      z0,
      z1,
      mouthR,
      Math.max(2, Math.round(p.slot_mouth_segments))
    );
    shape = booleanCutAdaptive(oc, shape, slotCut, p.boolean_fuzzy);

    if (bool01(p.make_entrance_relief) && p.entrance_relief_depth > 0.01) {
      const reliefDepth = Math.min(p.entrance_relief_depth, p.slot_depth_y - 0.2);
      const reliefHalfGrow = 0.5 * p.entrance_relief_extra_height;
      const rz0 = Math.max(p.bottom_wall_z + 0.05, z0 - reliefHalfGrow);
      const rz1 = Math.min(p.bottom_wall_z + slotHeight - 0.05, z1 + reliefHalfGrow);
      const maxReliefRadius = Math.max(0, Math.min(0.5 * reliefDepth - 0.1, 0.5 * (rz1 - rz0) - 0.1));
      const reliefR = clamp(p.entrance_relief_radius, 0, maxReliefRadius);

      if (p.entrance_relief_radius > maxReliefRadius + 1e-6) {
        console.warn(`entrance_relief_radius clamped in zone ${i + 1} from ${p.entrance_relief_radius.toFixed(3)} to ${reliefR.toFixed(3)}. Reduce entrance_relief_radius or increase entrance_relief_depth / extra_height.`);
      }

      const reliefCut = makeProfiledSlotCutX(
        oc,
        x0,
        x1,
        -p.eps,
        reliefDepth,
        rz0,
        rz1,
        reliefR,
        Math.max(2, Math.round(p.slot_mouth_segments))
      );
      shape = booleanCutAdaptive(oc, shape, reliefCut, p.boolean_fuzzy);
    }
  }

  if (bool01(p.make_holes)) {
    const leftHoleX = 0.5 * p.side_wall_x;
    const rightHoleX = blockWidthX - 0.5 * p.side_wall_x;

    let leftHole = makeDiamondHoleY(oc, leftHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, 0, p.eps);
    let rightHole = makeDiamondHoleY(oc, rightHoleX, holeZ, p.hole_width_x, p.hole_height_z, blockDepthY, 0, p.eps);

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(oc, leftHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, 0, p.eps);
      const rightChamfers = makeDiamondHoleChamferPairY(oc, rightHoleX, holeY, holeZ, p.hole_width_x, p.hole_height_z, p.hole_chamfer, blockDepthY, 0, p.eps);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[0], p.boolean_fuzzy);
      leftHole = booleanFuseAdaptive(oc, leftHole, leftChamfers[1], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[0], p.boolean_fuzzy);
      rightHole = booleanFuseAdaptive(oc, rightHole, rightChamfers[1], p.boolean_fuzzy);
    }

    shape = booleanCutAdaptive(oc, shape, leftHole, p.boolean_fuzzy);
    shape = booleanCutAdaptive(oc, shape, rightHole, p.boolean_fuzzy);
  }

  if (bool01(p.flip_model)) {
    shape = rotateShapeX180(oc, shape, blockHeightZ);
  }

  return shape;
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

function makeDiamondHoleY(oc, xc, zc, wx, hz, blockDepthY, frontOffsetY, eps) {
  const y0 = -frontOffsetY - 1;
  const y1 = blockDepthY + 1;

  const mkDiamondWireAtY = (py) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + hz / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc + wx / 2, py, zc));
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - hz / 2));
    poly.Add_1(new oc.gp_Pnt_3(xc - wx / 2, py, zc));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkDiamondWireAtY(y0));
  mk.AddWire(mkDiamondWireAtY(y1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeDiamondHoleChamferPairY(oc, xc, yc, zc, wx, hz, ch, blockDepthY, frontOffsetY, eps) {
  const yFront = -frontOffsetY - eps;
  const yBack = blockDepthY + eps;
  return [
    makeDiamondHoleChamferY(oc, xc, zc, wx, hz, ch, yFront, true),
    makeDiamondHoleChamferY(oc, xc, zc, wx, hz, ch, yBack, false)
  ];
}

function makeDiamondHoleChamferY(oc, xc, zc, wx, hz, ch, yFace, isFront) {
  const s = isFront ? 1 : -1;
  const y1 = yFace;
  const y2 = yFace + s * ch;

  const mkWire = (py, scale) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc + (hz / 2 + scale)));
    poly.Add_1(new oc.gp_Pnt_3(xc + (wx / 2 + scale), py, zc));
    poly.Add_1(new oc.gp_Pnt_3(xc, py, zc - (hz / 2 + scale)));
    poly.Add_1(new oc.gp_Pnt_3(xc - (wx / 2 + scale), py, zc));
    poly.Close();
    return poly.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkWire(y1, 0));
  mk.AddWire(mkWire(y2, ch));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeProfiledSlotCutX(oc, x0, x1, yFront, depth, z0, z1, mouthR, segments) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(makeYZSlotWireAtX(oc, x0, yFront, depth, z0, z1, mouthR, segments));
  mk.AddWire(makeYZSlotWireAtX(oc, x1, yFront, depth, z0, z1, mouthR, segments));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeYZSlotWireAtX(oc, x, yFront, depth, z0, z1, mouthR, segments) {
  const yBack = yFront + depth;
  const r = Math.max(0, Math.min(mouthR, 0.499 * depth, 0.499 * (z1 - z0)));
  const pts = [];

  if (r <= 1e-6) {
    pts.push([yFront, z0], [yBack, z0], [yBack, z1], [yFront, z1]);
  } else {
    pts.push([yFront, z0 + r]);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const a = Math.PI + 0.5 * Math.PI * t;
      pts.push([yFront + r + r * Math.cos(a), z0 + r + r * Math.sin(a)]);
    }
    pts.push([yBack, z0]);
    pts.push([yBack, z1]);
    pts.push([yFront + r, z1]);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const a = 0.5 * Math.PI * (1 - t);
      pts.push([yFront + r - r * Math.sin(a), z1 - r + r * Math.cos(a)]);
    }
  }

  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const [y, z] of pts) poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  poly.Close();
  return poly.Wire();
}

function rotateShapeX180(oc, shape, blockHeightZ) {
  try {
    const trsf = new oc.gp_Trsf_1();
    const axis = new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Dir_4(1, 0, 0));
    trsf.SetRotation_1(axis, Math.PI);
    const rotated = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();

    const move = new oc.gp_Trsf_1();
    move.SetTranslation_1(new oc.gp_Vec_4(0, 0, blockHeightZ));
    return new oc.BRepBuilderAPI_Transform_2(rotated, move, true).Shape();
  } catch (e) {
    console.warn("Model flip failed; returning unflipped shape. If your OC binding lacks transform constructors, remove flip_model or adapt rotateShapeX180().");
    return shape;
  }
}
