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
    this.defaultModelRotation = new THREE.Euler(-Math.PI / 2, 0, 0);
    this.modelRotation = this.defaultModelRotation.clone();

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

    this.axes = null;
    this._setAxesLength(80);

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
   *
   * Default orientation fix:
   * - rotateX = -Math.PI / 2
   * This is useful when imported objects are "facing down"
   * because they were authored in a different up-axis convention.
   */
  setMesh(
    mesh,
    {
      frame = false,
      rotateX = -Math.PI / 2,
      rotateY = 0,
      rotateZ = 0,
    } = {}
  ) {
    this._removeMesh();
    this.mesh = mesh;

    // Apply orientation correction before measuring bounds
    this.mesh.rotation.set(rotateX, rotateY, rotateZ);
    this.modelRotation.set(rotateX, rotateY, rotateZ);
    if (this.axes) this.axes.rotation.copy(this.modelRotation);

    this.scene.add(this.mesh);
    this.mesh.updateMatrixWorld(true);

    // 1. Calculate the bounding box of the new geometry
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 10;

    // 2. Always update target so zoom math stays centered on the object
    this.controls.target.copy(center);

    // 3. Adjust clipping planes based on object scale
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

    this._setAxesLength(THREE.MathUtils.clamp(maxDim * 0.45, 40, 180));

    // 5. Reset camera distance if it's the first time or model changed
    if (frame) {
      this.frameObject(center, maxDim);
    }

    this.controls.update();
  }

  clear({ resetCamera = false } = {}) {
    this._removeMesh();

    if (resetCamera) {
      this.camera.position.set(200, 200, 200);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    this.modelRotation.copy(this.defaultModelRotation);
    if (this.axes) this.axes.rotation.copy(this.modelRotation);
  }

  /**
   * Moves the camera to a standard perspective based on calculated bounds.
   */
  frameObject(center, maxDim) {
    const fov = (this.camera.fov * Math.PI) / 180;
    let dist = Math.abs(maxDim / Math.tan(fov / 2)) * 1.85;

    // Set a reasonable default distance
    if (dist === 0 || isNaN(dist)) dist = 200;

    const viewDir = new THREE.Vector3(1, 0.72, 1).normalize();
    this.camera.position.copy(center).addScaledVector(viewDir, dist);
    this.controls.target.copy(center);
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

  _setAxesLength(length) {
    if (this.axes) {
      this.scene.remove(this.axes);
      this.axes.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }

    this.axes = new THREE.Group();
    this.axes.rotation.copy(this.modelRotation);

    const helper = new THREE.AxesHelper(length);
    helper.renderOrder = 5;
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.9;
    this.axes.add(helper);

    this.axes.add(this._makeAxisLabel("X", "#ef4444", new THREE.Vector3(length + 10, 0, 0), length));
    this.axes.add(this._makeAxisLabel("Y", "#22c55e", new THREE.Vector3(0, length + 10, 0), length));
    this.axes.add(this._makeAxisLabel("Z", "#3b82f6", new THREE.Vector3(0, 0, length + 10), length));

    this.scene.add(this.axes);
  }

  _makeAxisLabel(text, color, position, axisLength) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.roundRect(18, 18, 92, 92, 22);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "700 70px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 69);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    const scale = THREE.MathUtils.clamp(axisLength * 0.22, 16, 32);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 6;
    return sprite;
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

    // Laptop/Trackpad Safety Check
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
