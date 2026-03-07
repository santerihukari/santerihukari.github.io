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
    Build the part in this order:

    - Compute slot geometry and per-zone riser heights.
    - Build the outer body.
    - Optionally fuse the back taper.
    - Build one exact cavity from a 2D XZ face, fillet that face in 2D,
      then extrude it through Y and cut once.
    - Optionally cut the side holes and their chamfers.

    Notes:
    - slot_fillet_r is used here as the 2D cavity-profile fillet radius.
    - outer_fillet_r and riser_fillet_r are intentionally unused in this phase.
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
  /*
    Emit only coarse warnings that are useful for stability.

    - Guard against impossible slot clearance.
    - Warn about aggressive taper.
    - Warn when the requested 2D cavity fillet is likely too large.
    - Warn when fuzzy tolerance is large relative to small dimensions.
  */

  if (2 * maxRiser > slotHeight - 0.2) {
    console.warn(
      `slot_clearance_between_surfaces or base_slot_height is too small for the requested finger lengths. Increase clearance or reduce pip_angle_deg.`
    );
  }

  if (p.taper_top_inset > Math.min(p.side_wall_x, p.top_wall_z + p.bottom_wall_z)) {
    console.warn(
      `taper_top_inset is aggressive for the current body size and can destabilize later booleans.`
    );
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
      console.warn(
        `slot_fillet_r is large relative to local cavity profile features. Reduce slot_fillet_r if 2D filleting fails.`
      );
    }
  }

  if (p.boolean_fuzzy > 0.25 * Math.min(p.side_wall_x, p.bottom_wall_z, p.top_wall_z, 1 + p.eps)) {
    console.warn(
      `boolean_fuzzy is fairly large relative to some small features. Reduce it if edges disappear or topology changes unexpectedly.`
    );
  }
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  /*
    Run one boolean cut with optional fuzzy tolerance.

    - If the operation succeeds, return the cut result.
    - If it fails, return the original input shape unchanged.
  */

  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  /*
    Run one boolean fuse with optional fuzzy tolerance.

    - If the operation succeeds, return the fused result.
    - If it fails, return the original input shape unchanged.
  */

  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function makeSlotCavityFromXZProfile2dFilleted(oc, d) {
  /*
    Build the slot cavity from a single planar XZ face.

    - Create the stepped XZ polygon for the exact cavity profile.
    - Make a planar face from that wire at fixed Y.
    - Fillet all face vertices in 2D with fallback radii.
    - Extrude the face through +Y to obtain one cavity cutter solid.
  */

  const ptsXZ = buildSteppedSlotProfileXZ(d);
  let face = makePlanarXZFaceAtY(oc, ptsXZ, d.y0);

  if (d.filletR > 0.05) {
    face = filletPlanarFace2dAllVerticesWithFallback(
      oc,
      face,
      [d.filletR, 0.75 * d.filletR, 0.5 * d.filletR, 0.25 * d.filletR]
    );
  }

  return extrudeFaceAlongY(oc, face, d.depthY);
}

function buildSteppedSlotProfileXZ(d) {
  /*
    Build the closed XZ polygon of the cavity.

    - Bottom boundary follows the bottom riser envelope from left to right.
    - Right side connects bottom to top.
    - Top boundary follows the mirrored top riser envelope from right to left.
    - The resulting polygon is suitable for planar 2D filleting before extrusion.
  */

  const n = d.zoneWidths.length;

  const xs = [d.slotX0];
  for (let i = 0; i < n; i++) {
    xs.push(xs[xs.length - 1] + d.zoneWidths[i]);
  }

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

function makePlanarXZFaceAtY(oc, ptsXZ, y) {
  /*
    Build one planar face from a closed XZ polygon placed at fixed Y.

    - Construct the boundary wire.
    - Create a planar face from that wire.
    - Use adaptive constructor lookup because OpenCascade.js overload names vary.
  */

  const poly = new oc.BRepBuilderAPI_MakePolygon_1();

  for (const [x, z] of ptsXZ) {
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }

  poly.Close();
  const wire = poly.Wire();

  const mkFace = constructAdaptive(oc, [
    ["BRepBuilderAPI_MakeFace_15", [wire, true]],
    ["BRepBuilderAPI_MakeFace_16", [wire, true]],
    ["BRepBuilderAPI_MakeFace_8", [wire, true]],
    ["BRepBuilderAPI_MakeFace", [wire, true]]
  ]);

  return extractBuiltShape(mkFace, ["Face", "Shape"]);
}

function filletPlanarFace2dAllVerticesWithFallback(oc, face, radii) {
  /*
    Apply 2D fillets to every vertex of the planar face.

    - Try the requested radius first.
    - Reduce the radius progressively on failure.
    - Return the original face if all attempts fail.
  */

  for (const r of radii) {
    if (r <= 0.05) continue;

    const out = tryFilletPlanarFace2dAllVertices(oc, face, r);
    if (out !== face) return out;
  }

  console.warn(
    `2D cavity-profile fillet failed. Reduce slot_fillet_r or increase local feature sizes.`
  );

  return face;
}

function tryFilletPlanarFace2dAllVertices(oc, face, radius) {
  /*
    Try one full-pass 2D fillet on the planar face.

    - Create the 2D fillet builder for the face.
    - Attempt to add a fillet at every vertex.
    - Build once after all vertices are added.
    - Return the original face on any overall failure.
  */

  try {
    const mk2d = constructAdaptive(oc, [
      ["BRepFilletAPI_MakeFillet2d_2", [face]],
      ["BRepFilletAPI_MakeFillet2d_1", [face]],
      ["BRepFilletAPI_MakeFillet2d", [face]]
    ]);

    const exp = new oc.TopExp_Explorer_2(
      face,
      oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let count = 0;

    while (exp.More()) {
      const v = oc.TopoDS.Vertex_1(exp.Current());

      try {
        mk2d.AddFillet(v, radius);
        count++;
      } catch (e) {
        // Skip single-vertex failures and let the overall build decide.
      }

      exp.Next();
    }

    if (count === 0) return face;

    mk2d.Build(oc.createProgressRange());

    if (typeof mk2d.IsDone === "function" && mk2d.IsDone()) {
      return extractBuiltShape(mk2d, ["Shape"]);
    }
  } catch (e) {
    // Fall through and return the original face.
  }

  return face;
}

function extrudeFaceAlongY(oc, face, depthY) {
  /*
    Extrude the planar face through +Y.

    - Build a Y-direction vector.
    - Create the prism builder.
    - Return the extruded solid shape.
  */

  const vec = constructAdaptive(oc, [
    ["gp_Vec_4", [0, depthY, 0]],
    ["gp_Vec", [0, depthY, 0]]
  ]);

  const mkPrism = constructAdaptive(oc, [
    ["BRepPrimAPI_MakePrism_1", [face, vec, false, true]],
    ["BRepPrimAPI_MakePrism", [face, vec, false, true]]
  ]);

  if (typeof mkPrism.Build === "function") {
    mkPrism.Build(oc.createProgressRange());
  }

  return extractBuiltShape(mkPrism, ["Shape"]);
}

function constructAdaptive(oc, candidates) {
  /*
    Try several constructor names and argument lists.

    - Use the first constructor that exists and instantiates successfully.
    - Throw only if all candidates fail.
  */

  for (const [name, args] of candidates) {
    const Ctor = oc[name];
    if (!Ctor) continue;

    try {
      return new Ctor(...args);
    } catch (e) {
      // Try next overload.
    }
  }

  throw new Error(`No matching OpenCascade constructor found for: ${candidates.map(([n]) => n).join(", ")}`);
}

function extractBuiltShape(builder, methodNames) {
  /*
    Extract the result shape from a builder object.

    - Try preferred result methods first.
    - Fall back to Shape when available.
    - Throw only if no supported accessor exists.
  */

  for (const name of methodNames) {
    if (typeof builder[name] === "function") {
      return builder[name]();
    }
  }

  if (typeof builder.Shape === "function") {
    return builder.Shape();
  }

  throw new Error(`Builder result accessor not found.`);
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  /*
    Build an axis-aligned prism using two parallel rectangular wires.

    - Create the lower and upper rectangle wires.
    - Loft between them to obtain a solid prism.
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

    - Create the larger rear section.
    - Create the inset top section.
    - Loft between them into one solid cap.
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
    Build one through-hole solid with a diamond XZ cross section.

    - Create the same diamond wire slightly before and after the body in Y.
    - Loft between the two sections to obtain the cutting solid.
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

    - Create two short frustums around the entry and exit faces.
    - Each frustum transitions between the nominal diamond and a scaled diamond.
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
