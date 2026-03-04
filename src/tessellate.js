import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Convert a B-rep TopoDS_Shape to a Three.js Object3D by:
 * 1) Creating an XCAF document
 * 2) Adding shape
 * 3) Meshing shape (BRepMesh_IncrementalMesh)
 * 4) Exporting GLB (RWGltf_CafWriter) to OCCT virtual FS
 * 5) Reading bytes from FS → Blob → ObjectURL
 * 6) Loading with GLTFLoader
 *
 * Returns: Promise<THREE.Object3D>
 */
export async function tessellateToThreeObject(oc, shape, { linearDeflection = 0.2, angularDeflection = 0.2 } = {}) {
  const glbUrl = brepShapeToGlbObjectUrl(oc, shape, { linearDeflection, angularDeflection });
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(glbUrl);
    return gltf.scene;
  } finally {
    URL.revokeObjectURL(glbUrl);
  }
}

function brepShapeToGlbObjectUrl(oc, shape, { linearDeflection, angularDeflection }) {
  // Create doc
  const doc = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());

  // Add to shape tool
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(doc.Main()).get();
  shapeTool.SetShape(shapeTool.NewShape(), shape);

  // Mesh the shape
  new oc.BRepMesh_IncrementalMesh_2(
    shape,
    linearDeflection,
    false,
    angularDeflection,
    false
  );

  // Export GLB to virtual FS
  const outPath = "/_tmp_model.glb";
  try {
    oc.FS.unlink(outPath);
  } catch (_) {
    // ignore
  }

  const writer = new oc.RWGltf_CafWriter(new oc.TCollection_AsciiString_2(outPath), true);
  writer.Perform_2(
    new oc.Handle_TDocStd_Document_2(doc),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1()
  );

  const glbFile = oc.FS.readFile(outPath, { encoding: "binary" });
  const blob = new Blob([glbFile.buffer], { type: "model/gltf-binary" });
  return URL.createObjectURL(blob);
}
