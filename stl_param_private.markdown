---
layout: page
title: Parametric CAD (Private)
permalink: /stl_param_private/
nav_exclude: true
---


<style>
  .page-content .wrapper {
    max-width: min(1680px, calc(100vw - 48px));
  }

  .hb-wrap {
    display: grid;
    gap: 16px;
    align-items: start;
  }

  .hb-card {
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    border-radius: 12px;
    padding: 12px;
  }

  .hb-view {
    width: 100%;
    height: min(74vh, 820px);
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

This page contains private or less polished parametric CAD models that are still useful for direct access by URL.

<div class="hb-wrap" data-model-scope="private" data-default-model="hangboard">
  <div class="hb-card">
    <div class="hb-muted">
      Private model list for experiments, niche generators, and models hidden from the public dropdown.
      <br><br>
    </div>

    <div id="hb-ui"></div>

    <div class="hb-row">
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
