// src/models/symmetric_5_zone_unlevel_portable_hangboard.js

export const meta = {
  name: "Symmetric 5-Zone Unlevel Portable Hangboard",
  params: [
    { key: "finger_len_index", label: "Index length", min: 40, max: 110, default: 72 },
    { key: "finger_len_middle", label: "Middle length", min: 40, max: 120, default: 78 },
    { key: "finger_len_ring", label: "Ring length", min: 40, max: 110, default: 76 },
    { key: "finger_len_pinky", label: "Pinky length", min: 35, max: 100, default: 62 },

    { key: "finger_width_scale", label: "Finger width scale", min: 0.6, max: 1.6, default: 1.0 },
    { key: "pip_angle_deg", label: "PIP angle (deg)", min: 0, max: 90, default: 85 },

    { key: "base_slot_height", label: "Base slot height", min: 8, max: 60, default: 20 },
    { key: "slot_clearance_above_highest", label: "Clearance above highest", min: 4, max: 50, default: 20 },
    { key: "slot_depth_y", label: "Slot depth", min: 8, max: 80, default: 24 },

    { key: "side_wall_x", label: "Side wall", min: 4, max: 40, default: 14 },
    { key: "back_wall_y", label: "Back wall", min: 4, max: 50, default: 20 },
    { key: "bottom_wall_z", label: "Bottom wall", min: 4, max: 40, default: 10 },
    { key: "top_wall_z", label: "Top wall", min: 4, max: 40, default: 8 },

    { key: "zone_w_1", label: "Zone 1 width", min: 8, max: 40, default: 16 },
    { key: "zone_w_2", label: "Zone 2 width", min: 8, max: 40, default: 19 },
    { key: "zone_w_3", label: "Zone 3 width", min: 8, max: 40, default: 20 },
    { key: "zone_w_4", label: "Zone 4 width", min: 8, max: 40, default: 19 },
    { key: "zone_w_5", label: "Zone 5 width", min: 8, max: 40, default: 16 },

    { key: "make_holes", label: "Make holes (0/1)", min: 0, max: 1, default: 1 },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7 },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "make_pinky_front_extrude", label: "Pinky front extrude (0/1)", min: 0, max: 1, default: 0 },
    { key: "pinky_front_extrude_y", label: "Pinky front extrude depth", min: 0, max: 40, default: 10 },
    { key: "pinky_front_extrude_z", label: "Pinky front extrude height", min: 2, max: 40, default: 12 },

    { key: "outer_fillet_r", label: "Outer fillet", min: 0, max: 8, default: 2.0 },
    { key: "slot_fillet_r", label: "Slot fillet", min: 0, max: 8, default: 2.0 },
    { key: "riser_fillet_r", label: "Riser fillet", min: 0, max: 8, default: 1.2 }
  ]
};

export function build(oc, params) {
  const p = {
    ...params,
    eps: 0.1
  };

  const degToRad = (d) => d * Math.PI / 180.0;
  const bool01 = (v) => v >= 0.5;

  const ringIndexLen = 0.5 * (p.finger_len_ring + p.finger_len_index);

  const zoneLengths = [
    p.finger_len_pinky,
    ringIndexLen,
    p.finger_len_middle,
    ringIndexLen,
    p.finger_len_pinky
  ];

  const nominalZoneWidths = [
    p.zone_w_1,
    p.zone_w_2,
    p.zone_w_3,
    p.zone_w_4,
    p.zone_w_5
  ];

  const zoneWidths = nominalZoneWidths.map(w => w * p.finger_width_scale);
  const minLen = Math.min(...zoneLengths);
  const angleSin = Math.sin(degToRad(p.pip_angle_deg));

  const riserHeights = zoneLengths.map(L => Math.max(0, (L - minLen) * angleSin));
  const maxRiserHeight = Math.max(...riserHeights);

  const slotHeight = Math.max(p.base_slot_height, maxRiserHeight + p.slot_clearance_above_highest);
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

  const zoneXStart = (i) => {
    let s = slotX0;
    for (let k = 0; k < i; k++) s += zoneWidths[k];
    return s;
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
      y1: Math.max(0, blockDepthY - 1),
      z1: p.taper_top_inset,
      w1: Math.max(0.5, blockWidthX - 2 * p.taper_top_inset),
      h1: Math.max(0.5, blockHeightZ - p.taper_top_inset)
    });

    shape = booleanFuseAdaptive(oc, shape, taper, 0.1);
  }

  if (p.outer_fillet_r > 0.1) {
    try {
      const mkOuter = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

      let count = 0;
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const c = props.CentreOfMass();

        const nearOuterX = c.X() < 1 || c.X() > blockWidthX - 1;
        const nearOuterY = c.Y() < 1 || c.Y() > blockDepthY - 1;
        const nearOuterZ = c.Z() < 1 || c.Z() > blockHeightZ - 1;

        if (nearOuterX || nearOuterY || nearOuterZ) {
          mkOuter.Add_2(p.outer_fillet_r, edge);
          count++;
        }
        exp.Next();
      }

      if (count > 0) {
        mkOuter.Build(oc.createProgressRange());
        if (mkOuter.IsDone()) shape = mkOuter.Shape();
      }
    } catch (e) {
      console.warn("Outer fillet failed.");
    }
  }

  const slot = makePrismAt(
    oc,
    slotX0,
    slotY0 - p.eps,
    slotZ0,
    slotWidthX,
    p.slot_depth_y + 2 * p.eps,
    slotHeight + p.eps
  );
  shape = booleanCutAdaptive(oc, shape, slot, 0.1);

  if (bool01(p.make_pinky_front_extrude) && p.pinky_front_extrude_y > 0.01) {
    const pinkyZones = [0, 4];

    for (const i of pinkyZones) {
      const px = zoneXStart(i);
      const pw = zoneWidths[i];
      const extH = Math.min(p.pinky_front_extrude_z, slotHeight);

      const frontBody = makePrismAt(
        oc,
        px,
        -p.pinky_front_extrude_y,
        slotZ0,
        pw,
        p.pinky_front_extrude_y,
        extH
      );
      shape = booleanFuseAdaptive(oc, shape, frontBody, 0.1);

      const frontSlotCut = makePrismAt(
        oc,
        px,
        -p.pinky_front_extrude_y - p.eps,
        slotZ0,
        pw,
        p.pinky_front_extrude_y + p.eps,
        extH + p.eps
      );
      shape = booleanCutAdaptive(oc, shape, frontSlotCut, 0.1);
    }
  }

  if (bool01(p.make_holes)) {
    const leftHole = makeDiamondHoleY(
      oc,
      leftHoleX,
      holeZ,
      p.hole_width_x,
      p.hole_height_z,
      blockDepthY
    );
    const rightHole = makeDiamondHoleY(
      oc,
      rightHoleX,
      holeZ,
      p.hole_width_x,
      p.hole_height_z,
      blockDepthY
    );

    shape = booleanCutAdaptive(oc, shape, leftHole, 0.1);
    shape = booleanCutAdaptive(oc, shape, rightHole, 0.1);
  }

  if (p.slot_fillet_r > 0.1) {
    try {
      const mkSlot = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

      let count = 0;
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const c = props.CentreOfMass();

        const insideSlotX = c.X() > slotX0 - 1 && c.X() < slotX0 + slotWidthX + 1;
        const nearSlotY = c.Y() > -p.pinky_front_extrude_y - 1 && c.Y() < p.slot_depth_y + 1;
        const nearSlotZ = c.Z() > slotZ0 - 1 && c.Z() < slotZ0 + slotHeight + 1;

        if (insideSlotX && nearSlotY && nearSlotZ) {
          mkSlot.Add_2(p.slot_fillet_r, edge);
          count++;
        }
        exp.Next();
      }

      if (count > 0) {
        mkSlot.Build(oc.createProgressRange());
        if (mkSlot.IsDone()) shape = mkSlot.Shape();
      }
    } catch (e) {
      console.warn("Slot fillet failed.");
    }
  }

  for (let i = 0; i < 5; i++) {
    const riserH = Math.min(riserHeights[i], slotHeight - 0.8);
    if (riserH > 0.01) {
      let riser = makePrismAt(
        oc,
        zoneXStart(i),
        slotY0,
        slotZ0,
        zoneWidths[i],
        blockDepthY,
        riserH
      );

      if (p.riser_fillet_r > 0.1) {
        try {
          const mkR = new oc.BRepFilletAPI_MakeFillet(riser, oc.ChFi3d_FilletShape.ChFi3d_Rational);
          const expR = new oc.TopExp_Explorer_2(riser, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

          let countR = 0;
          while (expR.More()) {
            const edge = oc.TopoDS.Edge_1(expR.Current());
            const props = new oc.GProp_GProps_1();
            oc.BRepGProp.LinearProperties(edge, props, false, false);
            const c = props.CentreOfMass();

            const nearTop = c.Z() > riserH - 1.0;
            const nearFront = c.Y() < 1.0;
            const nearBack = c.Y() > blockDepthY - 1.0;
            const withinX = c.X() > zoneXStart(i) - 1 && c.X() < zoneXStart(i) + zoneWidths[i] + 1;

            if (withinX && (nearTop || nearFront || nearBack)) {
              mkR.Add_2(p.riser_fillet_r, edge);
              countR++;
            }
            expR.Next();
          }

          if (countR > 0) {
            mkR.Build(oc.createProgressRange());
            if (mkR.IsDone()) riser = mkR.Shape();
          }
        } catch (e) {
          console.warn(`Riser fillet failed for zone ${i + 1}.`);
        }
      }

      shape = booleanFuseAdaptive(oc, shape, riser, 0.1);
    }
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

function makeDiamondHoleY(oc, xc, zc, wx, hz, blockDepthY) {
  const y0 = -1;
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
