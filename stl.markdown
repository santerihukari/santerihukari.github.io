---
layout: page
title: STL
permalink: /stl/
visible: false
---

<div id="stl-viewer" style="width:100%; height:min(70vh,720px); border-radius:12px; overflow:hidden; background:#0b0f14; border:1px solid rgba(255,255,255,0.08);"></div>

<script>
  window.__STL_VIEWER_PATH__ = "{{ '/assets/stl/polettesx16.stl' | relative_url }}";
</script>

<script type="module" src="{{ '/assets/js/stl-viewer.js' | relative_url }}"></script>
