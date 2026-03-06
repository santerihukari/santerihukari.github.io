// src/models/crimp.js

export const meta = {
  name: "Crimp",
  params: [
    { key: "width", label: "Width", min: 30, max: 300, default: 80 },
    { key: "depth", label: "Depth", min: 8, max: 100, default: 20 },
    { key: "height", label: "Height", min: 5, max: 80, default: 15 },
    { key: "incut", label: "Incut", min: 0, max: 60, default: 15 },

    { key: "curvature", label: "Width curvature", min: 0, max: 20, default: 0 },

    { key: "top_edge_radius", label: "Top edge radius", min: 0, max: 12, default: 5 },
    { key: "side_edge_radius", label: "Side edge radius", min: 0, max: 12, default: 4 },
    { key: "corner_radius", label: "Corner radius", min: 0, max: 12, default: 6 }
  ]
};

export function build(oc, params) {
  const p = sanitize(params);

  // Build the solid from closed cross-sections along X.
  // Each section is a quadrilateral in the YZ plane at a fixed X.
  const sectionCount = p.curvature > 0.001 ? 9 : 2;
  const shape0 = makeCrimpBody(oc, p, sectionCount);

  // Best-effort filleting:
  // - bottom perimeter stays sharp
  // - top perimeter and upper side transitions are rounded
  let shape = shape0;
  shape = trySelectiveFillets(oc, shape, p);

  // Keep bottom on Z=0 even after later edits / kernel tolerances
  shape = shiftToZ0(oc, shape);

  return shape;
}

function sanitize(params) {
  const p = { ...params };

  p.width = clampNum(p.width, 10, 10000);
  p.depth = clampNum(p.depth, 2, 10000);
  p.height = clampNum(p.height, 1, 10000);
  p.incut = clampNum(p.incut, 0, 10000);
  p.curvature = clampNum(p.curvature, 0, 1000);

  p.top_edge_radius = clampNum(p.top_edge_radius, 0, 1000);
  p.side_edge_radius = clampNum(p.side_edge_radius, 0, 1000);
  p.corner_radius = clampNum(p.corner_radius, 0, 1000);

  // Keep radii within a safe ballpark relative to dimensions.
  const safeTop = Math.min(p.height * 0.45, (p.depth + 2 * p.incut / 1.5) * 0.25);
  const safeSide = Math.min(p.height * 0.45, p.width * 0.10);
  const safeCorner = Math.min(safeTop, safeSide);

  p.top_edge_radius = Math.min(p.top_edge_radius, safeTop);
  p.side_edge_radius = Math.min(p.side_edge_radius, safeSide);
  p.corner_radius = Math.min(p.corner_radius, safeCorner);

  return p;
}

function makeCrimpBody(oc, p, sectionCount) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);

  for (let i = 0; i < sectionCount; i++) {
    const t = sectionCount === 1 ? 0 : i / (sectionCount - 1);
    const x = t * p.width;

    // Optional width-direction bow:
    // centerline(x) = curvature * sin(pi * x / width)
    const bow = p.curvature * Math.sin(Math.PI * t);

    mk.AddWire(makeSectionWire(oc, p, x, bow));
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeSectionWire(oc, p, x, bowZ) {
  /**
   * Closed quadrilateral section at fixed X.
   *
   * Bottom remains planar at z=0:
   *   (x, 0, 0)
   *   (x, depth, 0)
   *
   * Top follows the OpenSCAD-like overhang definition:
   *   front top y = -incut/1.5
   *   back  top y = depth + incut/1.5
   * and optional bow in z only affects the top edge.
   */
  const yFrontTop = -p.incut / 1.5;
  const yBackTop = p.depth + p.incut / 1.5;
  const zTop = p.height + bowZ;

  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  poly.Add_1(new oc.gp_Pnt_3(x, 0, 0));
  poly.Add_1(new oc.gp_Pnt_3(x, p.depth, 0));
  poly.Add_1(new oc.gp_Pnt_3(x, yBackTop, zTop));
  poly.Add_1(new oc.gp_Pnt_3(x, yFrontTop, zTop));
  poly.Close();
  return poly.Wire();
}

function trySelectiveFillets(oc, shape, p) {
  /**
   * Heuristic edge selection:
   *
   * Keep sharp:
   * - bottom perimeter edges (z ~ 0)
   *
   * Round:
   * - top perimeter edges
   * - upper side / corner transitions
   *
   * The classification is based on edge center-of-mass location.
   * This is a practical OCCT heuristic, not an exact topological naming solution.
   */
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
      const c = props.CentreOfMass();

      const x = c.X();
      const y = c.Y();
      const z = c.Z();

      const nearBottom = z < 0.25;
      const nearTop = z > p.height * 0.75;
      const nearLeftOrRight = x < 0.5 || x > p.width - 0.5;

      if (nearBottom) {
        exp.Next();
        continue;
      }

      let r = 0;

      // Top perimeter / top transitions
      if (nearTop) r = Math.max(r, p.top_edge_radius);

      // End corners / vertical-ish side edges near x = 0 or x = width
      if (nearLeftOrRight) r = Math.max(r, p.corner_radius, p.side_edge_radius);

      // General side transitions above the bottom
      if (!nearTop) r = Math.max(r, p.side_edge_radius);

      // Extra guard against huge fillets
      r = Math.min(r, p.height * 0.45);

      if (r > 0.05) {
        mk.Add_2(r, edge);
        added++;
      }

      exp.Next();
    }

    if (added === 0) return shape;

    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return mk.Shape();
  } catch (e) {
    console.warn("Crimp fillet pass failed; returning unfilleted body.", e);
  }

  return shape;
}

function shiftToZ0(oc, shape) {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const zMin = bbox.CornerMin().Z();

  if (!Number.isFinite(zMin) || Math.abs(zMin) < 1e-9) return shape;

  const tr = new oc.gp_Trsf_1();
  tr.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  return new oc.BRepBuilderAPI_Transform_2(shape, tr, true).Shape();
}

function clampNum(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
