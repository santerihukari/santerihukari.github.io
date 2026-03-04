import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh by extracting Poly_Triangulation from faces.
 *
 * This avoids RWGltf_CafWriter / XCAF completely and is typically the most reliable
 * minimal visualization pipeline for OCCT in the browser.
 *
 * Returns: THREE.Mesh
 */
export function tessellateToMesh(oc, shape, opts = {}) {
  const linearDeflection = numberOr(opts.linearDeflection, 0.25);
  const angularDeflection = numberOr(opts.angularDeflection, 0.25);

  // Ensure the shape has triangulation
  // BRepMesh_IncrementalMesh(shape, defl, isRelative, angDefl, inParallel)
  new oc.BRepMesh_IncrementalMesh_2(
    shape,
    linearDeflection,
    false,
    angularDeflection,
    false
  );

  const positions = [];
  const indices = [];
  let vertexBase = 0;

  // Iterate faces
  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; exp.More(); exp.Next()) {
    const face = oc.TopoDS.Face_1(exp.Current());

    // BRep_Tool::Triangulation(face, loc)
    const loc = new oc.TopLoc_Location_1();
    const tri = callTriangulation(oc, face, loc);
    if (!tri || tri.IsNull?.() === true) continue;

    // Transformation from location (if any)
    const trsf = loc.Transformation ? loc.Transformation() : null;

    // Nodes (1-based array in OCCT)
    const nodes = tri.Nodes();
    const nLower = nodes.Lower();
    const nUpper = nodes.Upper();

    // Map local node index -> vertex index in this geometry chunk
    const nodeToVert = new Map();

    for (let i = nLower; i <= nUpper; i++) {
      const p = nodes.Value(i);

      let x = p.X();
      let y = p.Y();
      let z = p.Z();

      if (trsf) {
        // Apply transformation to gp_Pnt
        // In OCCT: gp_Pnt::Transformed(trsf) or trsf.Transforms(pnt)
        // Binding variability: handle common patterns.
        const tp = transformPoint(oc, p, trsf);
        x = tp[0]; y = tp[1]; z = tp[2];
      }

      positions.push(x, y, z);
      nodeToVert.set(i, vertexBase++);
    }

    // Triangles (also 1-based array)
    const tris = tri.Triangles();
    const tLower = tris.Lower();
    const tUpper = tris.Upper();

    for (let t = tLower; t <= tUpper; t++) {
      const polyTri = tris.Value(t);

      // Poly_Triangle gives node indices (n1,n2,n3)
      const a = getTriIndex(polyTri, 1);
      const b = getTriIndex(polyTri, 2);
      const c = getTriIndex(polyTri, 3);

      const ia = nodeToVert.get(a);
      const ib = nodeToVert.get(b);
      const ic = nodeToVert.get(c);
      if (ia === undefined || ib === undefined || ic === undefined) continue;

      // Orientation: OCCT face orientation might flip triangles; for now just push.
      indices.push(ia, ib, ic);
    }
  }

  if (positions.length === 0 || indices.length === 0) {
    throw new Error("Tessellation produced no triangles. Check meshing / shape validity.");
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

function callTriangulation(oc, face, loc) {
  // Binding name variability; try common patterns.
  // Prefer BRep_Tool.Triangulation(face, loc) if present.
  const bt = oc.BRep_Tool;
  if (!bt) throw new Error("oc.BRep_Tool not available in this OpenCascade.js build.");

  // Most builds expose it as a static function:
  // oc.BRep_Tool.Triangulation(face, loc) OR oc.BRep_Tool.Triangulation_2(face, loc)
  if (typeof bt.Triangulation === "function") return bt.Triangulation(face, loc);
  if (typeof bt.Triangulation_2 === "function") return bt.Triangulation_2(face, loc);

  // Some builds expose BRepTool (older naming)
  if (oc.BRepTool && typeof oc.BRepTool.Triangulation === "function") return oc.BRepTool.Triangulation(face, loc);

  throw new Error("BRep_Tool::Triangulation binding not found.");
}

function getTriIndex(polyTri, corner /*1..3*/) {
  // Binding variability:
  // - polyTri.Value(1) / Value(2) / Value(3)
  // - polyTri.Get( ... ) into references (rare in JS)
  if (typeof polyTri.Value === "function") return polyTri.Value(corner);
  if (typeof polyTri.Value_1 === "function") return polyTri.Value_1(corner);

  // As a last resort, some bindings have "Get" that returns an array
  if (typeof polyTri.Get === "function") {
    const arr = polyTri.Get();
    return arr[corner - 1];
  }

  throw new Error("Poly_Triangle index accessor not found (Value/Get).");
}

function transformPoint(oc, pnt, trsf) {
  // Try gp_Pnt.Transformed(trsf)
  if (typeof pnt.Transformed === "function") {
    const tp = pnt.Transformed(trsf);
    return [tp.X(), tp.Y(), tp.Z()];
  }

  // Try creating a copy and applying trsf.Transforms(pnt)
  if (typeof trsf.Transforms === "function") {
    const cp = new oc.gp_Pnt_3(pnt.X(), pnt.Y(), pnt.Z());
    trsf.Transforms(cp);
    return [cp.X(), cp.Y(), cp.Z()];
  }

  // If no transform methods available, return original
  return [pnt.X(), pnt.Y(), pnt.Z()];
}
