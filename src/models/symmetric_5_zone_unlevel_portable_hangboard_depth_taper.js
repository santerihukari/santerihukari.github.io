const MAX_SLOTS = 6;
const DEFAULT_DEPTH_TAPER_CURVE = "0.000,1.000|0.250,1.000|0.500,1.000|0.750,1.000|1.000,1.000";
const DEPTH_SECTION_SAMPLE_COUNT = 17;
const DEFAULT_WIDTH_TAPER_CURVE = DEFAULT_DEPTH_TAPER_CURVE;

export const meta = {
  name: "Symmetric Dual-Side Portable Hangboard (Depth Taper)",
  description: "Portable hangboard with per-finger width profiles, a depth profile, and alternative rope attachments.",
  validate: validateAttachmentParameters,
  tessellation: {
    linearDeflection: 0.06,
    angularDeflection: 0.08
  },
  params: [
    {
      key: "slot_count",
      label: "Slot count",
      min: 1,
      max: MAX_SLOTS,
      input: "number",
      integer: true,
      step: 1,
      default: 4,
      description: "Controls how many slot width and riser-height rows are active."
    },

    { key: "slot_width_1", label: "Width", min: 6, max: 50, default: 19, visibleIf: { key: "slot_count", op: ">=", value: 1 }, groupKey: "slot_1", groupLabel: "Slot 1" },
    { key: "riser_height_1", label: "Riser height", min: 0, max: 40, default: 12, visibleIf: { key: "slot_count", op: ">=", value: 1 }, groupKey: "slot_1", groupLabel: "Slot 1" },
    { key: "slot_width_2", label: "Width", min: 6, max: 50, default: 20, visibleIf: { key: "slot_count", op: ">=", value: 2 }, groupKey: "slot_2", groupLabel: "Slot 2" },
    { key: "riser_height_2", label: "Riser height", min: 0, max: 40, default: 20, visibleIf: { key: "slot_count", op: ">=", value: 2 }, groupKey: "slot_2", groupLabel: "Slot 2" },
    { key: "slot_width_3", label: "Width", min: 6, max: 50, default: 19, visibleIf: { key: "slot_count", op: ">=", value: 3 }, groupKey: "slot_3", groupLabel: "Slot 3" },
    { key: "riser_height_3", label: "Riser height", min: 0, max: 40, default: 12, visibleIf: { key: "slot_count", op: ">=", value: 3 }, groupKey: "slot_3", groupLabel: "Slot 3" },
    { key: "slot_width_4", label: "Width", min: 6, max: 50, default: 16, visibleIf: { key: "slot_count", op: ">=", value: 4 }, groupKey: "slot_4", groupLabel: "Slot 4" },
    { key: "riser_height_4", label: "Riser height", min: 0, max: 40, default: 0, visibleIf: { key: "slot_count", op: ">=", value: 4 }, groupKey: "slot_4", groupLabel: "Slot 4" },
    { key: "slot_width_5", label: "Width", min: 6, max: 50, default: 16, visibleIf: { key: "slot_count", op: ">=", value: 5 }, groupKey: "slot_5", groupLabel: "Slot 5" },
    { key: "riser_height_5", label: "Riser height", min: 0, max: 40, default: 0, visibleIf: { key: "slot_count", op: ">=", value: 5 }, groupKey: "slot_5", groupLabel: "Slot 5" },
    { key: "slot_width_6", label: "Width", min: 6, max: 50, default: 16, visibleIf: { key: "slot_count", op: ">=", value: 6 }, groupKey: "slot_6", groupLabel: "Slot 6" },
    { key: "riser_height_6", label: "Riser height", min: 0, max: 40, default: 0, visibleIf: { key: "slot_count", op: ">=", value: 6 }, groupKey: "slot_6", groupLabel: "Slot 6" },

    {
      key: "width_taper_curve",
      label: "Per-finger width profile",
      type: "curve",
      default: DEFAULT_WIDTH_TAPER_CURVE,
      endpointValue: 1,
      flatEndpoints: true,
      boundedTangents: true,
      profileTangents: boundedProfileTangents,
      yMin: 0.5,
      yMax: 1.5,
      xLabel: "Left edge to right edge of each finger",
      yLabel: "Normalized taper",
      height: 118,
      columnSpan: "full",
      description: "Repeats within each finger surface between the rounded step transitions. Ends remain at the original height with horizontal tangents."
    },
    { key: "width_taper_amount_mm", label: "Width profile amount (mm)", min: 0, max: 8, default: 3, hint: "A platform lifts automatically if its combined width/depth profile would dip below the base surface. The curve keeps its shape.", description: "Maximum inward or outward offset of the per-finger width profile. A flat curve at 1 leaves the original shape unchanged." },
    {
      key: "depth_taper_curve",
      label: "Depth taper view",
      type: "curve",
      default: DEFAULT_DEPTH_TAPER_CURVE,
      yMin: 0.5,
      yMax: 1.5,
      xLabel: "Front face → back face",
      yLabel: "Normalized taper",
      height: 118,
      columnSpan: "full",
      description: "The middle spline joins radius-controlled front and back arcs tangentially.",
      roundedProfile: roundedDepthEditorData
    },
    {key:"depth_profile_version",label:"Profile definition version",type:"select",default:2,options:[{value:1,label:"Legacy rolling fillets"},{value:2,label:"Integrated rounded profile"}],visibleIf:{key:"__never__",value:true}},
    { key: "depth_taper_amount_mm", label: "Depth taper amount", min: 0, max: 30, default: 10, description: "Maximum additive riser offset in mm. The depth curve applies this amount equally to every riser." },

    { key: "risers_on_both_sides", label: "Risers on both sides (0/1)", min: 0, max: 1, default: 1 },
    { key: "slot_clearance_between_surfaces", label: "Minimum finger gap (mm)", min: 4, max: 80, default: 20, hint: "Free space between the tallest opposing finger surfaces. The opening grows automatically to keep this gap when risers change." },
    { key: "base_slot_height", label: "Minimum opening envelope (mm)", min: 8, max: 100, default: 28, hint: "Minimum height before subtracting the risers. Usually the finger-gap setting determines the final height, so this value has no effect unless it is larger." },
    { key: "slot_depth_y", label: "Lower grip depth (mm)", min: 8, max: 80, default: 24 },
    { key: "upper_slot_depth_y", label: "Upper grip depth (mm)", min: 8, max: 80, default: 24, defaultFrom: "slot_depth_y" },

    { key: "side_wall_x", label: "Side wall (mm)", min: 4, max: 40, default: 18, visibleIf: {key:"attachment_method",op:"!=",value:"rope_groove"} },
    { key: "rope_side_wall_x", label: "Side wall (mm)", min: 4, max: 40, default: 8, defaultFrom: "side_wall_x", visibleIf: {key:"attachment_method",value:"rope_groove"} },
    { key: "back_wall_y", label: "Back wall (mm)", min: 4, max: 60, default: 4 },
    { key: "bottom_wall_z", label: "Bottom wall", min: 4, max: 40, default: 10 },
    { key: "top_wall_z", label: "Top wall", min: 4, max: 40, default: 10 },

    { key: "make_holes", label: "Enable attachment", min: 0, max: 1, default: 1 },
    { key: "attachment_method", label: "Attachment method", type: "select", default: "diamond", visibleIf: {key:"make_holes",op:">=",value:0.5}, options: [
      {value:"diamond",label:"Two diamond holes"},
      {value:"rope_groove",label:"Perimeter rope groove"},
      {value:"single_point",label:"Central rounded eyelet"}
    ] },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"diamond"}] },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"diamond"}] },
    { key: "rope_diameter", label: "Rope diameter (mm)", min: 3, max: 10, default: 6, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",op:"!=",value:"diamond"}] },
    { key: "rope_clearance", label: "Rope diameter clearance (mm)", min: 0.2, max: 2, default: 0.8, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",op:"!=",value:"diamond"}], description: "Trial diametral clearance, not a strength or print-fit guarantee." },
    { key: "rope_bend_radius", label: "Outline corner radius (mm)", min: 6, max: 30, default: 12, visibleIf: {key:"attachment_method",value:"rope_groove"} },
    { key: "rope_crown_rise_mm", label: "Top/bottom curvature (mm)", min: 1, max: 18, step: 0.25, default: 12, visibleIf: {key:"attachment_method",value:"rope_groove"}, hint: "Curves the entire body through its full depth, not only the rope seat. Extra height keeps the requested shell beneath the finger surfaces." },
    { key: "rope_depth_offset_mm", label: "Rope path depth offset (mm)", min: -30, max: 80, step: 0.5, default: 0, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"rope_groove"}], hint: "0 follows the average midpoint of the upper and lower grip depths. Negative moves toward the open front; positive moves toward the back." },
    { key: "attachment_side", label: "Eyelet position", type: "select", default: "top", visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"single_point"}], options: [
      {value:"top",label:"Top"},{value:"bottom",label:"Bottom"},{value:"both",label:"Top and bottom"}
    ] },
    { key: "eyelet_depth_offset_mm", label: "Eyelet depth offset (mm)", min: -30, max: 80, step: 0.5, default: 0, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"single_point"}], hint: "0 centers the rope seat at half the selected grip depth. Negative moves toward the front; positive toward the back. Recessed entries locate the rope; local reinforcement is added only where the grip layout needs it." },
    { key: "eyelet_thickness_mm", label: "Rope-seat bridge length (mm)", min: 4, max: 30, step: 0.5, default: 10, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"single_point"}], description: "Front-to-back length of the retained bridge, including its rounded entry rims. Dimensions are not load-tested." },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "outer_fillet_r", label: "Outer fillet", min: 0, max: 8, default: 7.0 },
    { key: "slot_fillet_r", label: "Step corner radius (mm)", min: 0, max: 8, default: 2.0, hint: "Also sets the riser-side blend width, limited to fit the adjacent step corners. The depth end radius stays unchanged." },
    { key: "riser_fillet_r", label: "Depth end radius (mm)", min: 0, max: 8, default: 4.0 },
    { key: "hole_chamfer", label: "Hole chamfer", min: 0, max: 3, default: 0.5, visibleIf: [{key:"make_holes",op:">=",value:0.5},{key:"attachment_method",value:"diamond"}] },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

export function build(oc, params={}) {
  const p = resolvedHangboardParameters(params);
  const bool01 = (v) => v >= 0.5;

  const slotCount = clamp(Math.round(p.slot_count || 4), 1, MAX_SLOTS);
  const mirrorRisers = bool01(p.risers_on_both_sides);

  const zoneWidths = getActiveValues(p, "slot_width_", slotCount, 6);
  const requestedRiserHeights = getActiveValues(p, "riser_height_", slotCount, 0);
  const depthSections = depthProfileSections(p);
  const widthProfile = makeWidthProfile(p.width_taper_curve, p.width_taper_amount_mm);
  const baseRiserHeights = liftedPlatformHeights(requestedRiserHeights,depthSections,widthProfile);

  const slotHeight = computeRequiredSlotHeight({
    baseSlotHeight: p.base_slot_height,
    slotClearanceBetweenSurfaces: p.slot_clearance_between_surfaces,
    baseRiserHeights,
    mirrorRisers,
    depthSections,
    widthProfile,
    endRadius:p.depth_profile_version>=2?p.riser_fillet_r:0
  });

  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);
  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = Math.max(p.slot_depth_y, p.upper_slot_depth_y) + p.back_wall_y;
  const caps=perimeterBodyAllowances(p,blockWidthX,zoneWidths,baseRiserHeights,depthSections,widthProfile);
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z + caps.bottom + caps.top;

  const slotX0 = p.side_wall_x;
  const slotY0 = 0;
  const slotZ0 = p.bottom_wall_z + caps.bottom;
  const thinBack=p.back_wall_y<8;
  const ensureValid=p.depth_profile_version>=2 || thinBack || widthProfile.active || Math.abs(p.slot_depth_y-p.upper_slot_depth_y)>1e-8;

  const sectionProfiles = buildSectionProfiles({
    slotHeight,
    slotX0,
    slotZ0,
    zoneWidths,
    baseRiserHeights,
    mirrorRisers,
    depthSections,
    widthProfile
  });

  const leftHoleX = p.side_wall_x / 2;
  const rightHoleX = blockWidthX - p.side_wall_x / 2;
  const holeZ = slotZ0 + slotHeight / 2;
  const holeY = p.slot_depth_y + p.back_wall_y / 2;

  validateParameters(p, {
    slotCount,
    mirrorRisers,
    zoneWidths,
    baseRiserHeights,
    depthSections,
    sectionProfiles,
    slotHeight,
    widthProfile
  });

  const dimensions={blockWidthX,blockDepthY,blockHeightZ};
  // Round the clean oval before the grip cuts; intersecting two finished shells
  // leaves coincident trimmed faces at the front opening.
  let shape = p.attachment_method==='rope_groove'
    ? makeRoundedPerimeterBody(oc,p,dimensions)
    : makePrismAt(oc, 0, 0, 0, blockWidthX, blockDepthY, blockHeightZ);

  if (p.attachment_method!=='rope_groove' && bool01(p.make_back_taper) && p.taper_top_inset > 0) {
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

  const cavityOptions = {
    slotX0,
    slotZ0,
    slotHeight,
    zoneWidths,
    sectionProfiles,
    y0: slotY0 - p.eps,
    depthY: p.slot_depth_y + 2 * p.eps,
    filletR: p.slot_fillet_r,
    widthProfile,
    mirrorRisers
  };
  const splitZ = slotZ0 + (Math.max(...sectionProfiles.flatMap(section => section.bottomOffsets)) + (widthProfile.maxDelta || 0) +
    slotHeight - Math.max(...sectionProfiles.flatMap(section => section.topOffsets)) - (mirrorRisers ? widthProfile.maxDelta || 0 : 0)) / 2;
  const cavity = p.depth_profile_version>=2 ? makeIntegratedDepthCavity(oc,p,{slotX0,slotZ0,slotHeight,zoneWidths,baseRiserHeights,widthProfile,splitZ}) : Math.abs(p.slot_depth_y - p.upper_slot_depth_y) < 1e-8
    ? makeSlotCavityFromExactRoundedXZProfile(oc, cavityOptions)
    : makeUnequalDepthCavity(oc, cavityOptions, p, {blockWidthX, blockDepthY, blockHeightZ, splitZ});

  // A large fuzzy margin merges curved lip edges with the cavity's front overrun.
  shape = booleanCutAdaptive(oc, shape, cavity, p.depth_profile_version>=2 || widthProfile.active?Math.min(p.boolean_fuzzy,1e-5):p.boolean_fuzzy);

  if(p.depth_profile_version<2)shape = tryLongitudinalSlotEdgeFillets(oc, shape, {
    radius: p.slot_fillet_r,
    slotX0,
    slotWidthX,
    slotY0,
    slotDepthY: p.slot_depth_y,
    slotZ0,
    slotHeight,
    ensureValid
  });

  if(p.depth_profile_version<2)shape = tryFrontAndBackProfileRollingBallFillets(oc, shape, {
    radius: p.riser_fillet_r,
    slotX0,
    slotWidthX,
    slotY0,
    slotDepthY: p.slot_depth_y,
    slotZ0,
    slotHeight,
    upperSlotDepthY: p.upper_slot_depth_y,
    ensureValid,
    uniqueProfileEdges: widthProfile.active,
    backRadius: Math.min(p.riser_fillet_r,p.back_wall_y*0.45)
  });

  if (bool01(p.make_holes) && p.attachment_method === 'diamond') {
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

  if (p.outer_fillet_r > 0.05 && p.attachment_method!=='rope_groove') {
    shape = tryOuterBodyFilletLast(oc, shape, {
      radius: thinBack?Math.min(p.outer_fillet_r,p.back_wall_y*0.45):p.outer_fillet_r,
      blockWidthX,
      blockDepthY,
      blockHeightZ,
      ensureValid
    });
  }

  if (bool01(p.make_holes) && p.attachment_method !== 'diamond') {
    shape = addRopeAttachment(oc, shape, p, {blockWidthX, blockDepthY, blockHeightZ});
  }

  return shape;
}

for (const param of meta.params) {
  if (/^(slot_width|riser_height)_\d+$/.test(param.key)) {
    param.input = 'number'; param.step = 0.001; param.decimals = 3;
  }
}

function resolvedHangboardParameters(params={}) {
  const p={...Object.fromEntries(meta.params.map(param=>[param.key,param.default])),...params};
  if(params.upper_slot_depth_y===undefined)p.upper_slot_depth_y=p.slot_depth_y;
  if(p.attachment_method==='rope_groove')p.side_wall_x=params.rope_side_wall_x??params.side_wall_x??p.rope_side_wall_x;
  return p;
}

function getActiveValues(params, keyPrefix, count, minValue) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(Math.max(minValue, Number(params[`${keyPrefix}${i}`] || 0)));
  }
  return out;
}

function parseCurvePoints(rawValue, fallbackValue) {
  const fallbackPoints = parseCurveTokens(fallbackValue);
  const parsedPoints = parseCurveTokens(rawValue);
  const source = parsedPoints.length ? parsedPoints : fallbackPoints;
  return normalizeCurvePoints(
    source.length ? source : [{ x: 0, y: 1 }, { x: 1, y: 1 }]
  );
}

function parseCurveTokens(rawValue) {
  return String(rawValue || "")
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [xRaw, yRaw] = token.split(",");
      return { x: Number(xRaw), y: Number(yRaw) };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function normalizeCurvePoints(points) {
  const normalized = points
    .map((point) => ({
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, 0.5, 1.5)
    }))
    .sort((a, b) => a.x - b.x);

  const deduped = [];
  for (const point of normalized) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.x - point.x) < 1e-6) {
      prev.y = point.y;
    } else {
      deduped.push({ ...point });
    }
  }

  if (!deduped.length) {
    return [{ x: 0, y: 1 }, { x: 1, y: 1 }];
  }

  if (deduped[0].x > 0) {
    deduped.unshift({ x: 0, y: deduped[0].y });
  } else {
    deduped[0].x = 0;
  }

  if (deduped[deduped.length - 1].x < 1) {
    deduped.push({ x: 1, y: deduped[deduped.length - 1].y });
  } else {
    deduped[deduped.length - 1].x = 1;
  }

  return deduped;
}

function evaluateCurve(points, t) {
  const u = clamp(t, 0, 1);

  if (u <= points[0].x) return points[0].y;
  if (u >= points[points.length - 1].x) return points[points.length - 1].y;

  for (let i = 0; i + 1 < points.length; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (u < p1.x || u > p2.x) continue;

    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const span = Math.max(1e-9, p2.x - p1.x);
    const localT = (u - p1.x) / span;
    const m1 = ((p2.y - p0.y) / Math.max(1e-9, p2.x - p0.x)) * span;
    const m2 = ((p3.y - p1.y) / Math.max(1e-9, p3.x - p1.x)) * span;
    const t2 = localT * localT;
    const t3 = t2 * localT;
    const y =
      (2 * t3 - 3 * t2 + 1) * p1.y +
      (t3 - 2 * t2 + localT) * m1 +
      (-2 * t3 + 3 * t2) * p2.y +
      (t3 - t2) * m2;
    return clamp(y, 0.5, 1.5);
  }

  return points[points.length - 1].y;
}

function softenScale(scale) {
  return 1 + 0.7 * (scale - 1);
}

function curveValueToUnitDelta(value) {
  return (softenScale(value) - 1) / 0.35;
}

function resampleCurve(points, sampleCount) {
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount <= 1 ? 0 : i / (sampleCount - 1);
    samples.push({ t, value: evaluateCurve(points, t) });
  }
  return samples;
}

function buildDepthSections(curvePoints, amountMm) {
  const samples = resampleCurve(curvePoints, DEPTH_SECTION_SAMPLE_COUNT);
  const minValue = Math.min(...samples.map((sample) => curveValueToUnitDelta(sample.value)));
  const maxValue = Math.max(...samples.map((sample) => curveValueToUnitDelta(sample.value)));
  const collapsedSamples =
    Math.abs(maxValue - minValue) <= 1e-4 ? [samples[0], samples[samples.length - 1]] : samples;

  return collapsedSamples.map((sample) => ({
    t: sample.t,
    delta: Number(amountMm || 0) * curveValueToUnitDelta(sample.value)
  }));
}

function depthProfileSections(p) {
  if(p.depth_profile_version<2)return buildDepthSections(parseCurvePoints(p.depth_taper_curve,DEFAULT_DEPTH_TAPER_CURVE),p.depth_taper_amount_mm);
  return parseCurvePoints(p.depth_taper_curve,DEFAULT_DEPTH_TAPER_CURVE).map(point=>({t:point.x,delta:p.depth_taper_amount_mm*curveValueToUnitDelta(point.y)}));
}

function roundedDepthCurve(p,side='lower') {
  const radius=Number(p.riser_fillet_r),depth=Number(side==='upper'?p.upper_slot_depth_y:p.slot_depth_y),span=depth-2*radius;
  const raw=parseCurvePoints(p.depth_taper_curve,DEFAULT_DEPTH_TAPER_CURVE);
  const points=side==='upper'&&p.risers_on_both_sides<0.5?raw.map(point=>({...point,y:1})):raw;
  const height=value=>Number(p.depth_taper_amount_mm)*curveValueToUnitDelta(value);
  const segments=[],first=height(points[0].y),last=height(points.at(-1).y),q=Math.SQRT1_2,tangents=boundedProfileTangents(points);
  if(radius>0)segments.push({kind:'arc',points:[{x:0,y:first-radius},{x:0,y:first},{x:radius,y:first}],weights:[1,q,1]});
  if(points.every(point=>Math.abs(point.y-points[0].y)<1e-12)){
    segments.push({kind:'line',points:[{x:radius,y:first},{x:depth-radius,y:last}]});
  }else for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],width=b.x-a.x;
    const m1=tangents[i]*width,m2=tangents[i+1]*width;
    segments.push({kind:'bezier',points:[
      {x:radius+a.x*span,y:height(a.y)},
      {x:radius+(a.x+width/3)*span,y:height(a.y+m1/3)},
      {x:radius+(b.x-width/3)*span,y:height(b.y-m2/3)},
      {x:radius+b.x*span,y:height(b.y)}
    ]});
  }
  if(radius>0)segments.push({kind:'arc',points:[{x:depth-radius,y:last},{x:depth,y:last},{x:depth,y:last+radius}],weights:[1,q,1]});
  return {id:side,depth,span,innerStart:radius,innerEnd:depth-radius,segments,
    handles:points.map((point,index)=>({index,x:radius+point.x*span,y:height(point.y),normalized:{...point}})),
    fixed:[{x:0,y:first-radius,kind:'endpoint',label:'Front end'},
      {x:radius,y:first,kind:'tangent',label:'Front tangent'},
      {x:radius,y:first-radius,kind:'centre',label:'Front radius centre'},
      {x:depth-radius,y:last,kind:'tangent',label:'Back tangent'},
      {x:depth,y:last+radius,kind:'endpoint',label:'Back end'},
      {x:depth-radius,y:last+radius,kind:'centre',label:'Back radius centre'}]};
}

function roundedDepthErrors(p) {
  if(p.depth_profile_version<2)return {};
  const errors={},radius=Number(p.riser_fillet_r),depth=Math.min(Number(p.slot_depth_y),Number(p.upper_slot_depth_y));
  if(!Number.isFinite(radius)||!Number.isFinite(depth)||2*radius>depth-0.5)errors.riser_fillet_r='The end radii must leave at least 0.5 mm for the middle profile. Increase the grip depth or reduce the radius.';
  if(Math.min(Number(p.bottom_wall_z),Number(p.top_wall_z))-radius<3)errors.riser_fillet_r='The front radius must leave at least 3 mm of nominal outer wall. Increase the top/bottom walls or reduce the radius.';
  const points=parseCurvePoints(p.depth_taper_curve,DEFAULT_DEPTH_TAPER_CURVE),span=depth-2*radius;
  const raw=parseCurveTokens(p.depth_taper_curve).sort((a,b)=>a.x-b.x);
  if(raw.length<2||raw[0].x!==0||raw.at(-1).x!==1)errors.depth_taper_curve='The middle profile must start at position 0 and end at position 1.';
  if(points.length>8)errors.depth_taper_curve='Use at most 8 middle-profile points.';
  if(points.some((point,i)=>i>0&&(point.x-points[i-1].x)*span<0.5-1e-6&&Math.abs(point.y-points[i-1].y)>1e-8))errors.depth_taper_curve='Space changing middle-profile points at least 0.5 mm apart.';
  return errors;
}

function roundedDepthEditorData(values) {
  const p=resolvedHangboardParameters(values);
  if(p.depth_profile_version<2)return {enabled:false,profiles:[]};
  const profiles=['lower','upper'].map(side=>roundedDepthCurve(p,side));
  return {enabled:true,radius:Number(p.riser_fillet_r),maxPoints:8,minSpacing:0.5/Math.max(0.5,Math.min(...profiles.map(profile=>profile.span))),profiles,errors:Object.values(roundedDepthErrors(p))};
}

function evaluateRationalCurve(segment,t) {
  const n=segment.points.length-1;let denominator=0,x=0,y=0;
  for(let i=0;i<=n;i++){
    let coefficient=1;for(let j=1;j<=i;j++)coefficient=coefficient*(n-j+1)/j;
    const weight=coefficient*t**i*(1-t)**(n-i)*(segment.weights?.[i]??1);
    denominator+=weight;x+=weight*segment.points[i].x;y+=weight*segment.points[i].y;
  }
  return {x:x/denominator,y:y/denominator};
}

function roundedDepthValue(p,side,position) {
  const profile=roundedDepthCurve(p,side),x=clamp(position,0,profile.depth);
  const segment=profile.segments.find(segment=>x<=segment.points.at(-1).x+1e-9)||profile.segments.at(-1);
  let lo=0,hi=1;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(evaluateRationalCurve(segment,mid).x<x)lo=mid;else hi=mid;}
  return evaluateRationalCurve(segment,(lo+hi)/2).y;
}

function makeWidthProfile(rawCurve, amount) {
  const points = parseCurvePoints(rawCurve, DEFAULT_WIDTH_TAPER_CURVE);
  if (points[0].y !== 1 || points.at(-1).y !== 1) {
    throw new Error('The per-finger width profile must start and end at 1.');
  }
  const scale = 2 * Number(amount || 0);
  const segments = [],tangents=boundedProfileTangents(points);
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const span = b.x - a.x,m1=tangents[i]*span,m2=tangents[i+1]*span;
    segments.push([
      {x:a.x, z:scale * (a.y - 1)},
      {x:a.x + span / 3, z:scale * (a.y + m1 / 3 - 1)},
      {x:b.x - span / 3, z:scale * (b.y - m2 / 3 - 1)},
      {x:b.x, z:scale * (b.y - 1)}
    ]);
  }
  return {
    active: scale > 0 && points.some(point => point.y !== 1),
    minDelta: scale * (Math.min(...points.map(point => point.y)) - 1),
    maxDelta: scale * (Math.max(...points.map(point => point.y)) - 1),
    segments
  };
}

function boundedProfileTangents(points) {
  return points.map((point,i)=>{
    if(i===0||i===points.length-1)return 0;
    const previous=points[i-1],next=points[i+1],left=(point.y-previous.y)/(point.x-previous.x),right=(next.y-point.y)/(next.x-point.x);
    if(left*right<=0)return 0;
    const slope=(next.y-previous.y)/(next.x-previous.x);
    return Math.sign(slope)*Math.min(Math.abs(slope),3*Math.abs(left),3*Math.abs(right));
  });
}

function computeRequiredSlotHeight(d) {
  let maxCombinedInward = 0;

  for (const section of d.depthSections) {
    const sectionHeights = d.baseRiserHeights.map((h) => Math.max(0, h + section.delta) + (d.widthProfile?.maxDelta || 0));
    const bottomMax = sectionHeights.length > 0 ? Math.max(...sectionHeights) : 0;
    const topMax = d.mirrorRisers ? bottomMax : 0;
    maxCombinedInward = Math.max(maxCombinedInward, bottomMax + topMax);
  }
  if(d.endRadius>0){
    const last=d.depthSections.at(-1).delta+d.endRadius;
    const bottom=Math.max(...d.baseRiserHeights)+last+(d.widthProfile?.maxDelta||0);
    maxCombinedInward=Math.max(maxCombinedInward,bottom+(d.mirrorRisers?bottom:d.endRadius));
  }

  return Math.max(
    d.baseSlotHeight,
    d.slotClearanceBetweenSurfaces + maxCombinedInward
  );
}

function liftedPlatformHeights(heights,sections,widthProfile) {
  const minimumOffset=Math.min(...sections.map(section=>section.delta))+widthProfile.minDelta;
  return heights.map(height=>height+Math.max(0,-height-minimumOffset));
}

function buildSectionProfiles(d) {
  return d.depthSections.map((section) => {
    const bottomOffsets = d.baseRiserHeights.map((height) => Math.max(0, height + section.delta));
    const topOffsets = d.mirrorRisers
      ? bottomOffsets.map((offset) => offset)
      : bottomOffsets.map(() => 0);
    const profilePoints = buildSteppedSlotProfileXZ({
      slotX0: d.slotX0,
      slotZ0: d.slotZ0,
      slotHeight: d.slotHeight,
      zoneWidths: d.zoneWidths,
      bottomOffsets,
      topOffsets
    });

    return {
      t: section.t,
      profilePoints,
      bottomOffsets,
      topOffsets
    };
  });
}

function validateParameters(p, d) {
  const attachmentErrors = validateAttachmentParameters(p);
  if (Object.keys(attachmentErrors).length) throw new Error(Object.values(attachmentErrors)[0]);
  const minimumSurface=Math.min(...d.sectionProfiles.flatMap(section=>section.bottomOffsets))+d.widthProfile.minDelta;
  if (Math.min(p.bottom_wall_z, d.mirrorRisers ? p.top_wall_z : Infinity) + minimumSurface < 3) {
    throw new Error('The width profile leaves less than 3 mm of nominal outer wall. Reduce its amount or increase the shell thickness. This is a geometry limit, not a load rating.');
  }
  if (p.taper_top_inset > Math.min(p.side_wall_x, p.top_wall_z + p.bottom_wall_z)) {
    console.warn("taper_top_inset is aggressive for the current body size and can destabilize later booleans.");
  }

  const minDelta = Math.min(...d.depthSections.map((s) => s.delta));
  const maxDelta = Math.max(...d.depthSections.map((s) => s.delta));
  if (Math.max(Math.abs(minDelta), Math.abs(maxDelta)) > 12) {
    console.warn("Depth taper is aggressive, so deeper sections may shift a long way from the front. Reduce the taper amount if booleans or fillets become unstable.");
  }

  const localStepHeights = [];
  for (const section of d.sectionProfiles) {
    for (let i = 0; i + 1 < section.profilePoints.length; i++) {
      localStepHeights.push(distanceXZ(section.profilePoints[i + 1], section.profilePoints[i]));
    }
  }

  const limitingLengths = [
    ...d.zoneWidths,
    ...localStepHeights.filter((v) => v > 1e-6),
    ...d.sectionProfiles.flatMap((s) => s.bottomOffsets.map((bottom, index) => d.slotHeight - bottom - s.topOffsets[index]))
  ].filter((v) => v > 1e-6);

  if (p.slot_fillet_r > 0.05 && limitingLengths.length > 0) {
    const localMin = Math.min(...limitingLengths);
    if (p.slot_fillet_r > 0.5 * localMin) {
      console.warn("slot_fillet_r is large relative to local cavity profile features. Reduce slot_fillet_r if the analytic profile rounds collapse local steps.");
    }
  }

  if (p.depth_profile_version<2 && p.riser_fillet_r > 0.05 && limitingLengths.length > 0) {
    const localMin = Math.min(...limitingLengths);
    if (p.riser_fillet_r > 0.5 * localMin) {
      console.warn("riser_fillet_r is large relative to local slot features. Reduce riser_fillet_r if front/back rolling-ball filleting fails.");
    }
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  return booleanOperation(oc, oc.BRepAlgoAPI_Cut_1, a, b, fuzzy);
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  return booleanOperation(oc, oc.BRepAlgoAPI_Fuse_1, a, b, fuzzy);
}

function booleanOperation(oc, Constructor, a, b, fuzzy) {
  const pr = oc.createProgressRange();
  const op = new Constructor();
  const argumentsList = new oc.TopTools_ListOfShape_1();
  const toolsList = new oc.TopTools_ListOfShape_1();
  try {
    argumentsList.Append_1(a);
    toolsList.Append_1(b);
    op.SetArguments(argumentsList);
    op.SetTools(toolsList);
    if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
    // Two-shape constructors already build; configure an empty operation first.
    op.Build(pr);
    return op.IsDone() ? op.Shape() : a;
  } finally {
    toolsList.delete();
    argumentsList.delete();
    op.delete();
    pr?.delete?.();
  }
}

function makeSlotCavityFromExactRoundedXZProfile(oc, d) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);

  for (const section of d.sectionProfiles) {
    let primitives = buildRoundedOrthogonalPrimitivesXZ(section.profilePoints, d.filletR);
    if (d.widthProfile?.active) primitives = addWidthProfileToPrimitives(primitives, d.widthProfile, d.mirrorRisers);
    const y = d.y0 + d.depthY * section.t;
    mk.AddWire(makeExactWireXZAtY(oc, primitives, y));
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeUnequalDepthCavity(oc, options, p, d) {
  let lower, upper, lowerBox, upperBox, lowerHalf, upperHalf;
  try {
    lower = makeSlotCavityFromExactRoundedXZProfile(oc, options);
    upper = makeSlotCavityFromExactRoundedXZProfile(oc, {...options, depthY:p.upper_slot_depth_y + 2 * p.eps});
    lowerBox = makePrismAt(oc, -1, -1, -1, d.blockWidthX+2, d.blockDepthY+2, d.splitZ+1);
    upperBox = makePrismAt(oc, -1, -1, d.splitZ, d.blockWidthX+2, d.blockDepthY+2, d.blockHeightZ-d.splitZ+1);
    lowerHalf = booleanOperation(oc, oc.BRepAlgoAPI_Common_1, lower, lowerBox, p.boolean_fuzzy);
    upperHalf = booleanOperation(oc, oc.BRepAlgoAPI_Common_1, upper, upperBox, p.boolean_fuzzy);
    if (lowerHalf === lower || upperHalf === upper) throw new Error('The separate upper and lower grip depths could not be constructed.');
    const cavity = booleanFuseAdaptive(oc, lowerHalf, upperHalf, p.boolean_fuzzy);
    if (cavity === lowerHalf) throw new Error('The upper and lower grip cavities could not be joined.');
    return cavity;
  } finally {
    for(const shape of new Set([lowerHalf,upperHalf,lowerBox,upperBox,lower,upper]))shape?.delete();
  }
}

function makeIntegratedDepthCavity(oc,p,d) {
  let lower,upper;
  try {
    lower=makeRoundedHalfCavity(oc,p,d,'lower');
    upper=makeRoundedHalfCavity(oc,p,d,'upper');
    const combined=booleanFuseAdaptive(oc,lower,upper,1e-6);
    if(combined===lower)throw new Error('The rounded upper and lower grip cavities could not be joined.');
    return combined;
  }finally{lower?.delete();upper?.delete();}
}

function roundedHalfBoundary(p,d,side) {
  const lower=rawRoundedHalfBoundary(p,d,'lower'),upper=rawRoundedHalfBoundary(p,d,'upper');
  for(const end of ['left','right']){
    const curves=[lower,upper].map(boundary=>end==='left'?boundary.floor[0]:boundary.floor.at(-1));
    const index=end==='left'?0:-1;
    const radius=Math.min(...curves.map(curve=>Math.abs(index===0?curve.sideBlend[0]:curve.sideBlend.at(-1))));
    for(const curve of curves){
      const current=Math.abs(index===0?curve.sideBlend[0]:curve.sideBlend.at(-1));
      curve.sideBlend=curve.sideBlend.map(value=>current>1e-8?value*radius/current:0);
    }
  }
  return side==='lower'?lower:upper;
}

function rawRoundedHalfBoundary(p,d,side) {
  const upper=side==='upper',sign=upper?-1:1,base=upper?d.slotZ0+d.slotHeight:d.slotZ0;
  const cap=(d.splitZ-base)*sign,heights=upper&&p.risers_on_both_sides<0.5?d.baseRiserHeights.map(()=>0):d.baseRiserHeights;
  const profile=roundedDepthCurve(p,side),x0=d.slotX0,x1=x0+d.zoneWidths.reduce((a,b)=>a+b,0);
  const points=[{x:x0,z:heights[0]}];let x=x0;
  for(let i=0;i<heights.length;i++){
    x+=d.zoneWidths[i];points.push({x,z:heights[i]});
    if(i+1<heights.length&&Math.abs(heights[i+1]-heights[i])>1e-9)points.push({x,z:heights[i+1]});
  }
  points.push({x:x1,z:cap},{x:x0,z:cap});
  const maximumDepthOffset=Math.max(...profile.segments.flatMap(segment=>segment.points.map(point=>point.y)));
  let primitives=buildRoundedOrthogonalPrimitivesXZ(points,p.slot_fillet_r,cap,cap-maximumDepthOffset).filter(pr=>!(pr.kind==='line'&&(
    (Math.abs(pr.p0.z-cap)<1e-7&&Math.abs(pr.p1.z-cap)<1e-7)||
    (Math.abs(pr.p0.x-pr.p1.x)<1e-7&&[x0,x1].some(edge=>Math.abs(pr.p0.x-edge)<1e-7))
  )));
  if(d.widthProfile.active&&(!upper||p.risers_on_both_sides>=0.5))primitives=addWidthProfileToPrimitives(primitives,d.widthProfile,false);
  const sideBlends=riserSideBlends(primitives,p.riser_fillet_r,x0,x1);
  const floor=primitives.map((pr,index)=>{
    const curve=rationalXZPrimitive(pr);
    return {points:curve.points.map(point=>({x:point.x,z:base+sign*point.z})),weights:curve.weights,
      sideBlend:sideBlends[index]};
  });
  const first=profile.segments[0].points[0],last=profile.segments.at(-1).points.at(-1);
  const segments=[{points:[{x:-p.eps,y:first.y},{x:0,y:first.y}],sideBlend:[1,1]},...profile.segments.map((segment,i)=>({...segment,
    sideBlend:segment.points.map((_,j)=>p.riser_fillet_r>0&&segment.kind==='arc'?(i===0?(j===0?1:0):(j===segment.points.length-1?-1:0)):0)}))];
  return {x0,x1,profile,floor,segments,sign,first,last};
}

function makeRoundedHalfCavity(oc,p,d,side) {
  const {x0,x1,profile,floor,segments,sign,first,last}=roundedHalfBoundary(p,d,side);
  const faces=[];
  try {
    // A rational tensor product preserves both circular end arcs and the XZ profile.
    for(const curve of floor)for(const segment of segments)faces.push(makeTranslationPatch(oc,curve,segment,sign));
    const left={point:floor[0].points[0],blend:floor[0].sideBlend[0]},right={point:floor.at(-1).points.at(-1),blend:floor.at(-1).sideBlend.at(-1)};
    for(const wall of [left,right])for(const segment of segments){
      const curve={points:[wall.point,{x:wall.point.x,z:d.splitZ}],sideBlend:[wall.blend,wall.blend],capAt:1};
      faces.push(makeTranslationPatch(oc,curve,segment,sign));
    }
    for(const [y,offset,blend]of [[-p.eps,first.y,1],[profile.depth,last.y,-1]]){
      const edges=floor.map(curve=>makeWeightedEdge3D(oc,curve.points.map((point,i)=>[point.x+curve.sideBlend[i]*blend,y,point.z+sign*offset]),curve.weights));
      const start=floor[0].points[0],end=floor.at(-1).points.at(-1);
      const xLeft=x0+left.blend*blend,xRight=x1+right.blend*blend;
      edges.push(makeWeightedEdge3D(oc,[[xRight,y,end.z+sign*offset],[xRight,y,d.splitZ]]));
      edges.push(makeWeightedEdge3D(oc,[[xRight,y,d.splitZ],[xLeft,y,d.splitZ]]));
      edges.push(makeWeightedEdge3D(oc,[[xLeft,y,d.splitZ],[xLeft,y,start.z+sign*offset]]));
      faces.push(makePlanarFaceFromEdges(oc,edges));
    }
    const edges=[];
    for(const segment of segments)edges.push(makeWeightedEdge3D(oc,segment.points.map((point,j)=>[left.point.x+left.blend*(segment.sideBlend[j]??0),point.x,d.splitZ]),segment.weights));
    edges.push(makeWeightedEdge3D(oc,[[x0-left.blend,profile.depth,d.splitZ],[x1-right.blend,profile.depth,d.splitZ]]));
    for(const segment of [...segments].reverse())edges.push(makeWeightedEdge3D(oc,segment.points.map((point,j)=>[right.point.x+right.blend*(segment.sideBlend[j]??0),point.x,d.splitZ]).reverse(),segment.weights?[...segment.weights].reverse():undefined));
    edges.push(makeWeightedEdge3D(oc,[[x1+right.blend,-p.eps,d.splitZ],[x0+left.blend,-p.eps,d.splitZ]]));
    faces.push(makePlanarFaceFromEdges(oc,edges));
    return sewRoundedCavity(oc,faces);
  }finally{for(const face of faces)face.delete();}
}

function riserSideBlends(primitives,depthRadius,x0,x1) {
  const blends=primitives.map(primitive=>rationalXZPrimitive(primitive).points.map(()=>0));
  if(depthRadius<=0.05)return blends;
  for(const index of [0,primitives.length-1]){
    const arc=primitives[index];if(arc.kind!=='arc')continue;
    const centre=profileArcCentre(arc),vertical=index===0?arc.p0:arc.p1,radius=Math.min(depthRadius,0.9*centre.radius);
    const direction=index===0?-1:1,span=vertical.x-centre.x;
    blends[index]=rationalXZPrimitive(arc).points.map(point=>direction*(point.x-centre.x)/span*radius);
  }
  for(let i=1;i+1<primitives.length;i++){
    const primitive=primitives[i],a=primitives[i-1],b=primitives[i+1];
    if(primitive.kind!=='line'||Math.abs(primitive.p1.x-primitive.p0.x)>1e-8||Math.abs(primitive.p1.z-primitive.p0.z)<1e-8||primitive.p0.x<=x0+1e-7||primitive.p0.x>=x1-1e-7||a.kind!=='arc'||b.kind!=='arc')continue;
    // Stay below each corner radius so the side blend cannot fold its XZ arc.
    const first=profileArcCentre(a),last=profileArcCentre(b),radius=Math.min(depthRadius,0.9*first.radius,0.9*last.radius);
    blends[i]=blends[i].map(()=>Math.sign(primitive.p1.z-primitive.p0.z)*radius);
    for(const [index,arc,centre]of [[i-1,a,first],[i+1,b,last]]){
      const vertical=Math.abs(arc.p0.x-centre.x)>Math.abs(arc.p1.x-centre.x)?arc.p0:arc.p1;
      const span=vertical.x-centre.x,direction=Math.sign(arc.p1.z-arc.p0.z);
      blends[index]=rationalXZPrimitive(arc).points.map(point=>direction*(point.x-centre.x)/span*radius);
    }
  }
  return blends;
}

function profileArcCentre(primitive) {
  const a=primitive.p0,b=primitive.pm,c=primitive.p1;
  const denominator=2*(a.x*(b.z-c.z)+b.x*(c.z-a.z)+c.x*(a.z-b.z));
  const square=p=>p.x*p.x+p.z*p.z;
  const centreX=(square(a)*(b.z-c.z)+square(b)*(c.z-a.z)+square(c)*(a.z-b.z))/denominator;
  const centreZ=(square(a)*(c.x-b.x)+square(b)*(a.x-c.x)+square(c)*(b.x-a.x))/denominator;
  return {x:centreX,z:centreZ,radius:Math.hypot(a.x-centreX,a.z-centreZ)};
}

function rationalXZPrimitive(pr) {
  if(pr.kind==='bezier')return {points:pr.poles};
  if(pr.kind==='line')return {points:[pr.p0,pr.p1]};
  const chord=distanceXZ(pr.p0,pr.p1),mid={x:(pr.p0.x+pr.p1.x)/2,z:(pr.p0.z+pr.p1.z)/2};
  const sag=distanceXZ(mid,pr.pm),weight=Math.cos(2*Math.atan2(2*sag,chord));
  if(weight<1e-6)throw new Error('A profile arc exceeds the supported quarter-round geometry.');
  const control={x:((2+2*weight)*pr.pm.x-pr.p0.x-pr.p1.x)/(2*weight),z:((2+2*weight)*pr.pm.z-pr.p0.z-pr.p1.z)/(2*weight)};
  return {points:[pr.p0,control,pr.p1],weights:[1,weight,1]};
}

function makeWeightedEdge3D(oc,values,weights) {
  const poles=new oc.TColgp_Array1OfPnt_2(1,values.length),w=new oc.TColStd_Array1OfReal_2(1,values.length);
  let handle,maker,curve,ownsCurve=true;
  try {
    for(let i=0;i<values.length;i++){const point=new oc.gp_Pnt_3(...values[i]);poles.SetValue(i+1,point);point.delete();w.SetValue(i+1,weights?.[i]??1);}
    curve=new oc.Geom_BezierCurve_2(poles,w);handle=new oc.Handle_Geom_Curve_2(curve);ownsCurve=false;
    maker=new oc.BRepBuilderAPI_MakeEdge_24(handle);return maker.Edge();
  }finally{maker?.delete();handle?.delete();if(ownsCurve)curve?.delete();w.delete();poles.delete();}
}

function makeTranslationPatch(oc,curve,profile,sign) {
  const poles=new oc.TColgp_Array2OfPnt_2(1,curve.points.length,1,profile.points.length),weights=new oc.TColStd_Array2OfReal_2(1,curve.points.length,1,profile.points.length);
  let surface,handle,maker,ownsSurface=true;
  try {
    for(let i=0;i<curve.points.length;i++)for(let j=0;j<profile.points.length;j++){
      const point=new oc.gp_Pnt_3(curve.points[i].x+(curve.sideBlend?.[i]??0)*(profile.sideBlend?.[j]??0),profile.points[j].x,curve.points[i].z+(curve.capAt===i?0:sign*profile.points[j].y));
      poles.SetValue(i+1,j+1,point);point.delete();weights.SetValue(i+1,j+1,(curve.weights?.[i]??1)*(profile.weights?.[j]??1));
    }
    surface=new oc.Geom_BezierSurface_2(poles,weights);handle=new oc.Handle_Geom_Surface_2(surface);ownsSurface=false;
    maker=new oc.BRepBuilderAPI_MakeFace_8(handle,1e-7);return maker.Face();
  }finally{maker?.delete();handle?.delete();if(ownsSurface)surface?.delete();weights.delete();poles.delete();}
}

function makePlanarFaceFromEdges(oc,edges) {
  let wire,maker;
  try {wire=makeWireFromEdges(oc,edges);maker=new oc.BRepBuilderAPI_MakeFace_15(wire,true);return maker.Face();}
  finally{maker?.delete();wire?.delete();for(const edge of edges)edge.delete();}
}

function sewRoundedCavity(oc,faces) {
  const sew=new oc.BRepBuilderAPI_Sewing(1e-6,true,true,true,false),progress=oc.createProgressRange();
  let sewn,shell,maker,solid;
  try {
    for(const face of faces)sew.Add(face);sew.Perform(progress);
    if(sew.NbFreeEdges())throw new Error('The rounded depth-profile surfaces did not close.');
    sewn=sew.SewedShape();shell=oc.TopoDS.Shell_1(sewn);maker=new oc.BRepBuilderAPI_MakeSolid_3(shell);solid=maker.Solid();
    if(!oc.BRepLib.OrientClosedSolid(solid))throw new Error('The rounded cavity could not be oriented.');
    const check=new oc.BRepCheck_Analyzer(solid,true,false);
    try {if(!check.IsValid_2())throw new Error('The rounded depth-profile cavity has invalid boundaries.');}finally{check.delete();}
    return solid;
  }catch(error){solid?.delete();throw error;}
  finally{maker?.delete();shell?.delete();sewn?.delete();sew.delete();progress?.delete?.();}
}

function addWidthProfileToPrimitives(primitives, widthProfile, mirrorRisers) {
  return primitives.flatMap(primitive => {
    if (primitive.kind !== 'line' || Math.abs(primitive.p1.z - primitive.p0.z) > 1e-8 || Math.abs(primitive.p1.x - primitive.p0.x) < 1e-8) return [primitive];
    const top = primitive.p1.x < primitive.p0.x;
    if (top && !mirrorRisers) return [primitive];
    const x0 = Math.min(primitive.p0.x, primitive.p1.x), span = Math.abs(primitive.p1.x - primitive.p0.x);
    const segments = widthProfile.segments.map(segment => ({kind:'bezier', poles:segment.map(pole => ({
      x:x0 + span * pole.x, z:primitive.p0.z + (top ? -pole.z : pole.z)
    }))}));
    if (top) { segments.reverse(); for (const segment of segments) segment.poles.reverse(); }
    return segments;
  });
}

function buildSteppedSlotProfileXZ(d) {
  const n = d.zoneWidths.length;

  const xs = [d.slotX0];
  for (let i = 0; i < n; i++) xs.push(xs[xs.length - 1] + d.zoneWidths[i]);

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

  if (n > 0) {
    push(xs[0], d.slotZ0 + d.bottomOffsets[0]);
  }

  for (let i = 0; i < n; i++) {
    push(xs[i + 1], d.slotZ0 + d.bottomOffsets[i]);
    if (i + 1 < n) {
      push(xs[i + 1], d.slotZ0 + d.bottomOffsets[i + 1]);
    }
  }

  if (n > 0) {
    push(xs[n], d.slotZ0 + d.slotHeight - d.topOffsets[n - 1]);
  }

  for (let i = n - 1; i >= 0; i--) {
    push(xs[i], d.slotZ0 + d.slotHeight - d.topOffsets[i]);
    if (i > 0) {
      push(xs[i], d.slotZ0 + d.slotHeight - d.topOffsets[i - 1]);
    }
  }

  return pts;
}

function buildRoundedOrthogonalPrimitivesXZ(pts, radius,flatCap=Infinity,sideCeiling=Infinity) {
  const n = pts.length;

  if (n < 2) return [];
  if (radius <= 0.05 || n < 3) {
    return buildPolylinePrimitivesXZ(pts);
  }

  const area2 = signedArea2XZ(pts);
  const orientation = area2 >= 0 ? 1 : -1;
  const corners = [];

  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];

    const e1 = { x: b.x - a.x, z: b.z - a.z };
    const e2 = { x: c.x - b.x, z: c.z - b.z };

    const l1 = Math.hypot(e1.x, e1.z);
    const l2 = Math.hypot(e2.x, e2.z);

    const corner = {
      start: { x: b.x, z: b.z },
      end: { x: b.x, z: b.z },
      mid: null,
      hasArc: false
    };
    if(b.z>=flatCap-1e-7){corners.push(corner);continue;}

    if (l1 < 1e-9 || l2 < 1e-9) {
      corners.push(corner);
      continue;
    }

    const d1 = { x: e1.x / l1, z: e1.z / l1 };
    const d2 = { x: e2.x / l2, z: e2.z / l2 };
    const cross = d1.x * d2.z - d1.z * d2.x;

    if (Math.abs(cross) < 1e-9) {
      corners.push(corner);
      continue;
    }

    const atSide=Math.abs(b.x-pts[0].x)<1e-8||Math.abs(b.x-pts.at(-2).x)<1e-8;
    const r = Math.min(radius, 0.499 * l1, 0.499 * l2,atSide?Math.max(0,0.9*(sideCeiling-b.z)):Infinity);
    if (r <= 0.05) {
      corners.push(corner);
      continue;
    }

    const s = { x: b.x - d1.x * r, z: b.z - d1.z * r };
    const e = { x: b.x + d2.x * r, z: b.z + d2.z * r };

    const n1 = orientation > 0 ? leftNormalXZ(d1) : rightNormalXZ(d1);
    const n2 = orientation > 0 ? leftNormalXZ(d2) : rightNormalXZ(d2);

    const center = intersectLinesXZ(s, n1, e, n2);
    if (!center) {
      corners.push(corner);
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

    const midAng = a0 + 0.5 * delta;

    corner.start = s;
    corner.end = e;
    corner.mid = {
      x: center.x + r * Math.cos(midAng),
      z: center.z + r * Math.sin(midAng)
    };
    corner.hasArc = true;

    corners.push(corner);
  }

  const primitives = [];
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];

    if (distanceXZ(prev.end, curr.start) > 1e-9) {
      primitives.push({
        kind: "line",
        p0: prev.end,
        p1: curr.start
      });
    }

    if (curr.hasArc) {
      primitives.push({
        kind: "arc",
        p0: curr.start,
        pm: curr.mid,
        p1: curr.end
      });
    }
  }

  return primitives.length > 0 ? primitives : buildPolylinePrimitivesXZ(pts);
}

function buildPolylinePrimitivesXZ(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (distanceXZ(a, b) > 1e-9) {
      out.push({ kind: "line", p0: a, p1: b });
    }
  }
  return out;
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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

function makeExactWireXZAtY(oc, primitives, y) {
  const edges = primitives.map((pr) => {
    if (pr.kind === "line") return makeLineEdgeXZAtY(oc, pr.p0, pr.p1, y);
    if (pr.kind === "bezier") return makeBezierEdgeXZAtY(oc, pr.poles, y);
    return makeArcEdgeXZAtY(oc, pr.p0, pr.pm, pr.p1, y);
  });

  return makeWireFromEdges(oc, edges);
}

function makeBezierEdgeXZAtY(oc, poles, y) {
  const points = new oc.TColgp_Array1OfPnt_2(1, poles.length);
  let curve, handle, builder, ownsCurve = true;
  try {
    for (let i = 0; i < poles.length; i++) {
      const point = new oc.gp_Pnt_3(poles[i].x, y, poles[i].z);
      points.SetValue(i + 1, point);
      point.delete();
    }
    curve = new oc.Geom_BezierCurve_1(points);
    handle = new oc.Handle_Geom_Curve_2(curve);
    ownsCurve = false;
    builder = new oc.BRepBuilderAPI_MakeEdge_24(handle);
    return builder.Edge();
  } finally {
    builder?.delete();
    handle?.delete();
    // The handle/edge owns the Standard_Transient curve after handoff.
    if (ownsCurve) curve?.delete();
    points.delete();
  }
}

function makeLineEdgeXZAtY(oc, a, b, y) {
  const p0 = new oc.gp_Pnt_3(a.x, y, a.z);
  const p1 = new oc.gp_Pnt_3(b.x, y, b.z);
  const mk = new oc.BRepBuilderAPI_MakeEdge_3(p0, p1);
  return mk.Edge();
}

function makeArcEdgeXZAtY(oc, a, m, b, y) {
  const p0 = new oc.gp_Pnt_3(a.x, y, a.z);
  const pm = new oc.gp_Pnt_3(m.x, y, m.z);
  const p1 = new oc.gp_Pnt_3(b.x, y, b.z);

  const arcMaker = new oc.GC_MakeArcOfCircle_4(p0, pm, p1);
  const hCurve = new oc.Handle_Geom_Curve_2(arcMaker.Value().get());
  const mk = new oc.BRepBuilderAPI_MakeEdge_24(hCurve);
  return mk.Edge();
}

function makeWireFromEdges(oc, edges) {
  const wb = new oc.BRepBuilderAPI_MakeWire_1();

  for (const edge of edges) {
    if (typeof wb.Add_1 === "function") {
      wb.Add_1(edge);
    } else if (typeof wb.Add === "function") {
      wb.Add(edge);
    } else {
      throw new Error("No supported Add method found on BRepBuilderAPI_MakeWire_1.");
    }
  }

  if (typeof wb.IsDone === "function" && !wb.IsDone()) {
    throw new Error("Wire construction failed.");
  }

  return wb.Wire();
}

function tryFrontAndBackProfileRollingBallFillets(oc, shape, d) {
  if (d.radius <= 0.05) return shape;

  let out = shape;

  out = tryProfilePlaneRollingBallFillet(oc, out, {
    label: "front",
    radius: d.radius,
    targetY: d.slotY0,
    slotX0: d.slotX0,
    slotWidthX: d.slotWidthX,
    slotZ0: d.slotZ0,
    slotHeight: d.slotHeight,
    ensureValid: d.ensureValid,
    uniqueProfileEdges: d.uniqueProfileEdges
  });

  out = tryProfilePlaneRollingBallFillet(oc, out, {
    label: "back",
    radius: d.backRadius ?? d.radius,
    targetY: d.slotY0 + d.slotDepthY,
    slotX0: d.slotX0,
    slotWidthX: d.slotWidthX,
    slotZ0: d.slotZ0,
    slotHeight: d.slotHeight,
    ensureValid: d.ensureValid,
    uniqueProfileEdges: d.uniqueProfileEdges
  });

  if (d.upperSlotDepthY !== undefined && Math.abs(d.upperSlotDepthY - d.slotDepthY) > 1e-8) {
    out = tryProfilePlaneRollingBallFillet(oc, out, {
      label:'upper back', radius:d.backRadius ?? d.radius, targetY:d.slotY0+d.upperSlotDepthY,
      slotX0:d.slotX0, slotWidthX:d.slotWidthX, slotZ0:d.slotZ0, slotHeight:d.slotHeight, ensureValid:true, uniqueProfileEdges:d.uniqueProfileEdges
    });
  }

  return out;
}

function tryProfilePlaneRollingBallFillet(oc, shape, d) {
  const yTol = 0.35;
  const pad = 0.35;
  return trySelectedEdgeFillets(oc, shape, d.radius, (edge) => {
    const c = edgeCentreAndLength(oc, edge);
    return Math.abs(c.y - d.targetY) <= yTol &&
      c.x >= d.slotX0 - pad && c.x <= d.slotX0 + d.slotWidthX + pad &&
      c.z >= d.slotZ0 - pad && c.z <= d.slotZ0 + d.slotHeight + pad && c.length > 0.15;
  }, `No ${d.label} slot-profile edges matched for rolling-ball fillet.`,
  `${d.label[0].toUpperCase() + d.label.slice(1)} slot-profile rolling-ball fillet failed. Reduce riser_fillet_r.`,d.ensureValid,Boolean(d.uniqueProfileEdges));
}

function tryLongitudinalSlotEdgeFillets(oc, shape, d) {
  if (d.radius <= 0.05) return shape;

  const pad = Math.max(0.35, 0.5 * d.radius);
  const yInnerMin = d.slotY0 + Math.max(0.8, 0.12 * d.slotDepthY);
  const yInnerMax = d.slotY0 + d.slotDepthY - Math.max(0.8, 0.12 * d.slotDepthY);
  return trySelectedEdgeFillets(oc, shape, d.radius, (edge) => {
    const b = edgeBounds(oc, edge);
    return b.cx >= d.slotX0 - pad && b.cx <= d.slotX0 + d.slotWidthX + pad &&
      b.cz >= d.slotZ0 - pad && b.cz <= d.slotZ0 + d.slotHeight + pad &&
      b.cy >= yInnerMin && b.cy <= yInnerMax &&
      b.dy >= Math.max(1.0, 0.45 * d.slotDepthY) && b.dy >= 1.5 * Math.max(b.dx, b.dz);
  }, '', "Longitudinal slot fillet failed. Reduce slot_fillet_r.",d.ensureValid);
}

function tryOuterBodyFilletLast(oc, shape, d) {
  const tol = 0.6;
  return trySelectedEdgeFillets(oc, shape, d.radius, (edge) => {
    const c = edgeCentreAndLength(oc, edge);
    const hits = Number(c.x < tol || c.x > d.blockWidthX - tol) +
      Number(c.y < tol || c.y > d.blockDepthY - tol) +
      Number(c.z < tol || c.z > d.blockHeightZ - tol);
    return hits >= 2;
  }, "No outer body edges matched for exterior fillet.",
  "Outer body fillet failed. Reduce outer_fillet_r.",d.ensureValid);
}

function edgeCentreAndLength(oc, edge) {
  const props = new oc.GProp_GProps_1();
  let centre;
  try {
    oc.BRepGProp.LinearProperties(edge, props, false, false);
    centre = props.CentreOfMass();
    return {x: centre.X(), y: centre.Y(), z: centre.Z(), length: props.Mass()};
  } finally {
    centre?.delete();
    props.delete();
  }
}

function edgeBounds(oc, edge) {
  const box = new oc.Bnd_Box_1();
  let min, max;
  try {
    oc.BRepBndLib.Add(edge, box, false);
    min = box.CornerMin();
    max = box.CornerMax();
    return {
      dx: max.X() - min.X(), dy: max.Y() - min.Y(), dz: max.Z() - min.Z(),
      cx: 0.5 * (min.X() + max.X()), cy: 0.5 * (min.Y() + max.Y()), cz: 0.5 * (min.Z() + max.Z())
    };
  } finally {
    min?.delete();
    max?.delete();
    box.delete();
  }
}

function trySelectedEdgeFillets(oc, shape, radius, matches, noEdgesMessage, failedMessage, ensureValid=false, uniqueEdges=false) {
  const edges = [];
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    // Selection is radius-independent. Preserve traversal order and duplicate edges.
    while (exp.More()) {
      const current = exp.Current();
      const edge = oc.TopoDS.Edge_1(current);
      current.delete();
      try {
        if (matches(edge) && (!uniqueEdges || !edges.some(selected=>selected.IsSame(edge)))) edges.push(edge);
        else edge.delete();
      } catch (error) {
        edge.delete();
        throw error;
      }
      exp.Next();
    }
    if (!edges.length) {
      if (noEdgesMessage) console.warn(noEdgesMessage);
      return shape;
    }
    for (const r of [radius, 0.75 * radius, 0.5 * radius, 0.25 * radius]) {
      if (r <= 0.05) continue;
      let mk, progress;
      try {
        mk = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
        for (const edge of edges) mk.Add_2(r, edge);
        progress = oc.createProgressRange();
        mk.Build(progress);
        if (mk.IsDone()) {
          const candidate=mk.Shape();
          if(!ensureValid)return candidate;
          const checker=new oc.BRepCheck_Analyzer(candidate,true,false);
          try {if(checker.IsValid_2())return candidate;} finally {checker.delete();}
          candidate.delete();
        }
      } catch (error) {
        // Preserve the original smaller-radius fallback policy.
      } finally {
        progress?.delete?.();
        mk?.delete();
      }
    }
  } catch (error) {
    // An unclassifiable edge retains the original unfilleted fallback.
  } finally {
    exp.delete();
    for (const edge of edges) edge.delete();
  }
  console.warn(failedMessage);
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

function addRopeAttachment(oc, shape, p, dimensions) {
  const radius = (p.rope_diameter + p.rope_clearance) / 2;
  if (p.attachment_method === 'rope_groove') {
    const {blockWidthX:w, blockHeightZ:h} = dimensions;
    const route = perimeterRopePlacement(p, dimensions), {primitives, centre:y} = route;
    const spine = makeExactWireXZAtY(oc, primitives, y);
    const first = primitives[0], direction = {x:first.p1.x-first.p0.x,z:first.p1.z-first.p0.z};
    const profile = makeRoundedGrooveSection(oc, first.p0, y, direction, radius);
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(profile, true), face = faceMaker.Face();
    let pipe, tool;
    try {
      pipe = new oc.BRepOffsetAPI_MakePipe_1(spine, face);
      if (!pipe.IsDone()) throw new Error('The rounded rope groove could not be swept.');
      tool = orientAttachmentSolid(oc,pipe.Shape());
      let cut = booleanCutAdaptive(oc, shape, tool, p.boolean_fuzzy);
      if (cut === shape) throw new Error('The rope groove could not be cut.');
      cut=addIntegratedSideRails(oc,cut,p,dimensions,route,tool);
      cut=roundRopeChannelMouths(oc,cut,p,dimensions,route);
      console.warn('Experimental perimeter rope route with integrated covered sides and central inspection windows. The side walls locate the rope; they are not rated load-bearing anchors. Rope retention, wear and load strength have not been tested.');
      return cut;
    } finally {
      tool?.delete(); pipe?.delete(); face.delete(); faceMaker.delete(); profile.delete();
      spine.delete();
    }
  }
  if (p.attachment_method !== 'single_point') throw new Error('Unknown rope attachment method.');
  for (const side of p.attachment_side === 'both' ? ['top','bottom'] : [p.attachment_side]) {
    shape = addCentralEyelet(oc, shape, p, dimensions, side, radius);
  }
  console.warn('Experimental central attachment. Its rounded shape and nominal wall margins do not establish rope retention, fatigue resistance or a safe working load.');
  return shape;
}

function makeRoundedPerimeterBody(oc,p,d) {
  const route=perimeterRopePlacement(p,d);
  let core=loftProfileBetweenY(oc,route.primitives,0,d.blockDepthY);
  try {
    const radius=perimeterEdgeRadius(p,d,route);
    if(radius>0.05){
      const rounded=requiredEdgeFillet(oc,core,radius,edge=>{
        const b=edgeBounds(oc,edge);
        return b.dy<1e-5&&(Math.abs(b.cy)<1e-5||Math.abs(b.cy-d.blockDepthY)<1e-5);
      },'outer oval perimeter');
      core.delete();core=rounded;
    }
    return core;
  } catch(error) {core.delete();throw error;}
}

function perimeterEdgeRadius(p,d,route=perimeterRopePlacement(p,d)) {
  return Math.max(0,Math.min(p.outer_fillet_r,p.back_wall_y<8?p.back_wall_y*0.45:Infinity,0.45*d.blockDepthY,0.9*route.bend));
}

function requiredEdgeFillet(oc,shape,radius,matches,label) {
  const edges=[],explorer=new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_EDGE,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  const maker=new oc.BRepFilletAPI_MakeFillet(shape,oc.ChFi3d_FilletShape.ChFi3d_Rational),progress=oc.createProgressRange();
  try {
    while(explorer.More()){
      const current=explorer.Current(),edge=oc.TopoDS.Edge_1(current);current.delete();
      if(matches(edge)&&!edges.some(selected=>selected.IsSame(edge)))edges.push(edge);else edge.delete();
      explorer.Next();
    }
    if(!edges.length)throw new Error(`No edges matched for ${label} rounding.`);
    for(const edge of edges)if(maker.Contour(edge)===0)maker.Add_2(radius,edge);
    maker.Build(progress);
    if(!maker.IsDone())throw new Error(`The ${label} rounding could not be built.`);
    for(let contour=1;contour<=maker.NbContours();contour++){
      let generated=0;
      for(let i=1;i<=maker.NbEdges(contour);i++){
        const edge=maker.Edge(contour,i),faces=maker.Generated(edge);
        try{generated+=faces.Size();}finally{faces.delete();edge.delete();}
      }
      if(!generated)throw new Error(`The ${label} rounding left an unchanged edge chain.`);
    }
    const result=maker.Shape(),check=new oc.BRepCheck_Analyzer(result,true,false);
    try {if(!check.IsValid_2()){result.delete();throw new Error(`The ${label} rounding produced invalid boundaries.`);}}finally{check.delete();}
    return result;
  }finally{for(const edge of edges)edge.delete();explorer.delete();maker.delete();progress.delete();}
}

function perimeterRopePlacement(p, d) {
  const w=d.blockWidthX, h=d.blockHeightZ, a=w/2;
  const bend=Math.max(p.rope_bend_radius,p.outer_fillet_r), rise=p.rope_crown_rise_mm;
  const crownRadius=(a*a+rise*rise)/(2*rise), topCentre={x:a,z:h-crownRadius};
  const sideTop=topCentre.z+Math.sqrt((crownRadius-bend)**2-(a-bend)**2), sideBottom=h-sideTop;
  const leftCentre={x:bend,z:sideTop}, rightCentre={x:w-bend,z:sideTop};
  const tangent=c=>({x:a+(c.x-a)*crownRadius/(crownRadius-bend),z:topCentre.z+(c.z-topCentre.z)*crownRadius/(crownRadius-bend)});
  const tl=tangent(leftCentre),tr=tangent(rightCentre), mirror=v=>({x:v.x,z:h-v.z});
  const arc=(c,p0,p1)=>{
    const ux=p0.x-c.x,uz=p0.z-c.z,vx=p1.x-c.x,vz=p1.z-c.z,r=Math.hypot(ux,uz),s=r/Math.hypot(ux+vx,uz+vz);
    return {kind:'arc',p0,p1,pm:{x:c.x+(ux+vx)*s,z:c.z+(uz+vz)*s}};
  };
  const primitives=[
    {kind:'line',p0:{x:0,z:sideBottom},p1:{x:0,z:sideTop}},
    arc(leftCentre,{x:0,z:sideTop},tl),
    {kind:'arc',p0:tl,pm:{x:a,z:h},p1:tr},
    arc(rightCentre,tr,{x:w,z:sideTop}),
    {kind:'line',p0:{x:w,z:sideTop},p1:{x:w,z:sideBottom}},
    arc(mirror(rightCentre),{x:w,z:sideBottom},mirror(tr)),
    {kind:'arc',p0:mirror(tr),pm:{x:a,z:0},p1:mirror(tl)},
    arc(mirror(leftCentre),mirror(tl),{x:0,z:sideBottom})
  ];
  return {
    primitives, centre:(p.slot_depth_y+p.upper_slot_depth_y)/4+p.rope_depth_offset_mm,
    crownRadius, sideTop, sideBottom, bend, tangentX:tl.x
  };
}

function perimeterBoundarySag(p,width,x) {
  const route=perimeterRopePlacement(p,{blockWidthX:width,blockHeightZ:10000}),a=width/2;
  const left=Math.min(x,width-x);
  return left>=route.tangentX
    ? route.crownRadius-Math.sqrt(route.crownRadius**2-(x-a)**2)
    : route.sideBottom-Math.sqrt(Math.max(0,route.bend**2-(left-route.bend)**2));
}

function perimeterBodyAllowances(p,width,widths,risers,sections,widthProfile) {
  if(p.attachment_method!=='rope_groove')return {bottom:0,top:0};
  const groove=p.make_holes>=0.5?(p.rope_diameter+p.rope_clearance)/2:0;
  let left=p.side_wall_x,bottom=0,top=0;
  for(let i=0;i<widths.length;i++){
    const right=left+widths[i],sag=Math.max(perimeterBoundarySag(p,width,left),perimeterBoundarySag(p,width,right));
    const riser=Math.min(...sections.map(section=>Math.max(0,risers[i]+section.delta)))+widthProfile.minDelta;
    bottom=Math.max(bottom,sag+groove-riser);
    top=Math.max(top,sag+groove-(p.risers_on_both_sides>=0.5?riser:0));
    left=right;
  }
  return {bottom,top};
}

function loftProfileBetweenY(oc, primitives, y0, y1) {
  const front=makeExactWireXZAtY(oc,primitives,y0), back=makeExactWireXZAtY(oc,primitives,y1);
  const loft=new oc.BRepOffsetAPI_ThruSections(true,true,1e-6),progress=oc.createProgressRange();
  try {
    loft.AddWire(front);loft.AddWire(back);loft.Build(progress);
    if(!loft.IsDone())throw new Error('The attachment loft could not be built.');
    return orientAttachmentSolid(oc,loft.Shape());
  } finally {front.delete();back.delete();progress?.delete?.();loft.delete();}
}

function orientAttachmentSolid(oc,shape) {
  const properties=new oc.GProp_GProps_1();
  try {
    oc.BRepGProp.VolumeProperties_1(shape,properties,false,false,false);
    const volume=properties.Mass();
    if(!Number.isFinite(volume)||Math.abs(volume)<1e-6)throw new Error('An attachment loft did not produce a solid volume.');
    if(volume<0)shape.Reverse();
    return shape;
  } finally {properties.delete();}
}

function makeCylinder(oc, point, direction, radius, length) {
  const origin=new oc.gp_Pnt_3(...point),axisDirection=new oc.gp_Dir_4(...direction),across=new oc.gp_Dir_4(0,1,0);
  const axis=new oc.gp_Ax2_2(origin,axisDirection,across),maker=new oc.BRepPrimAPI_MakeCylinder_3(axis,radius,length);
  try {return maker.Shape();} finally {maker.delete();axis.delete();origin.delete();axisDirection.delete();across.delete();}
}

function makeRoundedGrooveSection(oc,origin,y,direction,radius) {
  // Tangent lip arcs meet the body and original circular rope seat smoothly.
  const lip=Math.min(1,radius*0.3),mouth=Math.sqrt(radius*radius+2*radius*lip);
  const contact={n:-lip*radius/(radius+lip),u:mouth*radius/(radius+lip)};
  const outside=radius+2*lip+1,length=Math.hypot(direction.x,direction.z);
  const normal={x:-direction.z/length,z:direction.x/length};
  const resources=[],edges=[];
  const point=p=>{
    const result=new oc.gp_Pnt_3(origin.x+normal.x*p.n,y+p.u,origin.z+normal.z*p.n);
    resources.push(result);return result;
  };
  const arc=(centre,p0,p1)=>{
    const a={n:p0.n-centre.n,u:p0.u-centre.u},b={n:p1.n-centre.n,u:p1.u-centre.u};
    const scale=Math.hypot(a.n,a.u)/Math.hypot(a.n+b.n,a.u+b.u);
    return {p0,p1,pm:{n:centre.n+(a.n+b.n)*scale,u:centre.u+(a.u+b.u)*scale}};
  };
  const lower={n:contact.n,u:-contact.u};
  const primitives=[
    {p0:{n:outside,u:mouth},p1:{n:0,u:mouth}},
    arc({n:-lip,u:mouth},{n:0,u:mouth},contact),
    {p0:contact,pm:{n:-radius,u:0},p1:lower},
    arc({n:-lip,u:-mouth},lower,{n:0,u:-mouth}),
    {p0:{n:0,u:-mouth},p1:{n:outside,u:-mouth}},
    {p0:{n:outside,u:-mouth},p1:{n:outside,u:mouth}}
  ];
  try {
    for(const primitive of primitives){
      const a=point(primitive.p0),b=point(primitive.p1);let maker;
      if(primitive.pm){
        const curveMaker=new oc.GC_MakeArcOfCircle_4(a,point(primitive.pm),b),curve=curveMaker.Value();
        const handle=new oc.Handle_Geom_Curve_2(curve.get());resources.push(curveMaker,curve,handle);
        maker=new oc.BRepBuilderAPI_MakeEdge_24(handle);
      }else maker=new oc.BRepBuilderAPI_MakeEdge_3(a,b);
      const edge=maker.Edge();resources.push(maker,edge);edges.push(edge);
    }
    return makeWireFromEdges(oc,edges);
  }finally{for(const resource of resources.reverse())resource.delete();}
}

function integratedRailLayout(p,d,route=perimeterRopePlacement(p,d)) {
  const length=route.sideTop-route.sideBottom,window=0.4*length;
  const taper=Math.min(6,(length-window-8)/4),middle=d.blockHeightZ/2;
  const bottom=middle-window/2,top=middle+window/2,extent=(p.rope_diameter+p.rope_clearance)/2+3;
  const z0=route.sideBottom,z1=route.sideTop;
  const ramp=(a,b,from,to)=>({z:[a,a+(b-a)/3,a+2*(b-a)/3,b],e:[from,from,to,to]});
  const straight=(a,b,e)=>({z:[a,b],e:[e,e]});
  return {extent,taper,windowBottom:bottom,windowTop:top,sideBottom:z0,sideTop:z1,
    coveredCentres:[(z0+taper+bottom-taper)/2,(top+taper+z1-taper)/2],
    spans:[ramp(z0,z0+taper,0,extent),straight(z0+taper,bottom-taper,extent),ramp(bottom-taper,bottom,extent,0),
      straight(bottom,top,0),ramp(top,top+taper,0,extent),straight(top+taper,z1-taper,extent),ramp(z1-taper,z1,extent,0)]};
}

function bernsteinProduct(a,b) {
  const n=a.length-1,m=b.length-1,choose=(degree,index)=>{
    let result=1;for(let j=1;j<=index;j++)result=result*(degree-j+1)/j;return result;
  };
  return Array.from({length:n+m+1},(_,k)=>{
    let sum=0;for(let i=Math.max(0,k-m);i<=Math.min(n,k);i++)sum+=a[i]*b[k-i]*choose(n,i)*choose(m,k-i)/choose(n+m,k);return sum;
  });
}

function railBoundaryProfiles(centre,depth,radius) {
  const q=Math.SQRT1_2,front={a:-1/(centre*centre),b:2/centre,c:0},length=depth-centre;
  const back={a:-1/(length*length),b:2*centre/(length*length),c:1-centre*centre/(length*length)};
  const definitions=[];
  if(radius>0)definitions.push({points:[{x:radius,y:0},{x:0,y:0},{x:0,y:radius}],weights:[1,q,1],shape:front});
  definitions.push({points:[{x:0,y:radius},{x:0,y:centre}],shape:front});
  definitions.push({points:[{x:0,y:centre},{x:0,y:depth-radius}],shape:back});
  if(radius>0)definitions.push({points:[{x:0,y:depth-radius},{x:0,y:depth},{x:radius,y:depth}],weights:[1,q,1],shape:back});
  return definitions.map(({points,weights=points.map(()=>1),shape})=>{
    // Degree-elevated rational products retain the exact circular base corner
    // while adding a tangent polynomial bulge for the covered rope channel.
    const x=points.map((point,i)=>point.x*weights[i]),y=points.map((point,i)=>point.y*weights[i]);
    const denominator=bernsteinProduct(weights,weights),nx=bernsteinProduct(x,weights),ny=bernsteinProduct(y,weights),yy=bernsteinProduct(y,y);
    return {weights:denominator,points:denominator.map((w,i)=>({x:nx[i]/w,y:ny[i]/w,h:(shape.a*yy[i]+shape.b*ny[i]+shape.c*w)/w}))};
  });
}

function roundRopeChannelMouths(oc,shape,p,d,route) {
  const boreEdges=[],skinEdges=[],radius=(p.rope_diameter+p.rope_clearance)/2;
  const value=type=>type?.value??type,tolerance=1e-4;
  const explorer=new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_FACE,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    while(explorer.More()){
      const current=explorer.Current(),face=oc.TopoDS.Face_1(current);current.delete();
      const surface=new oc.BRepAdaptor_Surface_2(face,true);let destination;
      try {
        const type=value(surface.GetType());
        if(type===value(oc.GeomAbs_SurfaceType.GeomAbs_BezierSurface)||type===value(oc.GeomAbs_SurfaceType.GeomAbs_BSplineSurface))destination=skinEdges;
        if(type===value(oc.GeomAbs_SurfaceType.GeomAbs_Cylinder)){
          const cylinder=surface.Cylinder(),axis=cylinder.Axis(),point=cylinder.Location(),direction=axis.Direction();
          try{
            if(Math.abs(cylinder.Radius()-radius)<tolerance&&Math.abs(Math.abs(direction.Z())-1)<tolerance&&Math.abs(point.Y()-route.centre)<tolerance&&Math.min(Math.abs(point.X()),Math.abs(point.X()-d.blockWidthX))<tolerance)destination=boreEdges;
          }finally{direction.delete();point.delete();axis.delete();cylinder.delete();}
        }
        if(destination){
          const edges=new oc.TopExp_Explorer_2(face,oc.TopAbs_ShapeEnum.TopAbs_EDGE,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
          try{while(edges.More()){
            const current=edges.Current(),edge=oc.TopoDS.Edge_1(current);current.delete();
            if(!destination.some(other=>other.IsSame(edge)))destination.push(edge);else edge.delete();
            edges.Next();
          }}finally{edges.delete();}
        }
      }finally{surface.delete();face.delete();}
      explorer.Next();
    }
    const mouths=boreEdges.filter(edge=>skinEdges.some(skin=>skin.IsSame(edge)));
    // These are the trimmed cylinder/covered-skin intersections, not the bore
    // seam or the swept open-groove lips. A 0.5 mm round fits their short ends.
    return requiredEdgeFillet(oc,shape,0.5,edge=>mouths.some(mouth=>mouth.IsSame(edge)),'covered rope-channel mouth');
  }finally{explorer.delete();for(const edge of [...boreEdges,...skinEdges])edge.delete();}
}

function makeRailWall(oc,x,y,depth,layout,radius) {
  const outward=x===0?-1:1,inward=-outward,root=Math.max(2,radius+1);
  const profiles=railBoundaryProfiles(y,depth,radius);
  const faces=[];
  try {
    for(const profile of profiles)for(const span of layout.spans){
      const poles=new oc.TColgp_Array2OfPnt_2(1,profile.points.length,1,span.z.length),weights=new oc.TColStd_Array2OfReal_2(1,profile.points.length,1,span.z.length);
      let surface,handle,maker;
      try {
        for(let i=0;i<profile.points.length;i++)for(let j=0;j<span.z.length;j++){
          const value=profile.points[i],point=new oc.gp_Pnt_3(x+inward*value.x+outward*value.h*span.e[j],value.y,span.z[j]);
          poles.SetValue(i+1,j+1,point);point.delete();weights.SetValue(i+1,j+1,profile.weights[i]);
        }
        surface=new oc.Geom_BezierSurface_2(poles,weights);handle=new oc.Handle_Geom_Surface_2(surface);
        maker=new oc.BRepBuilderAPI_MakeFace_8(handle,1e-7);faces.push(maker.Face());
      }finally{maker?.delete();handle?.delete();if(!handle)surface?.delete();weights.delete();poles.delete();}
    }
    for(const [a,b,c,d]of [
      [[x+inward*radius,0,layout.sideBottom],[x+inward*root,0,layout.sideBottom],[x+inward*root,0,layout.sideTop],[x+inward*radius,0,layout.sideTop]],
      [[x+inward*radius,depth,layout.sideBottom],[x+inward*root,depth,layout.sideBottom],[x+inward*root,depth,layout.sideTop],[x+inward*radius,depth,layout.sideTop]],
      [[x+inward*root,0,layout.sideBottom],[x+inward*root,depth,layout.sideBottom],[x+inward*root,depth,layout.sideTop],[x+inward*root,0,layout.sideTop]]
    ]){
      const corners=[a,b,c,d];faces.push(makePlanarFaceFromEdges(oc,corners.map((point,i)=>makeWeightedEdge3D(oc,[point,corners[(i+1)%4]]))));
    }
    for(const z of [layout.sideBottom,layout.sideTop]){
      const edges=profiles.map(profile=>makeWeightedEdge3D(oc,profile.points.map(point=>[x+inward*point.x,point.y,z]),profile.weights));
      for(const [a,b]of [[[x+inward*radius,depth,z],[x+inward*root,depth,z]],[[x+inward*root,depth,z],[x+inward*root,0,z]],[[x+inward*root,0,z],[x+inward*radius,0,z]]])edges.push(makeWeightedEdge3D(oc,[a,b]));
      faces.push(makePlanarFaceFromEdges(oc,edges));
    }
    return sewRoundedCavity(oc,faces);
  }finally{for(const face of faces)face.delete();}
}

function addIntegratedSideRails(oc,body,p,d,route,grooveTool) {
  const layout=integratedRailLayout(p,d,route),radius=(p.rope_diameter+p.rope_clearance)/2;
  for(const x of [0,d.blockWidthX]){
    const rail=makeRailWall(oc,x,route.centre,d.blockDepthY,layout,perimeterEdgeRadius(p,d,route)),bore=makeCylinder(oc,[x,route.centre,layout.sideBottom-1],[0,0,1],radius,layout.sideTop-layout.sideBottom+2);
    try {
      const joined=booleanFuseAdaptive(oc,body,rail,1e-6);
      if(joined===body)throw new Error('The side-wall rope extension could not be joined.');
      const opened=booleanCutAdaptive(oc,joined,bore,1e-6);
      if(opened===joined)throw new Error('The covered rope channel could not be opened.');
      body=opened;
    }finally{rail.delete();bore.delete();}
  }
  const window=makePrismAt(oc,-layout.extent-1,-1,layout.windowBottom,d.blockWidthX+2*layout.extent+2,d.blockDepthY+2,layout.windowTop-layout.windowBottom);
  let roundedWindow;
  try {
    roundedWindow=booleanOperation(oc,oc.BRepAlgoAPI_Common_1,grooveTool,window,1e-6);
    if(roundedWindow===grooveTool)throw new Error('The rope inspection window could not be bounded.');
    const result=booleanCutAdaptive(oc,body,roundedWindow,1e-6);
    if(result===body)throw new Error('The rope inspection-window lips could not be rounded.');
    return result;
  }finally{roundedWindow?.delete();window.delete();}
}

function addCentralEyelet(oc, body, p, d, side, holeRadius) {
  if (!['top','bottom'].includes(side)) throw new Error('Choose a top, bottom or two-sided central attachment.');
  const placement=internalEyeletGeometry(p,d,side),{y0,y1}=placement;
  const tolerance=Math.min(p.boolean_fuzzy,1e-5);
  const x=d.blockWidthX/2,z=placement.z,outer=holeRadius+6;
  const sign=side==='top'?1:-1,baseline=placement.rootZ;
  const profile=(radius,footprint)=>{
    const map=(px,pz)=>({x:x+px,z:z+sign*pz});
    return [
      {kind:'line',p0:{x:x-footprint,z:baseline},p1:{x:x+footprint,z:baseline}},
      {kind:'line',p0:{x:x+footprint,z:baseline},p1:map(radius,0)},
      {kind:'arc',p0:map(radius,0),pm:map(0,radius),p1:map(-radius,0)},
      {kind:'line',p0:map(-radius,0),p1:{x:x-footprint,z:baseline}}
    ];
  };
  const mouth=placement.mouthRadius,rootRadius=Math.min(outer,Math.max(1,(side==='top'?d.blockHeightZ-z:z)-p.outer_fillet_r)),footprint=Math.min(d.blockWidthX/2-1,outer+8);
  const loft=new oc.BRepOffsetAPI_ThruSections(true,true,1e-6),progress=oc.createProgressRange(),wires=[];
  let support,hole,frontRecess,backRecess;
  try {
    let result=body;
    const needsReinforcement=side==='top'?placement.outerZ>d.blockHeightZ+1e-6:placement.outerZ<-1e-6;
    if(needsReinforcement){
      for(const [y,radius]of [[0.25,rootRadius],[y0,outer],[y1,outer],[d.blockDepthY-0.25,rootRadius]]){
        const rootWidth=y===0.25||y===d.blockDepthY-0.25?footprint:Math.min(footprint,outer+3);
        const wire=makeExactWireXZAtY(oc,profile(radius,rootWidth),y);wires.push(wire);loft.AddWire(wire);
      }
      loft.Build(progress);if(!loft.IsDone())throw new Error('The integrated eyelet support could not be lofted.');
      support=orientAttachmentSolid(oc,loft.Shape());
      result=booleanFuseAdaptive(oc,body,support,tolerance);
      if(result===body)throw new Error('The integrated eyelet support could not be joined.');
    }
    const recessProfile=radius=>{
      const map=(px,pz)=>({x:x+px,z:z-sign*pz}),outside=placement.outerZ+sign;
      return [
        {kind:'arc',p0:map(-radius,0),pm:map(0,radius),p1:map(radius,0)},
        {kind:'line',p0:map(radius,0),p1:{x:x+radius,z:outside}},
        {kind:'line',p0:{x:x+radius,z:outside},p1:{x:x-radius,z:outside}},
        {kind:'line',p0:{x:x-radius,z:outside},p1:map(-radius,0)}
      ];
    };
    // Open entries allow the rope to turn around the retained Y-centred bridge,
    // instead of bearing on the front/back edges of an enclosed tunnel.
    frontRecess=loftVariableProfilesY(oc,[[ -1,recessProfile(mouth)],[0,recessProfile(mouth)],[y0,recessProfile(holeRadius)]]);
    backRecess=loftVariableProfilesY(oc,[[y1,recessProfile(holeRadius)],[d.blockDepthY,recessProfile(mouth)],[d.blockDepthY+1,recessProfile(mouth)]]);
    result=booleanCutAdaptive(oc,result,frontRecess,tolerance);
    result=booleanCutAdaptive(oc,result,backRecess,tolerance);
    hole=makeRoundedRopeBoreY(oc,x,z,holeRadius,y0,y1);
    const cut = booleanCutAdaptive(oc, result, hole, tolerance);
    if (cut === result) throw new Error('The central rope hole could not be cut.');
    return cut;
  } finally {
    hole?.delete();frontRecess?.delete();backRecess?.delete();support?.delete();for(const wire of wires)wire.delete();progress?.delete?.();loft.delete();
  }
}

function centralEyeletPlacement(p, side=p.attachment_side==='bottom'?'bottom':'top') {
  const thickness = p.eyelet_thickness_mm;
  const depth=side==='top'?p.upper_slot_depth_y:p.slot_depth_y;
  const centre = depth / 2 + p.eyelet_depth_offset_mm;
  return {
    centre, thickness, y0:centre - thickness / 2, y1:centre + thickness / 2,
    minOffset:1 + thickness / 2 - depth / 2,
    maxOffset:Math.max(p.slot_depth_y,p.upper_slot_depth_y) + p.back_wall_y - 1 - thickness / 2 - depth/2
  };
}

function internalEyeletGeometry(p,d,side) {
  const placement=centralEyeletPlacement(p,side),depth=side==='top'?p.upper_slot_depth_y:p.slot_depth_y;
  const delta=p.depth_profile_version>=2?roundedDepthValue(p,side==='top'?'upper':'lower',placement.centre):p.depth_taper_amount_mm*curveValueToUnitDelta(evaluateCurve(parseCurvePoints(p.depth_taper_curve,DEFAULT_DEPTH_TAPER_CURVE),clamp(placement.centre/depth,0,1)));
  const deltas=depthProfileSections(p);
  const widthProfile=makeWidthProfile(p.width_taper_curve,p.width_taper_amount_mm);
  const platforms=liftedPlatformHeights(getActiveValues(p,'riser_height_',p.slot_count,0),deltas,widthProfile);
  const pinky=Math.max(0,platforms.at(-1)+delta);
  const nominalZ=side==='bottom'?p.bottom_wall_z+pinky:d.blockHeightZ-p.top_wall_z-(p.risers_on_both_sides>=0.5?pinky:0);
  const r=(p.rope_diameter+p.rope_clearance)/2,outer=r+6,halfWidth=Math.min(d.blockWidthX/2-1,outer+8),centreX=d.blockWidthX/2;
  const heights=[];let left=p.side_wall_x;
  for(let i=1;i<=p.slot_count;i++){
    const right=left+p['slot_width_'+i];
    if(right>=centreX-halfWidth&&left<=centreX+halfWidth)for(const section of deltas)heights.push(Math.max(0,platforms[i-1]+section.delta));
    left=right;
  }
  const minRiser=Math.min(...heights)+widthProfile.minDelta-(p.depth_profile_version>=2?p.riser_fillet_r:0);
  const surface=side==='bottom'?p.bottom_wall_z+minRiser:d.blockHeightZ-p.top_wall_z-(p.risers_on_both_sides>=0.5?minRiser:0);
  // Keep the reinforcement out of the grip opening. If the last platform is
  // already high, move the eyelet outward and add only a local crown as needed.
  const z=side==='top'?Math.max(nominalZ,surface+outer+0.5):Math.min(nominalZ,surface-outer-0.5);
  const rootZ=surface+(side==='top'?0.25:-0.25),outerZ=side==='top'?Math.max(d.blockHeightZ,z+outer):Math.min(0,z-outer);
  const distanceInward=side==='top'?z:d.blockHeightZ-z;
  return {...placement,z,nominalZ,rootZ,outerZ,mouthRadius:Math.min(r+4,distanceInward-4)};
}

function loftVariableProfilesY(oc,sections) {
  const loft=new oc.BRepOffsetAPI_ThruSections(true,true,1e-6),progress=oc.createProgressRange(),resources=[];
  try {
    for(const [y,profile]of sections){
      const wire=makeExactWireXZAtY(oc,profile,y);resources.push(wire);loft.AddWire(wire);
    }
    loft.Build(progress);if(!loft.IsDone())throw new Error('The flared rope passage could not be built.');
    return orientAttachmentSolid(oc,loft.Shape());
  } finally {for(const resource of resources.reverse())resource.delete();progress?.delete?.();loft.delete();}
}

function validateAttachmentParameters(p) {
  p=resolvedHangboardParameters(p);
  const errors = roundedDepthErrors(p);
  if (!Number.isInteger(p.slot_count) || p.slot_count < 1 || p.slot_count > MAX_SLOTS) errors.slot_count = 'Slot count must be a whole number from 1 to 6.';
  if (Object.keys(errors).length) return errors;
  if (p.attachment_method === 'rope_groove') {
    const enabled=p.make_holes>=0.5,d=attachmentDimensions(p),r=enabled?(p.rope_diameter+p.rope_clearance)/2:0,route=perimeterRopePlacement(p,d);
    if (!Number.isFinite(route.sideTop) || route.sideTop-route.sideBottom < (enabled?24:1) || p.rope_bend_radius <= r+1) errors.rope_bend_radius = 'The rope route needs room for rounded corners and covered side channels. Reduce the corner radius or increase the body height.';
    const minY=r+4,maxY=d.blockDepthY-r-4;
    if(enabled&&(route.centre < minY || route.centre > maxY))errors.rope_depth_offset_mm = `Keep the rope path centre between ${minY.toFixed(1)} and ${maxY.toFixed(1)} mm from the front, including the covered side walls.`;
    const a=d.blockWidthX/2, x=p.side_wall_x, crownCut=route.crownRadius-Math.sqrt(route.crownRadius**2-(x-a)**2);
    if(Math.min(p.top_wall_z+d.capTop,p.bottom_wall_z+d.capBottom)-crownCut-r<3 || p.side_wall_x-r<3)errors.rope_crown_rise_mm = 'The rope seat leaves less than 3 mm nominal shell. Reduce the crown/rope size or increase the walls; this is not a load rating.';
    return errors;
  }
  if(p.make_holes<0.5)return errors;
  if (p.attachment_method !== 'single_point') return errors;
  const d=attachmentDimensions(p),r=(p.rope_diameter+p.rope_clearance)/2;
  for(const side of p.attachment_side==='both'?['top','bottom']:[p.attachment_side]) {
    const placement=internalEyeletGeometry(p,d,side);
    if (placement.minOffset > placement.maxOffset) {
      errors.eyelet_thickness_mm = 'Eyelet throat length must leave at least 1 mm for the front and back tapers.';
    } else if (placement.y0 < 1 || placement.y1 > d.blockDepthY - 1) {
      errors.eyelet_depth_offset_mm = `Eyelet depth offset must be between ${placement.minOffset.toFixed(1)} and ${placement.maxOffset.toFixed(1)} mm for the ${side} grip and throat length.`;
    }
    if(placement.mouthRadius<r+0.5)errors.rope_diameter='The eyelet recess does not fit this body. Increase the opening or reduce the rope diameter.';
    if(2*(r+8)>=d.blockWidthX)errors.side_wall_x='The central attachment needs more body width for its tapered support. Increase the side walls or finger widths.';
  }
  return errors;
}

function attachmentDimensions(p) {
  p=resolvedHangboardParameters(p);
  const widths=getActiveValues(p,'slot_width_',p.slot_count,6);
  const sections=depthProfileSections(p),widthProfile=makeWidthProfile(p.width_taper_curve,p.width_taper_amount_mm);
  const heights=liftedPlatformHeights(getActiveValues(p,'riser_height_',p.slot_count,0),sections,widthProfile);
  const slotHeight=computeRequiredSlotHeight({baseSlotHeight:p.base_slot_height,slotClearanceBetweenSurfaces:p.slot_clearance_between_surfaces,
    baseRiserHeights:heights,mirrorRisers:p.risers_on_both_sides>=0.5,depthSections:sections,widthProfile,endRadius:p.depth_profile_version>=2?p.riser_fillet_r:0});
  const blockWidthX=widths.reduce((a,b)=>a+b,0)+2*p.side_wall_x,caps=perimeterBodyAllowances(p,blockWidthX,widths,heights,sections,widthProfile);
  return {blockWidthX,blockHeightZ:p.bottom_wall_z+slotHeight+p.top_wall_z+caps.bottom+caps.top,
    blockDepthY:Math.max(p.slot_depth_y,p.upper_slot_depth_y)+p.back_wall_y,slotHeight,
    capBottom:caps.bottom,capTop:caps.top,slotZ0:p.bottom_wall_z+caps.bottom,sideWallX:p.side_wall_x};
}

function makeRoundedRopeBoreY(oc,x,z,r,y0,y1) {
  // Revolving this analytic section gives exact quarter-round entry rims.
  const f=1,q=f/Math.SQRT2;
  const primitives=[
    {kind:'line',p0:{r:0,y:y0-0.5},p1:{r:r+f,y:y0-0.5}},
    {kind:'line',p0:{r:r+f,y:y0-0.5},p1:{r:r+f,y:y0}},
    {kind:'arc',p0:{r:r+f,y:y0},pm:{r:r+f-q,y:y0+f-q},p1:{r,y:y0+f}},
    {kind:'line',p0:{r,y:y0+f},p1:{r,y:y1-f}},
    {kind:'arc',p0:{r,y:y1-f},pm:{r:r+f-q,y:y1-f+q},p1:{r:r+f,y:y1}},
    {kind:'line',p0:{r:r+f,y:y1},p1:{r:r+f,y:y1+0.5}},
    {kind:'line',p0:{r:r+f,y:y1+0.5},p1:{r:0,y:y1+0.5}},
    {kind:'line',p0:{r:0,y:y1+0.5},p1:{r:0,y:y0-0.5}}
  ];
  const resources=[],edges=[];
  const point=p=>{const result=new oc.gp_Pnt_3(x+p.r,p.y,z);resources.push(result);return result;};
  try {
    for(const primitive of primitives){
      const p0=point(primitive.p0),p1=point(primitive.p1);let maker;
      if(primitive.kind==='line')maker=new oc.BRepBuilderAPI_MakeEdge_3(p0,p1);
      else {
        const arc=new oc.GC_MakeArcOfCircle_4(p0,point(primitive.pm),p1),curve=arc.Value();
        const handle=new oc.Handle_Geom_Curve_2(curve.get());resources.push(arc,curve,handle);
        maker=new oc.BRepBuilderAPI_MakeEdge_24(handle);
      }
      const edge=maker.Edge();resources.push(maker,edge);edges.push(edge);
    }
    const wire=makeWireFromEdges(oc,edges),faceMaker=new oc.BRepBuilderAPI_MakeFace_15(wire,true),face=faceMaker.Face();resources.push(wire,faceMaker,face);
    const origin=new oc.gp_Pnt_3(x,0,z),direction=new oc.gp_Dir_4(0,1,0),axis=new oc.gp_Ax1_2(origin,direction);resources.push(origin,direction,axis);
    const revolve=new oc.BRepPrimAPI_MakeRevol_2(face,axis,false);resources.push(revolve);
    return orientAttachmentSolid(oc,revolve.Shape());
  } finally {for(const resource of resources.reverse())resource.delete();}
}
