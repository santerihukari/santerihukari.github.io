

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
function debugExactEdgeOverloads(oc) {
  const p1 = new oc.gp_Pnt_3(0, 0, 0);
  const pm = new oc.gp_Pnt_3(5, 0, 5);
  const p2 = new oc.gp_Pnt_3(10, 0, 0);

  const seg = new oc.GC_MakeSegment_1(p1, p2).Value();
  const arc = new oc.GC_MakeArcOfCircle_4(p1, pm, p2).Value();

  const tests = [
    ["BRepBuilderAPI_MakeEdge_2", [p1, p2]],
    ["BRepBuilderAPI_MakeEdge_3", [p1, p2]],

    ["BRepBuilderAPI_MakeEdge_24", [seg]],
    ["BRepBuilderAPI_MakeEdge_24", [arc]],

    ["BRepBuilderAPI_MakeEdge_25", [seg, p1, p2]],
    ["BRepBuilderAPI_MakeEdge_25", [arc, p1, p2]],
    ["BRepBuilderAPI_MakeEdge_26", [seg, p1, p2]],
    ["BRepBuilderAPI_MakeEdge_26", [arc, p1, p2]],
    ["BRepBuilderAPI_MakeEdge_27", [seg, p1, p2]],
    ["BRepBuilderAPI_MakeEdge_27", [arc, p1, p2]],

    ["BRepBuilderAPI_MakeEdge_25", [seg, 0, 1]],
    ["BRepBuilderAPI_MakeEdge_25", [arc, 0, 1]],
    ["BRepBuilderAPI_MakeEdge_26", [seg, 0, 1]],
    ["BRepBuilderAPI_MakeEdge_26", [arc, 0, 1]],
    ["BRepBuilderAPI_MakeEdge_27", [seg, 0, 1]],
    ["BRepBuilderAPI_MakeEdge_27", [arc, 0, 1]]
  ];

  for (const [name, args] of tests) {
    if (!oc[name]) continue;

    try {
      const mk = new oc[name](...args);
      const ok = typeof mk.IsDone === "function" ? mk.IsDone() : true;
      const hasEdge = typeof mk.Edge === "function";
      console.warn(`${name}(${args.map(a => typeof a === "number" ? a : a.constructor.name).join(", ")}) OK | IsDone=${ok} | Edge=${hasEdge}`);
    } catch (e) {
      console.warn(`${name} FAIL: ${e.message}`);
    }
  }

  throw new Error("Exact edge overload probe done");
}
function debugOcCurveBuilders(oc) {
  const p1 = new oc.gp_Pnt_3(0, 0, 0);
  const pm = new oc.gp_Pnt_3(5, 0, 5);
  const p2 = new oc.gp_Pnt_3(10, 0, 0);

  const tryCtor = (name, args) => {
    try {
      const obj = new oc[name](...args);
      console.warn(`${name} OK`);
      return obj;
    } catch (e) {
      console.warn(`${name} FAIL: ${e.message}`);
      return null;
    }
  };

  const listFns = (label, obj) => {
    if (!obj) return;
    const keys = [];
    let proto = obj;
    while (proto) {
      for (const k of Object.getOwnPropertyNames(proto)) {
        if (typeof obj[k] === "function" && !keys.includes(k)) keys.push(k);
      }
      proto = Object.getPrototypeOf(proto);
    }
    console.warn(`${label} methods:`, keys.sort());
  };

  const tryValue = (label, obj) => {
    if (!obj || typeof obj.Value !== "function") {
      console.warn(`${label} has no Value()`);
      return null;
    }
    try {
      const v = obj.Value();
      console.warn(`${label}.Value() OK`);
      return v;
    } catch (e) {
      console.warn(`${label}.Value() FAIL: ${e.message}`);
      return null;
    }
  };

  const tryEdgeFrom = (label, curve) => {
    if (!curve) return;
    const candidates = [
      "BRepBuilderAPI_MakeEdge",
      "BRepBuilderAPI_MakeEdge_1",
      "BRepBuilderAPI_MakeEdge_2",
      "BRepBuilderAPI_MakeEdge_3",
      "BRepBuilderAPI_MakeEdge_24",
      "BRepBuilderAPI_MakeEdge_25",
      "BRepBuilderAPI_MakeEdge_26",
      "BRepBuilderAPI_MakeEdge_27",
      "BRepBuilderAPI_MakeEdge_28",
      "BRepBuilderAPI_MakeEdge_29",
      "BRepBuilderAPI_MakeEdge_30",
      "BRepBuilderAPI_MakeEdge_31",
      "BRepBuilderAPI_MakeEdge_32",
      "BRepBuilderAPI_MakeEdge_33",
      "BRepBuilderAPI_MakeEdge_34",
      "BRepBuilderAPI_MakeEdge_35"
    ];

    for (const name of candidates) {
      if (!oc[name]) continue;
      try {
        const mk = new oc[name](curve);
        const ok = typeof mk.IsDone === "function" ? mk.IsDone() : true;
        console.warn(`${label}: ${name}(curve) OK, IsDone=${ok}`);
        listFns(`${label} edge builder ${name}`, mk);
        return;
      } catch (e) {
        console.warn(`${label}: ${name}(curve) FAIL: ${e.message}`);
      }
    }
  };

  console.warn("=== GC_MakeSegment probes ===");
  const seg1 = tryCtor("GC_MakeSegment_1", [p1, p2]);
  const seg2 = tryCtor("GC_MakeSegment_2", [p1, p2]);
  const seg3 = tryCtor("GC_MakeSegment_3", [p1, p2]);
  const seg4 = tryCtor("GC_MakeSegment_4", [p1, p2]);

  listFns("GC_MakeSegment_1 object", seg1);
  const segCurve =
    tryValue("GC_MakeSegment_1", seg1) ||
    tryValue("GC_MakeSegment_2", seg2) ||
    tryValue("GC_MakeSegment_3", seg3) ||
    tryValue("GC_MakeSegment_4", seg4);

  console.warn("=== GC_MakeArcOfCircle probes ===");
  const arc1 = tryCtor("GC_MakeArcOfCircle_1", [p1, pm, p2]);
  const arc2 = tryCtor("GC_MakeArcOfCircle_2", [p1, pm, p2]);
  const arc3 = tryCtor("GC_MakeArcOfCircle_3", [p1, pm, p2]);
  const arc4 = tryCtor("GC_MakeArcOfCircle_4", [p1, pm, p2]);
  const arc5 = tryCtor("GC_MakeArcOfCircle_5", [p1, pm, p2]);

  listFns("GC_MakeArcOfCircle_1 object", arc1);
  const arcCurve =
    tryValue("GC_MakeArcOfCircle_1", arc1) ||
    tryValue("GC_MakeArcOfCircle_2", arc2) ||
    tryValue("GC_MakeArcOfCircle_3", arc3) ||
    tryValue("GC_MakeArcOfCircle_4", arc4) ||
    tryValue("GC_MakeArcOfCircle_5", arc5);

  console.warn("=== Edge from segment curve ===");
  tryEdgeFrom("segment", segCurve);

  console.warn("=== Edge from arc curve ===");
  tryEdgeFrom("arc", arcCurve);

  throw new Error("Curve builder introspection done");
}
function debugOcBindings(oc) {
  const names = [
    "BRepBuilderAPI_MakeFace_15",
    "BRepFilletAPI_MakeFillet2d_1",
    "BRepBuilderAPI_MakeEdge_1",
    "BRepBuilderAPI_MakeEdge_3",
    "BRepBuilderAPI_MakeEdge_24",
    "BRepBuilderAPI_MakeWire_1",
    "GC_MakeArcOfCircle_1",
    "GC_MakeArcOfCircle_2",
    "GC_MakeArcOfCircle_3",
    "GC_MakeArcOfCircle_4",
    "GC_MakeSegment_1",
    "GC_MakeSegment_2",
    "gp_Vec_4",
    "BRepPrimAPI_MakePrism_1"
  ];

  const versionKeys = Object.keys(oc).filter(
    (k) => /version|Version|VERSION/.test(k)
  );
  console.warn("OC version-related keys:", versionKeys);

  for (const k of versionKeys) {
    try {
      console.warn(`${k}:`, oc[k]);
    } catch (e) {
      console.warn(`${k}: <unreadable>`);
    }
  }

  for (const n of names) {
    console.warn(`${n}:`, typeof oc[n], !!oc[n]);
  }

  const hits = Object.keys(oc)
    .filter((k) =>
      k.includes("MakeFillet2d") ||
      k.includes("MakeFace") ||
      k.includes("MakeEdge") ||
      k.includes("MakeWire") ||
      k.includes("MakePrism") ||
      k.includes("GC_MakeArcOfCircle") ||
      k.includes("GC_MakeSegment") ||
      k.includes("gp_Vec")
    )
    .sort();

  console.warn("Relevant OC bindings:");
  console.warn(JSON.stringify(hits, null, 2));

  throw new Error("OC introspection done");
}
export function build(oc, params) {
  debugExactEdgeOverloads(oc);
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
    const nominal = t === 0
      ? p.zone_w_pinky
      : (t === 1 ? p.zone_w_ring_index : p.zone_w_middle);
    return nominal * p.finger_width_scale;
  });

  const riserHeightsRaw = zoneTypes.map((t) => riserHFromType(t));
  const maxRiser = Math.max(...riserHeightsRaw);
  const slotHeight = Math.max(
    p.base_slot_height,
    2 * maxRiser + p.slot_clearance_between_surfaces
  );
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

  const cavity = makeSlotCavityFromXZProfile2dFilleted(oc, {
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
    let leftHole = makeDiamondHoleY(
      oc,
      leftHoleX,
      holeZ,
      p.hole_width_x,
      p.hole_height_z,
      blockDepthY
    );

    let rightHole = makeDiamondHoleY(
      oc,
      rightHoleX,
      holeZ,
      p.hole_width_x,
      p.hole_height_z,
      blockDepthY
    );

    if (p.hole_chamfer > 0.01) {
      const leftChamfers = makeDiamondHoleChamferPairY(
        oc,
        leftHoleX,
        holeY,
        holeZ,
        p.hole_width_x,
        p.hole_height_z,
        p.hole_chamfer,
        blockDepthY,
        p.eps
      );

      const rightChamfers = makeDiamondHoleChamferPairY(
        oc,
        rightHoleX,
        holeY,
        holeZ,
        p.hole_width_x,
        p.hole_height_z,
        p.hole_chamfer,
        blockDepthY,
        p.eps
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
      console.warn(`slot_fillet_r is large relative to local cavity profile features. Reduce slot_fillet_r if 2D filleting fails.`);
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

function makeSlotCavityFromXZProfile2dFilleted(oc, d) {
  const ptsXZ = buildSteppedSlotProfileXZ(d);

  const wire0 = makePolygonWireXZAtY(oc, ptsXZ, d.y0);
  const wire1 = makePolygonWireXZAtY(oc, ptsXZ, d.y0 + d.depthY);

  const filletedWire0 = filletPlanarWire2dWithFallback(oc, wire0, d.filletR);
  const filletedWire1 = filletPlanarWire2dWithFallback(oc, wire1, d.filletR);

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(filletedWire0);
  mk.AddWire(filletedWire1);
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function buildSteppedSlotProfileXZ(d) {
  const n = d.zoneWidths.length;

  const xs = [d.slotX0];
  for (let i = 0; i < n; i++) xs.push(xs[xs.length - 1] + d.zoneWidths[i]);

  const bottomZ = d.riserHeights.map((h) => d.slotZ0 + h);
  const topZ = d.riserHeights.map((h) => d.slotZ0 + d.slotHeight - h);

  const ptsXZ = [];
  const pushXZ = (x, z) => {
    if (ptsXZ.length === 0) {
      ptsXZ.push([x, z]);
      return;
    }
    const [lx, lz] = ptsXZ[ptsXZ.length - 1];
    if (Math.abs(lx - x) > 1e-9 || Math.abs(lz - z) > 1e-9) {
      ptsXZ.push([x, z]);
    }
  };

  pushXZ(xs[0], bottomZ[0]);

  for (let i = 0; i < n; i++) {
    pushXZ(xs[i + 1], bottomZ[i]);
    if (i + 1 < n) pushXZ(xs[i + 1], bottomZ[i + 1]);
  }

  pushXZ(xs[n], topZ[n - 1]);

  for (let i = n - 1; i >= 0; i--) {
    pushXZ(xs[i], topZ[i]);
    if (i - 1 >= 0) pushXZ(xs[i], topZ[i - 1]);
  }

  return ptsXZ;
}

function makePolygonWireXZAtY(oc, ptsXZ, y) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const [x, z] of ptsXZ) {
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }
  poly.Close();
  return poly.Wire();
}

function filletPlanarWire2dWithFallback(oc, wire, radius) {
  if (radius <= 0.05) return wire;

  const radii = [radius, 0.75 * radius, 0.5 * radius, 0.25 * radius];
  for (const r of radii) {
    if (r <= 0.05) continue;
    const out = filletPlanarWire2dExact(oc, wire, r);
    if (out !== wire) return out;
  }

  console.warn(`2D cavity-profile fillet failed. Reduce slot_fillet_r.`);
  return wire;
}

function filletPlanarWire2dExact(oc, wire, radius) {
  try {
    const mkFace = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
    const face = mkFace.Face();

    const mk2d = new oc.BRepFilletAPI_MakeFillet2d_1();
    mk2d.Init_1(face);

    const exp = new oc.TopExp_Explorer_2(
      face,
      oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let added = 0;
    while (exp.More()) {
      const v = oc.TopoDS.Vertex_1(exp.Current());
      try {
        mk2d.AddFillet(v, radius);
        added++;
      } catch (e) {
      }
      exp.Next();
    }

    if (added === 0) return wire;

    mk2d.Build(oc.createProgressRange());
    if (!mk2d.IsDone()) return wire;

    const outFace = oc.TopoDS.Face_1(mk2d.Shape());
    const wireExp = new oc.TopExp_Explorer_2(
      outFace,
      oc.TopAbs_ShapeEnum.TopAbs_WIRE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    if (!wireExp.More()) return wire;
    return oc.TopoDS.Wire_1(wireExp.Current());
  } catch (e) {
    return wire;
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
