---
layout: page
title: Parametric CAD
permalink: /stl_param/
nav: true
parent: stl
---


<style>
  .hb-wrap {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .hb-wrap { grid-template-columns: 1fr; }
  }

  .hb-card {
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    border-radius: 12px;
    padding: 12px;
  }

  .hb-view {
    height: min(70vh, 720px);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    background: #0b0f14;
    position: relative;
  }

  .hb-row { margin: 10px 0; }
  .hb-row label { display: flex; justify-content: space-between; gap: 10px; font-size: 0.95rem; }
  .hb-row input[type="range"] { width: 100%; }
  .hb-muted { color: var(--muted, #6b7280); font-size: 0.9rem; line-height: 1.35; }

  .hb-btn {
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    cursor: pointer;
    font-size: 0.95rem;
  }

  .hb-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(0,0,0,0.55);
    color: #fff;
    font-size: 0.9rem;
    position: absolute;
    top: 12px;
    left: 12px;
    backdrop-filter: blur(6px);
  }
</style>

<div class="hb-wrap">
  <div class="hb-card">
    <div class="hb-muted">
      Minimal parametric pipeline: UI → model params → “kernel” (stub) → tessellate → Three.js viewer.
      <br><br>
    </div>

    <div id="hb-ui"></div>

    <div class="hb-row">
      <button class="hb-btn" id="hb-rebuild" type="button">Rebuild</button>
      <!-- STL export button will be added later -->
    </div>

    <div class="hb-muted" id="hb-status" style="margin-top:10px;">Ready.</div>
  </div>

  <div class="hb-view" id="hb-view">
    <div class="hb-pill" id="hb-pill">Drag to orbit • Scroll to zoom</div>
  </div>
</div>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>

<script type="module" src="{{ '/src/app.js' | relative_url }}"></script>
