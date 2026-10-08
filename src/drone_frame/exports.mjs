export function binarySTL(mesh) {
  const triangles = mesh.indices.length / 3;
  const output = new ArrayBuffer(84 + triangles * 50), view = new DataView(output);
  new Uint8Array(output, 0, 80).set(new TextEncoder().encode('Santeri Hukari - parametric drone frame - millimetres'));
  view.setUint32(80, triangles, true);
  for (let i = 0; i < triangles; i++) {
    const corners = [0, 1, 2].map(j => mesh.positions.subarray(mesh.indices[i * 3 + j] * 3, mesh.indices[i * 3 + j] * 3 + 3));
    const u = corners[1].map((v, j) => v - corners[0][j]), v = corners[2].map((v, j) => v - corners[0][j]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(...normal) || 1;
    let offset = 84 + i * 50;
    for (const value of [...normal.map(x => x / length), ...corners.flatMap(corner => [...corner])]) { view.setFloat32(offset, value, true); offset += 4; }
  }
  return output;
}
