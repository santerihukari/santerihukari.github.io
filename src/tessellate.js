import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh by extracting Poly_Triangulation from faces.
 * Uses BRepMesh_IncrementalMesh, then BRep_Tool::Triangulation(face, loc, purpose?) depending on bindings.
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
    const tri = callTriangulationAdaptive(oc, face, loc);
    if (!tri || (typeof tri.IsNull === "function" && tri.IsNull())) continue;

    const trsf = typeof loc.Transformation === "function" ? loc.Transformation() : null;

    const nodes = tri.Nodes();
    const nLower = nodes.Lower();
    const nUpper = nodes.Upper();

    const nodeToVert = new Map();

    for (let i = nLower; i <= nUpper; i++) {
      const p = nodes.Value(i);

      let x = p.X(), y = p.Y(), z = p.Z();
      if (trsf) {
        const tp = transformPoint(oc, p, trsf);
        x = tp[0]; y = tp[1]; z = tp[2];
      }

      positions.push(x, y, z);
      nodeToVert.set(i, vertexBase++);
    }

    const tris = tri.Triangles();
    const tLower = tris.Lower();
    const tUpper = tris.Upper();

    for (let t = tLower; t <= tUpper; t++) {
      const polyTri = tris.Value(t);

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
    throw new Error("Tessellation produced no triangles. Check meshing / triangulation extraction.");
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

function callTriangulationAdaptive(oc, face, loc) {
  const bt = oc.BRep_Tool;
  if (!bt) throw new Error("oc.BRep_Tool not available in this OpenCascade.js build.");

  // Determine "purpose" enum value (if present)
  const purpose = pickMeshPurpose(oc);

  // Try the most likely bindings / overload names in order.
  const candidates = [
    // Common in newer OCCT: Triangulation(face, loc, purpose)
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc, purpose) : null),
    () => (typeof bt.Triangulation_3 === "function" ? bt.Triangulation_3(face, loc, purpose) : null),

    // Older / other builds: Triangulation(face, loc)
    () => (typeof bt.Triangulation === "function" ? bt.Triangulation(face, loc) : null),
    () => (typeof bt.Triangulation_2 === "function" ? bt.Triangulation_2(face, loc) : null),

    // Alternate naming some builds might have
    () => (oc.BRepTool && typeof oc.BRepTool.Triangulation === "function" ? oc.BRepTool.Triangulation(face, loc, purpose) : null),
    () => (oc.BRepTool && typeof oc.BRepTool.Triangulation === "function" ? oc.BRepTool.Triangulation(face, loc) : null),
  ];

  let lastErr = null;
  for (const fn of candidates) {
    try {
      const tri = fn();
      if (tri) return tri;
    } catch (e) {
      lastErr = e;
    }
  }

  // Surface a useful error
  const msg = lastErr?.message || String(lastErr || "Unknown error");
  throw new Error(`BRep_Tool::Triangulation binding failed. Last error: ${msg}`);
}

function pickMeshPurpose(oc) {
  // OCCT has Poly_MeshPurpose (Presentation/Calculation/etc). :contentReference[oaicite:1]{index=1}
  // Different builds expose enum names differently; choose any sane default.
  const p = oc.Poly_MeshPurpose;
  if (p && typeof p === "object") {
    if ("Poly_MeshPurpose_Presentation" in p) return p.Poly_MeshPurpose_Presentation;
    if ("Poly_MeshPurpose_Calculation" in p) return p.Poly_MeshPurpose_Calculation;
    if ("Poly_MeshPurpose_NONE" in p) return p.Poly_MeshPurpose_NONE;
  }
  // Fallback integer enum value (often 0 = NONE)
  return 0;
}

function getTriIndex(polyTri, corner /*1..3*/) {
  if (typeof polyTri.Value === "function") return polyTri.Value(corner);
  if (typeof polyTri.Value_1 === "function") return polyTri.Value_1(corner);
  if (typeof polyTri.Get === "function") {
    const arr = polyTri.Get();
    return arr[corner - 1];
  }
  throw new Error("Poly_Triangle index accessor not found (Value/Get).");
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
