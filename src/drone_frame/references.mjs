import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const close = (a, b) => Math.abs(a - b) < 0.0001;

export function referenceFor(part, parameters, manifest) {
  let id;
  if (part.name.startsWith('motor_') && close(parameters.motor_envelope_diameter, 27.5) && close(parameters.motor_envelope_height, 31.8)) id = 'tmotor_v2207_v3_dimensional';
  if (part.name === 'battery' && [35, 105, 25.4].every((n, i) => close(n, part.size[i]))) id = 'tattu_1800_4s_dimensional';
  if (part.shape === 'propeller' && close(part.size[0], 129.54)) id = part.clockwise ? 'generic_51_triblade_cw' : 'generic_51_triblade_ccw';
  return id && manifest.models[id] ? id : null;
}

export async function loadReferences(manifest, assetURL) {
  const loader = new GLTFLoader(), meshes = new Map();
  await Promise.all(Object.entries(manifest.models).map(async ([id, entry]) => {
    const gltf = await loader.loadAsync(assetURL(entry.file).href), geometries = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      // Published reference GLBs are metres/Y-up; the CAD scene is mm/Z-up.
      geometry.rotateX(Math.PI / 2).scale(1000, 1000, 1000);
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      geometries.push(geometry);
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    });
    if (!geometries.length) throw new Error(`Empty reference: ${entry.label}`);
    meshes.set(id, geometries);
  }));
  return meshes;
}

function surfaceGeometry(source, type) {
  if (!type) return [{ geometry: source.clone(), finish: 'body' }];
  const positions = source.getAttribute('position'), groups = new Map();
  for (let i = 0; i < source.index.count; i += 3) {
    const triangle = [0, 1, 2].map(n => source.index.getX(i + n));
    const z = triangle.reduce((sum, n) => sum + positions.getZ(n), 0) / 3;
    const finish = type === 'motor' ? z > 19.8 ? 'metal' : z < 3.01 ? 'base' : 'body' : type === 'connector' ? z < 3.3 ? 'gold' : 'body' : z > 1.2 ? 'metal' : 'body';
    if (!groups.has(finish)) groups.set(finish, []);
    groups.get(finish).push(...triangle);
  }
  return [...groups].map(([finish, indices]) => ({ finish, geometry: source.clone().setIndex(indices) }));
}

export function referenceObject(id, part, manifest, meshes) {
  const entry = manifest.models[id], object = new THREE.Group();
  const type = id.startsWith('tmotor') ? 'motor' : id.startsWith('xt60') ? 'connector' : id.startsWith('esp32') ? 'module' : null;
  for (const source of meshes.get(id)) for (const { geometry, finish } of surfaceGeometry(source, type)) {
    const color = finish === 'metal' ? '#bcc2c9' : finish === 'gold' ? '#d5a448' : finish === 'base' ? '#52575e' : part.color;
    const material = new THREE.MeshStandardMaterial({ color, roughness: ['metal', 'gold'].includes(finish) ? 0.32 : 0.58, metalness: ['metal', 'gold'].includes(finish) ? 0.65 : type === 'motor' ? 0.45 : 0.02 });
    object.add(new THREE.Mesh(geometry, material));
  }
  object.userData = { label: part.label, printable: false, reference: id, source: entry.source, author: entry.author, licence: entry.licence, source_sha256: entry.source_sha256, note: entry.basis };
  return object;
}

export function referencePose(id, part, parameters) {
  if (id.startsWith('tmotor')) return { position: [part.center[0], part.center[1], parameters.frame_thickness], rotation: [0, 0, part.rotation_z] };
  if (id.startsWith('tattu')) return { position: [part.center[0], part.center[1], -parameters.battery_underside_gap], rotation: [0, 0, part.rotation_z] };
  return { position: part.center, rotation: [0, 0, part.rotation_z || 0] };
}

export function optionalParts(parameters, manifest) {
  return Object.entries(parameters.component_references).map(([slot, setting]) => ({
    name: slot, label: manifest.models[setting.model_id].label, shape: 'reference',
    reference: setting.model_id, center: setting.position, rotation: setting.rotation,
    color: slot === 'power_connector' ? '#e5b928' : '#34393e', printable: false,
    note: 'Optional reference; position is a preview only. Not a controller substitute or part of frame fit checks.'
  }));
}
