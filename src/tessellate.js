import * as THREE from "three";

/**
 * Tessellate a TopoDS_Shape into a THREE.Mesh using your OCCT build's API:
 *
 * - Meshing: new oc.BRepMesh_IncrementalMesh_2(shape, linDefl, rel, angDefl, parallel)
 * - Triangulation: oc.BRep_Tool.Triangulation(face, loc, 0) -> Handle_Poly_Triangulation
 * - Access nodes via NbNodes() + Node(i)
 * - Access triangles via NbTriangles() + Triangle(i)
 *
 * The returned mesh is a single combined geometry for the whole shape.
 */
export function tessellateToMesh(oc, shape, opts = {}) {
  const linearDeflection = numberOr(opts.linearDeflection, 0.25);
  const angularDeflection = numberOr(opts.angularDeflection, 0.25);

  // Ensure triangulation exists
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

    // Your build: Triangulation expects 3 args and works with purpose=0
    const triHandle = oc.BRep_Tool.Triangulation(face, loc, 0);
    const tri = unwrapHandle(triHandle);
    if (!tri) continue;

    const nbNodes = tri.NbNodes();
    const nbTris = tri.NbTriangles();
    if (nbNodes <= 0 || nbTris <= 0) continue;

    const trsf = typeof loc.Transformation === "function" ? loc.Transformation() : null;

    // Map local node index (1..nbNodes) to global vertex index
    const nodeToVert = new Array(nbNodes + 1);

    for (let i = 1; i <= nbNodes; i++) {
      const p = tri.Node(i); // gp_Pnt
      let x = p.X(), y = p.Y(), z = p.Z();

      if (trsf) {
        const tp = transformPoint(oc, p, trsf);
        x = tp[0]; y = tp[1]; z = tp[2];
      }

      positions.push(x, y, z);
      nodeToVert[i] = vertexBase++;
    }

    // Handle face orientation (important for correct normals)
    const isReversed = isFaceReversed(oc, face);

    for (let t = 1; t <= nbTris; t++) {
      const polyTri = tri.Triangle(t);

      // Poly_Triangle index accessor (your earlier code path)
      const a = getTriIndex(polyTri, 1);
      const b = getTriIndex(polyTri, 2);
      const c = getTriIndex(polyTri, 3);

      const ia = nodeToVert[a];
      const ib = nodeToVert[b];
      const ic = nodeToVert[c];

      if (ia === undefined || ib === undefined || ic === undefined) continue;

      if (!isReversed) {
        indices.push(ia, ib, ic);
      } else {
        // flip winding
        indices.push(ia, ic, ib);
      }
    }
  }

  if (positions.length === 0 || indices.length === 0) {
    throw new Error(
      "Tessellation produced no triangles. " +
      "Triangulation exists but returned empty NbNodes/NbTriangles across faces."
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
  color: 0x9ca3af,
  metalness: 0.1,
  roughness: 0.55,
  side: THREE.DoubleSide
});

  return new THREE.Mesh(geom, mat);
}

function unwrapHandle(h) {
  if (!h) return null;
  if (typeof h.IsNull === "function" && h.IsNull()) return null;
  if (typeof h.get === "function") return h.get();
  if (typeof h.Get === "function") return h.Get();
  return h;
}

function getTriIndex(polyTri, corner /*1..3*/) {
  // Keep this conservative; only use accessors previously used successfully in your pipeline.
  if (typeof polyTri.Value === "function") return polyTri.Value(corner);
  if (typeof polyTri.Value_1 === "function") return polyTri.Value_1(corner);
  if (typeof polyTri.Get === "function") {
    const arr = polyTri.Get();
    return arr[corner - 1];
  }
  // Some bindings expose A/B/C getters
  const k = corner === 1 ? "A" : corner === 2 ? "B" : "C";
  if (typeof polyTri[k] === "function") return polyTri[k]();
  throw new Error("Poly_Triangle index accessor not found (Value/Get/A-B-C).");
}

function transformPoint(oc, pnt, trsf) {
  // These are the two common transform paths; keep them minimal.
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

function isFaceReversed(oc, face) {
  if (typeof face.Orientation !== "function") return false;
  const o = face.Orientation();

  // Prefer enum if exposed; otherwise compare numeric values is unreliable, so only use enum.
  const E = oc.TopAbs_Orientation;
  if (E && typeof E === "object" && "TopAbs_REVERSED" in E) {
    return o === E.TopAbs_REVERSED;
  }

  // If the enum isn't exported, skip winding correction rather than guessing.
  return false;
}

function numberOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
