---
layout: page
title: Gallery
permalink: /gallery/
nav_id: gallery
nav_order: 55
---

<p class="gallery-intro">
  Event galleries and selected photography by Santeri Hukari.
</p>

{% assign root_galleries = site.data.galleries.galleries
  | where_exp: 'gallery', 'gallery.parent == nil'
  | where_exp: 'gallery', 'gallery.hidden != true'
%}

{% include gallery-tile-grid.html galleries=root_galleries %}
