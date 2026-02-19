---
layout: page
title: Photography
permalink: /photography/
order: 50
---

Some selected photographs. Click a thumbnail to view full size.

<section class="gallery">
  <div class="grid">
    {% for p in site.data.photos.photos %}
      <a class="tile" href="/assets/photos/full/{{ p.file }}" target="_blank" rel="noopener">
        <img src="/assets/photos/thumbs/{{ p.file }}" alt="{{ p.name }}" loading="lazy">
      </a>
    {% endfor %}
  </div>
</section>
