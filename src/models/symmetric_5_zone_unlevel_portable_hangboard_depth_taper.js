const MAX_SLOTS = 6;
const DEFAULT_DEPTH_TAPER_CURVE = "0.000,1.000|0.250,1.000|0.500,1.000|0.750,1.000|1.000,1.000";
const DEPTH_SECTION_SAMPLE_COUNT = 17;

export const meta = {
  name: "Symmetric Dual-Side Portable Hangboard (Depth Taper)",
  description: "Direct-dimension hangboard variant with configurable slots and a draggable depth taper curve.",
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
      label: "Width taper view",
      type: "curve",
      default: "0.000,1.000|0.250,1.000|0.500,1.000|0.750,1.000|1.000,1.000",
      visibleIf: { key: "__never__", value: true },
      yMin: 0.5,
      yMax: 1.5,
      xLabel: "Left slots → right slots",
      yLabel: "Normalized taper",
      height: 118,
      columnSpan: "full",
      description: "Drag the local left-to-right riser shape that is reused inside every slot."
    },
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
      description: "Drag the front-to-back taper shape. The center line keeps the original riser heights."
    },
    { key: "depth_taper_amount_mm", label: "Depth taper amount", min: 0, max: 30, default: 10, description: "Maximum additive riser offset in mm. The depth curve applies this amount equally to every riser." },

    { key: "risers_on_both_sides", label: "Risers on both sides (0/1)", min: 0, max: 1, default: 1 },
    { key: "slot_clearance_between_surfaces", label: "Clearance between slot surfaces", min: 4, max: 80, default: 20 },
    { key: "base_slot_height", label: "Base slot height", min: 8, max: 100, default: 28 },
    { key: "slot_depth_y", label: "Slot depth", min: 8, max: 80, default: 24 },

    { key: "side_wall_x", label: "Side wall", min: 4, max: 40, default: 18 },
    { key: "back_wall_y", label: "Back wall", min: 4, max: 60, default: 20 },
    { key: "bottom_wall_z", label: "Bottom wall", min: 4, max: 40, default: 10 },
    { key: "top_wall_z", label: "Top wall", min: 4, max: 40, default: 10 },

    { key: "make_holes", label: "Make holes (0/1)", min: 0, max: 1, default: 1 },
    { key: "hole_width_x", label: "Hole width", min: 2, max: 30, default: 7 },
    { key: "hole_height_z", label: "Hole height", min: 2, max: 40, default: 12 },

    { key: "make_back_taper", label: "Back taper (0/1)", min: 0, max: 1, default: 1 },
    { key: "taper_top_inset", label: "Taper top inset", min: 0, max: 20, default: 5 },

    { key: "outer_fillet_r", label: "Outer fillet", min: 0, max: 8, default: 7.0 },
    { key: "slot_fillet_r", label: "Slot fillet", min: 0, max: 8, default: 2.0 },
    { key: "riser_fillet_r", label: "Riser fillet", min: 0, max: 8, default: 4.0 },
    { key: "hole_chamfer", label: "Hole chamfer", min: 0, max: 3, default: 0.5 },

    { key: "eps", label: "Boolean epsilon", min: 0.01, max: 1.0, default: 0.1 },
    { key: "boolean_fuzzy", label: "Boolean fuzzy", min: 0.0, max: 0.5, default: 0.1 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const bool01 = (v) => v >= 0.5;

  const slotCount = clamp(Math.round(p.slot_count || 4), 1, MAX_SLOTS);
  const mirrorRisers = bool01(p.risers_on_both_sides);

  const zoneWidths = getActiveValues(p, "slot_width_", slotCount, 6);
  const baseRiserHeights = getActiveValues(p, "riser_height_", slotCount, 0);
  const depthCurvePoints = parseCurvePoints(p.depth_taper_curve, DEFAULT_DEPTH_TAPER_CURVE);
  const depthSections = buildDepthSections(depthCurvePoints, p.depth_taper_amount_mm);

  const slotHeight = computeRequiredSlotHeight({
    baseSlotHeight: p.base_slot_height,
    slotClearanceBetweenSurfaces: p.slot_clearance_between_surfaces,
    baseRiserHeights,
    mirrorRisers,
    depthSections
  });

  const slotWidthX = zoneWidths.reduce((a, b) => a + b, 0);
  const blockWidthX = slotWidthX + 2 * p.side_wall_x;
  const blockDepthY = p.slot_depth_y + p.back_wall_y;
  const blockHeightZ = p.bottom_wall_z + slotHeight + p.top_wall_z;

  const slotX0 = p.side_wall_x;
  const slotY0 = 0;
  const slotZ0 = p.bottom_wall_z;

  const sectionProfiles = buildSectionProfiles({
    slotHeight,
    slotX0,
    slotZ0,
    zoneWidths,
    baseRiserHeights,
    mirrorRisers,
    depthSections
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
    slotHeight
  });

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

  const cavity = makeSlotCavityFromExactRoundedXZProfile(oc, {
    slotX0,
    slotZ0,
    slotHeight,
    zoneWidths,
    sectionProfiles,
    y0: slotY0 - p.eps,
    depthY: p.slot_depth_y + 2 * p.eps,
    filletR: p.slot_fillet_r
  });

  shape = booleanCutAdaptive(oc, shape, cavity, p.boolean_fuzzy);

  shape = tryLongitudinalSlotEdgeFillets(oc, shape, {
    radius: p.slot_fillet_r,
    slotX0,
    slotWidthX,
    slotY0,
    slotDepthY: p.slot_depth_y,
    slotZ0,
    slotHeight
  });

  shape = tryFrontAndBackProfileRollingBallFillets(oc, shape, {
    radius: p.riser_fillet_r,
    slotX0,
    slotWidthX,
    slotY0,
    slotDepthY: p.slot_depth_y,
    slotZ0,
    slotHeight
  });

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

  if (p.outer_fillet_r > 0.05) {
    shape = tryOuterBodyFilletLast(oc, shape, {
      radius: p.outer_fillet_r,
      blockWidthX,
      blockDepthY,
      blockHeightZ
    });
  }

  return shape;
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

function computeRequiredSlotHeight(d) {
  let maxCombinedInward = 0;

  for (const section of d.depthSections) {
    const sectionHeights = d.baseRiserHeights.map((h) => Math.max(0, h + section.delta));
    const bottomMax = sectionHeights.length > 0 ? Math.max(...sectionHeights) : 0;
    const topMax = d.mirrorRisers ? bottomMax : 0;
    maxCombinedInward = Math.max(maxCombinedInward, bottomMax + topMax);
  }

  return Math.max(
    d.baseSlotHeight,
    d.slotClearanceBetweenSurfaces + maxCombinedInward
  );
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
  if (p.taper_top_inset > Math.min(p.side_wall_x, p.top_wall_z + p.bottom_wall_z)) {
    console.warn("taper_top_inset is aggressive for the current body size and can destabilize later booleans.");
  }

  const minDelta = Math.min(...d.depthSections.map((s) => s.delta));
  const maxDelta = Math.max(...d.depthSections.map((s) => s.delta));
  const minResultingHeight = Math.min(
    ...d.depthSections.flatMap((section) => d.baseRiserHeights.map((height) => height + section.delta))
  );

  if (minResultingHeight <= 0) {
    console.warn("Depth taper pushes at least one riser to zero height. Reduce the taper amount or raise the curve if you want every riser to stay stepped.");
  }

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

  if (p.riser_fillet_r > 0.05 && limitingLengths.length > 0) {
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

function makeSlotCavityFromExactRoundedXZProfile(oc, d) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);

  for (const section of d.sectionProfiles) {
    const primitives = buildRoundedOrthogonalPrimitivesXZ(section.profilePoints, d.filletR);
    const y = d.y0 + d.depthY * section.t;
    mk.AddWire(makeExactWireXZAtY(oc, primitives, y));
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
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

function buildRoundedOrthogonalPrimitivesXZ(pts, radius) {
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

    const r = Math.min(radius, 0.499 * l1, 0.499 * l2);
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
    return makeArcEdgeXZAtY(oc, pr.p0, pr.pm, pr.p1, y);
  });

  return makeWireFromEdges(oc, edges);
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
    slotHeight: d.slotHeight
  });

  out = tryProfilePlaneRollingBallFillet(oc, out, {
    label: "back",
    radius: d.radius,
    targetY: d.slotY0 + d.slotDepthY,
    slotX0: d.slotX0,
    slotWidthX: d.slotWidthX,
    slotZ0: d.slotZ0,
    slotHeight: d.slotHeight
  });

  return out;
}

function tryProfilePlaneRollingBallFillet(oc, shape, d) {
  const radii = [d.radius, 0.75 * d.radius, 0.5 * d.radius, 0.25 * d.radius];
  const yTol = 0.35;
  const pad = 0.35;

  for (const r of radii) {
    if (r <= 0.05) continue;

    try {
      const mk = new oc.BRepFilletAPI_MakeFillet(
        shape,
        oc.ChFi3d_FilletShape.ChFi3d_Rational
      );

      const exp = new oc.TopExp_Explorer_2(
        shape,
        oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );

      let count = 0;

      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());

        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);

        const c = props.CentreOfMass();
        const len = props.Mass();

        const nearProfilePlane = Math.abs(c.Y() - d.targetY) <= yTol;
        const insideSlotBoxX = c.X() >= d.slotX0 - pad && c.X() <= d.slotX0 + d.slotWidthX + pad;
        const insideSlotBoxZ = c.Z() >= d.slotZ0 - pad && c.Z() <= d.slotZ0 + d.slotHeight + pad;
        const usableLength = len > 0.15;

        if (nearProfilePlane && insideSlotBoxX && insideSlotBoxZ && usableLength) {
          mk.Add_2(r, edge);
          count++;
        }

        exp.Next();
      }

      if (count === 0) {
        console.warn(`No ${d.label} slot-profile edges matched for rolling-ball fillet.`);
        return shape;
      }

      mk.Build(oc.createProgressRange());

      if (mk.IsDone()) {
        return mk.Shape();
      }
    } catch (e) {
    }
  }

  console.warn(`${d.label[0].toUpperCase() + d.label.slice(1)} slot-profile rolling-ball fillet failed. Reduce riser_fillet_r.`);
  return shape;
}

function tryLongitudinalSlotEdgeFillets(oc, shape, d) {
  if (d.radius <= 0.05) return shape;

  const radii = [d.radius, 0.75 * d.radius, 0.5 * d.radius, 0.25 * d.radius];
  const pad = Math.max(0.35, 0.5 * d.radius);
  const yInnerMin = d.slotY0 + Math.max(0.8, 0.12 * d.slotDepthY);
  const yInnerMax = d.slotY0 + d.slotDepthY - Math.max(0.8, 0.12 * d.slotDepthY);

  for (const r of radii) {
    if (r <= 0.05) continue;

    try {
      const mk = new oc.BRepFilletAPI_MakeFillet(
        shape,
        oc.ChFi3d_FilletShape.ChFi3d_Rational
      );

      const exp = new oc.TopExp_Explorer_2(
        shape,
        oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );

      let count = 0;

      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const bbox = new oc.Bnd_Box_1();
        oc.BRepBndLib.Add(edge, bbox, false);

        const min = bbox.CornerMin();
        const max = bbox.CornerMax();
        const dx = max.X() - min.X();
        const dy = max.Y() - min.Y();
        const dz = max.Z() - min.Z();
        const cx = 0.5 * (min.X() + max.X());
        const cy = 0.5 * (min.Y() + max.Y());
        const cz = 0.5 * (min.Z() + max.Z());

        const insideSlotBoxX = cx >= d.slotX0 - pad && cx <= d.slotX0 + d.slotWidthX + pad;
        const insideSlotBoxZ = cz >= d.slotZ0 - pad && cz <= d.slotZ0 + d.slotHeight + pad;
        const insideDepthInterior = cy >= yInnerMin && cy <= yInnerMax;
        const longitudinalEnough = dy >= Math.max(1.0, 0.45 * d.slotDepthY);
        const notMostlyCrosswise = dy >= 1.5 * Math.max(dx, dz);

        if (insideSlotBoxX && insideSlotBoxZ && insideDepthInterior && longitudinalEnough && notMostlyCrosswise) {
          mk.Add_2(r, edge);
          count++;
        }

        exp.Next();
      }

      if (count === 0) {
        return shape;
      }

      mk.Build(oc.createProgressRange());

      if (mk.IsDone()) {
        return mk.Shape();
      }
    } catch (e) {
    }
  }

  console.warn("Longitudinal slot fillet failed. Reduce slot_fillet_r.");
  return shape;
}

function tryOuterBodyFilletLast(oc, shape, d) {
  const radii = [d.radius, 0.75 * d.radius, 0.5 * d.radius, 0.25 * d.radius];
  const tol = 0.6;

  for (const r of radii) {
    if (r <= 0.05) continue;

    try {
      const mk = new oc.BRepFilletAPI_MakeFillet(
        shape,
        oc.ChFi3d_FilletShape.ChFi3d_Rational
      );

      const exp = new oc.TopExp_Explorer_2(
        shape,
        oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );

      let count = 0;

      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());

        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);

        const c = props.CentreOfMass();

        const nearOuterX = c.X() < tol || c.X() > d.blockWidthX - tol;
        const nearOuterY = c.Y() < tol || c.Y() > d.blockDepthY - tol;
        const nearOuterZ = c.Z() < tol || c.Z() > d.blockHeightZ - tol;

        const hits =
          (nearOuterX ? 1 : 0) +
          (nearOuterY ? 1 : 0) +
          (nearOuterZ ? 1 : 0);

        if (hits >= 2) {
          mk.Add_2(r, edge);
          count++;
        }

        exp.Next();
      }

      if (count === 0) {
        console.warn("No outer body edges matched for exterior fillet.");
        return shape;
      }

      mk.Build(oc.createProgressRange());

      if (mk.IsDone()) {
        return mk.Shape();
      }
    } catch (e) {
    }
  }

  console.warn("Outer body fillet failed. Reduce outer_fillet_r.");
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
