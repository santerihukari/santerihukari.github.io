import * as THREE from "three";

/**
 * Takes a "shape" from kernel and returns a THREE.Mesh.
 * Today supports { kind: "geometry", geometry: BufferGeometry }.
 * Later will support B-rep shape tessellation.
 */
export function tessellateToMesh(shape, { wireframe = false } = {}) {
  if (!shape || typeof shape !== "object") {
    throw new Error("tessellateToMesh: invalid shape");
  }

  if (shape.kind === "geometry" && shape.geometry) {
    const geometry = shape.geometry;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.1,
      roughness: 0.55,
      wireframe: !!wireframe
    });

    return new THREE.Mesh(geometry, material);
  }

  // Later: if (shape.kind === "brep") { ...call kernel tessellator... }

  throw new Error(`tessellateToMesh: unsupported shape kind "${shape.kind}"`);
}
