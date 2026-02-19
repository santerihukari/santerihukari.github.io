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
      <figure class="card">
        <img src="{{ '/assets/photos/thumbs/' | relative_url }}{{ p.file }}" alt="{{ p.name }}" loading="lazy">
        <a class="zoom"
           href="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
           target="_blank" rel="noopener"
           aria-label="Open full size {{ p.name }}">
          ⤢
        </a>
      </figure>
    {% endfor %}
  </div>
</section>
