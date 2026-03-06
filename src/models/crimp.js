// src/models/crimp.js
//
// Parametric climbing crimp hold.
//
// Geometry:
// - Bottom / mounting face is a sharp rectangular plane at z = 0.
// - The body is built as a watertight B-rep loft through closed section wires.
// - Independent overhang / incut is supported on all 4 sides:
//   front, back, left, right.
// - Optional width curvature bows the top in z with a sinusoid and supports
//   both positive and negative values.
// - Vertical screw holes are subtracted from the local top surface downward.
//
// Notes:
// - This file only uses OCCT operations already consistent with your app:
//   BRepOffsetAPI_ThruSections, BRepAlgoAPI_Cut/Fuse, fillets, cylinders.
// - Bottom perimeter is intentionally kept sharp.
// - Fillets are best-effort and may be skipped by OCCT for some parameter sets.

export const meta = {
  name: "Crimp",
  params: [
    { key: "width", label: "Width", min: 30, max: 300, default: 80 },
    { key: "depth", label: "Depth", min: 8, max: 120, default: 20 },
    { key: "height", label: "Height", min: 5, max: 80, default: 15 },

    { key: "front_incut", label: "Front incut", min: -30, max: 60, default: 10 },
    { key: "back_incut", label: "Back incut", min: -30, max: 60, default: 10 },
    { key: "left_incut", label: "Left incut", min: -30, max: 60, default: 0 },
    { key: "right_incut", label: "Right incut", min: -30, max: 60, default: 0 },

    { key: "curvature", label: "Width curvature", min: -20, max: 20, default: 0 },

    { key: "top_edge_radius", label: "Top edge radius", min: 0, max: 12, default: 5 },
    { key: "side_edge_radius", label: "Side edge radius", min: 0, max: 12, default: 3 },
    { key: "corner_radius", label: "Corner radius", min: 0, max: 12, default: 5 },

    { key: "screw_hole_count", label: "Screw hole count", min: 0, max: 6, default: 2 },
    { key: "screw_hole_shaft_radius", label: "Shaft radius", min: 1, max: 8, default: 2.5 },
    { key: "screw_head_radius", label: "Head seat radius", min: 1, max: 12, default: 5.0 },
    { key: "screw_head_depth", label: "Head seat depth", min: 0.5, max: 12, default: 3.0 },
    { key: "screw_hole_y", label: "Screw hole Y", min: 0, max: 120, default: 9.0 },
    { key: "side_margin_x", label: "Side margin X", min: 2, max: 60, default: 12.0 },

    // 0 = blind, 1 = through
    { key: "screw_hole_depth_mode", label: "Through holes (0/1)", min: 0, max: 1, default: 0 },
    { key: "screw_hole_bottom_offset", label: "Blind bottom offset", min: 0.5, max: 20, default: 3.0 }
  ]
};

export function build(oc, params) {
  /**
   * Build the crimp hold.
   *
   * - Creates the base body from a loft through closed quadrilateral section wires.
   * - Keeps the flat mounting face at z = 0 and intentionally sharp.
   * - Supports independent top overhang / incut on all 4 sides.
   * - Supports positive or negative width curvature through the top height function.
   * - Adds vertical screw holes with counterbores from the local top surface.
   * - Applies best-effort fillets while preserving the bottom perimeter.
   */
  const p = sanitizeAndValidate(params);

  let shape = makeCrimpBody(oc, p);

  if (p.screw_hole_count > 0) {
    const holes = makeVerticalScrewHoleSolids(oc, p);
    for (const hole of holes) {
      shape = booleanCutAdaptive(oc, shape, hole, 0.05);
    }
  }

  shape = trySelectiveFillets(oc, shape, p);
  shape = shiftToZ0(oc, shape);

  return shape;
}

function sanitizeAndValidate(params) {
  /**
   * Sanitize and reject invalid parameter combinations.
   *
   * - Clamps numeric inputs to stable ranges.
   * - Computes safe fillet caps relative to current dimensions.
   * - Validates screw-hole spacing, margins, and vertical depth limits.
   * - Rejects combinations that would obviously self-intersect or break walls.
   */
  const p = { ...params };

  p.width = clampNum(p.width, 10, 10000);
  p.depth = clampNum(p.depth, 2, 10000);
  p.height = clampNum(p.height, 1, 10000);

  p.front_incut = clampNum(p.front_incut, -1000, 1000);
  p.back_incut = clampNum(p.back_incut, -1000, 1000);
  p.left_incut = clampNum(p.left_incut, -1000, 1000);
  p.right_incut = clampNum(p.right_incut, -1000, 1000);

  p.curvature = clampNum(p.curvature, -1000, 1000);

  p.top_edge_radius = clampNum(p.top_edge_radius, 0, 1000);
  p.side_edge_radius = clampNum(p.side_edge_radius, 0, 1000);
  p.corner_radius = clampNum(p.corner_radius, 0, 1000);

  p.screw_hole_count = clampInt(p.screw_hole_count, 0, 20);
  p.screw_hole_shaft_radius = clampNum(p.screw_hole_shaft_radius, 0.1, 1000);
  p.screw_head_radius = clampNum(p.screw_head_radius, 0.1, 1000);
  p.screw_head_depth = clampNum(p.screw_head_depth, 0.1, 1000);
  p.screw_hole_y = clampNum(p.screw_hole_y, -1000, 1000);
  p.side_margin_x = clampNum(p.side_margin_x, 0, 1000);
  p.screw_hole_depth_mode = clampInt(p.screw_hole_depth_mode, 0, 1);
  p.screw_hole_bottom_offset = clampNum(p.screw_hole_bottom_offset, 0.1, 1000);

  const safeTop = Math.min(
    p.height * 0.45,
    (p.depth + Math.max(0, p.front_incut) + Math.max(0, p.back_incut)) * 0.25
  );
  const safeSide = Math.min(
    p.height * 0.45,
    (p.width + Math.max(0, p.left_incut) + Math.max(0, p.right_incut)) * 0.12
  );
  const safeCorner = Math.min(safeTop, safeSide);

  p.top_edge_radius = Math.min(p.top_edge_radius, Math.max(0, safeTop));
  p.side_edge_radius = Math.min(p.side_edge_radius, Math.max(0, safeSide));
  p.corner_radius = Math.min(p.corner_radius, Math.max(0, safeCorner));

  if (p.width <= 0 || p.depth <= 0 || p.height <= 0) {
    throw new Error("Width, depth, and height must be positive.");
  }

  if (p.screw_head_radius < p.screw_hole_shaft_radius) {
    throw new Error("Head seat radius must be at least the shaft radius.");
  }

  if (p.screw_hole_count > 0) {
    if (p.screw_hole_y <= p.screw_head_radius || p.screw_hole_y >= p.depth - p.screw_head_radius) {
      throw new Error("Screw hole Y leaves too little material to front or back side.");
    }

    if (p.side_margin_x <= p.screw_head_radius || p.side_margin_x >= p.width / 2) {
      throw new Error("Side margin X is invalid for the chosen width and screw head radius.");
    }

    if (p.screw_head_depth >= minLocalTopZ(p) - 0.5) {
      throw new Error("Screw head depth is too large relative to local top height.");
    }

    if (p.screw_hole_depth_mode === 0 && p.screw_hole_bottom_offset >= minLocalTopZ(p) - 0.5) {
      throw new Error("Blind bottom offset is too large for the current height.");
    }

    if (p.screw_hole_count > 1) {
      const xs = computeScrewXs(p);
      const minDx = minAdjacentSpacing(xs);
      if (minDx < 2 * p.screw_head_radius + 1.0) {
        throw new Error("Screw holes are too close to each other for the selected head radius.");
      }
    }
  }

  return p;
}

function makeCrimpBody(oc, p) {
  /**
   * Construct the main body as a solid loft through closed section wires.
   *
   * - Sections run across width from left to right.
   * - Bottom edge of every section lies on z = 0.
   * - Top edge uses independent 4-side incuts:
   *   front/back shift in y, left/right shift in x.
   * - Width curvature modifies top z with a sinusoid and supports negative values.
   */
  const sectionCount = Math.abs(p.curvature) > 0.001 ? 11 : 2;
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);

  for (let i = 0; i < sectionCount; i++) {
    const t = sectionCount === 1 ? 0 : i / (sectionCount - 1);
    mk.AddWire(makeSectionWire(oc, p, t));
  }

  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeSectionWire(oc, p, t) {
  /**
   * Create one closed quadrilateral section wire.
   *
   * Bottom points:
   * - fixed on the rectangular mounting plane
   *
   * Top points:
   * - front/back incuts move the top in y
   * - left/right incuts move the top in x
   * - curvature changes top z only
   */
  const xb = p.width * t;
  const xt = lerp(-p.left_incut, p.width + p.right_incut, t);

  const yFrontTop = -p.front_incut;
  const yBackTop = p.depth + p.back_incut;
  const zTop = topZAtT(p, t);

  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  poly.Add_1(new oc.gp_Pnt_3(xb, 0, 0));
  poly.Add_1(new oc.gp_Pnt_3(xb, p.depth, 0));
  poly.Add_1(new oc.gp_Pnt_3(xt, yBackTop, zTop));
  poly.Add_1(new oc.gp_Pnt_3(xt, yFrontTop, zTop));
  poly.Close();

  return poly.Wire();
}

function makeVerticalScrewHoleSolids(oc, p) {
  /**
   * Create vertical hole solids to subtract.
   *
   * - Hole axes are parallel to global z.
   * - Centers are evenly spaced in x within [side_margin_x, width - side_margin_x].
   * - All holes share y = screw_hole_y.
   * - Each hole consists of:
   *   - a counterbore from the local top downward
   *   - a shaft hole from the local top downward
   * - Blind mode leaves screw_hole_bottom_offset material above the bottom plane.
   */
  const holes = [];
  const xs = computeScrewXs(p);
  const eps = 0.3;

  for (const x of xs) {
    const y = p.screw_hole_y;
    const zTop = topZAtBaseXY(p, x, y);

    const seatStartZ = zTop - p.screw_head_depth - eps;
    const seatLen = p.screw_head_depth + 2 * eps;

    const shaftBottomZ = p.screw_hole_depth_mode === 1
      ? -eps
      : p.screw_hole_bottom_offset;

    const shaftLen = (zTop - shaftBottomZ) + eps;

    if (shaftLen <= 0.2) {
      throw new Error("A screw hole has non-positive shaft length.");
    }

    const seat = makeVerticalCylinder(oc, x, y, seatStartZ, p.screw_head_radius, seatLen);
    const shaft = makeVerticalCylinder(oc, x, y, shaftBottomZ, p.screw_hole_shaft_radius, shaftLen);

    const combined = booleanFuseAdaptive(oc, seat, shaft, 0.02);
    holes.push(combined);
  }

  return holes;
}

function computeScrewXs(p) {
  /**
   * Evenly distribute screw-hole centers across width.
   *
   * - count = 0: []
   * - count = 1: centered
   * - count > 1: even spacing between side margins
   */
  const n = p.screw_hole_count;
  if (n <= 0) return [];
  if (n === 1) return [p.width / 2];

  const xStart = p.side_margin_x;
  const xEnd = p.width - p.side_margin_x;
  const xs = [];

  for (let i = 0; i < n; i++) {
    xs.push(xStart + i * (xEnd - xStart) / (n - 1));
  }

  return xs;
}

function makeVerticalCylinder(oc, x, y, z0, radius, length) {
  /**
   * Create a cylinder with axis parallel to global +z.
   *
   * - Used for both counterbore and shaft subtraction solids.
   * - The subtraction direction is still downward because the solid spans
   *   from a lower z to the top entry point.
   */
  const ax = new oc.gp_Ax2_2(
    new oc.gp_Pnt_3(x, y, z0),
    new oc.gp_Dir_4(0, 0, 1),
    new oc.gp_Dir_4(1, 0, 0)
  );
  return new oc.BRepPrimAPI_MakeCylinder_3(ax, radius, length).Shape();
}

function topZAtT(p, t) {
  /**
   * Top height as a function of width parameter.
   *
   * - Positive curvature bows upward.
   * - Negative curvature bows downward.
   */
  return p.height + p.curvature * Math.sin(Math.PI * t);
}

function topZAtBaseXY(p, x, _y) {
  /**
   * Evaluate local top-surface entry height for screw holes.
   *
   * - The current top surface varies along width through t = x / width.
   * - For this model, z does not vary independently with y.
   * - Using base-space x keeps hole placement stable and inside the solid.
   */
  const t = clampNum(x / p.width, 0, 1);
  return topZAtT(p, t);
}

function minLocalTopZ(p) {
  /**
   * Conservative minimum local top height.
   *
   * - Needed for blind-hole and head-depth validation.
   */
  return p.height + Math.min(0, p.curvature);
}

function trySelectiveFillets(oc, shape, p) {
  /**
   * Apply best-effort fillets while keeping the mounting face sharp.
   *
   * Selection heuristic:
   * - skip edges near z = 0
   * - apply top radius to upper edges
   * - apply side / corner radii to upper side transitions
   *
   * This is intentionally heuristic because robust topological naming is not
   * available here. Failure returns the unfilleted body.
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
    const zTopMin = minLocalTopZ(p);
    const zTopMax = p.height + Math.max(0, p.curvature);

    while (exp.More()) {
      const edge = oc.TopoDS.Edge_1(exp.Current());

      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, props, false, false);
      const c = props.CentreOfMass();

      const x = c.X();
      const y = c.Y();
      const z = c.Z();

      if (z < 0.25) {
        exp.Next();
        continue;
      }

      const nearTop = z > (zTopMin + 0.55 * (zTopMax - zTopMin + 1e-9));
      const nearLeft = x < Math.max(0.8, p.width * 0.04);
      const nearRight = x > p.width - Math.max(0.8, p.width * 0.04);
      const nearFront = y < Math.min(1.0, p.depth * 0.08);
      const nearBack = y > p.depth - Math.min(1.0, p.depth * 0.08);

      let r = 0;

      if (nearTop) r = Math.max(r, p.top_edge_radius);
      if (nearLeft || nearRight || nearFront || nearBack) r = Math.max(r, p.side_edge_radius);
      if ((nearLeft || nearRight) && nearTop) r = Math.max(r, p.corner_radius);

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

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  if (fuzzy > 0 && typeof op.SetFuzzyValue === "function") op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, pr);
  if (fuzzy > 0 && typeof op.SetFuzzyValue === "function") op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
}

function shiftToZ0(oc, shape) {
  /**
   * Translate shape so the global minimum z is exactly 0.
   */
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const zMin = bbox.CornerMin().Z();

  if (!Number.isFinite(zMin) || Math.abs(zMin) < 1e-9) return shape;

  const tr = new oc.gp_Trsf_1();
  tr.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  return new oc.BRepBuilderAPI_Transform_2(shape, tr, true).Shape();
}

function minAdjacentSpacing(xs) {
  let m = Infinity;
  for (let i = 1; i < xs.length; i++) {
    m = Math.min(m, Math.abs(xs[i] - xs[i - 1]));
  }
  return m;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clampNum(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
