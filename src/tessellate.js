import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh by extracting Poly_Triangulation from faces.
 *
 * This version is defensive against OpenCascade.js binding variability:
 * - BRep_Tool::Triangulation can be 2-arg or 3-arg
 * - Triangulation is often returned as a Handle_... (needs .get()/.Get())
 * - Nodes/Triangles accessors sometimes have suffixes or alternative names
 */
export function tessellateToMesh(oc, shape, opts = {}) {
  const linearDeflection = numberOr(opts.linearDeflection, 0.25);
  const angularDeflection = numberOr(opts.angularDeflection, 0.25);

  // Build triangulation
  new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);

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
    const triHandle = callTriangulationAdaptive(oc, face, loc);
    if (!triHandle) continue;

    const tri = unwrapHandle(triHandle);
    if (!tri) continue;

    const nodesArr = callFirstExisting(tri, ["Nodes", "Nodes_1", "Nodes_2"]);
    const trisArr = callFirstExisting(tri, ["Triangles", "Triangles_1", "Triangles_2"]);

    if (!nodesArr || !trisArr) continue;

    const trsf = typeof loc.Transformation === "function" ? loc.Transformation() : null;

    // Nodes: TColgp_Array1OfPnt (1-based)
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

    // Triangles: Poly_Array1OfTriangle (1-based)
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
    throw new Error(
      "Tessellation produced no triangles. " +
      "Meshing succeeded but triangulation extraction returned empty."
    );
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

function numberOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unwrapHandle(h) {
  // OpenCascade.js commonly wraps Handles with .get() or .Get()
  if (!h) return null;

  // Some handles have IsNull()
  if (typeof h.IsNull === "function" && h.IsNull()) return null;

  if (typeof h.get === "function") return h.get();
  if (typeof h.Get === "function") return h.Get();

  // Sometimes the binding already returns the raw object
  return h;
}

function callFirstExisting(obj, methodNames, args = []) {
  for (const name of methodNames) {
    const fn = obj?.[name];
    if (typeof fn === "function") return fn.apply(obj, args);
  }
  return null;
}

function callTriangulationAdaptive(oc, face, loc) {
  const bt = oc.BRep_Tool;
  if (!bt) throw new Error("oc.BRep_Tool not available in this OpenCascade.js build.");

  const purpose = pickMeshPurpose(oc);

  // Try most likely signatures / overload names.
  const attempts = [
    // 3 args
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc, purpose) : null),
    () => (typeof bt.Triangulation_3 === "function" ? bt.Triangulation_3(face, loc, purpose) : null),

    // 2 args
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc) : null),
    () => (typeof bt.Triangulation_2 === "function" ? bt.Triangulation_2(face, loc) : null),

    // Alternate namespace some builds
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

  throw new Error(`BRep_Tool::Triangulation binding failed. Last error: ${lastErr?.message || String(lastErr)}`);
}

function pickMeshPurpose(oc) {
  const p = oc.Poly_MeshPurpose;
  if (p && typeof p === "object") {
    if ("Poly_MeshPurpose_Presentation" in p) return p.Poly_MeshPurpose_Presentation;
    if ("Poly_MeshPurpose_Calculation" in p) return p.Poly_MeshPurpose_Calculation;
    if ("Poly_MeshPurpose_NONE" in p) return p.Poly_MeshPurpose_NONE;
  }
  return 0;
}

function getTriIndex(polyTri, corner /*1..3*/) {
  // Many builds: polyTri.Value(1..3)
  if (typeof polyTri.Value === "function") return polyTri.Value(corner);
  if (typeof polyTri.Value_1 === "function") return polyTri.Value_1(corner);

  // Some builds provide Get() returning [a,b,c]
  if (typeof polyTri.Get === "function") {
    const arr = polyTri.Get();
    return arr[corner - 1];
  }

  // Rare: accessors A/B/C
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
