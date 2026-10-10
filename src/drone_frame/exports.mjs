export function binarySTL(mesh) {
  const triangles = mesh.indices.length / 3;
  const output = new ArrayBuffer(84 + triangles * 50), view = new DataView(output);
  new Uint8Array(output, 0, 80).set(new TextEncoder().encode('Santeri Hukari - parametric drone frame - millimetres'));
  let written = 0;
  for (let i = 0; i < triangles; i++) {
    const corners = [0, 1, 2].map(j => Array.from(mesh.positions.subarray(mesh.indices[i * 3 + j] * 3, mesh.indices[i * 3 + j] * 3 + 3)));
    const u = corners[1].map((v, j) => v - corners[0][j]), v = corners[2].map((v, j) => v - corners[0][j]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(...normal);
    // Float32 conversion can collapse coplanar boolean seams into zero-area faces.
    if (length === 0) continue;
    let offset = 84 + written++ * 50;
    for (const value of [...normal.map(x => x / length), ...corners.flatMap(corner => [...corner])]) { view.setFloat32(offset, value, true); offset += 4; }
  }
  view.setUint32(80, written, true);
  return output.slice(0, 84 + written * 50);
}
