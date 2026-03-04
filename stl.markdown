---
layout: page
title_: STL
permalink: /stl/
---

<style>
  .stl-list { margin: 1rem 0; padding: 0; list-style: none; }
  .stl-item {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .stl-fn { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
  .btn {
    padding: 0.45rem 0.7rem;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.15);
    background: rgba(255,255,255,0.85);
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    font-size: 0.95rem;
  }
  .btn:active { transform: translateY(1px); }
  .btn-primary { border-color: rgba(0,0,0,0.25); }

  /* Lightbox */
  .lb {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1.5rem;
  }
  .lb.open { display: flex; }
  .lb-card {
    width: min(1100px, 95vw);
    background: #0b0f14;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.55);
  }
  .lb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
    color: #e5e7eb;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .lb-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 0.95rem; opacity: 0.95; }
  .lb-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .lb-actions label { user-select: none; cursor: pointer; font-size: 0.95rem; opacity: 0.95; }
  .lb-actions input { vertical-align: middle; }
  .lb-close {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.20);
    color: #e5e7eb;
    border-radius: 10px;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
  }
  .lb-body { position: relative; }
  #stl-viewer {
    width: 100%;
    height: min(70vh, 720px);
    display: block;
  }
  .lb-status {
    position: absolute;
    left: 12px;
    top: 10px;
    color: #e5e7eb;
    font-size: 0.95rem;
    opacity: 0.85;
    pointer-events: none;
  }
</style>

## Models

{% assign stls = site.static_files
  | where_exp: "f", "f.path contains '/assets/stl/'"
  | where_exp: "f", "f.extname == '.stl'" %}

{% if stls.size == 0 %}
No STL files found in <code>assets/stl/</code>.
{% else %}
<ul class="stl-list">
  {% for f in stls %}
    <li class="stl-item">
      <span class="stl-fn">{{ f.name }}</span>
      <button class="btn btn-primary" type="button" data-preview data-src="{{ f.path | relative_url }}" data-name="{{ f.name }}">
        Preview
      </button>
      <a class="btn" href="{{ f.path | relative_url }}" download>
        Download
      </a>
    </li>
  {% endfor %}
</ul>
{% endif %}

<!-- Lightbox modal -->
<div class="lb" id="lb" aria-hidden="true">
  <div class="lb-card" role="dialog" aria-modal="true" aria-label="STL Viewer">
    <div class="lb-header">
      <div class="lb-title" id="lb-title">—</div>

      <div class="lb-actions">
        <label title="Enable/disable orbit controls">
          <input type="checkbox" id="ui-orbit">
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

        <a class="btn" id="ui-download" href="#" download>Download</a>
        <button class="lb-close" id="lb-close" type="button">Close</button>
      </div>
    </div>

    <div class="lb-body">
      <div class="lb-status" id="lb-status">Click Preview to load…</div>
      <div id="stl-viewer"></div>
    </div>
  </div>
</div>

<!-- Classic (non-module) three.js stack -->
<script src="{{ '/assets/js/three.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stlloader.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/orbitcontrols.min.js' | relative_url }}"></script>

<script>
(function () {
  const lb = document.getElementById("lb");
  const titleEl = document.getElementById("lb-title");
  const statusEl = document.getElementById("lb-status");
  const viewerEl = document.getElementById("stl-viewer");

  const orbitCb = document.getElementById("ui-orbit");
  const wireRb = document.getElementById("ui-wire");
  const shadedRb = document.getElementById("ui-shaded");
  const dlBtn = document.getElementById("ui-download");
  const closeBtn = document.getElementById("lb-close");

  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let mesh = null;
  let animId = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function teardownViewer() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;

    if (controls) { controls.dispose(); controls = null; }
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }

    // Dispose mesh/geometry/material to avoid leaks
    if (mesh) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      mesh = null;
    }

    scene = null;
    camera = null;

    viewerEl.innerHTML = "";
    setStatus("Closed.");
  }

  function openLightbox() {
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    teardownViewer();
  }

  function initViewer() {
    // Fresh viewer per open
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

    // IMPORTANT: no orbiting by default
    controls.autoRotate = false;
    controls.enabled = false;            // "Orbit" checkbox controls this
    orbitCb.checked = false;

    // Lighting
    scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 2, 2);
    scene.add(dir);

    function onResize() {
      if (!renderer || !camera) return;
      const w = viewerEl.clientWidth;
      const h = viewerEl.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize, { passive: true });

    function animate() {
      animId = requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }

  function applyShadingMode() {
    if (!mesh || !mesh.material) return;
    // Wireframe toggle
    mesh.material.wireframe = !!wireRb.checked;
    mesh.material.needsUpdate = true;
  }

  orbitCb.addEventListener("change", function () {
    if (controls) controls.enabled = !!orbitCb.checked;
  });
  wireRb.addEventListener("change", applyShadingMode);
  shadedRb.addEventListener("change", applyShadingMode);

  closeBtn.addEventListener("click", closeLightbox);
  lb.addEventListener("click", function (e) {
    if (e.target === lb) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lb.classList.contains("open")) closeLightbox();
  });

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
        setStatus("Loaded.");
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0x9ca3af,
          metalness: 0.1,
          roughness: 0.5
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        frameObject(geometry);
        applyShadingMode();
      },
      undefined,
      function (err) {
        console.error("Failed to load STL:", err);
        setStatus("Failed to load STL. Check console / network.");
      }
    );
  }

  // Wire/shaded defaults
  shadedRb.checked = true;
  wireRb.checked = false;

  // Attach Preview buttons
  document.querySelectorAll("[data-preview]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const src = btn.getAttribute("data-src");
      const name = btn.getAttribute("data-name") || src;

      titleEl.textContent = name;
      dlBtn.href = src;
      dlBtn.setAttribute("download", name);

      openLightbox();
      initViewer();
      loadSTL(src);
    });
  });
})();
</script>
