export const meta = {
  name: "Standards-Aware Bolt With Helical Thread Renderer",
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
    // 9 = Custom M10x25 four-fifths ring head
    { key: "preset_index", label: "Preset index", min: 0, max: 9, default: 1 },

    { key: "length_override", label: "Length override (<=0 uses preset)", min: -1, max: 300, default: -1 },
    { key: "major_dia_offset", label: "Major diameter offset", min: -1.0, max: 1.0, default: 0.0 },

    { key: "make_drive", label: "Model drive recess (0/1)", min: 0, max: 1, default: 1 },
    { key: "drive_depth_scale", label: "Drive depth scale", min: 0.3, max: 1.2, default: 1.0 },

    // Disabled by default so the custom head is easier to debug.
    { key: "render_thread", label: "Render thread (0/1)", min: 0, max: 1, default: 0 },
    { key: "thread_sections_per_turn", label: "Thread sections/turn", min: 6, max: 24, default: 12 },
    { key: "thread_depth_scale", label: "Thread depth scale", min: 0.2, max: 1.2, default: 1.0 },
    { key: "thread_runout_top", label: "Thread runout top (<=0 auto)", min: -1, max: 20, default: -1 },
    { key: "thread_runout_bottom", label: "Thread runout bottom (<=0 auto)", min: -1, max: 20, default: -1 },

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
    threadSeries: "M",
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
    threadSeries: "M",
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
    threadSeries: "M",
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
    threadSeries: "M",
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
    threadSeries: "M",
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
    threadSeries: "M",
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
    threadSeries: "UNC",
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
    threadSeries: "UNF",
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
    threadSeries: "UNC",
    headStyle: "socket_cap",
    driveStyle: "hex_socket",
    majorDia: 6.35,
    pitch: 25.4 / 20.0,
    length: 25.4,
    headDia: 0.375 * 25.4,
    headHeight: 0.25 * 25.4,
    socketAcrossFlats: 0.1875 * 25.4,
    socketDepth: 0.12 * 25.4
  },
  {
    label: "Custom M10x25 four-fifths ring head",
    productStandard: "Custom",
    threadStandard: "ISO 261/262 metric coarse",
    threadSeries: "M",
    headStyle: "four_fifths_ring_bow",
    driveStyle: "finger_turn",
    majorDia: 10.0,
    pitch: 1.5,
    length: 25.0,

    // Minimal base collar below z=0
    headHeight: 4.0,
    neckDia: 12.0,

    // 4/5-circle bow above z=0, extruded along Y
    // Hole diameter = 1.5x previous 10 mm = 15 mm
    // Material outer diameter ~= 1.2x hole diameter = 18 mm
    bowThicknessY: 4.0,
    bowOuterRadius: 9.0,
    bowHoleDia: 15.0
  }
];

export function build(oc, params) {
  const p = { ...params };
  const preset = getPreset(Math.round(p.preset_index));
  const spec = resolveSpec(preset, p);

  validateParameters(spec);

  let head;
  if (spec.headStyle === "hex") {
    head = makeHexHeadTopAtZ0(oc, spec.headAcrossFlats, spec.headHeight);
  } else if (spec.headStyle === "socket_cap") {
    head = makeCylinderTopAtZ0(oc, spec.headDia, spec.headHeight, spec.circleSides);
  } else if (spec.headStyle === "countersunk_socket") {
    head = makeCountersunkHeadTopAtZ0(
      oc,
      spec.headDia,
      spec.majorDia,
      spec.headHeight,
      spec.circleSides
    );
  } else if (spec.headStyle === "button_socket") {
    head = makeButtonHeadTopAtZ0(oc, spec.headDia, spec.headHeight, spec.circleSides);
  } else if (spec.headStyle === "four_fifths_ring_bow") {
    head = makeFourFifthsRingBowHead(oc, {
      headHeight: spec.headHeight,
      neckDia: spec.neckDia,
      bowThicknessY: spec.bowThicknessY,
      bowOuterRadius: spec.bowOuterRadius,
      bowHoleDia: spec.bowHoleDia,
      circleSides: spec.circleSides,
      eps: spec.eps,
      booleanFuzzy: spec.booleanFuzzy
    });
  } else {
    throw new Error(`Unsupported head style: ${spec.headStyle}`);
  }

  const shankZ0 = -spec.headHeight - spec.length;
  const shankZ1 = -spec.headHeight;

  const shank = bool01(p.render_thread)
    ? makeThreadedShankBetweenZ(oc, {
        majorDia: spec.majorDia,
        pitch: spec.pitch,
        z0: shankZ0,
        z1: shankZ1,
        circleSides: spec.circleSides,
        sectionsPerTurn: Math.max(6, Math.round(p.thread_sections_per_turn || 12)),
        depthScale: spec.threadDepthScale,
        runoutTop: spec.threadRunoutTop,
        runoutBottom: spec.threadRunoutBottom
      })
    : makeCylinderBetweenZ(
        oc,
        spec.majorDia,
        shankZ0,
        shankZ1,
        spec.circleSides
      );

  let shape = booleanFuseAdaptive(oc, head, shank, spec.booleanFuzzy);

  if (bool01(p.make_drive) && spec.driveStyle === "hex_socket" && spec.socketAcrossFlats > 0) {
    const depth = clamp(
      spec.socketDepth * (p.drive_depth_scale || 1.0),
      0.5,
      Math.max(0.6, spec.headHeight - 0.35)
    );

    const socketCut = makeHexPrismBetweenZ(
      oc,
      spec.socketAcrossFlats,
      -depth - spec.eps,
      spec.eps
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
  const majorDia = Math.max(0.5, preset.majorDia + (p.major_dia_offset || 0));
  const pitch = preset.pitch;

  return {
    ...preset,
    majorDia,
    pitch,
    length,
    circleSides,
    threadDepthScale: p.thread_depth_scale || 1.0,
    threadRunoutTop: p.thread_runout_top > 0 ? p.thread_runout_top : 0.75 * pitch,
    threadRunoutBottom: p.thread_runout_bottom > 0 ? p.thread_runout_bottom : 0.75 * pitch,
    booleanFuzzy: p.boolean_fuzzy || 0,
    eps: p.eps || 0.1
  };
}

function validateParameters(spec) {
  if (spec.pitch <= 0) {
    throw new Error("Pitch must be positive.");
  }
  if (spec.length <= 0) {
    throw new Error("Length must be positive.");
  }
  if (spec.majorDia <= 0) {
    throw new Error("Major diameter must be positive.");
  }
  if (spec.circleSides < 12) {
    throw new Error("circle_sides must be at least 12.");
  }
}

function bool01(v) {
  return v >= 0.5;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fract(x) {
  return x - Math.floor(x);
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
  const circumRadius = acrossFlats / Math.sqrt(3.0);
  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, 6, circumRadius, Math.PI / 6);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, 6, circumRadius, Math.PI / 6);
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

function makeCylinderAlongY(oc, dia, y0, y1, sides, cx = 0, cz = 0) {
  const r = dia / 2;
  const w0 = makeRegularPolygonWireXZAtY(oc, cx, y0, cz, sides, r, 0);
  const w1 = makeRegularPolygonWireXZAtY(oc, cx, y1, cz, sides, r, 0);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeCountersunkHeadTopAtZ0(oc, headDia, shaftDia, headHeight, sides) {
  const wBottom = makeRegularPolygonWireXYAtZ(oc, 0, 0, -headHeight, sides, shaftDia / 2, 0);
  const wTop = makeRegularPolygonWireXYAtZ(oc, 0, 0, 0, sides, headDia / 2, 0);
  return makeLoftFromWires(oc, [wBottom, wTop], true, true);
}

function makeButtonHeadTopAtZ0(oc, headDia, headHeight, sides) {
  const z0 = -headHeight;
  const z1 = -0.55 * headHeight;
  const z2 = -0.20 * headHeight;
  const z3 = 0;

  const r0 = headDia / 2;
  const r1 = headDia / 2;
  const r2 = 0.88 * headDia / 2;
  const r3 = 0.68 * headDia / 2;

  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, sides, r0, 0);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, sides, r1, 0);
  const w2 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z2, sides, r2, 0);
  const w3 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z3, sides, r3, 0);

  return makeLoftFromWires(oc, [w0, w1, w2, w3], true, false);
}

function makeFourFifthsRingBowHead(oc, d) {
  const arcFraction = 0.8;
  const gapAngle = 2 * Math.PI * (1 - arcFraction);
  const halfGap = 0.5 * gapAngle;
  const outerR = d.bowOuterRadius;
  const innerR = Math.max(0.5, d.bowHoleDia / 2);

  const centerZ = outerR * Math.cos(halfGap);

  // Minimal collar, just enough to support the ring.
  const baseDia = d.neckDia;

  // Slight overlap into the lower part of the ring for robust fusion.
  const collarTopZ = Math.max(1.0, centerZ - innerR * Math.cos(halfGap) + 0.5);

  let shape = makeCylinderBetweenZ(oc, baseDia, -d.headHeight, collarTopZ, d.circleSides);

  const bow = makeFourFifthsRingPrismAlongY(oc, {
    y0: -0.5 * d.bowThicknessY,
    y1: 0.5 * d.bowThicknessY,
    outerR,
    innerR,
    centerZ,
    halfGap,
    steps: Math.max(24, d.circleSides)
  });

  shape = booleanFuseAdaptive(oc, shape, bow, d.booleanFuzzy);
  return shape;
}

function makeFourFifthsRingPrismAlongY(oc, d) {
  const w0 = makeFourFifthsRingWireXZAtY(oc, d.outerR, d.innerR, d.centerZ, d.halfGap, d.y0, d.steps);
  const w1 = makeFourFifthsRingWireXZAtY(oc, d.outerR, d.innerR, d.centerZ, d.halfGap, d.y1, d.steps);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeFourFifthsRingWireXZAtY(oc, outerR, innerR, centerZ, halfGap, y, steps) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();

  const outerStart = -Math.PI / 2 + halfGap;
  const outerEnd = 3 * Math.PI / 2 - halfGap;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = outerStart + t * (outerEnd - outerStart);
    const x = outerR * Math.cos(ang);
    const z = centerZ + outerR * Math.sin(ang);
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = outerEnd - t * (outerEnd - outerStart);
    const x = innerR * Math.cos(ang);
    const z = centerZ + innerR * Math.sin(ang);
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }

  poly.Close();
  return poly.Wire();
}

function makeThreadedShankBetweenZ(oc, d) {
  const length = Math.abs(d.z1 - d.z0);
  if (length < 1e-6 || d.pitch <= 1e-6) {
    return makeCylinderBetweenZ(oc, d.majorDia, d.z0, d.z1, d.circleSides);
  }

  const majorR = d.majorDia / 2;

  const basicDepth = 0.61343 * d.pitch;
  const depth = Math.max(
    0,
    Math.min(basicDepth * d.depthScale, 0.45 * d.majorDia)
  );

  if (depth < 1e-5) {
    return makeCylinderBetweenZ(oc, d.majorDia, d.z0, d.z1, d.circleSides);
  }

  const sectionsPerTurn = Math.max(6, Math.round(d.sectionsPerTurn || 12));
  const turns = length / d.pitch;
  const sectionCount = Math.max(2, Math.ceil(turns * sectionsPerTurn) + 1);

  const wires = [];
  for (let i = 0; i < sectionCount; i++) {
    const t = sectionCount === 1 ? 0 : i / (sectionCount - 1);
    const z = lerp(d.z0, d.z1, t);

    wires.push(
      makeThreadSectionWireXYAtZ(oc, {
        z,
        z0: d.z0,
        z1: d.z1,
        majorR,
        pitch: d.pitch,
        depth,
        circleSides: d.circleSides,
        runoutTop: d.runoutTop,
        runoutBottom: d.runoutBottom
      })
    );
  }

  return makeLoftFromWires(oc, wires, true, true);
}

function makeThreadSectionWireXYAtZ(oc, d) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();

  const bottomRamp = d.runoutBottom > 1e-9
    ? smoothRamp01((d.z - d.z0) / d.runoutBottom)
    : 1;

  const topRamp = d.runoutTop > 1e-9
    ? smoothRamp01((d.z1 - d.z) / d.runoutTop)
    : 1;

  const runoutFactor = bottomRamp * topRamp;
  const helixTurns = (d.z - d.z0) / d.pitch;
  const helixPhase = 2 * Math.PI * helixTurns;

  for (let i = 0; i < d.circleSides; i++) {
    const ang = (2 * Math.PI * i) / d.circleSides;
    const u = fract((ang - helixPhase) / (2 * Math.PI));
    const profile = externalThreadProfile01(u);

    const r = Math.max(0.05, d.majorR - runoutFactor * d.depth * profile);
    const x = r * Math.cos(ang);
    const y = r * Math.sin(ang);

    poly.Add_1(new oc.gp_Pnt_3(x, y, d.z));
  }

  poly.Close();
  return poly.Wire();
}

function externalThreadProfile01(u) {
  const t = fract(u);

  const crestHalf = 0.05;
  const rootFlat = 0.12;
  const flank = 0.5 * (1 - 2 * crestHalf - rootFlat);

  const a = crestHalf;
  const b = a + flank;
  const c = b + rootFlat;
  const d = c + flank;

  if (t < a) return 0;
  if (t < b) return (t - a) / flank;
  if (t < c) return 1;
  if (t < d) return 1 - (t - c) / flank;
  return 0;
}

function smoothRamp01(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
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

function makeRegularPolygonWireXZAtY(oc, cx, y, cz, n, r, phase = 0) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();

  for (let i = 0; i < n; i++) {
    const a = phase + (2 * Math.PI * i) / n;
    const x = cx + r * Math.cos(a);
    const z = cz + r * Math.sin(a);
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }

  poly.Close();
  return poly.Wire();
}

function makeLoftFromWires(oc, wires, makeSolid = true, ruled = true) {
  const mk = new oc.BRepOffsetAPI_ThruSections(makeSolid, ruled, 1e-6);
  for (const w of wires) {
    mk.AddWire(w);
  }
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}
