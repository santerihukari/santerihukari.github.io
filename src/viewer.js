// src/viewer.js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Viewer {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.containerEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    this.camera.position.set(200, 200, 200);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 200, 100);
    this.scene.add(dir);

    const grid = new THREE.GridHelper(400, 20, 0x334155, 0x1f2937);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    this.scene.add(grid);

    this.mesh = null;
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize, { passive: true });
    this._onResize();
    this._animate();
  }

  setMesh(mesh, { frame = false } = {}) {
    this._removeMesh();
    this.mesh = mesh;
    this.scene.add(mesh);
    
    // Only move the camera if this is the first build or a manual reset
    if (frame) {
      this.frameObject(mesh);
    }
  }

  frameObject(obj3d) {
    const box = new THREE.Box3().setFromObject(obj3d);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (this.camera.fov * Math.PI) / 180;
    let dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.2;

    this.camera.position.set(center.x + dist, center.y + dist * 0.5, center.z + dist);
    this.controls.target.copy(center);
    this.camera.updateProjectionMatrix();
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
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
