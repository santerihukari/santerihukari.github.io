export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function fract(value) {
  return value - Math.floor(value);
}

export function bool01(value) {
  return Number(value) >= 0.5;
}

export function smoothRamp01(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

export function booleanCut(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, oc.createProgressRange());
  if (fuzzy > 0 && typeof op.SetFuzzyValue === "function") op.SetFuzzyValue(fuzzy);
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : a;
}

export function booleanFuse(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, oc.createProgressRange());
  if (fuzzy > 0 && typeof op.SetFuzzyValue === "function") op.SetFuzzyValue(fuzzy);
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : a;
}

export function translateShape(oc, shape, dx, dy, dz) {
  const trsf = new oc.gp_Trsf_1();
  trsf.SetTranslation_1(new oc.gp_Vec_4(dx, dy, dz));
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
}

export function rotateShapeZ(oc, shape, angleRad, cx = 0, cy = 0, cz = 0) {
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_3(cx, cy, cz), new oc.gp_Dir_4(0, 0, 1)),
    angleRad
  );
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
}

export function rotateShapeX(oc, shape, angleRad, cx = 0, cy = 0, cz = 0) {
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_3(cx, cy, cz), new oc.gp_Dir_4(1, 0, 0)),
    angleRad
  );
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
}

export function rotateShapeY(oc, shape, angleRad, cx = 0, cy = 0, cz = 0) {
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_3(cx, cy, cz), new oc.gp_Dir_4(0, 1, 0)),
    angleRad
  );
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
}

export function makeLoftFromWires(oc, wires, makeSolid = true, ruled = true) {
  const loft = new oc.BRepOffsetAPI_ThruSections(makeSolid, ruled, 1e-6);
  wires.forEach((wire) => loft.AddWire(wire));
  loft.Build(oc.createProgressRange());
  return loft.Shape();
}

export function makePolygonWireXYAtZ(oc, points, z) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  points.forEach((point) => {
    polygon.Add_1(new oc.gp_Pnt_3(point.x, point.y, z));
  });
  polygon.Close();
  return polygon.Wire();
}

export function makeRegularPolygonWireXYAtZ(oc, cx, cy, z, sides, radius, phase = 0) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  for (let index = 0; index < sides; index += 1) {
    const angle = phase + (2 * Math.PI * index) / sides;
    polygon.Add_1(new oc.gp_Pnt_3(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z));
  }
  polygon.Close();
  return polygon.Wire();
}

export function makePolygonPrism(oc, points, z0, z1) {
  return makeLoftFromWires(
    oc,
    [makePolygonWireXYAtZ(oc, points, z0), makePolygonWireXYAtZ(oc, points, z1)],
    true,
    true
  );
}

export function makeCylinderBetweenZ(oc, diameter, z0, z1, sides = 48, cx = 0, cy = 0) {
  const radius = Math.max(0.05, diameter / 2);
  return makeLoftFromWires(
    oc,
    [
      makeRegularPolygonWireXYAtZ(oc, cx, cy, z0, sides, radius, 0),
      makeRegularPolygonWireXYAtZ(oc, cx, cy, z1, sides, radius, 0)
    ],
    true,
    true
  );
}

export function makeFrustumBetweenZ(oc, bottomDiameter, topDiameter, z0, z1, sides = 48, cx = 0, cy = 0) {
  const r0 = Math.max(0.05, bottomDiameter / 2);
  const r1 = Math.max(0.05, topDiameter / 2);
  return makeLoftFromWires(
    oc,
    [
      makeRegularPolygonWireXYAtZ(oc, cx, cy, z0, sides, r0, 0),
      makeRegularPolygonWireXYAtZ(oc, cx, cy, z1, sides, r1, 0)
    ],
    true,
    true
  );
}

export function makeCylinderAlongX(oc, diameter, x0, x1, sides = 48, cy = 0, cz = 0) {
  const vertical = makeCylinderBetweenZ(oc, diameter, x0, x1, sides, 0, 0);
  return translateShape(oc, rotateShapeY(oc, vertical, Math.PI / 2), 0, cy, 0 + cz);
}

export function makeCylinderAlongY(oc, diameter, y0, y1, sides = 48, cx = 0, cz = 0) {
  const vertical = makeCylinderBetweenZ(oc, diameter, y0, y1, sides, 0, 0);
  return translateShape(oc, rotateShapeX(oc, vertical, Math.PI / 2), cx, 0, cz);
}

export function makeBoxAt(oc, x0, y0, z0, width, depth, height) {
  const x1 = x0 + width;
  const y1 = y0 + depth;
  const z1 = z0 + height;
  return makeLoftFromWires(
    oc,
    [
      makePolygonWireXYAtZ(
        oc,
        [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 }
        ],
        z0
      ),
      makePolygonWireXYAtZ(
        oc,
        [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 }
        ],
        z1
      )
    ],
    true,
    true
  );
}

export function makeCenteredBox(oc, width, depth, height, cx = 0, cy = 0, z0 = 0) {
  return makeBoxAt(oc, cx - width / 2, cy - depth / 2, z0, width, depth, height);
}

export function makeRoundedRectPrism(oc, width, depth, height, radius, z0 = 0, cx = 0, cy = 0) {
  const loft = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  loft.AddWire(makeRoundedRectWireXYAtZ(oc, cx - width / 2, cy - depth / 2, width, depth, z0, radius));
  loft.AddWire(makeRoundedRectWireXYAtZ(oc, cx - width / 2, cy - depth / 2, width, depth, z0 + height, radius));
  loft.Build(oc.createProgressRange());
  return loft.Shape();
}

export function clampRadius(radius, width, depth) {
  if (width <= 0 || depth <= 0) return 0;
  return Math.max(0, Math.min(radius || 0, 0.5 * Math.min(width, depth) - 0.01));
}

function makeRoundedRectWireXYAtZ(oc, x0, y0, width, depth, z, radius) {
  const r = clampRadius(radius, width, depth);
  if (r <= 0.01) {
    return makePolygonWireXYAtZ(
      oc,
      [
        { x: x0, y: y0 },
        { x: x0 + width, y: y0 },
        { x: x0 + width, y: y0 + depth },
        { x: x0, y: y0 + depth }
      ],
      z
    );
  }

  const x1 = x0 + width;
  const y1 = y0 + depth;
  const edges = [];
  edges.push(makeLineEdgeXYAtZ(oc, x0 + r, y0, x1 - r, y0, z));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - r, y0 + r, r, -Math.PI / 2, 0, z));
  edges.push(makeLineEdgeXYAtZ(oc, x1, y0 + r, x1, y1 - r, z));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - r, y1 - r, r, 0, Math.PI / 2, z));
  edges.push(makeLineEdgeXYAtZ(oc, x1 - r, y1, x0 + r, y1, z));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + r, y1 - r, r, Math.PI / 2, Math.PI, z));
  edges.push(makeLineEdgeXYAtZ(oc, x0, y1 - r, x0, y0 + r, z));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, z));
  return makeWireFromEdges(oc, edges);
}

function makeLineEdgeXYAtZ(oc, x0, y0, x1, y1, z) {
  return new oc.BRepBuilderAPI_MakeEdge_3(
    new oc.gp_Pnt_3(x0, y0, z),
    new oc.gp_Pnt_3(x1, y1, z)
  ).Edge();
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

export function tryFilletEdges(oc, shape, radius, predicate) {
  if (!shape || radius <= 0.05) return shape;

  try {
    const mk = new oc.BRepFilletAPI_MakeFillet(
      shape,
      oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0
    );
    const exp = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );
    let added = 0;

    while (exp.More()) {
      const edge = oc.TopoDS.Edge_1(exp.Current());
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, props, false, false);
      const center = props.CentreOfMass();
      if (!predicate || predicate(center, edge)) {
        mk.Add_2(radius, edge);
        added += 1;
      }
      exp.Next();
    }

    if (added === 0) return shape;
    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return mk.Shape();
  } catch (error) {
    console.warn("Fillet failed", error);
  }

  return shape;
}

export function makeThreadedCylinderBetweenZ(oc, d) {
  const length = Math.abs(d.z1 - d.z0);
  const pitch = Math.max(0.2, d.pitch);
  const depth = Math.max(0, Math.min(d.depth, 0.45 * d.majorDia));
  if (length < 1e-6 || depth < 1e-6) {
    return makeCylinderBetweenZ(oc, d.majorDia, d.z0, d.z1, d.circleSides || 48, d.cx || 0, d.cy || 0);
  }

  const circleSides = Math.max(16, Math.round(d.circleSides || 48));
  const sectionsPerTurn = Math.max(6, Math.round(d.sectionsPerTurn || 12));
  const sectionCount = Math.max(2, Math.ceil((length / pitch) * sectionsPerTurn) + 1);
  const majorR = d.majorDia / 2;
  const phase = d.phase || 0;
  const runoutStart = Math.max(0, d.runoutStart || 0);
  const runoutEnd = Math.max(0, d.runoutEnd || 0);
  const tipR = Math.max(0.05, (d.tipDia || d.majorDia - 2 * depth) / 2);
  const startBlendLength = Math.max(0, d.startBlendLength || 0);
  const endBlendLength = Math.max(0, d.endBlendLength || 0);
  const wires = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const t = sectionCount === 1 ? 0 : index / (sectionCount - 1);
    const z = lerp(d.z0, d.z1, t);
    const bottomRamp = runoutStart > 1e-9 ? smoothRamp01((z - d.z0) / runoutStart) : 1;
    const topRamp = runoutEnd > 1e-9 ? smoothRamp01((d.z1 - z) / runoutEnd) : 1;
    const runout = bottomRamp * topRamp;
    const startBlend = startBlendLength > 1e-9 ? smoothRamp01((z - d.z0) / startBlendLength) : 1;
    const endBlend = endBlendLength > 1e-9 ? smoothRamp01((d.z1 - z) / endBlendLength) : 1;
    const crestBlend = Math.min(startBlend, endBlend);
    const rootR = Math.max(0.05, majorR - runout * depth);
    const crestR = lerp(tipR, majorR, crestBlend);
    const effectiveRoot = lerp(tipR, rootR, crestBlend);
    const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
    const helixTurns = (z - d.z0) / pitch;
    const helixPhase = 2 * Math.PI * helixTurns + phase;

    for (let side = 0; side < circleSides; side += 1) {
      const angle = (2 * Math.PI * side) / circleSides;
      const u = fract((angle - helixPhase) / (2 * Math.PI));
      const profile = externalThreadProfile01(u);
      const radius = Math.max(0.05, lerp(crestR, effectiveRoot, profile));
      polygon.Add_1(new oc.gp_Pnt_3(
        (d.cx || 0) + radius * Math.cos(angle),
        (d.cy || 0) + radius * Math.sin(angle),
        z
      ));
    }

    polygon.Close();
    wires.push(polygon.Wire());
  }

  return makeLoftFromWires(oc, wires, true, true);
}

function externalThreadProfile01(u) {
  const t = fract(u);
  const crestHalf = 0.06;
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
