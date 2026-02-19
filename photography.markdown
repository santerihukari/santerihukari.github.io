---
layout: page
title: Photography
permalink: /photography/
order: 50
---

Some selected photographs. Click a thumbnail to view full size.

<section class="photo-gallery">
  <div class="photo-grid">
    {% for p in site.data.photos.photos %}
      <figure class="photo-card">
        <a class="photo-thumb"
           href="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
           aria-label="Open full size {{ p.name }}">
          <img src="{{ '/assets/photos/thumbs/' | relative_url }}{{ p.file }}"
               alt="{{ p.name }}" loading="lazy">
        </a>

        <a class="photo-zoom"
           href="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
           aria-label="Open full size {{ p.name }}">⤢</a>
      </figure>
    {% endfor %}
  </div>
</section>
