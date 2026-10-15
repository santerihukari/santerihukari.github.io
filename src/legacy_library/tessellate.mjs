// The old tessellator's OCCT traversal, without its main-thread Three.js objects.
export function tessellationOptions(meta) {
  return {linearDeflection:meta.tessellation?.linearDeflection ?? .15,angularDeflection:meta.tessellation?.angularDeflection ?? .2};
}

export function tessellate(oc, shape, options = {}) {
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, options.linearDeflection ?? .25, false, options.angularDeflection ?? .25, false);
  const positions = [], indices = [];
  const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    for (; explorer.More(); explorer.Next()) {
      const face = oc.TopoDS.Face_1(explorer.Current()), location = new oc.TopLoc_Location_1();
      const handle = oc.BRep_Tool.Triangulation(face, location, 0);
      if (handle.IsNull?.()) { handle.delete?.(); location.delete(); face.delete(); continue; }
      const tri = handle.get ? handle.get() : handle.Get ? handle.Get() : handle;
      const transform = location.Transformation(), offset = positions.length / 3;
      try {
        for (let i = 1; i <= tri.NbNodes(); i++) {
          const point = tri.Node(i), transformed = point.Transformed(transform);
          positions.push(transformed.X(), transformed.Y(), transformed.Z());
          transformed.delete(); point.delete();
        }
        const orientation = typeof face.Orientation === 'function' ? face.Orientation() : face.Orientation_1?.();
        const reversed = orientation === oc.TopAbs_Orientation?.TopAbs_REVERSED;
        for (let i = 1; i <= tri.NbTriangles(); i++) {
          const triangle = tri.Triangle(i);
          const value = n => triangle.Value ? triangle.Value(n) : triangle.Value_1 ? triangle.Value_1(n) : triangle.Get ? triangle.Get()[n-1] : triangle[['A','B','C'][n-1]]();
          const a = offset + value(1)-1, b = offset + value(2)-1, c = offset + value(3)-1;
          indices.push(a, reversed ? c : b, reversed ? b : c); triangle.delete();
        }
      } finally { transform.delete(); handle.delete?.(); location.delete(); face.delete(); }
    }
  } finally { explorer.delete(); mesher.delete(); }
  if (!indices.length || positions.some(value => !Number.isFinite(value))) throw new Error('The original builder produced no finite mesh.');
  return {positions: new Float32Array(positions), indices: new Uint32Array(indices)};
}

export function meshMetrics(mesh) {
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  let volume = 0;
  for (let i=0; i<mesh.positions.length; i+=3) for (let axis=0; axis<3; axis++) {
    min[axis] = Math.min(min[axis], mesh.positions[i+axis]); max[axis] = Math.max(max[axis], mesh.positions[i+axis]);
  }
  const p = mesh.positions;
  for (let i=0; i<mesh.indices.length; i+=3) {
    const a=mesh.indices[i]*3,b=mesh.indices[i+1]*3,c=mesh.indices[i+2]*3;
    volume += (p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1]) - p[a+1]*(p[b]*p[c+2]-p[b+2]*p[c]) + p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6;
  }
  return {min,max,volume:Math.abs(volume),triangles:mesh.indices.length/3};
}
