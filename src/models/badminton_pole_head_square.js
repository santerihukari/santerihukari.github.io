import {
  booleanCut,
  booleanFuse,
  clamp,
  makeRoundedRectPrism,
  tryFilletEdges
} from "./cad_utils.js";

export const meta = {
  name: "Badminton Pole Head (Square)",
  description:
    "Rounded-rectangle badminton pole head with a half-cylinder top aligned to the groove axis and an elliptical-path groove cut only into that top piece.",
  tessellation: { linearDeflection: 0.06, angularDeflection: 0.08 },
  params: [
    { key: "body_w", label: "Body width", min: 10, max: 120, default: 34.8 },
    { key: "body_d", label: "Body depth", min: 10, max: 120, default: 34.8 },
    {
      key: "body_corner_r",
      label: "Body corner radius",
      min: 0,
      max: 10,
      default: 1,
      description:
        "Corner radius for the rectangular shaft section. Real square-ish badminton poles usually still have a bit of corner rounding."
    },
    { key: "h", label: "Body height", min: 5, max: 160, default: 15 },
    {
      key: "d_ball",
      label: "Half-cylinder minimum width",
      min: 10,
      max: 120,
      default: 42.8,
      description:
        "Minimum plan-view width used for the half-cylinder in both X and Y directions before scaling."
    },
    {
      key: "h_ball",
      label: "Half-cylinder height",
      min: 1,
      max: 60,
      default: 10,
      description:
        "Vertical height of the half-cylinder above the square shaft before scaling."
    },
    {
      key: "head_overhang_xy",
      label: "Half-cylinder XY overhang",
      min: 0,
      max: 30,
      default: 0,
      description:
        "Extra overhang added beyond the base in both X and Y directions. The half-cylinder becomes base size plus twice this value in each plan direction, unless the minimum width is larger."
    },
    {
      key: "head_lateral_scale",
      label: "Half-cylinder lateral scale",
      min: 0.2,
      max: 3,
      default: 1,
      description:
        "Scales the half-cylinder width perpendicular to its axis."
    },
    {
      key: "head_vertical_scale",
      label: "Half-cylinder vertical scale",
      min: 0.2,
      max: 3,
      default: 1,
      description:
        "Scales the half-cylinder height in Z."
    },
    {
      key: "groove_center_r",
      label: "Groove radial offset",
      min: -20,
      max: 20,
      default: 0,
      description:
        "Offset from the half-cylinder radius before groove scaling. Default 0 makes the groove follow the half-cylinder size directly."
    },
    {
      key: "groove_axis",
      label: "Groove revolve axis",
      type: "select",
      default: "x",
      description: "Choose which horizontal axis the groove profile revolves around.",
      options: [
        { value: "x", label: "X axis", description: "Revolve the groove around a horizontal axis parallel to X." },
        { value: "y", label: "Y axis", description: "Revolve the groove around a horizontal axis parallel to Y." }
      ]
    },
    {
      key: "groove_z",
      label: "Groove axis Z",
      min: 0,
      max: 60,
      default: 0,
      description:
        "Height of the horizontal groove axis above the half-cylinder base plane at z = h."
    },
    {
      key: "groove_profile_d",
      label: "Groove profile diameter",
      min: 0.5,
      max: 30,
      default: 8,
      description:
        "Diameter of the groove tube itself. This controls groove thickness, not the size of the elliptical path it follows."
    },
    {
      key: "groove_y_scale",
      label: "Groove ellipse cross-axis scale",
      min: 0.2,
      max: 3,
      default: 1.3,
      description:
        "Adjusts how much larger or smaller the groove ellipse is sideways compared with the half-cylinder. With X-axis revolve this affects Y; with Y-axis revolve this affects X. A value of 1 matches the half-cylinder."
    },
    {
      key: "groove_z_scale",
      label: "Groove ellipse Z scale",
      min: 0.2,
      max: 3,
      default: 1,
      description:
        "Adjusts how tall the groove ellipse is in Z compared with the half-cylinder height. A value of 1 matches the half-cylinder."
    },
    {
      key: "side_relief_inset",
      label: "Side relief inset",
      min: 0,
      max: 60,
      default: 0,
      description:
        "Cuts angled relief planes into the half-cylinder sides, starting from the lowest outer edge and sloping inward toward the groove."
    },
    {
      key: "edge_fillet_r",
      label: "Edge fillet radius",
      min: 0,
      max: 4,
      default: 1,
      description: "Best-effort fillet applied to the final body after the groove cut."
    }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const bodyWidth = Math.max(0.5, Number(p.body_w) || 34.8);
  const bodyDepth = Math.max(0.5, Number(p.body_d) || 34.8);
  const bodyHeight = Math.max(1, Number(p.h) || 15);
  const bodyCornerRadius = clamp(
    Number(p.body_corner_r) || 0,
    0,
    0.5 * Math.min(bodyWidth, bodyDepth) - 0.01
  );
  const headOverhang = Math.max(0, Number(p.head_overhang_xy) || 0);
  const headLateralScale = Math.max(0.2, Number(p.head_lateral_scale) || 1);
  const headVerticalScale = Math.max(0.2, Number(p.head_vertical_scale) || 1);
  const grooveAxis = p.groove_axis === "y" ? "y" : "x";
  const baseSpanAlongAxis = grooveAxis === "x" ? bodyWidth : bodyDepth;
  const baseSpanCrossAxis = grooveAxis === "x" ? bodyDepth : bodyWidth;
  const minHeadWidth = Math.max(0.5, Number(p.d_ball) || 42.8);
  const headSpanLength =
    Math.max(minHeadWidth, baseSpanAlongAxis + 2 * headOverhang) * headLateralScale;
  const headCrossWidth =
    Math.max(minHeadWidth, baseSpanCrossAxis + 2 * headOverhang) * headLateralScale;
  const headLateralRadius = Math.max(
    0.5,
    0.5 * headCrossWidth
  );
  const headVerticalRadius = Math.max(
    0.5,
    (Number(p.h_ball) || 10) * headVerticalScale
  );
  const grooveProfileRadius = Math.max(0.25, p.groove_profile_d / 2);
  const grooveAxisZ = bodyHeight + clamp(p.groove_z, 0, headVerticalRadius);
  const grooveBasePathRadius = Math.max(
    grooveProfileRadius + 0.2,
    headLateralRadius + (Number(p.groove_center_r) || 0)
  );
  const grooveLateralScale = Math.max(0.2, Number(p.groove_y_scale) || 1);
  const grooveLateralInfluence = Math.max(grooveProfileRadius, 0.35 * headLateralRadius);
  const grooveLateralPathRadius = Math.max(
    grooveProfileRadius + 0.2,
    grooveBasePathRadius + (grooveLateralScale - 1) * grooveLateralInfluence
  );
  const grooveVerticalScale = Math.max(0.2, Number(p.groove_z_scale) || 1);
  const grooveVerticalInfluence = Math.max(grooveProfileRadius, 0.5 * headVerticalRadius);
  const grooveVerticalPathRadius = Math.max(
    grooveProfileRadius + 0.2,
    headVerticalRadius + (grooveVerticalScale - 1) * grooveVerticalInfluence
  );

  let shape = makeRoundedRectPrism(
    oc,
    bodyWidth,
    bodyDepth,
    bodyHeight,
    bodyCornerRadius,
    0,
    0,
    0
  );

  let topBoss = makeHalfCylinderTop(
    oc,
    grooveAxis,
    headSpanLength,
    headLateralRadius,
    headVerticalRadius,
    bodyHeight
  );
  topBoss = applyHalfCylinderSideRelief(
    oc,
    topBoss,
    grooveAxis,
    headSpanLength,
    headLateralRadius,
    headVerticalRadius,
    bodyHeight,
    Math.max(0, Number(p.side_relief_inset) || 0)
  );
  const grooveCutter = makeEllipticalGrooveCutter(
    oc,
    grooveAxis,
    grooveAxisZ,
    grooveLateralPathRadius,
    grooveVerticalPathRadius,
    grooveProfileRadius
  );

  topBoss = booleanCut(oc, topBoss, grooveCutter);
  shape = booleanFuse(oc, shape, topBoss);
  shape = tryFilletEdges(
    oc,
    shape,
    Math.max(0, Number(p.edge_fillet_r) || 0),
    (center) => center.Z() >= bodyHeight + 0.1
  );
  return shape;
}

function applyHalfCylinderSideRelief(
  oc,
  shape,
  axisKey,
  spanLength,
  lateralRadius,
  verticalRadius,
  zBase,
  reliefInset
) {
  if (!shape || reliefInset <= 0.05) return shape;
  const maxInset = Math.max(0, 2 * lateralRadius - 0.8);
  const inset = Math.min(reliefInset, maxInset);
  if (inset <= 0.05) return shape;

  let relieved = shape;
  relieved = booleanCut(
    oc,
    relieved,
    axisKey === "x"
      ? makeSideReliefPrismAlongY(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, 1)
      : makeSideReliefPrismAlongX(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, 1)
  );
  relieved = booleanCut(
    oc,
    relieved,
    axisKey === "x"
      ? makeSideReliefPrismAlongY(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, -1)
      : makeSideReliefPrismAlongX(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, -1)
  );
  return relieved;
}

function makeHalfCylinderTop(oc, axisKey, spanLength, lateralRadius, verticalRadius, zBase) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  if (typeof mk.CheckCompatibility === "function") mk.CheckCompatibility(false);

  if (axisKey === "y") {
    mk.AddWire(
      asTopoDSWire(
        oc,
        makeSemiEllipseWireXZAtY(oc, -0.5 * spanLength, lateralRadius, verticalRadius, zBase)
      )
    );
    mk.AddWire(
      asTopoDSWire(
        oc,
        makeSemiEllipseWireXZAtY(oc, 0.5 * spanLength, lateralRadius, verticalRadius, zBase)
      )
    );
  } else {
    mk.AddWire(
      asTopoDSWire(
        oc,
        makeSemiEllipseWireYZAtX(oc, -0.5 * spanLength, lateralRadius, verticalRadius, zBase)
      )
    );
    mk.AddWire(
      asTopoDSWire(
        oc,
        makeSemiEllipseWireYZAtX(oc, 0.5 * spanLength, lateralRadius, verticalRadius, zBase)
      )
    );
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeSideReliefPrismAlongX(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, sign) {
  const sideMargin = 4;
  const topMargin = 1.5;
  const topZ = zBase + verticalRadius + topMargin;
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  polygon.Add_1(new oc.gp_Pnt_3(-0.5 * spanLength - sideMargin, sign * lateralRadius, zBase));
  polygon.Add_1(new oc.gp_Pnt_3(-0.5 * spanLength - sideMargin, sign * (lateralRadius + sideMargin), zBase));
  polygon.Add_1(
    new oc.gp_Pnt_3(-0.5 * spanLength - sideMargin, sign * (lateralRadius + sideMargin), topZ)
  );
  polygon.Add_1(
    new oc.gp_Pnt_3(-0.5 * spanLength - sideMargin, sign * (lateralRadius - inset), topZ)
  );
  polygon.Close();
  const face = new oc.BRepBuilderAPI_MakeFace_15(polygon.Wire(), false).Shape();
  const vec = new oc.gp_Vec_4(spanLength + 2 * sideMargin, 0, 0);
  return new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true).Shape();
}

function makeSideReliefPrismAlongY(oc, spanLength, lateralRadius, verticalRadius, zBase, inset, sign) {
  const sideMargin = 4;
  const topMargin = 1.5;
  const topZ = zBase + verticalRadius + topMargin;
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  polygon.Add_1(new oc.gp_Pnt_3(sign * lateralRadius, -0.5 * spanLength - sideMargin, zBase));
  polygon.Add_1(new oc.gp_Pnt_3(sign * (lateralRadius + sideMargin), -0.5 * spanLength - sideMargin, zBase));
  polygon.Add_1(
    new oc.gp_Pnt_3(sign * (lateralRadius + sideMargin), -0.5 * spanLength - sideMargin, topZ)
  );
  polygon.Add_1(
    new oc.gp_Pnt_3(sign * (lateralRadius - inset), -0.5 * spanLength - sideMargin, topZ)
  );
  polygon.Close();
  const face = new oc.BRepBuilderAPI_MakeFace_15(polygon.Wire(), false).Shape();
  const vec = new oc.gp_Vec_4(0, spanLength + 2 * sideMargin, 0);
  return new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true).Shape();
}

function makeSemiEllipseWireYZAtX(oc, x, lateralRadius, verticalRadius, zBase) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  const sampleCount = 36;
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = Math.PI - (Math.PI * index) / sampleCount;
    polygon.Add_1(
      new oc.gp_Pnt_3(
        x,
        lateralRadius * Math.cos(t),
        zBase + verticalRadius * Math.sin(t)
      )
    );
  }
  polygon.Close();
  return polygon.Wire();
}

function makeSemiEllipseWireXZAtY(oc, y, lateralRadius, verticalRadius, zBase) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  const sampleCount = 36;
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = Math.PI - (Math.PI * index) / sampleCount;
    polygon.Add_1(
      new oc.gp_Pnt_3(
        lateralRadius * Math.cos(t),
        y,
        zBase + verticalRadius * Math.sin(t)
      )
    );
  }
  polygon.Close();
  return polygon.Wire();
}

function makeEllipticalGrooveCutter(
  oc,
  axisKey,
  axisZ,
  lateralPathRadius,
  verticalPathRadius,
  profileRadius
) {
  const pipe = tryMakePipeAlongEllipticalPath(
    oc,
    axisKey,
    axisZ,
    lateralPathRadius,
    verticalPathRadius,
    profileRadius
  );
  if (pipe) return pipe;
  return makeLoftedEllipticalTube(
    oc,
    axisKey,
    axisZ,
    lateralPathRadius,
    verticalPathRadius,
    profileRadius
  );
}

function makeSemiEllipseArcEdgeXZ(oc, radiusXY, heightZ, zBase) {
  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(0, 0, zBase),
    new oc.gp_Dir_4(0, -1, 0),
    new oc.gp_Dir_4(1, 0, 0)
  );
  const ellipse = new oc.gp_Elips_2(ax, radiusXY, heightZ);
  const arc = new oc.GC_MakeArcOfEllipse_1(ellipse, 0, Math.PI / 2, true);
  const hCurve = new oc.Handle_Geom_Curve_2(arc.Value().get());
  return new oc.BRepBuilderAPI_MakeEdge_24(hCurve).Edge();
}

function makeFullEllipseWireXZ(oc, centerX, centerZ, radiusX, radiusZ) {
  const ellipse = makeXZEllipse(oc, centerX, centerZ, radiusX, radiusZ);
  const upperArc = new oc.GC_MakeArcOfEllipse_1(ellipse, 0, Math.PI, true);
  const lowerArc = new oc.GC_MakeArcOfEllipse_1(ellipse, Math.PI, 2 * Math.PI, true);
  const upperEdge = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(upperArc.Value().get())
  ).Edge();
  const lowerEdge = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(lowerArc.Value().get())
  ).Edge();
  return makeWireFromEdges(oc, [upperEdge, lowerEdge]);
}

function makeFullEllipseWireYZ(oc, centerY, centerZ, radiusY, radiusZ) {
  const ellipse = makeYZEllipse(oc, centerY, centerZ, radiusY, radiusZ);
  const upperArc = new oc.GC_MakeArcOfEllipse_1(ellipse, 0, Math.PI, true);
  const lowerArc = new oc.GC_MakeArcOfEllipse_1(ellipse, Math.PI, 2 * Math.PI, true);
  const upperEdge = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(upperArc.Value().get())
  ).Edge();
  const lowerEdge = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(lowerArc.Value().get())
  ).Edge();
  return makeWireFromEdges(oc, [upperEdge, lowerEdge]);
}

function makeXZEllipse(oc, centerX, centerZ, radiusX, radiusZ) {
  if (radiusX >= radiusZ) {
    const ax = new oc.gp_Ax2_2(
      new oc.gp_Pnt_3(centerX, 0, centerZ),
      new oc.gp_Dir_4(0, -1, 0),
      new oc.gp_Dir_4(1, 0, 0)
    );
    return new oc.gp_Elips_2(ax, radiusX, radiusZ);
  }

  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(centerX, 0, centerZ),
    new oc.gp_Dir_4(0, 1, 0),
    new oc.gp_Dir_4(0, 0, 1)
  );
  return new oc.gp_Elips_2(ax, radiusZ, radiusX);
}

function makeYZEllipse(oc, centerY, centerZ, radiusY, radiusZ) {
  if (radiusY >= radiusZ) {
    const ax = new oc.gp_Ax2_2(
      new oc.gp_Pnt_3(0, centerY, centerZ),
      new oc.gp_Dir_4(1, 0, 0),
      new oc.gp_Dir_4(0, 1, 0)
    );
    return new oc.gp_Elips_2(ax, radiusY, radiusZ);
  }

  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(0, centerY, centerZ),
    new oc.gp_Dir_4(-1, 0, 0),
    new oc.gp_Dir_4(0, 0, 1)
  );
  return new oc.gp_Elips_2(ax, radiusZ, radiusY);
}

function revolveFullAroundZ(oc, shape) {
  const axis = new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Dir_4(0, 0, 1));
  return new oc.BRepPrimAPI_MakeRevol_2(shape, axis, false).Shape();
}

function makeLineEdge(oc, p0, p1) {
  return new oc.BRepBuilderAPI_MakeEdge_3(p0, p1).Edge();
}

function makeCircleWireXYAtZ(oc, radius, z) {
  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(0, 0, z),
    new oc.gp_Dir_4(0, 0, 1),
    new oc.gp_Dir_4(1, 0, 0)
  );
  const circ = new oc.gp_Circ_2(ax, radius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
  return new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
}

function makeCirclePrismZ(oc, radius, z0, z1) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(asTopoDSWire(oc, makeCircleWireXYAtZ(oc, radius, z0)));
  mk.AddWire(asTopoDSWire(oc, makeCircleWireXYAtZ(oc, radius, z1)));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeRoundedRectWireXYAtZ(oc, width, depth, z, radius) {
  const r = clamp(radius, 0, 0.5 * Math.min(width, depth) - 0.01);
  const x0 = -0.5 * width;
  const y0 = -0.5 * depth;
  const x1 = 0.5 * width;
  const y1 = 0.5 * depth;

  if (r <= 0.01) {
    const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
    polygon.Add_1(new oc.gp_Pnt_3(x0, y0, z));
    polygon.Add_1(new oc.gp_Pnt_3(x1, y0, z));
    polygon.Add_1(new oc.gp_Pnt_3(x1, y1, z));
    polygon.Add_1(new oc.gp_Pnt_3(x0, y1, z));
    polygon.Close();
    return polygon.Wire();
  }

  const edges = [];
  edges.push(makeLineEdge(oc, new oc.gp_Pnt_3(x0 + r, y0, z), new oc.gp_Pnt_3(x1 - r, y0, z)));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - r, y0 + r, r, -Math.PI / 2, 0, z));
  edges.push(makeLineEdge(oc, new oc.gp_Pnt_3(x1, y0 + r, z), new oc.gp_Pnt_3(x1, y1 - r, z)));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - r, y1 - r, r, 0, Math.PI / 2, z));
  edges.push(makeLineEdge(oc, new oc.gp_Pnt_3(x1 - r, y1, z), new oc.gp_Pnt_3(x0 + r, y1, z)));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + r, y1 - r, r, Math.PI / 2, Math.PI, z));
  edges.push(makeLineEdge(oc, new oc.gp_Pnt_3(x0, y1 - r, z), new oc.gp_Pnt_3(x0, y0 + r, z)));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, z));
  return makeWireFromEdges(oc, edges);
}

function makeArcEdgeXYAtZ(oc, cx, cy, radius, startAngle, endAngle, z) {
  const p0 = new oc.gp_Pnt_3(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle), z);
  const pm = new oc.gp_Pnt_3(
    cx + radius * Math.cos(0.5 * (startAngle + endAngle)),
    cy + radius * Math.sin(0.5 * (startAngle + endAngle)),
    z
  );
  const p1 = new oc.gp_Pnt_3(cx + radius * Math.cos(endAngle), cy + radius * Math.sin(endAngle), z);
  const arcMaker = new oc.GC_MakeArcOfCircle_4(p0, pm, p1);
  const hCurve = new oc.Handle_Geom_Curve_2(arcMaker.Value().get());
  return new oc.BRepBuilderAPI_MakeEdge_24(hCurve).Edge();
}

function makeWireFromEdges(oc, edges) {
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
  edges.forEach((edge) => {
    if (typeof wireBuilder.Add_1 === "function") wireBuilder.Add_1(edge);
    else wireBuilder.Add(edge);
  });
  return wireBuilder.Wire();
}

function tryMakePipeAlongEllipticalPath(
  oc,
  axisKey,
  axisZ,
  lateralPathRadius,
  verticalPathRadius,
  profileRadius
) {
  const spineWire =
    axisKey === "y"
      ? makeFullEllipseWireXZ(oc, 0, axisZ, lateralPathRadius, verticalPathRadius)
      : makeFullEllipseWireYZ(oc, 0, axisZ, lateralPathRadius, verticalPathRadius);
  const startCenter =
    axisKey === "y"
      ? { x: lateralPathRadius, y: 0, z: axisZ }
      : { x: 0, y: lateralPathRadius, z: axisZ };
  const sectionWire = makeCircleWireAtFrame(
    oc,
    startCenter,
    { x: 0, y: 0, z: 1 },
    axisKey === "y" ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 },
    profileRadius
  );
  const sectionFace = new oc.BRepBuilderAPI_MakeFace_15(sectionWire, false).Shape();
  const ctorCandidates = [
    oc.BRepOffsetAPI_MakePipe_1,
    oc.BRepOffsetAPI_MakePipe_2,
    oc.BRepOffsetAPI_MakePipe
  ].filter((ctor) => typeof ctor === "function");
  const profileCandidates = [sectionFace, sectionWire];

  for (const ctor of ctorCandidates) {
    for (const profile of profileCandidates) {
      try {
        const mk = new ctor(spineWire, profile);
        if (typeof mk.Build === "function") mk.Build(oc.createProgressRange());
        if (typeof mk.IsDone === "function" && !mk.IsDone()) continue;
        if (typeof mk.Shape === "function") return mk.Shape();
      } catch {
        // Fall through to the lofted fallback below.
      }
    }
  }

  return null;
}

function makeLoftedEllipticalTube(
  oc,
  axisKey,
  axisZ,
  lateralPathRadius,
  verticalPathRadius,
  profileRadius
) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  if (typeof mk.CheckCompatibility === "function") mk.CheckCompatibility(false);

  const sampleCount = 48;
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = (2 * Math.PI * index) / sampleCount;
    const frame = evaluateEllipticalPathFrame(
      axisKey,
      axisZ,
      lateralPathRadius,
      verticalPathRadius,
      t
    );
    const wire = makeCircleWireAtFrame(
      oc,
      frame.center,
      frame.normal,
      frame.xDir,
      profileRadius
    );
    mk.AddWire(asTopoDSWire(oc, wire));
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function evaluateEllipticalPathFrame(axisKey, axisZ, lateralRadius, verticalRadius, t) {
  if (axisKey === "y") {
    const center = {
      x: lateralRadius * Math.cos(t),
      y: 0,
      z: axisZ + verticalRadius * Math.sin(t)
    };
    const tangent = normalizeVec3({
      x: -lateralRadius * Math.sin(t),
      y: 0,
      z: verticalRadius * Math.cos(t)
    });
    return {
      center,
      normal: tangent,
      xDir: { x: 0, y: 1, z: 0 }
    };
  }

  const center = {
    x: 0,
    y: lateralRadius * Math.cos(t),
    z: axisZ + verticalRadius * Math.sin(t)
  };
  const tangent = normalizeVec3({
    x: 0,
    y: -lateralRadius * Math.sin(t),
    z: verticalRadius * Math.cos(t)
  });
  return {
    center,
    normal: tangent,
    xDir: { x: 1, y: 0, z: 0 }
  };
}

function makeCircleWireAtFrame(oc, center, normal, xDir, radius) {
  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(center.x, center.y, center.z),
    new oc.gp_Dir_4(normal.x, normal.y, normal.z),
    new oc.gp_Dir_4(xDir.x, xDir.y, xDir.z)
  );
  const circ = new oc.gp_Circ_2(ax, radius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
  return new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
}

function asTopoDSWire(oc, wire) {
  return oc.TopoDS?.Wire_1 ? oc.TopoDS.Wire_1(wire) : wire;
}

function normalizeVec3(v) {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= 1e-9) return { x: 0, y: 0, z: 1 };
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length
  };
}
