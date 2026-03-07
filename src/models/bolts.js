export const meta = {
  name: "Standards-Aware Bolt Example Presets",
  params: [
    // Preset index map:
    // 0 = ISO 4017 M6x20 hex head
    // 1 = ISO 4017 M8x25 hex head
    // 2 = ISO 4762 M6x20 socket cap
    // 3 = ISO 4762 M8x25 socket cap
    // 4 = ISO 10642 M8x25 countersunk socket
    // 5 = ISO 7380-1 M8x20 button head socket
    // 6 = ASME B18.2.1 1/4-20 UNC x 1" hex head
    // 7 = ASME B18.2.1 1/4-28 UNF x 1" hex head
    // 8 = ASME B18.3 1/4-20 UNC x 1" socket cap
    { key: "preset_index", label: "Preset index", min: 0, max: 8, default: 1 },

    { key: "length_override", label: "Length override (<=0 uses preset)", min: -1, max: 200, default: -1 },
    { key: "major_dia_offset", label: "Major diameter offset", min: -1.0, max: 1.0, default: 0.0 },

    { key: "make_drive", label: "Model drive recess (0/1)", min: 0, max: 1, default: 1 },
    { key: "drive_depth_scale", label: "Drive depth scale", min: 0.3, max: 1.2, default: 1.0 },

    { key: "circle_sides", label: "Circle approximation sides", min: 12, max: 96, default: 48 },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

const PRESETS = [
  {
    label: "ISO 4017 M6x20 hex head",
    productStandard: "ISO 4017",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "hex",
    driveStyle: "external_hex",
    majorDia: 6.0,
    pitch: 1.0,
    length: 20.0,
    headAcrossFlats: 10.0,
    headHeight: 4.0
  },
  {
    label: "ISO 4017 M8x25 hex head",
    productStandard: "ISO 4017",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "hex",
    driveStyle: "external_hex",
    majorDia: 8.0,
    pitch: 1.25,
    length: 25.0,
    headAcrossFlats: 13.0,
    headHeight: 5.3
  },
  {
    label: "ISO 4762 M6x20 socket cap",
    productStandard: "ISO 4762",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "socket_cap",
    driveStyle: "hex_socket",
    majorDia: 6.0,
    pitch: 1.0,
    length: 20.0,
    headDia: 10.0,
    headHeight: 6.0,
    socketAcrossFlats: 5.0,
    socketDepth: 3.0
  },
  {
    label: "ISO 4762 M8x25 socket cap",
    productStandard: "ISO 4762",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "socket_cap",
    driveStyle: "hex_socket",
    majorDia: 8.0,
    pitch: 1.25,
    length: 25.0,
    headDia: 13.0,
    headHeight: 8.0,
    socketAcrossFlats: 6.0,
    socketDepth: 4.0
  },
  {
    label: "ISO 10642 M8x25 countersunk socket",
    productStandard: "ISO 10642",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "countersunk_socket",
    driveStyle: "hex_socket",
    majorDia: 8.0,
    pitch: 1.25,
    length: 25.0,
    headDia: 17.92,
    headHeight: 4.96,
    socketAcrossFlats: 5.0,
    socketDepth: 3.0
  },
  {
    label: "ISO 7380-1 M8x20 button head socket",
    productStandard: "ISO 7380-1",
    threadStandard: "ISO 261/262 metric coarse",
    headStyle: "button_socket",
    driveStyle: "hex_socket",
    majorDia: 8.0,
    pitch: 1.25,
    length: 20.0,
    headDia: 14.0,
    headHeight: 4.4,
    socketAcrossFlats: 5.0,
    socketDepth: 2.7
  },
  {
    label: "ASME B18.2.1 1/4-20 UNC x 1 in hex head",
    productStandard: "ASME B18.2.1",
    threadStandard: "ASME B1.1 UNC",
    headStyle: "hex",
    driveStyle: "external_hex",
    majorDia: 6.35,
    pitch: 25.4 / 20.0,
    length: 25.4,
    headAcrossFlats: 0.438 * 25.4,
    headHeight: 0.188 * 25.4
  },
  {
    label: "ASME B18.2.1 1/4-28 UNF x 1 in hex head",
    productStandard: "ASME B18.2.1",
    threadStandard: "ASME B1.1 UNF",
    headStyle: "hex",
    driveStyle: "external_hex",
    majorDia: 6.35,
    pitch: 25.4 / 28.0,
    length: 25.4,
    headAcrossFlats: 0.438 * 25.4,
    headHeight: 0.188 * 25.4
  },
  {
    label: "ASME B18.3 1/4-20 UNC x 1 in socket cap",
    productStandard: "ASME B18.3",
    threadStandard: "ASME B1.1 UNC",
    headStyle: "socket_cap",
    driveStyle: "hex_socket",
    majorDia: 6.35,
    pitch: 25.4 / 20.0,
    length: 25.4,
    headDia: 0.375 * 25.4,
    headHeight: 0.25 * 25.4,
    socketAcrossFlats: 0.1875 * 25.4,
    socketDepth: 0.12 * 25.4
  }
];

export function build(oc, params) {
  const p = { ...params };
  const preset = getPreset(Math.round(p.preset_index));
  const spec = resolveSpec(preset, p);

  let head;
  if (spec.headStyle === "hex") {
    head = makeHexHeadTopAtZ0(oc, spec.headAcrossFlats, spec.headHeight);
  } else if (spec.headStyle === "socket_cap") {
    head = makeCylinderTopAtZ0(oc, spec.headDia, spec.headHeight, spec.circleSides);
  } else if (spec.headStyle === "countersunk_socket") {
    head = makeCountersunkHeadTopAtZ0(oc, spec.headDia, spec.majorDia, spec.headHeight, spec.circleSides);
  } else if (spec.headStyle === "button_socket") {
    head = makeButtonHeadTopAtZ0(oc, spec.headDia, spec.headHeight, spec.circleSides);
  } else {
    throw new Error(`Unsupported head style: ${spec.headStyle}`);
  }

  const shank = makeCylinderBetweenZ(
    oc,
    spec.majorDia,
    -spec.headHeight - spec.length,
    -spec.headHeight,
    spec.circleSides
  );

  let shape = booleanFuseAdaptive(oc, head, shank, spec.booleanFuzzy);

  if (bool01(p.make_drive) && spec.driveStyle === "hex_socket" && spec.socketAcrossFlats > 0) {
    const depth = clamp(
      spec.socketDepth * p.drive_depth_scale,
      0.5,
      Math.max(0.6, spec.headHeight - 0.35)
    );

    const socketCut = makeHexPrismBetweenZ(
      oc,
      spec.socketAcrossFlats,
      p.eps,
      -depth - p.eps
    );

    shape = booleanCutAdaptive(oc, shape, socketCut, spec.booleanFuzzy);
  }

  return shape;
}

function getPreset(i) {
  const idx = clamp(Math.round(i), 0, PRESETS.length - 1);
  return PRESETS[idx];
}

function resolveSpec(preset, p) {
  const circleSides = Math.max(12, Math.round(p.circle_sides || 48));
  const length = p.length_override > 0 ? p.length_override : preset.length;

  return {
    ...preset,
    majorDia: Math.max(0.5, preset.majorDia + (p.major_dia_offset || 0)),
    length,
    circleSides,
    booleanFuzzy: p.boolean_fuzzy || 0
  };
}

function bool01(v) {
  return v >= 0.5;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

function makeHexHeadTopAtZ0(oc, acrossFlats, height) {
  return makeHexPrismBetweenZ(oc, acrossFlats, -height, 0);
}

function makeHexPrismBetweenZ(oc, acrossFlats, z0, z1) {
  const R = acrossFlats / Math.sqrt(3.0);
  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, 6, R, Math.PI / 6);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, 6, R, Math.PI / 6);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeCylinderTopAtZ0(oc, dia, height, sides) {
  return makeCylinderBetweenZ(oc, dia, -height, 0, sides);
}

function makeCylinderBetweenZ(oc, dia, z0, z1, sides) {
  const r = dia / 2;
  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, sides, r, 0);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, sides, r, 0);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeCountersunkHeadTopAtZ0(oc, headDia, shaftDia, headHeight, sides) {
  const wTop = makeRegularPolygonWireXYAtZ(oc, 0, 0, 0, sides, headDia / 2, 0);
  const wBottom = makeRegularPolygonWireXYAtZ(oc, 0, 0, -headHeight, sides, shaftDia / 2, 0);
  return makeLoftFromWires(oc, [wBottom, wTop], true, true);
}

function makeButtonHeadTopAtZ0(oc, headDia, headHeight, sides) {
  const z0 = -headHeight;
  const z1 = -0.35 * headHeight;
  const z2 = 0;

  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, sides, headDia / 2, 0);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, sides, headDia / 2, 0);
  const w2 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z2, sides, 0.68 * headDia / 2, 0);

  return makeLoftFromWires(oc, [w0, w1, w2], true, false);
}

function makeRegularPolygonWireXYAtZ(oc, cx, cy, z, n, r, phase = 0) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();

  for (let i = 0; i < n; i++) {
    const a = phase + (2 * Math.PI * i) / n;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }

  poly.Close();
  return poly.Wire();
}

function makeLoftFromWires(oc, wires, makeSolid = true, ruled = true) {
  const mk = new oc.BRepOffsetAPI_ThruSections(makeSolid, ruled, 1e-6);
  for (const w of wires) mk.AddWire(w);
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}
