---
layout: page
title: Photography
permalink: /photography/
order: 50
---

<style>
  .page-content > .wrapper {
    max-width: min(1800px, calc(100vw - 32px));
  }

  .post-content > p,
  .post-content > ul {
    max-width: 760px;
  }
</style>

A selection of photographs from events, sports, and personal projects.

Photography has been a side activity since early 2025. The focus has been on pro bono work when time allows.

Events I've photographed include:
- **Tampere Marathon** (2025)
- **Tampere Climbing Center Kesacup II** (2025)
- **Tampere Climbing Center Kesacup III** (2025)
- **Powerlifting and Weightlifting Student Championships** (2025)
- **Volleyball Student Championships** (2026)
- **Marski Challenge** (2026)
- Various smaller local events

The gallery is under active development, and interaction may vary across devices. Smaller versions of the photos are stored on GitHub. Downloading the original size photos is possible via the download button, which initializes download from Google Drive.

<details class="viewer-help" open>
  <summary>Viewer controls</summary>
  <ul>
    <li>Open a photo by selecting its thumbnail.</li>
    <li>Zoom with click, mouse wheel, or pinch. Drag to pan after zooming.</li>
    <li>Use <kbd>Ctrl</kbd> + drag to draw a zoom area on desktop.</li>
    <li>Move between photos with the side buttons, arrow keys, or swipe.</li>
    <li>Close with <kbd>Esc</kbd>, the close button, or the dark area outside the image.</li>
  </ul>
</details>

<section class="photo-gallery">
  <div class="photo-grid" id="photoGrid">
    {% assign photos = site.data.gallery.photos %}
    {% for p in photos %}
      {% assign photo_alt = p.description | default: p.file | default: p.name %}
      <figure class="photo-card">
        <button class="photo-thumb"
                type="button"
                data-lightbox
                data-lightbox-group="photos"
                data-lightbox-meta="true"
                data-full="{{ '/' | relative_url }}{{ p.full }}"
                data-thumb="{{ '/' | relative_url }}{{ p.thumb }}"
                data-alt="{{ photo_alt | escape }}"
                data-name="{{ p.name }}"
                data-file="{{ p.file }}"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"
                data-description="{{ p.description | default: '' | escape }}"
                data-captured-at="{{ p.captured_at | default: '' }}"
                data-camera-model="{{ p.camera_model | default: '' | escape }}"
                data-lens-model="{{ p.lens_model | default: '' | escape }}"
                data-focal-length="{{ p.focal_length | default: '' | escape }}"
                data-aperture="{{ p.aperture | default: '' | escape }}"
                data-exposure-time="{{ p.exposure_time | default: '' | escape }}"
                data-iso="{{ p.iso | default: '' }}"
                aria-label="Open {{ p.name }}">
          <img src="{{ '/' | relative_url }}{{ p.thumb }}"
               alt="{{ photo_alt | escape }}"
               loading="lazy">
        </button>

      </figure>
    {% endfor %}
  </div>
</section>
