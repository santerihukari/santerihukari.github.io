// src/models/crimp.js
//
// Demo “crimp” model:
// - Base solid: rectangular block (width X, depth Y, height Z)
// - Grip feature: a pocket cut defined by a 2D quadrilateral in the Y–Z plane,
//   extruded along X (i.e., “trace over width”)
// - Optional rounding: fillet attempt on pocket-region edges (best-effort)
// - Screw holes: N through-holes along +Y direction, spaced along X

export const meta = {
  name: "Crimp (Demo)",
  params: [
    { key: "width", label: "Width (X)", min: 40, max: 300, default: 140 },
    { key: "depth", label: "Total depth (Y)", min: 20, max: 120, default: 55 },
    { key: "height", label: "Total height (Z)", min: 12, max: 80, default: 30 },

    { key: "grip_depth", label: "Grip depth (Y)", min: 6, max: 80, default: 18 },
    { key: "incut_angle_deg", label: "Incut angle (deg)", min: 0, max: 60, default: 15 },

    { key: "pocket_height", label: "Pocket height (Z)", min: 6, max: 60, default: 22 },
    { key: "bottom_wall", label: "Bottom wall (Z)", min: 2, max: 30, default: 6 },

    { key: "round_r", label: "Rounding radius", min: 0, max: 8, default: 2.0 },

    { key: "screw_count", label: "Screw holes", min: 0, max: 6, default: 2 },
    { key: "screw_d", label: "Screw diameter", min: 2, max: 12, default: 5.0 },
    { key: "screw_inset", label: "Screw inset from sides", min: 4, max: 60, default: 18 },
    { key: "screw_z", label: "Screw Z height", min: 4, max: 60, default: 15 }
  ]
};

export function build(oc, params) {
  /**
   * Build the crimp solid.
   *
   * - Constructs a base block (0..width, 0..depth, 0..height).
   * - Cuts a pocket formed by a quadrilateral profile in Y–Z, extruded along X.
   * - Attempts a fillet pass near the pocket edges (best-effort).
   * - Cuts N screw holes through the depth (Y direction), spaced along X.
   * - Keeps the model resting on Z=0.
   */
  const p = sanitizeParams(params);

  // Base block
  let shape = makeBox(oc, 0, 0, 0, p.width, p.depth, p.height);

  // Pocket cut: defined in Y–Z and extruded across X
  const pocket = makePocketCut(oc, p);
  shape = booleanCutAdaptive(oc, shape, pocket, 0.1);

  // Rounding (best-effort): fillet edges that are likely part of pocket opening/region
  if (p.round_r > 0.05) {
    shape = tryFilletPocketRegion(oc, shape, p.round_r, p);
  }

  // Screw holes (through Y)
  if (p.screw_count >= 1 && p.screw_d > 0.1) {
    const holes = makeScrewHoles(oc, p);
    for (const h of holes) shape = booleanCutAdaptive(oc, shape, h, 0.05);
  }

  // Ensure bottom at Z=0 (already is, but keep robust if later changes add transforms)
  shape = shiftToZ0(oc, shape);

  return shape;
}

function sanitizeParams(params) {
  /**
   * Clamp and derive parameters to avoid impossible geometry.
   *
   * - Ensures pocket dimensions fit within the base.
   * - Prevents negative/degenerate pocket roof endpoint.
   * - Coerces screw_count to an integer range.
   */
  const p = { ...params };

  p.width = clampNum(p.width, 10, 10000);
  p.depth = clampNum(p.depth, 5, 10000);
  p.height = clampNum(p.height, 5, 10000);

  p.grip_depth = clampNum(p.grip_depth, 1, p.depth - 1);

  p.incut_angle_deg = clampNum(p.incut_angle_deg, 0, 80);
  p.pocket_height = clampNum(p.pocket_height, 1, p.height);
  p.bottom_wall = clampNum(p.bottom_wall, 0, p.height - 0.5);

  // Pocket top at zTop; pocket bottom at zBot
  const zTopMax = p.height - 0.2;
  const zBotMin = 0.2;

  // Keep pocket inside height bounds
  const zBot = clampNum(p.bottom_wall, 0, zTopMax - 0.2);
  const zTop = clampNum(zBot + p.pocket_height, zBot + 0.2, zTopMax);

  p._pocket_z_bot = Math.max(zBotMin, zBot);
  p._pocket_z_top = Math.max(p._pocket_z_bot + 0.2, zTop);

  // Rounding
  p.round_r = clampNum(p.round_r, 0, 1000);

  // Screws
  p.screw_count = clampInt(p.screw_count, 0, 12);
  p.screw_d = clampNum(p.screw_d, 0, 1000);
  p.screw_inset = clampNum(p.screw_inset, 0, p.width / 2 - 0.1);
  p.screw_z = clampNum(p.screw_z, 0.5, p.height - 0.5);

  return p;
}

function makePocketCut(oc, p) {
  /**
   * Create a pocket “wedge” solid to subtract from the base.
   *
   * - Defines a quadrilateral in Y–Z:
   *   (y=0, z=zBot) -> (0, zTop) -> (y=gripDepth, z=zRoofEnd) -> (gripDepth, zBot)
   * - Extrudes the face along X across the full width (with small overshoot).
   */
  const eps = 0.2;

  const y0 = -eps; // slightly outside the front face
  const y1 = p.grip_depth + eps;

  const zBot = p._pocket_z_bot;
  const zTop = p._pocket_z_top;

  const a = (p.incut_angle_deg * Math.PI) / 180.0;

  // “Incut angle” here: roof line drops as it goes deeper in +Y.
  // zRoofEnd = zTop - tan(a) * grip_depth, clamped not below zBot.
  let zRoofEnd = zTop - Math.tan(a) * p.grip_depth;
  zRoofEnd = Math.max(zBot + 0.2, zRoofEnd);

  const ptsYZ = [
    [y0, zBot],
    [y0, zTop],
    [y1, zRoofEnd],
    [y1, zBot]
  ];

  // Make a face in the plane X=0, then extrude along +X
  const face = makeFaceFromYZPolygonAtX(oc, 0, ptsYZ);
  const vec = new oc.gp_Vec_4(p.width + 2 * eps, 0, 0);
  const prism = new oc.BRepPrimAPI_MakePrism_2(face, vec, true, true).Shape();

  // Shift prism slightly negative X so it fully spans the base
  const tr = new oc.gp_Trsf_1();
  tr.SetTranslation_1(new oc.gp_Vec_4(-eps, 0, 0));
  return new oc.BRepBuilderAPI_Transform_2(prism, tr, true).Shape();
}

function makeScrewHoles(oc, p) {
  /**
   * Generate cylindrical through-holes along +Y direction.
   *
   * - Places holes at Z = screw_z
   * - X positions:
   *   - count=1: centered
   *   - count>=2: evenly spaced between insets (inclusive)
   * - Holes run through full depth with overshoot.
   */
  const holes = [];
  const r = p.screw_d / 2;
  const yLen = p.depth + 40;

  const count = p.screw_count;
  if (count <= 0) return holes;

  const xs = [];
  if (count === 1) {
    xs.push(p.width / 2);
  } else {
    const xMin = p.screw_inset;
    const xMax = p.width - p.screw_inset;
    const span = Math.max(0, xMax - xMin);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      xs.push(xMin + t * span);
    }
  }

  for (const x of xs) {
    const ax = new oc.gp_Ax2_2(
      new oc.gp_Pnt_3(x, -20, p.screw_z),
      new oc.gp_Dir_4(0, 1, 0),   // cylinder axis along +Y
      new oc.gp_Dir_4(1, 0, 0)
    );
    holes.push(new oc.BRepPrimAPI_MakeCylinder_3(ax, r, yLen).Shape());
  }

  return holes;
}

function tryFilletPocketRegion(oc, shape, radius, p) {
  /**
   * Best-effort filleting of edges near the pocket region.
   *
   * - Filters edges by approximate center-of-mass location:
   *   - Near the front (small Y)
   *   - Within pocket depth (Y <= grip_depth + margin)
   *   - Within pocket Z span (zBot..zTop + margin)
   * - If fillet fails, returns the unmodified shape.
   */
  try {
    const mk = new oc.BRepFilletAPI_MakeFillet(
      shape,
      oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0
    );

    const zBot = p._pocket_z_bot;
    const zTop = p._pocket_z_top;
    const yMax = p.grip_depth + 2.0;

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

      const y = c.Y();
      const z = c.Z();

      const inY = y >= -1.0 && y <= yMax;
      const inZ = z >= (zBot - 1.0) && z <= (zTop + 1.0);

      if (inY && inZ) {
        mk.Add_2(radius, edge);
        added++;
      }

      exp.Next();
    }

    if (added === 0) return shape;

    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return mk.Shape();
  } catch (e) {
    // Intentionally silent; keep model build robust.
  }
  return shape;
}

function shiftToZ0(oc, shape) {
  /**
   * Translate the shape so its bounding box minimum Z becomes 0.
   *
   * - Useful if later edits add rotations or negative offsets.
   */
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const zMin = bbox.CornerMin().Z();
  if (!Number.isFinite(zMin) || Math.abs(zMin) < 1e-9) return shape;

  const tr = new oc.gp_Trsf_1();
  tr.SetTranslation_1(new oc.gp_Vec_4(0, 0, -zMin));
  return new oc.BRepBuilderAPI_Transform_2(shape, tr, true).Shape();
}

function makeBox(oc, x, y, z, dx, dy, dz) {
  /**
   * Construct an axis-aligned box by translating a primitive.
   *
   * - Uses BRepPrimAPI_MakeBox and then translates to (x,y,z).
   */
  const b = new oc.BRepPrimAPI_MakeBox_2(dx, dy, dz).Shape();
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12 && Math.abs(z) < 1e-12) return b;

  const tr = new oc.gp_Trsf_1();
  tr.SetTranslation_1(new oc.gp_Vec_4(x, y, z));
  return new oc.BRepBuilderAPI_Transform_2(b, tr, true).Shape();
}

function makeFaceFromYZPolygonAtX(oc, x, ptsYZ) {
  /**
   * Create a planar face from a polygon described in (Y,Z) at fixed X.
   *
   * - ptsYZ: array of [y, z] in order (closed implicitly).
   * - Returns TopoDS_Face suitable for extrusion via MakePrism.
   */
  const poly = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const [y, z] of ptsYZ) {
    poly.Add_1(new oc.gp_Pnt_3(x, y, z));
  }
  poly.Close();
  const wire = poly.Wire();
  return new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face();
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  /**
   * Robust-ish boolean cut with optional fuzzy tolerance.
   *
   * - Returns original shape on failure to keep UI responsive.
   */
  const pr = oc.createProgressRange();
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, pr);
  if (fuzzy > 0 && typeof op.SetFuzzyValue === "function") op.SetFuzzyValue(fuzzy);
  op.Build(pr);
  return op.IsDone() ? op.Shape() : a;
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
