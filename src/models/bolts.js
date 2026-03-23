export const meta = {
  name: "Standards-Aware Bolt With Helical Thread Renderer",
  description: "Fastener generator with standards-based presets, optional drive features, and an optional helical thread renderer.",
  params: [
    // Preset index map:
    // 0 = ISO 4017 M6x20 hex head
    // 1 = ISO 4017 M8x25 hex head
    // 2 = ISO 4762 M6x20 socket cap
    // 3 = ISO 4762 M8x25 socket cap
    // 4 = ISO 10642 M8x25 countersunk socket
    // 5 = ISO 7380-1 M8x20 button head socket
    // 6 = ISO 4762 M10x60 climbing hold socket cap
    // 7 = ISO 10642 M10x90 climbing hold countersunk socket
    // 8 = Custom M10x60 headless drive bolt
    // 9 = ASME B18.2.1 1/4-20 UNC x 1" hex head
    // 10 = ASME B18.2.1 1/4-28 UNF x 1" hex head
    // 11 = ASME B18.3 1/4-20 UNC x 1" socket cap
    // 12 = Custom M10x25 four-fifths ring head
    {
      key: "preset_index",
      label: "Preset",
      type: "select",
      default: 1,
      description: "Choose a standards-aware bolt preset as the starting point for the generated geometry.",
      options: [
        { value: 0, label: "ISO 4017 M6x20 hex head", description: "Metric hex-head bolt with M6 coarse thread and 20 mm length." },
        { value: 1, label: "ISO 4017 M8x25 hex head", description: "Metric hex-head bolt with M8 coarse thread and 25 mm length." },
        { value: 2, label: "ISO 4762 M6x20 socket cap", description: "Metric socket-cap screw with M6 coarse thread and 20 mm length." },
        { value: 3, label: "ISO 4762 M8x25 socket cap", description: "Metric socket-cap screw with M8 coarse thread and 25 mm length." },
        { value: 4, label: "ISO 10642 M8x25 countersunk socket", description: "Metric countersunk socket screw with M8 coarse thread and 25 mm length." },
        { value: 5, label: "ISO 7380-1 M8x20 button head socket", description: "Metric button-head socket screw with M8 coarse thread and 20 mm length." },
        { value: 6, label: "ISO 4762 M10x60 climbing hold socket cap", description: "M10 socket-cap hold bolt preset with the 8 mm hex commonly used on PU and PE climbing holds." },
        { value: 7, label: "ISO 10642 M10x90 climbing hold countersunk", description: "M10 countersunk wood-hold preset with a 6 mm hex and extra socket clearance for printed tool fit." },
        { value: 8, label: "Custom M10x60 headless drive bolt", description: "Custom fully threaded M10 bolt with a selectable internal drive that can run partway or completely through the threaded body." },
        { value: 9, label: "ASME B18.2.1 1/4-20 UNC x 1\" hex head", description: "Imperial hex-head bolt with coarse 1/4-20 UNC thread and 1 inch length." },
        { value: 10, label: "ASME B18.2.1 1/4-28 UNF x 1\" hex head", description: "Imperial hex-head bolt with fine 1/4-28 UNF thread and 1 inch length." },
        { value: 11, label: "ASME B18.3 1/4-20 UNC x 1\" socket cap", description: "Imperial socket-cap screw with coarse 1/4-20 UNC thread and 1 inch length." },
        { value: 12, label: "Custom M10x25 ring head", description: "Custom metric bolt preset used for ring-head experiments." }
      ]
    },

    {
      key: "length_override",
      label: "Length override (<=0 uses preset)",
      min: -1,
      max: 300,
      default: -1,
      description: "Override the preset length in millimeters. Values at or below zero keep the preset length."
    },
    { key: "major_dia_offset", label: "Major diameter offset", min: -1.0, max: 1.0, default: 0.0 },

    {
      key: "make_drive",
      label: "Drive recess",
      type: "select",
      default: 1,
      description: "Include or remove the drive recess geometry when the chosen preset supports one.",
      options: [
        { value: 1, label: "Enabled", description: "Create the socket or drive recess geometry in the head." },
        { value: 0, label: "Disabled", description: "Skip the drive recess and keep the head solid." }
      ]
    },
    { key: "drive_depth_scale", label: "Drive depth scale", min: 0.3, max: 1.2, default: 1.0 },
    {
      key: "headless_drive_type",
      label: "Headless drive",
      type: "select",
      default: "hex",
      visibleIf: { key: "preset_index", op: "==", value: 8 },
      description: "Choose which tool interface is used on the custom headless bolt.",
      options: [
        { value: "hex", label: "Hex", description: "Allen key drive." },
        { value: "torx", label: "Torx", description: "Six-lobed Torx-style drive." },
        { value: "phillips", label: "Phillips", description: "Cross-head drive." },
        { value: "flathead", label: "Flathead", description: "Single straight slot." }
      ]
    },
    {
      key: "socket_clearance",
      label: "Socket clearance (<=0 auto)",
      min: -1,
      max: 0.6,
      default: -1,
      description: "Extra across-flats clearance added to printed hex sockets so real tools still fit after corner rounding. Good starting values: 0.15 mm for most socket-cap bolts, 0.20-0.25 mm for countersunk sockets, and 0.25-0.35 mm for through-hex sockets."
    },
    {
      key: "headless_tool_size",
      label: "Headless tool size",
      type: "select",
      default: 6,
      visibleIf: [
        { key: "preset_index", op: "==", value: 8 },
        { key: "headless_drive_type", op: "==", value: "hex" }
      ],
      description: "Choose the Allen key size for the custom headless bolt.",
      options: [
        { value: 4, label: "4 mm", description: "Leaves the most material around the socket." },
        { value: 5, label: "5 mm", description: "Balanced option between strength and tool size." },
        { value: 6, label: "6 mm", description: "Largest recommended through-hex size for the custom M10 variant." }
      ]
    },
    {
      key: "headless_torx_size",
      label: "Torx size",
      type: "select",
      default: "T30",
      visibleIf: [
        { key: "preset_index", op: "==", value: 8 },
        { key: "headless_drive_type", op: "==", value: "torx" }
      ],
      options: [
        { value: "T25", label: "T25", description: "Smaller Torx option with more remaining wall thickness." },
        { value: "T30", label: "T30", description: "Good general-purpose Torx size for M10." },
        { value: "T40", label: "T40", description: "Largest Torx option, easiest to engage but weakest cross-section." }
      ]
    },
    {
      key: "headless_phillips_size",
      label: "Phillips size",
      type: "select",
      default: "PH3",
      visibleIf: [
        { key: "preset_index", op: "==", value: 8 },
        { key: "headless_drive_type", op: "==", value: "phillips" }
      ],
      options: [
        { value: "PH2", label: "PH2", description: "ISO 4757 type-H-compatible PH2 size with more remaining material." },
        { value: "PH3", label: "PH3", description: "Recommended ISO 4757/ISO 8764-style PH3 size for the custom M10 variant." },
        { value: "PH4", label: "PH4", description: "Largest PH4 option, easiest to engage but weakest cross-section." }
      ]
    },
    {
      key: "headless_flat_width",
      label: "Flathead slot width",
      type: "select",
      default: 6,
      visibleIf: [
        { key: "preset_index", op: "==", value: 8 },
        { key: "headless_drive_type", op: "==", value: "flathead" }
      ],
      options: [
        { value: 5, label: "5 mm", description: "Narrow slotted drive; slot thickness follows nearby ISO 2380 blade sizes." },
        { value: 6, label: "6 mm", description: "Balanced slotted drive width for the custom M10 variant." },
        { value: 8, label: "8 mm", description: "Very wide slot, easiest to engage but weakest cross-section." }
      ]
    },
    {
      key: "headless_drive_depth",
      label: "Headless drive depth",
      min: -1,
      max: 120,
      default: -1,
      visibleIf: { key: "preset_index", op: "==", value: 8 },
      description: "How deep the custom headless drive extends into the threaded body. Values at or below zero use a standards-inspired automatic blind depth for the selected drive style."
    },
    {
      key: "headless_drive_through",
      label: "Headless drive through",
      type: "select",
      default: 1,
      visibleIf: { key: "preset_index", op: "==", value: 8 },
      options: [
        { value: 1, label: "Enabled", description: "Run the drive all the way through the body." },
        { value: 0, label: "Disabled", description: "Use a blind recess. If drive depth is <= 0, a standards-inspired automatic blind depth is used." }
      ]
    },

    // Disabled by default so the custom head is easier to debug.
    {
      key: "render_thread",
      label: "Thread geometry",
      type: "select",
      default: 0,
      description: "Toggle between a faster smooth shank and an explicit helical thread model.",
      options: [
        { value: 0, label: "Disabled", description: "Do not render the helical thread. Faster to build and useful for layout checks." },
        { value: 1, label: "Enabled", description: "Render the helical thread geometry for more realistic output." }
      ]
    },
    { key: "thread_sections_per_turn", label: "Thread sections/turn", min: 6, max: 24, default: 12 },
    { key: "thread_depth_scale", label: "Thread depth scale", min: 0.2, max: 1.2, default: 1.0 },
    { key: "thread_runout_top", label: "Thread runout top (<=0 auto)", min: -1, max: 20, default: -1 },
    { key: "thread_runout_bottom", label: "Thread runout bottom (<=0 auto)", min: -1, max: 20, default: -1 },
    {
      key: "thread_end_style",
      label: "Thread end",
      type: "select",
      default: "auto",
      description: "Choose whether the free end stays blunt or gets a standards-style lead-in chamfer.",
      options: [
        { value: "auto", label: "Auto (standard)", description: "Use the preset's default standard behavior. Metric screw presets and socket-head screws chamfer the end; ASME hex-head bolt presets stay blunt." },
        { value: "none", label: "None", description: "Keep the free end blunt." },
        { value: "chamfered", label: "Chamfered", description: "Add a flat-ended lead-in chamfer so the first full major thread appears within roughly 1.5 pitches from the end." }
      ]
    },

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
    threadEndDefault: "chamfered",
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
    threadEndDefault: "chamfered",
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
    threadEndDefault: "chamfered",
    headDia: 10.0,
    headHeight: 6.0,
    socketAcrossFlats: 5.0,
    socketDepth: 3.0,
    socketClearance: 0.15,
    socketLeadInDepth: 0.6,
    socketLeadInExtraAF: 0.25
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
    threadEndDefault: "chamfered",
    headDia: 13.0,
    headHeight: 8.0,
    socketAcrossFlats: 6.0,
    socketDepth: 4.0,
    socketClearance: 0.15,
    socketLeadInDepth: 0.7,
    socketLeadInExtraAF: 0.25
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
    threadEndDefault: "chamfered",
    headDia: 17.92,
    headHeight: 4.96,
    socketAcrossFlats: 5.0,
    socketDepth: 4.0,
    socketClearance: 0.2,
    socketLeadInDepth: 0.9,
    socketLeadInExtraAF: 0.35
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
    threadEndDefault: "chamfered",
    headDia: 14.0,
    headHeight: 4.4,
    socketAcrossFlats: 5.0,
    socketDepth: 2.7,
    socketClearance: 0.15,
    socketLeadInDepth: 0.5,
    socketLeadInExtraAF: 0.2
  },
  {
    label: "ISO 4762 M10x60 climbing hold socket cap",
    productStandard: "ISO 4762",
    threadStandard: "ISO 261/262 metric coarse",
    threadSeries: "M",
    headStyle: "socket_cap",
    driveStyle: "hex_socket",
    majorDia: 10.0,
    pitch: 1.5,
    length: 60.0,
    threadEndDefault: "chamfered",
    headDia: 16.0,
    headHeight: 10.0,
    socketAcrossFlats: 8.0,
    socketDepth: 6.0,
    socketClearance: 0.15,
    socketLeadInDepth: 0.8,
    socketLeadInExtraAF: 0.25
  },
  {
    label: "ISO 10642 M10x90 climbing hold countersunk socket",
    productStandard: "ISO 10642",
    threadStandard: "ISO 261/262 metric coarse",
    threadSeries: "M",
    headStyle: "countersunk_socket",
    driveStyle: "hex_socket",
    majorDia: 10.0,
    pitch: 1.5,
    length: 90.0,
    threadEndDefault: "chamfered",
    headDia: 22.40,
    headHeight: 5.00,
    socketAcrossFlats: 6.0,
    socketDepth: 5.0,
    socketClearance: 0.25,
    socketLeadInDepth: 1.0,
    socketLeadInExtraAF: 0.4
  },
  {
    label: "Custom M10x60 headless drive bolt",
    productStandard: "Custom",
    threadStandard: "ISO 261/262 metric coarse",
    threadSeries: "M",
    headStyle: "headless_socket",
    driveStyle: "hex_socket",
    majorDia: 10.0,
    pitch: 1.5,
    length: 60.0,
    threadEndDefault: "none",
    headHeight: 0.0,
    socketAcrossFlats: 6.0,
    socketDepth: 60.0,
    socketThrough: true,
    socketClearance: 0.25,
    socketLeadInDepth: 1.2,
    socketLeadInExtraAF: 0.45,
    socketLeadInBothEnds: true
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
    threadEndDefault: "none",
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
    threadEndDefault: "none",
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
    threadEndDefault: "chamfered",
    headDia: 0.375 * 25.4,
    headHeight: 0.25 * 25.4,
    socketAcrossFlats: 0.1875 * 25.4,
    socketDepth: 0.12 * 25.4,
    socketClearance: 0.1,
    socketLeadInDepth: 0.45,
    socketLeadInExtraAF: 0.2
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
    threadEndDefault: "chamfered",

    // Minimal base collar below z=0, now a bit wider and 90% of previous height.
    headHeight: 3.6,
    neckDia: 14.0,

    // 4/5-circle bow above z=0, extruded along Y.
    // Hole diameter stays 15 mm.
    // Support material thickness doubled from 1.5 mm radial to 3.0 mm radial.
    bowThicknessY: 4.0,
    bowOuterRadius: 10.5,
    bowHoleDia: 15.0
  }
];

const TORX_PROFILE_SPECS = {
  T25: {
    size: "T25",
    A: 0.5 * (4.451 + 4.465),
    B: 0.5 * (3.170 + 3.185),
    Ri: 0.5 * (0.907 + 0.932),
    Re: 0.5 * (0.371 + 0.378),
    H: 0.5 * (3.94 + 4.45)
  },
  T30: {
    size: "T30",
    A: 0.5 * (5.543 + 5.557),
    B: 0.5 * (3.958 + 3.972),
    Ri: 0.5 * (1.182 + 1.206),
    Re: 0.5 * (0.448 + 0.454),
    H: 0.5 * (4.44 + 4.95)
  },
  T40: {
    size: "T40",
    A: 0.5 * (6.673 + 6.687),
    B: 0.5 * (4.766 + 4.780),
    Ri: 0.5 * (1.415 + 1.440),
    Re: 0.5 * (0.544 + 0.548),
    H: 0.5 * (5.08 + 5.59)
  }
};

const PHILLIPS_PROFILE_SPECS = {
  // Based on ISO 4757 type H gauge dimensions (Table 2) for PH-compatible driver points.
  PH2: {
    size: "PH2",
    span: 2.286,
    coreDia: 1.102,
    armWidth: 0.64,
    trueFormDepth: 1.539
  },
  PH3: {
    size: "PH3",
    span: 3.81,
    coreDia: 2.098,
    armWidth: 0.79,
    trueFormDepth: 2.497
  },
  PH4: {
    size: "PH4",
    span: 5.08,
    coreDia: 2.738,
    armWidth: 1.12,
    trueFormDepth: 3.574
  }
};

const FLAT_BLADE_WIDTH_THICKNESS_SPECS = [
  // ISO 2380 nominal width/thickness series, reduced to the range relevant here.
  { width: 3.5, thickness: 0.6 },
  { width: 4.0, thickness: 0.8 },
  { width: 5.5, thickness: 1.0 },
  { width: 6.5, thickness: 1.2 },
  { width: 8.0, thickness: 1.2 },
  { width: 10.0, thickness: 1.6 }
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
  } else if (spec.headStyle === "headless_socket") {
    head = null;
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
        runoutBottom: spec.threadRunoutBottom,
        threadEndStyle: spec.threadEndStyle,
        threadEndLength: spec.threadEndLength,
        threadEndTipDia: spec.threadEndTipDia
      })
    : makePlainShankBetweenZ(oc, {
        majorDia: spec.majorDia,
        z0: shankZ0,
        z1: shankZ1,
        circleSides: spec.circleSides,
        threadEndStyle: spec.threadEndStyle,
        threadEndLength: spec.threadEndLength,
        threadEndTipDia: spec.threadEndTipDia
      });

  let shape =
    spec.headStyle === "headless_socket"
      ? shank
      : booleanFuseAdaptive(oc, head, shank, spec.booleanFuzzy);

  if (bool01(p.make_drive) && spec.driveStyle && spec.driveStyle !== "external_hex" && spec.driveStyle !== "finger_turn") {
    const requestedBlindDepth =
      spec.headStyle === "headless_socket"
        ? spec.socketDepth
        : spec.socketDepth * (p.drive_depth_scale || 1.0);
    const maxBlindDepth =
      spec.headStyle === "headless_socket"
        ? Math.max(0.6, spec.length - 0.6)
        : Math.max(0.6, spec.headHeight - 0.35);
    const fullDepth = spec.socketThrough
      ? Math.max(spec.length + spec.headHeight, spec.socketDepth || 0)
      : clamp(
          requestedBlindDepth,
          0.5,
          maxBlindDepth
        );
    const z0 = spec.socketThrough ? shankZ0 - spec.eps : -fullDepth - spec.eps;
    const z1 = spec.eps;

    if (spec.driveStyle === "hex_socket" && spec.socketAcrossFlats > 0) {
      const acrossFlats = spec.socketAcrossFlats + 2 * spec.socketClearance;
      const socketCut = makeHexPrismBetweenZ(oc, acrossFlats, z0, z1);
      shape = booleanCutAdaptive(oc, shape, socketCut, spec.booleanFuzzy);

      if (spec.socketLeadInDepth > 0.05 && spec.socketLeadInExtraAF > 0.01) {
        const leadInDepth = spec.socketThrough
          ? spec.socketLeadInDepth
          : clamp(spec.socketLeadInDepth, 0.15, Math.max(0.15, fullDepth - 0.05));
        const entranceAF = acrossFlats + 2 * spec.socketLeadInExtraAF;
        const topLeadIn = makeHexFrustumBetweenZ(
          oc,
          Math.max(acrossFlats, entranceAF),
          acrossFlats,
          -leadInDepth - spec.eps,
          spec.eps
        );
        shape = booleanCutAdaptive(oc, shape, topLeadIn, spec.booleanFuzzy);

        if (spec.socketThrough && spec.socketLeadInBothEnds) {
          const bottomLeadIn = makeHexFrustumBetweenZ(
            oc,
            acrossFlats,
            Math.max(acrossFlats, entranceAF),
            shankZ0 - spec.eps,
            shankZ0 + leadInDepth + spec.eps
          );
          shape = booleanCutAdaptive(oc, shape, bottomLeadIn, spec.booleanFuzzy);
        }
      }
    } else if (spec.driveStyle === "torx_socket" && spec.torxProfile) {
      const torxCut = makeTorxSocketBetweenZ(
        oc,
        spec.torxProfile,
        z0,
        z1,
        {
          through: spec.socketThrough,
          depth: fullDepth
        },
        Math.max(72, 2 * spec.circleSides)
      );
      shape = booleanCutAdaptive(oc, shape, torxCut, spec.booleanFuzzy);
    } else if (spec.driveStyle === "phillips_socket" && spec.phillipsProfile) {
      const phillipsCut = makePhillipsSocketBetweenZ(
        oc,
        spec.phillipsProfile,
        z0,
        z1,
        {
          through: spec.socketThrough,
          depth: fullDepth
        },
        Math.max(72, 2 * spec.circleSides)
      );
      shape = booleanCutAdaptive(oc, shape, phillipsCut, spec.booleanFuzzy);
    } else if (spec.driveStyle === "flat_slot" && spec.flatSlotWidth > 0) {
      const flatCut = makeFlatSlotSocketBetweenZ(
        oc,
        spec.flatSlotWidth + 2 * spec.socketClearance,
        spec.flatSlotThickness + spec.socketClearance,
        z0,
        z1,
        {
          through: spec.socketThrough,
          depth: fullDepth
        },
        Math.max(56, spec.circleSides)
      );
      shape = booleanCutAdaptive(oc, shape, flatCut, spec.booleanFuzzy);
    }
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
  const threadDepthScale = p.thread_depth_scale || 1.0;
  const basicDepth = 0.61343 * pitch;
  const modeledDepth = Math.max(
    0,
    Math.min(basicDepth * threadDepthScale, 0.45 * majorDia)
  );
  const threadEndStyle =
    p.thread_end_style === "auto"
      ? preset.threadEndDefault || "chamfered"
      : p.thread_end_style;
  const isHeadlessCustom = preset.headStyle === "headless_socket";
  const headlessDriveType = isHeadlessCustom ? String(p.headless_drive_type || "hex") : null;
  const headlessDriveThrough = isHeadlessCustom ? bool01(p.headless_drive_through) : false;
  const socketClearance =
    p.socket_clearance > 0
      ? p.socket_clearance
      : preset.socketClearance || ((isHeadlessCustom || preset.driveStyle === "hex_socket") ? 0.15 : 0);
  const headlessToolSize =
    isHeadlessCustom && headlessDriveType === "hex"
      ? Math.max(4, Math.min(6, Number(p.headless_tool_size) || preset.socketAcrossFlats || 6))
      : null;
  const torxProfile =
    isHeadlessCustom && headlessDriveType === "torx"
      ? getTorxProfileSpec(String(p.headless_torx_size || "T30"), socketClearance)
      : null;
  const phillipsProfile =
    isHeadlessCustom && headlessDriveType === "phillips"
      ? getPhillipsProfileSpec(String(p.headless_phillips_size || "PH3"), socketClearance)
      : null;
  const flatSlotWidth =
    isHeadlessCustom && headlessDriveType === "flathead"
      ? Math.max(3, Number(p.headless_flat_width) || 6)
      : 0;
  const flatSlotThickness =
    isHeadlessCustom && headlessDriveType === "flathead"
      ? getFlatBladeThickness(flatSlotWidth)
      : 0;
  const headlessAutoDepth =
    isHeadlessCustom
      ? getHeadlessDriveAutoDepth({
          driveType: headlessDriveType,
          acrossFlats: headlessToolSize || preset.socketAcrossFlats || 0,
          torxProfile,
          phillipsProfile,
          flatSlotWidth,
          flatSlotThickness,
          clearance: socketClearance
        })
      : 0;
  const headlessDriveDepthInput = Number(p.headless_drive_depth);
  const headlessDriveDepth =
    isHeadlessCustom
      ? clamp(
          headlessDriveThrough
            ? (headlessDriveDepthInput > 0 ? headlessDriveDepthInput : length)
            : (headlessDriveDepthInput > 0 ? headlessDriveDepthInput : headlessAutoDepth),
          1.5,
          length + preset.headHeight
        )
      : 0;

  return {
    ...preset,
    majorDia,
    pitch,
    length,
    circleSides,
    threadDepthScale,
    threadRunoutTop: p.thread_runout_top > 0 ? p.thread_runout_top : 0.75 * pitch,
    threadRunoutBottom: p.thread_runout_bottom > 0 ? p.thread_runout_bottom : 0.75 * pitch,
    threadEndStyle,
    threadEndLength: threadEndStyle === "chamfered" ? clamp(1.5 * pitch, pitch, 2 * pitch) : 0,
    threadEndTipDia: Math.max(0.15, majorDia - 2 * modeledDepth),
    driveStyle:
      isHeadlessCustom
        ? (
            headlessDriveType === "torx"
              ? "torx_socket"
              : headlessDriveType === "phillips"
                ? "phillips_socket"
                : headlessDriveType === "flathead"
                  ? "flat_slot"
                  : "hex_socket"
          )
        : preset.driveStyle,
    socketAcrossFlats: headlessToolSize || preset.socketAcrossFlats,
    socketDepth: isHeadlessCustom ? headlessDriveDepth : preset.socketDepth,
    socketThrough: isHeadlessCustom ? headlessDriveThrough : preset.socketThrough,
    torxProfile,
    phillipsProfile,
    flatSlotWidth,
    flatSlotThickness,
    socketClearance,
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

function makeHexFrustumBetweenZ(oc, bottomAcrossFlats, topAcrossFlats, z0, z1) {
  const r0 = bottomAcrossFlats / Math.sqrt(3.0);
  const r1 = topAcrossFlats / Math.sqrt(3.0);
  const w0 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z0, 6, r0, Math.PI / 6);
  const w1 = makeRegularPolygonWireXYAtZ(oc, 0, 0, z1, 6, r1, Math.PI / 6);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeTorxPrismBetweenZ(oc, profile, z0, z1, sampleCount = 96) {
  const points = makeTorxProfilePoints(profile, sampleCount);
  const w0 = makePolygonWireXYAtZ(oc, points, z0);
  const w1 = makePolygonWireXYAtZ(oc, points, z1);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeTorxSocketBetweenZ(oc, profile, z0, z1, d = {}, sampleCount = 96) {
  const basePoints = makeTorxProfilePoints(profile, sampleCount);
  const depth = Math.max(0.2, d.depth || z1 - z0);
  if (d.through) {
    return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
      { z: z0, scale: 1.06 },
      { z: z0 + Math.min(0.8, 0.18 * depth), scale: 1.0 },
      { z: z1 - Math.min(0.8, 0.18 * depth), scale: 1.0 },
      { z: z1, scale: 1.06 }
    ]);
  }

  const topLead = clamp(0.22 * depth, 0.45, 1.2);
  const tipDepth = clamp(0.30 * depth, 0.8, Math.max(0.8, depth - 0.4));
  const tipStart = Math.max(z0 + 0.05, z0 + tipDepth);
  const topNominal = Math.max(tipStart + 0.05, z1 - topLead);

  return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
    { z: z0, scale: 0.36 },
    { z: tipStart, scale: 0.9 },
    { z: topNominal, scale: 1.0 },
    { z: z1, scale: 1.06 }
  ]);
}

function makeTorxProfilePoints(profile, sampleCount = 96) {
  const majorR = Math.max(0.2, profile.A / 2);
  const minorR = Math.max(0.1, Math.min(majorR - 1e-3, profile.B / 2));
  const outerLobeR = Math.max(0.05, Math.min(profile.Ri, majorR - 1e-3));
  const valleyR = Math.max(0.03, Math.min(profile.Re, minorR - 1e-3));

  // Fit a smooth 6-lobe polar curve to the ISO 10664 A/B and GO-gauge Ri/Re values.
  const peakSecond = majorR - (majorR * majorR) / outerLobeR;
  const valleySecond = minorR + (minorR * minorR) / valleyR;
  const halfSpan = 0.5 * (majorR - minorR);
  const midRadius = 0.5 * (majorR + minorR);
  const c2 = -(peakSecond + valleySecond) / 288;
  const c3 = (valleySecond - peakSecond - 72 * halfSpan) / 576;
  const c1 = halfSpan - c3;
  const c0 = midRadius - c2;

  const pointCount = Math.max(48, Math.round(sampleCount / 6) * 6);
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / pointCount;
    const u = theta + Math.PI / 2;
    const r =
      c0 +
      c1 * Math.cos(6 * u) +
      c2 * Math.cos(12 * u) +
      c3 * Math.cos(18 * u);
    const clampedR = clamp(r, minorR * 0.98, majorR * 1.02);
    points.push({ x: clampedR * Math.cos(theta), y: clampedR * Math.sin(theta) });
  }

  return points;
}

function getTorxProfileSpec(size, clearance = 0) {
  const base = TORX_PROFILE_SPECS[String(size)] || TORX_PROFILE_SPECS.T30;
  const c = Math.max(0, Number(clearance) || 0);
  return {
    ...base,
    A: base.A + 2 * c,
    B: base.B + 2 * c,
    Ri: base.Ri + c,
    Re: base.Re + c
  };
}

function getPhillipsProfileSpec(size, clearance = 0) {
  const base = PHILLIPS_PROFILE_SPECS[String(size)] || PHILLIPS_PROFILE_SPECS.PH3;
  const c = Math.max(0, Number(clearance) || 0);
  return {
    ...base,
    span: base.span + 2 * c,
    coreDia: base.coreDia + 2 * c,
    armWidth: base.armWidth + 2 * c
  };
}

function getFlatBladeThickness(width) {
  const w = Math.max(2, Number(width) || 0);
  const specs = FLAT_BLADE_WIDTH_THICKNESS_SPECS;

  if (w <= specs[0].width) return specs[0].thickness;
  if (w >= specs[specs.length - 1].width) return specs[specs.length - 1].thickness;

  for (let i = 1; i < specs.length; i++) {
    const a = specs[i - 1];
    const b = specs[i];
    if (w <= b.width) {
      const t = (w - a.width) / (b.width - a.width);
      return lerp(a.thickness, b.thickness, t);
    }
  }

  return specs[specs.length - 1].thickness;
}

function getHeadlessDriveAutoDepth(d) {
  if (d.driveType === "torx" && d.torxProfile) {
    return clamp(d.torxProfile.H || d.torxProfile.A * 0.84, 2.0, 12.0);
  }

  if (d.driveType === "phillips" && d.phillipsProfile) {
    return clamp(d.phillipsProfile.trueFormDepth || d.phillipsProfile.span * 0.65, 1.5, 10.0);
  }

  if (d.driveType === "flathead") {
    return clamp(1.8 * Math.max(0.4, d.flatSlotThickness || 0.8), 1.4, 6.0);
  }

  if (d.driveType === "hex") {
    return clamp(1.05 * Math.max(3, d.acrossFlats || 5), 2.5, 12.0);
  }

  return 4.0;
}

function makeRectPrismBetweenZ(oc, width, depth, z0, z1) {
  const hw = width / 2;
  const hd = depth / 2;
  const points = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd }
  ];
  const w0 = makePolygonWireXYAtZ(oc, points, z0);
  const w1 = makePolygonWireXYAtZ(oc, points, z1);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makePhillipsPrismBetweenZ(oc, profile, z0, z1, sampleCount = 96) {
  const points = makePhillipsProfilePoints(profile, sampleCount);
  const w0 = makePolygonWireXYAtZ(oc, points, z0);
  const w1 = makePolygonWireXYAtZ(oc, points, z1);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makePhillipsSocketBetweenZ(oc, profile, z0, z1, d = {}, sampleCount = 96) {
  const basePoints = makePhillipsProfilePoints(profile, sampleCount);
  const depth = Math.max(0.2, d.depth || z1 - z0);
  if (d.through) {
    return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
      { z: z0, scale: 1.08 },
      { z: z0 + Math.min(0.8, 0.22 * depth), scale: 1.0 },
      { z: z1 - Math.min(0.8, 0.22 * depth), scale: 1.0 },
      { z: z1, scale: 1.08 }
    ]);
  }

  const topLead = clamp(0.24 * depth, 0.5, 1.25);
  const tipDepth = clamp(0.42 * depth, 0.9, Math.max(0.9, depth - 0.45));
  const tipStart = Math.max(z0 + 0.05, z0 + tipDepth);
  const topNominal = Math.max(tipStart + 0.05, z1 - topLead);

  return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
    { z: z0, scale: 0.18 },
    { z: z0 + 0.55 * (tipStart - z0), scale: 0.55 },
    { z: tipStart, scale: 0.95 },
    { z: topNominal, scale: 1.0 },
    { z: z1, scale: 1.08 }
  ]);
}

function makeFlatSlotPrismBetweenZ(oc, width, thickness, z0, z1, sampleCount = 72) {
  const points = makeRoundedSlotProfilePoints(width, thickness, sampleCount);
  const w0 = makePolygonWireXYAtZ(oc, points, z0);
  const w1 = makePolygonWireXYAtZ(oc, points, z1);
  return makeLoftFromWires(oc, [w0, w1], true, true);
}

function makeFlatSlotSocketBetweenZ(oc, width, thickness, z0, z1, d = {}, sampleCount = 72) {
  const basePoints = makeRoundedSlotProfilePoints(width, thickness, sampleCount);
  const depth = Math.max(0.2, d.depth || z1 - z0);
  if (d.through) {
    return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
      { z: z0, sx: 1.08, sy: 1.35 },
      { z: z0 + Math.min(0.7, 0.2 * depth), sx: 1.0, sy: 1.0 },
      { z: z1 - Math.min(0.7, 0.2 * depth), sx: 1.0, sy: 1.0 },
      { z: z1, sx: 1.08, sy: 1.35 }
    ]);
  }

  const topLead = clamp(0.25 * depth, 0.45, 1.0);
  const bottomRelief = clamp(0.30 * depth, 0.5, Math.max(0.5, depth - 0.35));
  const bottomNominal = Math.max(z0 + bottomRelief, z0 + 0.05);
  const topNominal = Math.max(bottomNominal + 0.05, z1 - topLead);

  return makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, [
    { z: z0, sx: 0.9, sy: 0.35 },
    { z: bottomNominal, sx: 1.0, sy: 0.9 },
    { z: topNominal, sx: 1.0, sy: 1.0 },
    { z: z1, sx: 1.08, sy: 1.35 }
  ]);
}

function makePhillipsProfilePoints(profile, sampleCount = 96) {
  const span = Math.max(0.8, profile.span);
  const armWidth = Math.max(0.2, Math.min(profile.armWidth, span));
  const coreRadius = Math.max(armWidth / 2, profile.coreDia / 2);
  const halfSeg = Math.max(0.01, span / 2 - armWidth / 2);
  const armRadius = armWidth / 2;
  const maxR = Math.max(span / 2 + armRadius, coreRadius) + 0.5;

  return sampleImplicitProfilePoints(
    maxR,
    (x, y) =>
      pointInCapsule(x, y, -halfSeg, 0, halfSeg, 0, armRadius) ||
      pointInCapsule(x, y, 0, -halfSeg, 0, halfSeg, armRadius) ||
      x * x + y * y <= coreRadius * coreRadius,
    sampleCount
  );
}

function makeRoundedSlotProfilePoints(width, thickness, sampleCount = 72) {
  const slotWidth = Math.max(thickness + 0.05, width);
  const slotThickness = Math.max(0.2, Math.min(thickness, slotWidth));
  const halfSeg = Math.max(0.01, slotWidth / 2 - slotThickness / 2);
  const radius = slotThickness / 2;
  const maxR = slotWidth / 2 + radius + 0.25;

  return sampleImplicitProfilePoints(
    maxR,
    (x, y) => pointInCapsule(x, y, -halfSeg, 0, halfSeg, 0, radius),
    sampleCount
  );
}

function sampleImplicitProfilePoints(maxRadius, insideFn, sampleCount = 96) {
  const pointCount = Math.max(24, Math.round(sampleCount / 4) * 4);
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / pointCount;
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    let lo = 0;
    let hi = maxRadius;

    while (insideFn(hi * cx, hi * cy) && hi < 10 * maxRadius) {
      hi *= 1.25;
    }

    for (let iter = 0; iter < 28; iter++) {
      const mid = 0.5 * (lo + hi);
      if (insideFn(mid * cx, mid * cy)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    points.push({ x: lo * cx, y: lo * cy });
  }

  return points;
}

function pointInCapsule(x, y, ax, ay, bx, by, radius) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = x - ax;
  const wy = y - ay;
  const vv = vx * vx + vy * vy;
  const t = vv <= 1e-9 ? 0 : clamp((wx * vx + wy * vy) / vv, 0, 1);
  const px = ax + t * vx;
  const py = ay + t * vy;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy <= radius * radius;
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

function makePlainShankBetweenZ(oc, d) {
  if (d.threadEndStyle !== "chamfered" || d.threadEndLength <= 1e-6) {
    return makeCylinderBetweenZ(oc, d.majorDia, d.z0, d.z1, d.circleSides);
  }

  const pointZ1 = Math.min(d.z1, d.z0 + d.threadEndLength);
  const wires = [
    makeRegularPolygonWireXYAtZ(oc, 0, 0, d.z0, d.circleSides, d.threadEndTipDia / 2, 0),
    makeRegularPolygonWireXYAtZ(oc, 0, 0, pointZ1, d.circleSides, d.majorDia / 2, 0)
  ];

  if (pointZ1 < d.z1 - 1e-6) {
    wires.push(makeRegularPolygonWireXYAtZ(oc, 0, 0, d.z1, d.circleSides, d.majorDia / 2, 0));
  }

  return makeLoftFromWires(oc, wires, true, true);
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
  const threadEndLength = d.threadEndStyle === "chamfered" ? Math.max(0, d.threadEndLength || 0) : 0;
  const threadEndTipR = Math.max(0.05, (d.threadEndTipDia || d.majorDia) / 2);
  for (let i = 0; i < sectionCount; i++) {
    const t = sectionCount === 1 ? 0 : i / (sectionCount - 1);
    const z = lerp(d.z0, d.z1, t);
    const pointBlend =
      threadEndLength > 1e-9 ? smoothRamp01((z - d.z0) / threadEndLength) : 1;

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
        runoutBottom: d.runoutBottom,
        pointBlend,
        tipR: threadEndTipR
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
  const threadRootR = Math.max(0.05, d.majorR - runoutFactor * d.depth);
  const crestR = lerp(d.tipR, d.majorR, d.pointBlend);
  const rootR = lerp(d.tipR, threadRootR, d.pointBlend);

  for (let i = 0; i < d.circleSides; i++) {
    const ang = (2 * Math.PI * i) / d.circleSides;
    const u = fract((ang - helixPhase) / (2 * Math.PI));
    const profile = externalThreadProfile01(u);

    const r = Math.max(0.05, lerp(crestR, rootR, profile));
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

function makePolygonWireXYAtZ(oc, points, z) {
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const point of points) {
    poly.Add_1(new oc.gp_Pnt_3(point.x, point.y, z));
  }
  poly.Close();
  return poly.Wire();
}

function makeShapedProfileSocketBetweenZ(oc, basePoints, z0, z1, sections) {
  const ordered = sections
    .map((section) => ({
      z: clamp(section.z, z0, z1),
      sx: section.sx || section.scale || 1,
      sy: section.sy || section.scale || 1
    }))
    .sort((a, b) => a.z - b.z);

  const merged = [];
  for (const section of ordered) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.z - section.z) < 1e-6) {
      merged[merged.length - 1] = section;
    } else {
      merged.push(section);
    }
  }

  if (merged.length < 2) {
    merged.push({ ...merged[0], z: z1 });
  }

  const wires = merged.map((section) =>
    makePolygonWireXYAtZ(oc, scaleProfilePoints(basePoints, section.sx, section.sy), section.z)
  );

  return makeLoftFromWires(oc, wires, true, true);
}

function scaleProfilePoints(points, sx = 1, sy = 1) {
  return points.map((point) => ({ x: point.x * sx, y: point.y * sy }));
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
