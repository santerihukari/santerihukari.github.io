// Reference surfaces must contain the enclosing guide, not just the panel footprint.
export function mountingPreview(parts, radius) {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Invalid enclosing radius');
  const extent = radius * 1.05;
  return parts.map(part => {
    if (!part.reference || !['mount_plane_1', 'mount_plane_2'].includes(part.name)) return part;
    const lo = [0, 1, 2].map(axis => Math.min(...part.vertices.map(point => point[axis])));
    const hi = [0, 1, 2].map(axis => Math.max(...part.vertices.map(point => point[axis])));
    const z0 = Math.min(lo[2], -extent), z1 = Math.max(hi[2], extent);
    const vertices = part.name === 'mount_plane_1'
      ? [[Math.min(lo[0], -extent), 0, z0], [Math.max(hi[0], extent), 0, z0], [Math.max(hi[0], extent), 0, z1], [Math.min(lo[0], -extent), 0, z1]]
      : [[0, 0, z0], [0, Math.max(hi[1], extent), z0], [0, Math.max(hi[1], extent), z1], [0, 0, z1]];
    return { ...part, vertices };
  });
}
