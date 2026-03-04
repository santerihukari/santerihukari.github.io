import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh by extracting Poly_Triangulation from faces.
 *
 * Key point for newer OCCT:
 * - BRep_Tool::Triangulation(face, loc, purpose) can return null depending on Poly_MeshPurpose.
 * - Poly_MeshPurpose_AnyFallback is a special flag telling OCCT to return any available triangulation.
 *
 * Source: Poly_MeshPurpose.hxx enum includes Poly_MeshPurpose_AnyFallback. :contentReference[oaicite:1]{index=1}
 */
export function tessellateToMesh(oc, shape, opts = {}) {
  const linearDeflection = numberOr(opts.linearDeflection, 0.25);
  const angularDeflection = numberOr(opts.angularDeflection, 0.25);

  // Generate mesh on faces
  new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);

  const positions = [];
  const indices = [];
  let vertexBase = 0;

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  const anyFallback = getAnyFallbackPurpose(oc);

  for (; exp.More(); exp.Next()) {
    const face = oc.TopoDS.Face_1(exp.Current());

    const loc = new oc.TopLoc_Location_1();
    const triHandle = callTriangulation(oc, face, loc, anyFallback);
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
    throw new Error(
      "Tessellation produced no triangles. " +
      "Triangulation handles were null/empty even with AnyFallback. " +
      "Next step: verify the mesher ctor overload for your build."
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

function getAnyFallbackPurpose(oc) {
  // Builds differ: sometimes enums live under oc.Poly_MeshPurpose, sometimes as top-level constants.
  const p = oc.Poly_MeshPurpose;
  if (p && typeof p === "object" && "Poly_MeshPurpose_AnyFallback" in p) return p.Poly_MeshPurpose_AnyFallback;
  if ("Poly_MeshPurpose_AnyFallback" in oc) return oc.Poly_MeshPurpose_AnyFallback;

  // If missing, use a reasonable fallback: Presentation|Calculation|Active|Loaded|USER etc is NOT safe;
  // but numeric fallback sometimes works. AnyFallback is defined after 0x0008 in enum; value varies by build,
  // so do NOT guess. Force an explicit error so it’s obvious.
  throw new Error("Poly_MeshPurpose_AnyFallback not found in this OCCT build.");
}

function callTriangulation(oc, face, loc, purposeAnyFallback) {
  const bt = oc.BRep_Tool;
  if (!bt) throw new Error("oc.BRep_Tool not available in this OpenCascade.js build.");

  // Your build earlier complained Triangulation expected 3 args → prefer 3-arg call.
  const attempts = [
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc, purposeAnyFallback) : null),
    () => (typeof bt.Triangulation_3 === "function" ? bt.Triangulation_3(face, loc, purposeAnyFallback) : null),

    // fallback for older builds
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc) : null),
    () => (typeof bt.Triangulation_2 === "function" ? bt.Triangulation_2(face, loc) : null),
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

  throw new Error(`BRep_Tool::Triangulation failed. ${lastErr?.message || String(lastErr || "")}`);
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
