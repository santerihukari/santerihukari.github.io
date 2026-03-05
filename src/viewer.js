import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Viewer {
  constructor(containerEl) {
    this.containerEl = containerEl;

    // Set touch-action to none to prevent the browser from 
    // trying to page-zoom while you are model-zooming
    this.containerEl.style.touchAction = "none";

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.containerEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Start with a standard perspective
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    this.camera.position.set(200, 200, 200);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    // Laptop Fix: Reduce zoom speed to prevent "teleporting" through the model
    this.controls.zoomSpeed = 0.8; 
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 5000;

    // Lights
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 200, 100);
    this.scene.add(dir);

    // Ground Grid
    this.grid = new THREE.GridHelper(400, 20, 0x334155, 0x1f2937);
    this.grid.material.opacity = 0.35;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    this.mesh = null;
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize, { passive: true });

    this._onResize();
    this._animate();
  }

  /**
   * Updates the viewer with a new mesh.
   * Logic is added to ensure clipping planes and orbit targets 
   * are updated even if the camera position isn't "framed".
   */
  setMesh(mesh, { frame = false } = {}) {
    this._removeMesh();
    this.mesh = mesh;
    this.scene.add(mesh);
    
    // 1. Calculate the bounding box of the new geometry
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 10;

    // 2. Fix: Always update target so zoom math stays centered on the object
    this.controls.target.copy(center);

    // 3. Fix: Adjust clipping planes based on object scale
    // This prevents the "disappearing" effect when zooming in close
    this.camera.near = Math.max(0.01, maxDim / 2000); 
    this.camera.far = Math.max(2000, maxDim * 100);
    this.camera.updateProjectionMatrix();

    // 4. Update the Grid helper to match the object size
    if (maxDim > 200) {
        this.scene.remove(this.grid);
        this.grid = new THREE.GridHelper(maxDim * 3, 20, 0x334155, 0x1f2937);
        this.grid.material.opacity = 0.35;
        this.grid.material.transparent = true;
        this.scene.add(this.grid);
    }

    // 5. Reset camera distance if it's the first time or model changed
    if (frame) {
      this.frameObject(center, maxDim);
    }

    this.controls.update();
  }

  /**
   * Moves the camera to a standard perspective based on calculated bounds.
   */
  frameObject(center, maxDim) {
    const fov = (this.camera.fov * Math.PI) / 180;
    let dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;

    // Set a reasonable default distance
    if (dist === 0 || isNaN(dist)) dist = 200;

    this.camera.position.set(center.x + dist, center.y + dist * 0.5, center.z + dist);
    this.camera.lookAt(center);
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

    // 6. Laptop/Trackpad Safety Check
    // If a high-frequency scroll pushes the camera to an invalid state, reset it.
    if (isNaN(this.camera.position.x) || this.camera.position.length() > 20000) {
      console.warn("Camera position corrupted or escaped. Resetting...");
      this.camera.position.set(200, 200, 200);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
