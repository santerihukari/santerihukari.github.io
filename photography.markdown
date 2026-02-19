---
layout: page
title: Photography
permalink: /photography/
order: 50
---

Some selected photographs. Click a thumbnail to view full size.

<section class="photo-gallery">
  <div class="photo-grid" id="photoGrid">
    {% for p in site.data.photos.photos %}
      <figure class="photo-card">
        <button class="photo-thumb"
                type="button"
                data-full="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
                data-alt="{{ p.name }}"
                aria-label="Open {{ p.name }}">
          <img src="{{ '/assets/photos/thumbs/' | relative_url }}{{ p.file }}"
               alt="{{ p.name }}" loading="lazy">
        </button>

        <button class="photo-zoom"
                type="button"
                data-full="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
                data-alt="{{ p.name }}"
                aria-label="Zoom {{ p.name }}">⤢</button>
      </figure>
    {% endfor %}
  </div>
</section>

<dialog class="photo-lightbox" id="photoLightbox" aria-label="Image viewer">
  <button class="photo-lightbox-close" id="photoLightboxClose" type="button" aria-label="Close">×</button>
  <img class="photo-lightbox-img" id="photoLightboxImg" alt="">
</dialog>

<script>
  (function () {
    const grid = document.getElementById('photoGrid');
    const dlg = document.getElementById('photoLightbox');
    const img = document.getElementById('photoLightboxImg');
    const closeBtn = document.getElementById('photoLightboxClose');

    function openLightbox(src, alt) {
      img.src = src;
      img.alt = alt || '';
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', ''); // basic fallback
    }

    function closeLightbox() {
      img.src = '';
      dlg.close?.();
      dlg.removeAttribute('open');
    }

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-full]');
      if (!btn) return;
      openLightbox(btn.dataset.full, btn.dataset.alt);
    });

    closeBtn.addEventListener('click', closeLightbox);

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (dlg.open || dlg.hasAttribute('open'))) closeLightbox();
    });
  })();
</script>
