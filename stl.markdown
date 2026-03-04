---
layout: page
title_: STL
permalink: /stl/
visible: false
---

<style>
  .stlviewer { height: min(70vh, 720px); width: 100%; }
  #loading {
    width: 100%;
    height: 40px;
    position: absolute;
    top: 260px;
    left: 0;
    text-align: center;
    opacity: 0.7;
    z-index: 1;
  }
</style>

<h2>
  <span style="float:right;">
    <input type="checkbox" id="c1" name="cntrl"/><label for="c1">orbit</label>
    <label style="margin-left: 40px"></label>
    <input type="radio" id="r1" name="model"/><label for="r1">wire</label>
    <label style="margin-left: 20px"></label>
    <input type="radio" id="r2" name="model"/><label for="r2">shaded</label>
  </span>
</h2>

<div style="width:100%; text-align:center; position:relative;">
  <div id="loading">Loading…</div>

  <div class="stlviewer"
       data-src="{{ '/assets/stl/polettesx16.stl' | relative_url }}"
       data-value="1.6">
    <canvas id="glcanvas" width="740" height="400"></canvas>
  </div>
</div>

<script src="{{ '/assets/js/webgl.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/three.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stlloader.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/orbitcontrols.min.js' | relative_url }}"></script>
<script src="{{ '/assets/js/stlviewer.js' | relative_url }}"></script>

<script>
  window.onload = function () {
    STLViewerEnable("stlviewer");
  };
</script>
