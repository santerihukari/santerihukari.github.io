import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh by extracting Poly_Triangulation from faces.
 *
 * This build is purpose-aware:
 * - Some OCCT builds store triangulation per Poly_MeshPurpose.
 * - Passing "NONE/0" can yield empty triangulation arrays.
 *
 * Strategy:
 * 1) Run meshing (try overloads, including purpose if available).
 * 2) Try extracting triangulation for a sequence of purpose candidates until triangles appear.
 */
export function tessellateToMesh(oc, shape, opts = {}) {
  const linearDeflection = numberOr(opts.linearDeflection, 0.25);
  const angularDeflection = numberOr(opts.angularDeflection, 0.25);

  // Purpose candidates (try "Presentation" first if exposed)
  const purposeCandidates = getPurposeCandidates(oc);

  // (1) Run meshing – try with purpose when supported, otherwise basic overload.
  meshShapeAdaptive(oc, shape, linearDeflection, angularDeflection, purposeCandidates);

  // (2) Extract triangles – try purposes until something is found.
  let lastErr = null;
  for (const purpose of purposeCandidates) {
    try {
      const mesh = extractMeshForPurpose(oc, shape, purpose);
      if (mesh) return mesh;
    } catch (e) {
      lastErr = e;
    }
  }

  // If nothing worked, give a concrete error
  const msg = lastErr?.message || "no additional detail";
  throw new Error(
    "Tessellation produced no triangles. " +
      "Likely a Poly_MeshPurpose mismatch or a binding overload mismatch. " +
      `Last error: ${msg}`
  );
}

function extractMeshForPurpose(oc, shape, purpose) {
  const positions = [];
  const indices = [];
  let vertexBase = 0;

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const face = oc.TopoDS.Face_1(exp.Current());

    const loc = new oc.TopLoc_Location_1();
    const triHandle = callTriangulationAdaptive(oc, face, loc, purpose);
    if (!triHandle) continue;

    const tri = unwrapHandle(triHandle);
    if (!tri) continue;

    const nodesArr = callFirstExisting(tri, ["Nodes", "Nodes_1", "Nodes_2"]);
    const trisArr = callFirstExisting(tri, ["Triangles", "Triangles_1", "Triangles_2"]);
    if (!nodesArr || !trisArr) continue;

    const trsf = typeof loc.Transformation === "function" ? loc.Transformation() : null;

    const nLower = nodesArr.Lower();
    const nUpper = nodesArr.Upper();

    const nodeToVert = new Map();
    for (let i = nLower; i <= nUpper; i++) {
      const p = nodesArr.Value(i);

      let x = p.X(), y = p.Y(), z = p.Z();
      if (trsf) {
        const tp = transformPoint(oc, p, trsf);
        x = tp[0]; y = tp[1]; z = tp[2];
      }

      positions.push(x, y, z);
      nodeToVert.set(i, vertexBase++);
    }

    const tLower = trisArr.Lower();
    const tUpper = trisArr.Upper();

    for (let t = tLower; t <= tUpper; t++) {
      const polyTri = trisArr.Value(t);

      const a = getTriIndex(polyTri, 1);
      const b = getTriIndex(polyTri, 2);
      const c = getTriIndex(polyTri, 3);

      const ia = nodeToVert.get(a);
      const ib = nodeToVert.get(b);
      const ic = nodeToVert.get(c);
      if (ia === undefined || ib === undefined || ic === undefined) continue;

      indices.push(ia, ib, ic);
    }
  }

  if (positions.length === 0 || indices.length === 0) {
    // No triangles for this purpose → signal "try next purpose"
    return null;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    metalness: 0.1,
    roughness: 0.55
  });

  return new THREE.Mesh(geom, mat);
}

function meshShapeAdaptive(oc, shape, linearDeflection, angularDeflection, purposes) {
  // Try overloads that include purpose if they exist in this build.
  // Many builds still only have the 5-arg overload (_2) you were using earlier.
  const ctorNames = [
    "BRepMesh_IncrementalMesh_3",
    "BRepMesh_IncrementalMesh_2",
    "BRepMesh_IncrementalMesh"
  ];

  for (const name of ctorNames) {
    const C = oc[name];
    if (typeof C !== "function") continue;

    // Try meshing with a non-NONE purpose first (often required)
    for (const purpose of purposes) {
      // Heuristic: try a 6-arg signature first (shape, defl, rel, ang, parallel, purpose),
      // then fall back to 5 args.
      const attempts = [
        () => new C(shape, linearDeflection, false, angularDeflection, false, purpose),
        () => new C(shape, linearDeflection, false, angularDeflection, false)
      ];

      for (const fn of attempts) {
        try {
          const m = fn();
          // Some bindings require an explicit Perform/Build; try if available.
          if (m && typeof m.Perform === "function") m.Perform();
          if (m && typeof m.Perform_1 === "function") m.Perform_1();
          if (m && typeof m.Build === "function") m.Build();
          if (m && typeof m.Build_1 === "function") m.Build_1();
          return; // meshing invoked; extraction will validate
        } catch (_) {
          // try next attempt
        }
      }
    }
  }

  // As a last resort, try the known 5-arg overload name directly if present.
  if (typeof oc.BRepMesh_IncrementalMesh_2 === "function") {
    new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);
    return;
  }

  throw new Error("No usable BRepMesh_IncrementalMesh constructor found in this OpenCascade.js build.");
}

function getPurposeCandidates(oc) {
  const p = oc.Poly_MeshPurpose;

  // Prioritize Presentation if available
  const out = [];

  if (p && typeof p === "object") {
    if ("Poly_MeshPurpose_Presentation" in p) out.push(p.Poly_MeshPurpose_Presentation);
    if ("Poly_MeshPurpose_Calculation" in p) out.push(p.Poly_MeshPurpose_Calculation);
    if ("Poly_MeshPurpose_NONE" in p) out.push(p.Poly_MeshPurpose_NONE);
  }

  // Add numeric fallbacks (covers builds that map enums to 0/1/2)
  // Try 1/2 before 0, because 0 is often NONE.
  out.push(1, 2, 0);

  // De-dupe while preserving order
  return [...new Set(out)];
}

function callTriangulationAdaptive(oc, face, loc, purpose) {
  const bt = oc.BRep_Tool;
  if (!bt) throw new Error("oc.BRep_Tool not available in this OpenCascade.js build.");

  const attempts = [
    // 3 args is what your build complained about earlier
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc, purpose) : null),
    () => (typeof bt.Triangulation_3 === "function" ? bt.Triangulation_3(face, loc, purpose) : null),

    // 2 args (older builds)
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc) : null),
    () => (typeof bt.Triangulation_2 === "function" ? bt.Triangulation_2(face, loc) : null),

    // Alternate namespace some builds expose
    () => (oc.BRepTool && typeof oc.BRepTool.Triangulation === "function" ? oc.BRepTool.Triangulation(face, loc, purpose) : null),
    () => (oc.BRepTool && typeof oc.BRepTool.Triangulation === "function" ? oc.BRepTool.Triangulation(face, loc) : null)
  ];

  let lastErr = null;
  for (const fn of attempts) {
    try {
      const tri = fn();
      if (tri) return tri;
    } catch (e) {
      lastErr = e;
    }
  }

  // If this purpose failed due to a signature mismatch, allow caller to try next purpose.
  // But if it’s a hard binding miss, surface it.
  const msg = lastErr?.message || String(lastErr || "");
  throw new Error(`BRep_Tool::Triangulation failed (purpose=${String(purpose)}). ${msg}`);
}

function unwrapHandle(h) {
  if (!h) return null;
  if (typeof h.IsNull === "function" && h.IsNull()) return null;
  if (typeof h.get === "function") return h.get();
  if (typeof h.Get === "function") return h.Get();
  return h;
}

function callFirstExisting(obj, methodNames, args = []) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  return null;
}

function getTriIndex(polyTri, corner /*1..3*/) {
  if (typeof polyTri.Value === "function") return polyTri.Value(corner);
  if (typeof polyTri.Value_1 === "function") return polyTri.Value_1(corner);
  if (typeof polyTri.Get === "function") {
    const arr = polyTri.Get();
    return arr[corner - 1];
  }
  const k = corner === 1 ? "A" : corner === 2 ? "B" : "C";
  if (typeof polyTri[k] === "function") return polyTri[k]();
  throw new Error("Poly_Triangle index accessor not found (Value/Get/A-B-C).");
}

function transformPoint(oc, pnt, trsf) {
  if (typeof pnt.Transformed === "function") {
    const tp = pnt.Transformed(trsf);
    return [tp.X(), tp.Y(), tp.Z()];
  }
  if (typeof trsf.Transforms === "function") {
    const cp = new oc.gp_Pnt_3(pnt.X(), pnt.Y(), pnt.Z());
    trsf.Transforms(cp);
    return [cp.X(), cp.Y(), cp.Z()];
  }
  return [pnt.X(), pnt.Y(), pnt.Z()];
}

function numberOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
