// src/models/portable_hangboard.js

/**
 * Parametric B-rep model using OpenCascade.js bindings.
 * Units: mm
 *
 * Fingerboard-like tapered base (depthBottom -> depthTop) with a side-open finger slot
 * made by boolean-cutting a smaller tapered volume that deliberately protrudes out +X.
 *
 * Returns: oc.TopoDS_Shape
 */
export function buildPortableHangboardBrep(oc, params) {
  const p = normalizeParams(params);

  // Outer tapered body (loft between two rectangles)
  let outer = makeTaperedBlockLoft(oc, {
    width: p.width,
    height: p.height,
    depthBottom: p.depthBottom,
    depthTop: p.depthTop,
    x0: 0,
    y0: 0,
    z0: 0
  });

  // Inner "negative" to create a finger slot opening on +X side.
  // Inset in Y and Z by 'wall', mostly inset in X, but extended by openSideExtra
  // so it protrudes past x=width and opens the slot.
  const inner = makeTaperedBlockLoft(oc, {
    width: Math.max(1, (p.width - 2 * p.wall) + p.openSideExtra),
    height: Math.max(1, p.height - 2 * p.wall),
    depthBottom: Math.max(1, p.depthBottom - 2 * p.wall),
    depthTop: Math.max(1, p.depthTop - 2 * p.wall),
    x0: p.wall,
    y0: p.wall,
    z0: p.wall
  });

  let shape = booleanCutAdaptive(oc, outer, inner);

  // Optional fillet after cut (post-boolean fillets can be fragile)
  if (p.radius > 1e-9) {
    shape = filletAllEdges(oc, shape, p.radius);
  }

  return shape;
}

/** Build a tapered block by lofting two rectangles at z=z0 and z=z0+height. */
function makeTaperedBlockLoft(oc, { width, height, depthBottom, depthTop, x0, y0, z0 }) {
  const w0 = makeRectangleWire(oc, x0, y0, z0, width, depthBottom);
  const w1 = makeRectangleWire(oc, x0, y0, z0 + height, width, depthTop);

  const Thru = oc.BRepOffsetAPI_ThruSections;
  if (typeof Thru !== "function") {
    throw new Error("oc.BRepOffsetAPI_ThruSections not available in this OpenCascade.js build.");
  }

  const mk = makeThruSections(oc, /*isSolid*/ true, /*ruled*/ false, /*tol*/ 1e-6);

  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w0]);
  callFirstExisting(mk, ["AddWire_1", "AddWire"], [w1]);

  // Some builds require CheckCompatibility(true) for section lofts; harmless if missing.
  tryCallFirstExisting(mk, ["CheckCompatibility_1", "CheckCompatibility"], [true]);

  // Build overloads vary; try with/without progress range.
  tryCallFirstExisting(mk, ["Build_1", "Build"], [new oc.Message_ProgressRange_1()]);
  tryCallFirstExisting(mk, ["Build"], []);

  if (typeof mk.IsDone === "function" && !mk.IsDone()) {
    throw new Error("ThruSections failed (IsDone() == false).");
  }
  if (typeof mk.Shape !== "function") {
    throw new Error("ThruSections builder has no Shape() method in this build.");
  }

  return mk.Shape();
}

function makeThruSections(oc, isSolid, ruled, tol) {
  const C = oc.BRepOffsetAPI_ThruSections;

  // Prefer ctors that explicitly take isSolid so the result is a Solid, not just a Shell.
  const ctors = [
    () => new C(isSolid, ruled, tol),
    () => new C(isSolid, ruled),
    () => new C(isSolid),
    () => new C()
  ];

  let mk = null;
  for (const fn of ctors) {
    try {
      const obj = fn();
      if (obj && (obj.AddWire || obj.AddWire_1) && typeof obj.Shape === "function") {
        mk = obj;
        break;
      }
    } catch (_) {
      // continue
    }
  }

  if (!mk) {
    throw new Error("Could not construct BRepOffsetAPI_ThruSections with available overloads.");
  }

  // If the ctor didn't accept isSolid/ruled, set them via setters when available.
  tryCallFirstExisting(mk, ["SetSolid_1", "SetSolid"], [!!isSolid]);
  tryCallFirstExisting(mk, ["SetRuled_1", "SetRuled"], [!!ruled]);
  if (Number.isFinite(tol)) tryCallFirstExisting(mk, ["SetPres3d_1", "SetPres3d"], [tol]);

  return mk;
}

/** Rectangle wire in XY plane at fixed Z: x:[x0..x0+w], y:[y0..y0+d]. */
function makeRectangleWire(oc, x0, y0, z, w, d) {
  const mkPoly = new oc.BRepBuilderAPI_MakePolygon_1();

  const p0 = new oc.gp_Pnt_3(x0, y0, z);
  const p1 = new oc.gp_Pnt_3(x0 + w, y0, z);
  const p2 = new oc.gp_Pnt_3(x0 + w, y0 + d, z);
  const p3 = new oc.gp_Pnt_3(x0, y0 + d, z);

  callFirstExisting(mkPoly, ["Add_1", "Add"], [p0]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p1]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p2]);
  callFirstExisting(mkPoly, ["Add_1", "Add"], [p3]);

  callFirstExisting(mkPoly, ["Close_1", "Close"], []);
  if (typeof mkPoly.Wire !== "function") throw new Error("MakePolygon has no Wire() in this build.");
  return mkPoly.Wire();
}

/**
 * Adaptive boolean cut across OpenCascade.js builds.
 * Tries BRepAlgoAPI_Cut and common suffixed overload names, and multiple build paths.
 */
function booleanCutAdaptive(oc, a, b) {
  const candidates = [];

  // Common names: BRepAlgoAPI_Cut and BRepAlgoAPI_Cut_1/_2/...
  if (typeof oc.BRepAlgoAPI_Cut === "function") candidates.push(oc.BRepAlgoAPI_Cut);
  for (let i = 1; i <= 9; i++) {
    const k = `BRepAlgoAPI_Cut_${i}`;
    if (typeof oc[k] === "function") candidates.push(oc[k]);
  }

  // If nothing obvious exists, fail with diagnostics.
  if (candidates.length === 0) {
    const hint = Object.keys(oc).filter((k) => k.includes("BRepAlgoAPI")).slice(0, 60);
    throw new Error(`No BRepAlgoAPI_Cut constructor found. Seen keys: ${hint.join(", ")}`);
  }

  const progress = safeNewProgressRange(oc);

  // Try ctor-based APIs first.
  for (const C of candidates) {
    const ctors = [
      () => new C(a, b),
      () => (progress ? new C(a, b, progress) : null),
      () => new C()
    ].filter(Boolean);

    for (const make of ctors) {
      let op = null;
      try {
        op = make();
      } catch (_) {
        continue;
      }
      if (!op) continue;

      // Some builds require setting args/tools explicitly when using default ctor.
      // Try both direct-shape setters and list-based setters (if available).
      trySetArgsAndTools(oc, op, a, b);

      // Build overloads vary.
      tryCallFirstExisting(op, ["Build_1", "Build"], progress ? [progress] : []);
      tryCallFirstExisting(op, ["Build"], []);

      if (typeof op.IsDone === "function" && !op.IsDone()) continue;
      if (typeof op.Shape === "function") {
        try {
          const out = op.Shape();
          if (out) return out;
        } catch (_) {
          // continue
        }
      }
    }
  }

  // If it still fails, provide helpful diagnostics for the current build.
  const seen = Object.keys(oc)
    .filter((k) => k.includes("BRepAlgoAPI_Cut") || k.includes("BRepAlgoAPI_Boolean") || k.includes("BOPAlgo"))
    .slice(0, 80);

  throw new Error(
    "Boolean cut failed (could not build or no Shape()). " +
      `Seen boolean-related keys: ${seen.join(", ")}`
  );
}

function trySetArgsAndTools(oc, op, a, b) {
  // Direct setters (some builds)
  if (typeof op.SetArguments === "function") {
    const list = makeShapeList(oc, [a]);
    if (list) {
      try {
        op.SetArguments(list);
      } catch (_) {}
    }
  }
  if (typeof op.SetTools === "function") {
    const list = makeShapeList(oc, [b]);
    if (list) {
      try {
        op.SetTools(list);
      } catch (_) {}
    }
  }

  // Some builds: SetShape1/SetShape2
  tryCallFirstExisting(op, ["SetShape1_1", "SetShape1"], [a]);
  tryCallFirstExisting(op, ["SetShape2_1", "SetShape2"], [b]);

  // Sometimes: SetArgument/SetTool single-shape
  tryCallFirstExisting(op, ["SetArgument_1", "SetArgument"], [a]);
  tryCallFirstExisting(op, ["SetTool_1", "SetTool"], [b]);

  // Optional tolerance/fuzzy value improves robustness when shapes touch.
  tryCallFirstExisting(op, ["SetFuzzyValue_1", "SetFuzzyValue"], [1e-6]);
}

function makeShapeList(oc, shapes) {
  // Try the common containers used in OCCT boolean APIs.
  const listCands = ["TopTools_ListOfShape", "TopTools_ListOfShape_1"];
  for (const name of listCands) {
    const L = oc[name];
    if (typeof L !== "function") continue;
    try {
      const list = new L();
      for (const s of shapes) {
        // Push/Append naming varies
        if (!tryCallFirstExisting(list, ["Append_1", "Append", "Push_1", "Push"], [s])) return null;
      }
      return list;
    } catch (_) {
      // try next
    }
  }
  return null;
}

function safeNewProgressRange(oc) {
  try {
    if (typeof oc.Message_ProgressRange_1 === "function") return new oc.Message_ProgressRange_1();
    if (typeof oc.Message_ProgressRange === "function") return new oc.Message_ProgressRange();
  } catch (_) {}
  return null;
}

/* --- existing fillet helpers --- */

function filletAllEdges(oc, shape, radius) {
  const filletMode = pickFilletShapeEnum(oc);
  const mk = makeMakeFillet(oc, shape, filletMode);

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    callFirstExisting(mk, ["Add_2", "Add_1", "Add"], [radius, edge]);
  }

  tryCallFirstExisting(mk, ["Build_1", "Build"], [new oc.Message_ProgressRange_1()]);
  tryCallFirstExisting(mk, ["Build"], []);

  const isDone = mk.IsDone ? mk.IsDone() : true;
  if (!isDone) {
    throw new Error("Fillet failed (IsDone() == false). Try a smaller radius.");
  }
  if (typeof mk.Shape !== "function") {
    throw new Error("Fillet builder has no Shape() method in this build.");
  }
  return mk.Shape();
}

function makeMakeFillet(oc, shape, filletMode) {
  const C = oc.BRepFilletAPI_MakeFillet;
  if (typeof C !== "function") {
    throw new Error("oc.BRepFilletAPI_MakeFillet not available in this OpenCascade.js build.");
  }

  const ctors = [() => new C(shape, filletMode), () => new C(shape)];

  for (const fn of ctors) {
    try {
      const obj = fn();
      if (obj && (obj.Add || obj.Add_1 || obj.Add_2) && typeof obj.Shape === "function") return obj;
    } catch (_) {
      // continue
    }
  }

  const keys = Object.keys(oc).filter((k) => k.includes("BRepFilletAPI_MakeFillet")).slice(0, 20);
  throw new Error(
    "Could not construct BRepFilletAPI_MakeFillet with available overloads. " +
      `Seen keys: ${keys.join(", ")}`
  );
}

function callFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  throw new Error(`Missing method. Tried: ${methodNames.join(", ")}`);
}

function tryCallFirstExisting(obj, methodNames, args) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") {
      try {
        return fn.apply(obj, args);
      } catch (_) {
        return null;
      }
    }
  }
  return null;
}

function pickFilletShapeEnum(oc) {
  const e = oc.ChFi3d_FilletShape;
  if (e && typeof e === "object") {
    if ("ChFi3d_Rational" in e) return e.ChFi3d_Rational;
    if ("ChFi3d_QuasiAngular" in e) return e.ChFi3d_QuasiAngular;
    if ("ChFi3d_Polynomial" in e) return e.ChFi3d_Polynomial;
    if ("ChFi3d_ConstThroat" in e) return e.ChFi3d_ConstThroat;
  }
  return 0;
}

function normalizeParams(params) {
  const width = clampNum(params?.width ?? 180, 60, 400);
  const height = clampNum(params?.height ?? 55, 20, 120);

  const depthBottom = clampNum(params?.depthBottom ?? 22, 8, 120);
  const depthTop = clampNum(params?.depthTop ?? 14, 4, depthBottom);

  // Slot wall thickness + protrusion to open on +X side
  const wall = clampNum(params?.wall ?? 4, 1, 0.45 * Math.min(width, height, depthTop, depthBottom));
  const openSideExtra = clampNum(params?.openSideExtra ?? 6, 0.5, 30);

  // Fillet radius (post-boolean)
  const maxR = 0.2 * Math.min(width, height, depthTop, depthBottom);
  const radius = clampNum(params?.radius ?? 0, 0, maxR);

  // Sanity: ensure inner dimensions won't collapse too easily.
  // (Leave behavior permissive; boolean may still fail for extreme params.)
  if (width - 2 * wall < 1 || height - 2 * wall < 1) {
    throw new Error("wall is too large relative to width/height; inner cavity would be degenerate.");
  }
  if (depthBottom - 2 * wall < 1 || depthTop - 2 * wall < 1) {
    throw new Error("wall is too large relative to depth; inner cavity would be degenerate.");
  }

  return { width, height, depthBottom, depthTop, wall, openSideExtra, radius };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
