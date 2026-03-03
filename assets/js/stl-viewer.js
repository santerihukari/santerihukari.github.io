import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js";

const container = document.getElementById("stl-viewer");
if (!container) throw new Error("Missing #stl-viewer");

const STL_PATH = window.__STL_VIEWER_PATH__;
if (!STL_PATH) throw new Error("Missing window.__STL_VIEWER_PATH__");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.01,
  1000
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(2, 2, 2);
scene.add(dir);

const loader = new STLLoader();
loader.load(
  STL_PATH,
  (geometry) => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const mat = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.5 });
    const mesh = new THREE.Mesh(geometry, mat);
    scene.add(mesh);

    const bbox = geometry.boundingBox;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    mesh.position.sub(center);

    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = (camera.fov * Math.PI) / 180;
    let dist = (maxDim / 2) / Math.tan(fov / 2);
    dist *= 1.6;

    camera.position.set(dist, dist * 0.7, dist);
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.update();
  },
  undefined,
  (err) => {
    console.error("Failed to load STL:", err);
    container.insertAdjacentHTML(
      "beforeend",
      `<div style="padding:12px;color:#e5e7eb">
        Failed to load STL from <code>${STL_PATH}</code>.
      </div>`
    );
  }
);

function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
