---
layout: page
title_: STL
permalink: /stl/
---

<style>
  .stl-hint {
    margin: 0.5rem 0 1rem 0;
    color: var(--muted);
  }

  .stl-list { margin: 0; padding: 0; list-style: none; }
  .stl-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--border);
  }

  .stl-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--link);
    text-decoration: none;
    cursor: pointer;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    padding: 0.2rem 0.35rem;
    border-radius: 8px;
  }
  .stl-link:hover,
  .stl-link:focus {
    color: var(--link-hover);
    background: var(--card);
    text-decoration: none;
  }
  .stl-link:focus-visible {
    outline: 2px solid var(--border);
    outline-offset: 2px;
  }
  .stl-link .badge {
    font-family: inherit;
    font-size: 0.85em;
    color: var(--muted);
    border: 1px solid var(--border);
    background: var(--card);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .stl-btn {
    padding: 0.45rem 0.7rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    cursor: pointer;
    text-decoration: none;
    font-size: 0.95rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .stl-btn:hover { filter: brightness(0.98); }
  html[data-theme="dark"] .stl-btn:hover { filter: brightness(1.05); }

  /* Lightbox: use <dialog> like your photo lightbox */
  .stl-lightbox {
    border: 0;
    padding: 0;
    background: transparent;
    max-width: none;
    width: min(96vw, 1400px);
    height: min(96vh, 900px);
  }
  .stl-lightbox::backdrop { background: rgba(0, 0, 0, 0.85); }

  .stl-stage {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 12px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    touch-action: none;
    position: relative;
    background: #0b0f14;
  }

  #stl-viewer {
    width: 100%;
    height: 100%;
  }

  .stl-close {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
  }
  .stl-close:hover { background: rgba(0, 0, 0, 0.8); }

  .stl-download {
    position: fixed;
    top: 16px;
    right: 68px;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
    display: grid;
    place-items: center;
    text-decoration: none;
  }
  .stl-download:hover { background: rgba(0, 0, 0, 0.8); }

  /* Controls panel */
  .stl-controls {
    position: fixed;
    left: 16px;
    top: 16px;
    max-width: min(520px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    z-index: 10;
    font-size: 0.95rem;
    line-height: 1.35;
    backdrop-filter: blur(6px);
    display: inline-flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    user-select: none;
  }
  .stl-controls label { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .stl-controls input { cursor: pointer; }

  .stl-meta {
    position: fixed;
    left: 16px;
    bottom: 16px;
    max-width: min(760px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    z-index: 10;
    font-size: 0.95rem;
    line-height: 1.35;
    backdrop-filter: blur(6px);
  }
</style>

<p class="stl-hint">Tip: click a filename to open a 3D preview (the STL loads only after clicking).</p>

{% assign stls = site.static_files
  | where_exp: "f", "f.path contains '/assets/stl/'"
  | where_exp: "f", "f.extname == '.stl'" %}

{% if stls.size == 0 %}
No STL files found in <code>assets/stl/</code>.
{% else %}
<ul class="stl-list">
  {% for f in stls %}
    <li class="stl-item">
      <a href="#"
         class="stl-link"
         data-open
         data-src="{{ f.path | relative_url }}"
         data-name="{{ f.name }}">
        {{ f.name }} <span class="badge">preview</span>
      </a>
      <a class="stl-btn" href="{{ f.path | relative_url }}" download>Download</a>
    </li>
  {% endfor %}
</ul>
{% endif %}

<dialog class="stl-lightbox" id="stl-dialog">
  <div class="stl-stage">
    <button class="stl-close" id="stl-close" type="button" aria-label="Close">×</button>
    <a class="stl-download" id="stl-dl" href="#" download aria-label="Download">⬇</a>

    <div class="stl-controls">
      <label title="Enable/disable orbit controls">
        <input type="checkbox" id="ui-orbit" checked>
        Orbit
      </label>

      <label title="Wireframe view">
        <input type="radio" name="ui-shading" id="ui-wire">
        wire
      </label>

      <label title="Shaded view">
        <input type="radio" name="ui-shading" id="ui-shaded" checked>
        shaded
      </label>
    </div>

    <div class="stl-meta">
      <div><strong id="stl-title">—</strong></div>
      <div id="stl-status" style="opacity:0.9;">Click a filename to load…</div>
    </div>

    <div id="stl-viewer"></div>
  </div>
</dialog>

<!-- Classic (non-module) three.js stack you already use -->
<script src="{{ '/assets/js/three.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stlloader.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/orbitcontrols.min.js' | relative_url }}"></script>

<script>
(function () {
  const dialog = document.getElementById("stl-dialog");
  const closeBtn = document.getElementById("stl-close");
  const dlBtn = document.getElementById("stl-dl");
  const titleEl = document.getElementById("stl-title");
  const statusEl = document.getElementById("stl-status");
  const viewerEl = document.getElementById("stl-viewer");

  const orbitCb = document.getElementById("ui-orbit");
  const wireRb = document.getElementById("ui-wire");
  const shadedRb = document.getElementById("ui-shaded");

  let renderer = null, scene = null, camera = null, controls = null, mesh = null, animId = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function disposeMesh() {
    if (!mesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    mesh = null;
  }

  function teardownViewer() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;

    if (controls) { controls.dispose(); controls = null; }

    disposeMesh();

    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }

    scene = null;
    camera = null;
    viewerEl.innerHTML = "";
  }

  function initViewer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
    viewerEl.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      45,
      viewerEl.clientWidth / viewerEl.clientHeight,
      0.01,
      2000
    );

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Enabled by default (user interaction), but no auto motion.
    controls.enabled = true;
    controls.autoRotate = false;
    orbitCb.checked = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 2, 2);
    scene.add(dir);

    function animate() {
      animId = requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }

  function onResize() {
    if (!renderer || !camera) return;
    const w = viewerEl.clientWidth;
    const h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize, { passive: true });

  function applyShadingMode() {
    if (!mesh || !mesh.material) return;
    mesh.material.wireframe = !!wireRb.checked;
    mesh.material.needsUpdate = true;
  }

  orbitCb.addEventListener("change", function () {
    if (controls) controls.enabled = !!orbitCb.checked;
  });
  wireRb.addEventListener("change", applyShadingMode);
  shadedRb.addEventListener("change", applyShadingMode);

  function frameObject(geometry) {
    geometry.computeBoundingBox();
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

    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  function loadSTL(stlUrl) {
    setStatus("Loading STL…");

    const loader = new THREE.STLLoader();
    loader.load(
      stlUrl,
      function (geometry) {
        setStatus("Loaded. Drag to rotate, scroll to zoom.");
        geometry.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
          color: 0x9ca3af,
          metalness: 0.1,
          roughness: 0.5
        });

        mesh = new THREE.Mesh(geometry, mat);
        scene.add(mesh);

        frameObject(geometry);
        applyShadingMode();
      },
      undefined,
      function (err) {
        console.error("Failed to load STL:", err);
        setStatus("Failed to load STL. Check console/network.");
      }
    );
  }

  function openModal(name, src) {
    titleEl.textContent = name;
    dlBtn.href = src;
    dlBtn.setAttribute("download", name);

    // reset UI defaults
    shadedRb.checked = true;
    wireRb.checked = false;

    // clean viewer from previous open
    teardownViewer();

    // open + then init (ensures sizes are non-zero)
    dialog.showModal();
    initViewer();

    // load only after click
    loadSTL(src);
  }

  function closeModal() {
    dialog.close();
    teardownViewer();
    setStatus("Closed.");
  }

  closeBtn.addEventListener("click", closeModal);
  dialog.addEventListener("click", function (e) {
    // click outside the card closes (<dialog> backdrop click)
    const rect = dialog.getBoundingClientRect();
    const inside = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
    if (!inside) closeModal();
  });

  document.querySelectorAll("[data-open]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(a.getAttribute("data-name") || "model.stl", a.getAttribute("data-src"));
    });
  });
})();
</script>
