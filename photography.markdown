---
layout: page
title: Photography
permalink: /photography/
order: 50
---

A selection of photographs from events, sports, and personal projects.
Click a thumbnail to open the full image with zoom, pan, and swipe navigation.

Photography has been a side activity since early 2025. The focus has been on pro bono work when time allows.

Events I've photographed include:
- **Tampere Marathon** (2025)
- **Tampere Climbing Center Kesacup II** (2025)
- **Tampere Climbing Center Kesacup III** (2025)
- **Powerlifting and Weightlifting Student Championships** (2025)
- Various smaller local events

The gallery is under active development, and interaction may vary across devices. Smaller versions of the photos are stored on GitHub. Downloading the original size photos is possible via the download button, which initializes download from Google Drive.

<section class="photo-gallery">
  <div class="photo-grid" id="photoGrid">
    {% assign photos = site.data.gallery.photos %}
    {% for p in photos %}
      <figure class="photo-card">
        <button class="photo-thumb"
                type="button"
                data-lightbox
                data-lightbox-group="photos"
                data-lightbox-meta="true"
                data-full="{{ '/' | relative_url }}{{ p.full }}"
                data-thumb="{{ '/' | relative_url }}{{ p.thumb }}"
                data-alt="{{ p.name }}"
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
               alt="{{ p.name }}"
               loading="lazy">
        </button>

        {% if p.drive_id %}
          <a class="photo-download"
             href="https://drive.google.com/uc?export=download&id={{ p.drive_id }}"
             target="_blank"
             rel="noopener"
             aria-label="Download {{ p.name }}">&#8595;</a>
        {% endif %}
      </figure>
    {% endfor %}
  </div>
</section>
