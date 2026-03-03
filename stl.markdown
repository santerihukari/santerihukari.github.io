---
layout: page
title: STL
permalink: /stl/
nav_exclude: true
hidden: true
sitemap: false
---

<div id="stl-viewer" style="width:100%; height:min(70vh,720px); border-radius:12px; overflow:hidden; background:#0b0f14; border:1px solid rgba(255,255,255,0.08);"></div>
<p style="margin-top:.75rem; font-size:.95rem; opacity:.9;">
  Loads: <code id="stl-path-label"></code>
</p>

<script>
  // Pass the STL path to the module in a way that doesn't depend on inline module scripts.
  window.__STL_VIEWER_PATH__ = "{{ '/assets/stl/polettesx16.stl' | relative_url }}";
</script>

<script type="module" src="{{ '/assets/js/stl-viewer.mjs' | relative_url }}"></script>
