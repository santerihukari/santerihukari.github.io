const PROFILE_OPTIONS = [
  {
    value: "circle",
    label: "Full circle",
    description: "Use a true circular section. Twist has almost no visible effect with a perfect circle."
  },
  ...Array.from({ length: 14 }, (_, index) => {
    const sides = index + 3;
    return {
      value: sides,
      label: `${sides} sides`,
      description: `Quantize the profile to a ${sides}-sided polygon so rotation becomes visible in the loft.`
    };
  })
];

const DEFAULT_RADIUS_CURVE = "0.000,35.000|0.500,50.000|1.000,30.000";
const DEFAULT_EDGE_CURVE = "0.000,0.000|0.250,0.000|0.500,0.000|0.750,0.000|1.000,0.000";

export const meta = {
  name: "Spline Twisted Vase",
  description: "Twisted vase variant with both a height-radius spline and a per-side edge-shaping spline for polygonal profiles.",
  tessellation: {
    linearDeflection: 0.08,
    angularDeflection: 0.12
  },
  params: [
    {
      key: "profile_sides",
      label: "Profile shape",
      type: "select",
      default: "circle",
      description: "Choose whether each cross-section is a smooth circle or a polygonal approximation.",
      options: PROFILE_OPTIONS
    },
    {
      key: "radius_curve",
      label: "Height radius profile",
      type: "curve",
      default: DEFAULT_RADIUS_CURVE,
      yMin: 8,
      yMax: 120,
      xLabel: "Base -> top",
      yLabel: "Radius (mm)",
      height: 118,
      columnSpan: "full",
      description: "Drag the outer radius profile over the height of the vase."
    },
    {
      key: "edge_curve",
      label: "Per-side edge profile",
      type: "curve",
      default: DEFAULT_EDGE_CURVE,
      yMin: -12,
      yMax: 12,
      xLabel: "Corner -> next corner",
      yLabel: "Edge offset (mm)",
      height: 118,
      columnSpan: "full",
      visibleIf: { key: "profile_sides", op: "!=", value: "circle" },
      description: "Shapes each polygon edge between its two corners. Positive values bulge outward and negative values pull inward."
    },
    { key: "height", label: "Height", min: 20, max: 300, default: 100 },
    {
      key: "twist",
      label: "Total twist angle",
      min: 0,
      max: 360,
      default: 45,
      description: "Twist accumulates from base to top."
    },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 8, default: 2 },
    {
      key: "edge_samples_per_side",
      label: "Edge samples/side",
      min: 2,
      max: 24,
      default: 10,
      visibleIf: { key: "profile_sides", op: "!=", value: "circle" },
      description: "Higher values follow the edge spline more closely."
    },
    { key: "section_count", label: "Loft sections", min: 3, max: 40, default: 20, description: "More sections follow the spline more closely but are heavier to build." }
  ]
};

export function build(oc, params) {
  const profileSides =
    params.profile_sides === "circle"
      ? "circle"
      : Math.max(3, Math.round(Number(params.profile_sides) || 6));

  const height = Math.max(20, Number(params.height) || 100);
  const wallT = Math.max(0.5, Number(params.wall_t) || 2);
  const totalTwist = Number(params.twist) || 0;
  const sectionCount = Math.max(3, Math.round(Number(params.section_count) || 20));
  const radiusCurve = parseCurvePoints(params.radius_curve, DEFAULT_RADIUS_CURVE, 8, 120);
  const edgeCurve = parseCurvePoints(params.edge_curve, DEFAULT_EDGE_CURVE, -12, 12);
  const requestedEdgeSamplesPerSide = Math.max(2, Math.round(Number(params.edge_samples_per_side) || 10));
  const edgeSamplesPerSide = Math.max(
    requestedEdgeSamplesPerSide,
    2 * Math.max(2, edgeCurve.length - 1)
  );

  const outer = makeVasePart(oc, {
    profileSides,
    height,
    wallOffset: 0,
    zOffset: 0,
    totalTwist,
    sectionCount,
    radiusCurve,
    edgeCurve,
    edgeSamplesPerSide
  });

  const inner = makeVasePart(oc, {
    profileSides,
    height,
    wallOffset: -wallT,
    zOffset: wallT,
    totalTwist,
    sectionCount,
    radiusCurve,
    edgeCurve,
    edgeSamplesPerSide
  });

  const op = new oc.BRepAlgoAPI_Cut_3(outer, inner, oc.createProgressRange());
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : outer;
}

function makeVasePart(oc, d) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);

  for (let index = 0; index < d.sectionCount; index += 1) {
    const t = d.sectionCount <= 1 ? 0 : index / (d.sectionCount - 1);
    const z = d.zOffset + (d.height - d.zOffset) * t;
    const radius = Math.max(0.5, evaluateCurve(d.radiusCurve, t) + d.wallOffset);
    const angle = d.totalTwist * t;
    mk.AddWire(
      oc.TopoDS.Wire_1(
        makeSectionWire(
          oc,
          d.profileSides,
          radius,
          z,
          angle,
          d.edgeCurve,
          d.edgeSamplesPerSide
        )
      )
    );
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeSectionWire(oc, profileSides, radius, z, angle, edgeCurve, edgeSamplesPerSide) {
  const angleRad = (angle * Math.PI) / 180;

  if (profileSides !== "circle") {
    const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
    const points = buildPolygonEdgeProfilePoints({
      sides: profileSides,
      radius,
      angleRad,
      edgeCurve,
      edgeSamplesPerSide
    });

    points.forEach((point) => {
      polygon.Add_1(new oc.gp_Pnt_3(point.x, point.y, z));
    });
    polygon.Close();
    return polygon.Wire();
  }

  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(0, 0, z),
    new oc.gp_Dir_4(0, 0, 1),
    new oc.gp_Dir_4(1, 0, 0)
  );

  const circ = new oc.gp_Circ_2(ax, radius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
  const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();

  if (Math.abs(angle) <= 1e-9) return wire;

  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, z), new oc.gp_Dir_4(0, 0, 1)),
    angleRad
  );
  return new oc.BRepBuilderAPI_Transform_2(wire, trsf, true).Shape();
}

function buildPolygonEdgeProfilePoints(d) {
  const points = [];

  for (let sideIndex = 0; sideIndex < d.sides; sideIndex += 1) {
    const theta0 = d.angleRad + (sideIndex * Math.PI * 2) / d.sides;
    const theta1 = d.angleRad + ((sideIndex + 1) * Math.PI * 2) / d.sides;
    const p0 = { x: Math.cos(theta0) * d.radius, y: Math.sin(theta0) * d.radius };
    const p1 = { x: Math.cos(theta1) * d.radius, y: Math.sin(theta1) * d.radius };
    const outward = normalize2({
      x: Math.cos(d.angleRad + ((sideIndex + 0.5) * Math.PI * 2) / d.sides),
      y: Math.sin(d.angleRad + ((sideIndex + 0.5) * Math.PI * 2) / d.sides)
    });

    for (let sampleIndex = 0; sampleIndex < d.edgeSamplesPerSide; sampleIndex += 1) {
      const u = sampleIndex / d.edgeSamplesPerSide;
      const base = lerpPoint2(p0, p1, u);
      const envelope = Math.sin(Math.PI * u);
      const offset = clamp(
        evaluateCurve(d.edgeCurve, u),
        -0.8 * d.radius * Math.cos(Math.PI / d.sides),
        0.6 * d.radius
      ) * envelope;
      points.push({
        x: base.x + outward.x * offset,
        y: base.y + outward.y * offset
      });
    }
  }

  return points;
}

function parseCurvePoints(rawValue, fallbackValue, yMin, yMax) {
  const fallbackPoints = parseCurveTokens(fallbackValue);
  const parsedPoints = parseCurveTokens(rawValue);
  const source = parsedPoints.length ? parsedPoints : fallbackPoints;
  return normalizeCurvePoints(
    source.length ? source : [{ x: 0, y: 35 }, { x: 1, y: 35 }],
    yMin,
    yMax
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

function normalizeCurvePoints(points, yMin, yMax) {
  const normalized = points
    .map((point) => ({
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, yMin, yMax)
    }))
    .sort((a, b) => a.x - b.x);

  const deduped = [];
  for (const point of normalized) {
    const previous = deduped[deduped.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 1e-6) {
      previous.y = point.y;
    } else {
      deduped.push({ ...point });
    }
  }

  if (!deduped.length) {
    return [
      { x: 0, y: clamp(35, yMin, yMax) },
      { x: 1, y: clamp(35, yMin, yMax) }
    ];
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
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  if (u <= points[0].x) return points[0].y;
  if (u >= points[points.length - 1].x) return points[points.length - 1].y;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const p1 = points[index];
    const p2 = points[index + 1];
    if (u < p1.x || u > p2.x) continue;

    const p0 = points[Math.max(0, index - 1)];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const segmentWidth = Math.max(1e-9, p2.x - p1.x);
    const localT = (u - p1.x) / segmentWidth;
    const m1 = ((p2.y - p0.y) / Math.max(1e-9, p2.x - p0.x)) * segmentWidth;
    const m2 = ((p3.y - p1.y) / Math.max(1e-9, p3.x - p1.x)) * segmentWidth;
    const t2 = localT * localT;
    const t3 = t2 * localT;

    return clamp((
      (2 * t3 - 3 * t2 + 1) * p1.y +
      (t3 - 2 * t2 + localT) * m1 +
      (-2 * t3 + 3 * t2) * p2.y +
      (t3 - t2) * m2
    ), minY, maxY);
  }

  return points[points.length - 1].y;
}

function lerpPoint2(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function normalize2(v) {
  const length = Math.hypot(v.x, v.y);
  if (length <= 1e-9) return { x: 1, y: 0 };
  return { x: v.x / length, y: v.y / length };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
