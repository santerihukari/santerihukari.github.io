import {
  booleanCut,
  booleanFuse,
  clamp,
  tryFilletEdges
} from "./cad_utils.js";

const DEFAULTS = {
  d_cyl: 36,
  h: 15,
  d_ball: 44,
  h_ball: 22,
  groove_center_r: 16.6,
  groove_z: 1.8,
  groove_profile_d: 8,
  groove_y_scale: 1.6,
  groove_z_scale: 1.1,
  edge_fillet_r: 1
};

export const meta = {
  name: "Badminton Pole Head",
  description:
    "Cylinder with an exact squashed hemispherical cap and an elliptical-path groove cut only into the cap.",
  tessellation: { linearDeflection: 0.06, angularDeflection: 0.08 },
  params: [
    { key: "d_cyl", label: "Cylinder diameter", min: 10, max: 120, default: DEFAULTS.d_cyl },
    { key: "h", label: "Cylinder height", min: 5, max: 160, default: DEFAULTS.h },
    {
      key: "d_ball",
      label: "Half-ball diameter",
      min: 10,
      max: 120,
      default: DEFAULTS.d_ball,
      description: "Unsquashed x/y diameter of the cap."
    },
    {
      key: "h_ball",
      label: "Half-ball height",
      min: 1,
      max: 60,
      default: DEFAULTS.h_ball,
      description: "Vertical height of the cap. This is clamped to at most d_ball / 2 to keep it a z-squashed half-ball."
    },
    {
      key: "groove_center_r",
      label: "Base groove path radius",
      min: 0,
      max: 60,
      default: DEFAULTS.groove_center_r,
      description:
        "Reference radius of the groove centerline before lateral and vertical path scaling. It scales automatically with the half-ball diameter so tuned grooves keep their proportions when the cap size changes."
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
      default: DEFAULTS.groove_z,
      description:
        "Reference height of the horizontal revolve axis above the cap base at z = h. It scales automatically with the cap height so tuned grooves stay in proportion."
    },
    {
      key: "groove_profile_d",
      label: "Groove profile diameter",
      min: 0.5,
      max: 30,
      default: DEFAULTS.groove_profile_d,
      description:
        "Reference diameter of the groove tube itself. It scales automatically with the half-ball diameter so changing the cap size does not break a tuned groove."
    },
    {
      key: "groove_y_scale",
      label: "Groove ellipse cross-axis scale",
      min: 0.2,
      max: 3,
      default: DEFAULTS.groove_y_scale,
      description:
        "Scales the groove ellipse sideways in the plane around the selected axis. With X-axis revolve this affects Y; with Y-axis revolve this affects X."
    },
    {
      key: "groove_z_scale",
      label: "Groove ellipse Z scale",
      min: 0.2,
      max: 3,
      default: DEFAULTS.groove_z_scale,
      description:
        "Scales the groove ellipse vertically in Z. This changes how tall or shallow the groove path is without changing the groove tube thickness."
    },
    {
      key: "edge_fillet_r",
      label: "Edge fillet radius",
      min: 0,
      max: 4,
      default: DEFAULTS.edge_fillet_r,
      description:
        "Best-effort fillet applied to the main body after the groove cut."
    }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const cylRadius = Math.max(0.5, p.d_cyl / 2);
  const cylHeight = Math.max(1, p.h);
  const capRadius = Math.max(0.5, p.d_ball / 2);
  const capHeight = clamp(p.h_ball, 1, capRadius);
  const grooveXyScale = capRadius / (DEFAULTS.d_ball / 2);
  const grooveZReferenceHeight = clamp(DEFAULTS.h_ball, 1, DEFAULTS.d_ball / 2);
  const grooveHeightScale = capHeight / grooveZReferenceHeight;
  const grooveProfileRadius = Math.max(0.25, (p.groove_profile_d * grooveXyScale) / 2);
  const grooveAxis = p.groove_axis === "y" ? "y" : "x";
  const grooveAxisZ = cylHeight + clamp(p.groove_z * grooveHeightScale, 0, capHeight);
  const grooveBasePathRadius = Math.max(
    grooveProfileRadius + 0.2,
    p.groove_center_r * grooveXyScale
  );
  const grooveLateralPathRadius = Math.max(
    grooveProfileRadius + 0.2,
    grooveBasePathRadius * Math.max(0.2, p.groove_y_scale)
  );
  const grooveVerticalPathRadius = Math.max(
    grooveProfileRadius + 0.2,
    grooveBasePathRadius * Math.max(0.2, p.groove_z_scale)
  );

  const cylinder = makeExactCylinderZ(oc, cylRadius, cylHeight);
  let cap = makeExactCap(oc, capRadius, capHeight, cylHeight);
  const grooveCutter = makeEllipticalGrooveCutter(
    oc,
    grooveAxis,
    grooveAxisZ,
    grooveLateralPathRadius,
    grooveVerticalPathRadius,
    grooveProfileRadius
  );

  cap = booleanCut(oc, cap, grooveCutter);
  let shape = booleanFuse(oc, cylinder, cap);
  shape = tryFilletEdges(oc, shape, Math.max(0, Number(p.edge_fillet_r) || 0));
  return shape;
}

function makeExactCylinderZ(oc, radius, height) {
  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(0, 0, 0),
    new oc.gp_Dir_4(0, 0, 1),
    new oc.gp_Dir_4(1, 0, 0)
  );
  return new oc.BRepPrimAPI_MakeCylinder_3(ax, radius, height).Shape();
}

function makeExactCap(oc, radiusXY, heightZ, zBase) {
  const pAxisBase = new oc.gp_Pnt_3(0, 0, zBase);
  const pRim = new oc.gp_Pnt_3(radiusXY, 0, zBase);
  const pApex = new oc.gp_Pnt_3(0, 0, zBase + heightZ);

  const edges = [
    makeLineEdge(oc, pAxisBase, pRim),
    makeSemiEllipseArcEdgeXZ(oc, radiusXY, heightZ, zBase),
    makeLineEdge(oc, pApex, pAxisBase)
  ];

  const wire = makeWireFromEdges(oc, edges);
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, false).Shape();
  return revolveFullAroundZ(oc, face);
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
        // Fall through to the more explicit lofted fallback below.
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
