---
layout: page
title: SRK Boulder Photogrammetry
permalink: /projects/photogrammetry/
parent: projects
nav_order: 20
---

<style>
  .page-content > .wrapper {
    max-width: min(1800px, calc(100vw - 32px));
  }

  .photogrammetry-viewer {
    display: block;
    width: 100%;
    min-height: min(82vh, 980px);
    border: 0;
    background: #0b0f14;
  }
</style>

<p class="photogrammetry-intro">
  This is my first photogrammetry model: a reconstruction of the SRK boulder in Tampere.
  The viewer below is built from the local HTML export in this repository. It may be slow
  to load, and compatibility is not guaranteed on all devices or browsers.
</p>

<iframe
  class="photogrammetry-viewer"
  src="{{ '/photogrammetry/boulder2_chalk_priority_adaptive_blackcaps_routes_viewer.html' | relative_url }}"
  title="Photogrammetry viewer"
  loading="lazy"
  allowfullscreen>
</iframe>
