---
layout: page
title: STL Models
permalink: /stl/
parent: projects
nav_order: 2
---

<style>
  .stl-hint {
    margin: 0.5rem 0 1rem 0;
    color: var(--muted);
  }

  .stl-library {
    margin-top: 1.5rem;
    border-top: 1px solid var(--border);
  }

  .stl-model {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14.5rem;
    gap: 1rem 2.5rem;
    padding: 1.4rem 0;
    border-bottom: 1px solid var(--border);
  }

  .stl-model h2 {
    margin: 0.2rem 0 0;
    font-size: 1.3rem;
    letter-spacing: 0;
  }

  .stl-model__status {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .stl-model__description,
  .stl-model__note {
    margin: 0.55rem 0 0;
    color: var(--muted);
    line-height: 1.5;
  }

  .stl-model__note {
    font-size: 0.9rem;
  }

  .stl-model__variants {
    align-self: start;
  }

  .stl-model__files {
    min-width: 0;
    width: 100%;
  }

  .stl-variant {
    position: relative;
    padding: 0;
  }

  .stl-variant + .stl-variant {
    margin-top: 0.9rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--border);
  }

  .stl-model__file-list {
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .stl-model__file-list li + li {
    margin-top: 0.5rem;
  }

  .stl-model__file-list strong {
    font-size: 0.9rem;
  }

  .stl-preview {
    display: block;
    grid-column: 1 / -1;
    width: 100%;
    margin-inline: auto;
    padding: 0;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #edf0f2;
    box-sizing: border-box;
  }

  button.stl-preview {
    cursor: pointer;
  }

  button.stl-preview:hover,
  button.stl-preview:focus-visible {
    outline: 2px solid var(--link);
    outline-offset: 2px;
  }

  .stl-preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .stl-model__file-list strong,
  .stl-model__file-list code {
    display: block;
  }

  .stl-model__file-list code {
    margin-top: 0.15rem;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.78rem;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .stl-variant__download {
    position: absolute;
    right: 0.35rem;
    bottom: 0.35rem;
    z-index: 1;
  }

  .stl-variant__number {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--card);
    color: var(--fg);
    font-size: 0.8rem;
    pointer-events: none;
  }

  .stl-variant + .stl-variant .stl-variant__number {
    top: calc(1.25rem + 1px);
  }

  .stl-btn {
    justify-content: center;
    min-width: 0;
    box-sizing: border-box;
    min-height: 2.55rem;
    padding: 0.5rem 0.7rem;
    border-radius: 4px;
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
  .stl-btn:hover,
  .stl-btn:focus-visible {
    border-color: var(--link);
    color: var(--link);
  }
  .stl-btn:focus-visible {
    outline: 2px solid var(--link);
    outline-offset: 2px;
  }

  .stl-withheld {
    padding: 0.75rem 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .stl-withheld strong,
  .stl-withheld code {
    display: block;
  }

  .stl-withheld code {
    overflow-wrap: anywhere;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .stl-withheld p {
    margin: 0.45rem 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .stl-model {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
    }

    .stl-model__files {
      width: 50%;
      max-width: 14.5rem;
      justify-self: center;
    }
  }

  /* Lightbox (<dialog>) */
  .stl-lightbox {
    border: 0;
    padding: 0;
    background: transparent;
    box-sizing: border-box;
    max-width: none;
    width: min(96vw, 1400px);
    height: min(96vh, 900px);
    overflow: hidden;
  }
  .stl-lightbox::backdrop { background: rgba(255, 255, 255, 0.86); }
  html[data-theme="dark"] .stl-lightbox::backdrop { background: rgba(0, 0, 0, 0.86); }

  .stl-lightbox.stl-lightbox--fallback {
    position: fixed;
    inset: 0.5rem;
    z-index: 1000;
    display: block;
    width: min(calc(100vw - 1rem), 1400px);
    height: min(calc(100vh - 1rem), 900px);
    margin: auto;
  }

  .stl-lightbox.stl-lightbox--fallback::before {
    position: fixed;
    z-index: -1;
    inset: 0;
    background: rgba(255, 255, 255, 0.86);
    content: "";
  }

  html[data-theme="dark"] .stl-lightbox.stl-lightbox--fallback::before {
    background: rgba(0, 0, 0, 0.86);
  }

  html.stl-lightbox-open,
  body.stl-lightbox-open {
    overflow: hidden;
  }

  .stl-stage {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 4px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    touch-action: none;
    position: relative;
    background: #eef1f5;
  }

  html[data-theme="dark"] .stl-stage { background: #0b0f14; }

  #stl-viewer { width: 100%; height: 100%; }

  .stl-close {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
  }
  .stl-close:hover { color: var(--link); }

  .stl-download {
    position: fixed;
    top: 16px;
    right: 68px;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
    display: grid;
    place-items: center;
    text-decoration: none;
  }
  .stl-download:hover { color: var(--link); }

  .stl-controls {
    position: fixed;
    left: 16px;
    top: 16px;
    max-width: min(520px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    z-index: 10;
    font-size: 0.95rem;
    line-height: 1.35;
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
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg);
    z-index: 10;
    font-size: 0.95rem;
    line-height: 1.35;
  }
  .stl-meta-row { margin-top: 6px; }
  .stl-meta-key { opacity: 0.75; margin-right: 6px; }
  .stl-meta a { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }

  @media (max-width: 760px) {
    .stl-meta {
      box-sizing: border-box;
      max-height: 32dvh;
      overflow: auto;
      overflow-wrap: anywhere;
    }
  }
</style>

This library contains selected code-generated and manually designed STL models.
Related variants are grouped together, and files load into the 3D viewer only
when a thumbnail is selected. Experimental fit and mesh limitations are stated
alongside the affected model. All models are copyright Santeri Hukari.

<p class="stl-usage-terms">{{ site.data.stl_models.usage_terms | escape }}</p>

<p class="stl-hint">Drag to rotate, scroll or pinch to zoom, and right-drag to pan in the preview.</p>

<div class="stl-library">
  {% for model in site.data.stl_models.models %}
    <article class="stl-model">
      <div>
        <p class="stl-model__status">{{ model.status | escape }}</p>
        <h2>{{ model.title | escape }}</h2>
        <p class="stl-model__description">{{ model.description | escape }}</p>
        {% if model.project_url %}
          <p class="work-context-link">
            <a href="{{ model.project_url | relative_url }}">{{ model.project_label | escape }}</a>
          </p>
        {% endif %}
        {% if model.note %}<p class="stl-model__note">{{ model.note | escape }}</p>{% endif %}
        {% if model.variants and model.variants.size > 0 %}
          <ul class="stl-model__file-list">
            {% for variant in model.variants %}
              <li>
                <strong>{% if model.variants.size > 1 %}{{ forloop.index }}. {% endif %}{{ variant.label | escape }}</strong>
                <code>{{ variant.file | escape }}</code>
              </li>
            {% endfor %}
          </ul>
        {% endif %}
      </div>

      <div class="stl-model__files">
        {% if model.variants and model.variants.size > 0 %}
          <div class="stl-model__variants">
            {% for variant in model.variants %}
              {% assign stl_path = '/assets/stl/' | append: variant.file %}
              <div class="stl-variant">
                {% if variant.preview %}
                  <button type="button" class="stl-preview"
                          data-open data-src="{{ stl_path | relative_url }}"
                          data-name="{{ variant.file | escape }}"
                          title="View 3D model: {{ variant.label | escape }}"
                          aria-label="View 3D model: {{ model.title | escape }} - {{ variant.label | escape }}">
                    <img src="{{ variant.preview | relative_url }}"
                         alt="{{ model.title | escape }} - {{ variant.label | escape }}"
                         width="960" height="720" loading="lazy" decoding="async">
                  </button>
                {% endif %}
                {% if model.variants.size > 1 %}<span class="stl-variant__number" aria-hidden="true">{{ forloop.index }}</span>{% endif %}
                <a class="stl-btn stl-variant__download download-action" href="{{ stl_path | relative_url }}" download
                   aria-label="Download STL: {{ model.title | escape }} - {{ variant.label | escape }}"
                   title="Download STL: {{ model.title | escape }} - {{ variant.label | escape }}">{% include download-icon.html %}</a>
              </div>
            {% endfor %}
          </div>
        {% endif %}

        {% if model.withheld %}
          <div class="stl-withheld">
            {% if model.withheld.preview %}
              <div class="stl-preview">
                <img src="{{ model.withheld.preview | relative_url }}"
                     alt="{{ model.title | escape }} - development model"
                     width="960" height="720" loading="lazy" decoding="async">
              </div>
            {% endif %}
            <strong>Not published as a download</strong>
            {% for filename in model.withheld.files %}<code>{{ filename | escape }}</code>{% endfor %}
            <p>{{ model.withheld.reason | escape }}</p>
          </div>
        {% endif %}
      </div>
    </article>
  {% endfor %}
</div>

<dialog class="stl-lightbox" id="stl-dialog">
  <div class="stl-stage">
    <button class="stl-close" id="stl-close" type="button" aria-label="Close">×</button>
    <a class="stl-download download-action" id="stl-dl" href="#" download aria-label="Download STL" title="Download STL">{% include download-icon.html %}</a>

    <div class="stl-controls">
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
      <div id="stl-meta-fields"></div>
    </div>

    <div id="stl-viewer"></div>
  </div>
</dialog>

<script src="{{ '/assets/js/three.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stlloader.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/orbitcontrols.min.js' | relative_url }}"></script>

<script>
(function () {
  const METADATA_URL = "{{ '/assets/stl/metadata.json' | relative_url }}";
  const MODEL_USAGE_TERMS = {{ site.data.stl_models.usage_terms | jsonify }};

  const dialog = document.getElementById("stl-dialog");
  const closeBtn = document.getElementById("stl-close");
  const dlBtn = document.getElementById("stl-dl");
  const titleEl = document.getElementById("stl-title");
  const statusEl = document.getElementById("stl-status");
  const metaFieldsEl = document.getElementById("stl-meta-fields");
  const viewerEl = document.getElementById("stl-viewer");

  closeBtn.innerHTML = "&times;";
  titleEl.innerHTML = "&mdash;";
  statusEl.textContent = "Click a filename to load...";

  const wireRb = document.getElementById("ui-wire");
  const shadedRb = document.getElementById("ui-shaded");

  let renderer = null, scene = null, camera = null, controls = null, mesh = null, animId = null;

  // filename -> metadata object (lazy loaded once)
  let metaByName = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

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

    controls.enabled = true;
    controls.autoRotate = false;

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

        const isDark = document.documentElement.dataset.theme === "dark";
        const mat = new THREE.MeshStandardMaterial({
          color: isDark ? 0xcbd5e1 : 0x64748b,
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

  async function ensureMetadataLoaded() {
    if (metaByName !== null) return;
    try {
      const res = await fetch(METADATA_URL, { cache: "no-store" });
      if (!res.ok) { metaByName = {}; return; }
      const json = await res.json();
      // Accept either { "file.stl": {...} } or { "models": { "file.stl": {...} } }
      metaByName = (json && json.models && typeof json.models === "object") ? json.models : (json || {});
    } catch (_) {
      metaByName = {};
    }
  }

  function renderMetadata(name) {
    metaFieldsEl.innerHTML = "";

    if (!metaByName || !metaByName[name]) return;
    const m = metaByName[name];
    if (!m || typeof m !== "object") return;

    // Required by you (optional display):
    // - creator, description, created
    // Extra useful (all optional):
    // - license, source, units, scale, tags, version
    const rows = [];

    function addRow(keyLabel, valueHtml) {
      rows.push(
        '<div class="stl-meta-row"><span class="stl-meta-key">' +
        escapeHtml(keyLabel) +
        ':</span><span>' +
        valueHtml +
        '</span></div>'
      );
    }

    if (m.creator) addRow("Creator", escapeHtml(m.creator));
    if (m.copyright || m.creator) addRow("Copyright", escapeHtml(m.copyright || m.creator));
    if (m.created) addRow("Created", escapeHtml(m.created));
    if (m.description) addRow("Description", escapeHtml(m.description));

    if (m.license) addRow("License", escapeHtml(m.license));
    else if (MODEL_USAGE_TERMS) addRow("Usage terms", escapeHtml(MODEL_USAGE_TERMS));
    if (m.version) addRow("Version", escapeHtml(m.version));
    if (m.units) addRow("Units", escapeHtml(m.units));
    if (m.scale) addRow("Scale notes", escapeHtml(m.scale));
    if (m.validation) addRow("Mesh check", escapeHtml(m.validation));
    if (m.fit) addRow("Fit note", escapeHtml(m.fit));

    if (m.tags) {
      const tags = Array.isArray(m.tags) ? m.tags : String(m.tags).split(",").map(s => s.trim()).filter(Boolean);
      if (tags.length) addRow("Tags", escapeHtml(tags.join(", ")));
    }

    if (m.source) {
      // allow either plain url or { url, label }
      if (typeof m.source === "string") {
        const u = escapeHtml(m.source);
        addRow("Source", '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>");
      } else if (m.source && typeof m.source === "object" && m.source.url) {
        const u = escapeHtml(m.source.url);
        const lbl = escapeHtml(m.source.label || m.source.url);
        addRow("Source", '<a href="' + u + '" target="_blank" rel="noopener">' + lbl + "</a>");
      }
    }

    if (rows.length) metaFieldsEl.innerHTML = rows.join("");
  }

  async function openModal(name, src) {
    titleEl.textContent = name;
    dlBtn.href = src;
    dlBtn.setAttribute("download", name);
    dlBtn.setAttribute("aria-label", "Download STL: " + name);
    dlBtn.title = "Download STL: " + name;

    metaFieldsEl.innerHTML = "";
    setStatus("Loading…");

    // reset UI defaults
    shadedRb.checked = true;
    wireRb.checked = false;

    // clean viewer from previous open
    teardownViewer();

    // show dialog first (ensures sizes)
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
      dialog.classList.add("stl-lightbox--fallback");
      document.documentElement.classList.add("stl-lightbox-open");
      document.body.classList.add("stl-lightbox-open");
    }

    // metadata (optional)
    await ensureMetadataLoaded();
    renderMetadata(name);

    // init + load model (lazy)
    initViewer();
    loadSTL(src);
  }

  function closeModal() {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    dialog.classList.remove("stl-lightbox--fallback");
    document.documentElement.classList.remove("stl-lightbox-open");
    document.body.classList.remove("stl-lightbox-open");
    teardownViewer();
    setStatus("Closed.");
  }

  closeBtn.addEventListener("click", closeModal);

  dialog.addEventListener("cancel", function (e) {
    e.preventDefault();
    closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dialog.classList.contains("stl-lightbox--fallback")) {
      closeModal();
    }
  });

  // click outside closes (dialog backdrop)
  dialog.addEventListener("click", function (e) {
    const r = dialog.getBoundingClientRect();
    const inside = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
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
