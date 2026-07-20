---
layout: page
title: Gallery
permalink: /gallery/
nav_id: gallery
nav_order: 55
---

<p class="gallery-intro">
  Event and photography galleries organized by the same hierarchy used locally.
</p>

{% assign root_galleries = site.data.galleries.galleries
  | where_exp: 'gallery', 'gallery.parent == nil'
  | where_exp: 'gallery', 'gallery.hidden != true'
%}

{% include gallery-tile-grid.html galleries=root_galleries %}
