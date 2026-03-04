import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Viewer {
  constructor(containerEl) {
    this.containerEl = containerEl;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.containerEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    this.camera.position.set(200, 140, 220);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // lights
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 2, 2);
    this.scene.add(dir);

    // optional ground reference
    const grid = new THREE.GridHelper(400, 20, 0x334155, 0x1f2937);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    this.scene.add(grid);

    this.mesh = null;
    this._animId = null;

    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize, { passive: true });

    this._onResize();
    this._animate();
  }

  dispose() {
    if (this._animId) cancelAnimationFrame(this._animId);
    window.removeEventListener("resize", this._onResize);

    if (this.controls) this.controls.dispose();
    this._removeMesh();

    this.renderer.dispose();
    this.containerEl.innerHTML = "";
  }

  setMesh(mesh, { frame = true } = {}) {
    this._removeMesh();
    this.mesh = mesh;
    this.scene.add(mesh);
    if (frame) this.frameObject(mesh);
  }

  setOrbitEnabled(enabled) {
    this.controls.enabled = !!enabled;
  }

  frameObject(obj3d) {
    const box = new THREE.Box3().setFromObject(obj3d);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Recenter object at origin (viewer convention)
    obj3d.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (this.camera.fov * Math.PI) / 180;
    let dist = (maxDim / 2) / Math.tan(fov / 2);
    dist *= 1.6;

    this.camera.position.set(dist, dist * 0.7, dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _removeMesh() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.mesh = null;
  }

  _onResize() {
    const w = this.containerEl.clientWidth || 1;
    const h = this.containerEl.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
