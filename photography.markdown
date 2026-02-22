---
layout: page
title: Photography
permalink: /photography/
order: 50
---

A selection of photographs from events, sports, and personal projects.  
Click a thumbnail to view the full image.

Photography has been a side activity since early 2025. The focus has been on pro bono work when time allows.  

Events I've photographed include:
- **Tampere Marathon** (2025)
- **Tampere Climbing Center Kesäcup II** (2025)
- **Tampere Climbing Center Kesäcup III** (2025)
- **Powerlifting and Weightlifting Student Championships** (2025)
- Various smaller local events

The gallery is under active development, and interaction may vary across devices.

<section class="photo-gallery">
  <div class="photo-grid" id="photoGrid">
    {% for p in site.data.photos.photos %}
      <figure class="photo-card">
        <button class="photo-thumb"
                type="button"
                data-full="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
                data-alt="{{ p.name }}"
                data-name="{{ p.name }}"
                data-file="{{ p.file }}"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"
                aria-label="Open {{ p.name }}">
          <img src="{{ '/assets/photos/thumbs/' | relative_url }}{{ p.file }}"
               alt="{{ p.name }}" loading="lazy">
        </button>

        <button class="photo-zoom"
                type="button"
                data-full="{{ '/assets/photos/full/' | relative_url }}{{ p.file }}"
                data-alt="{{ p.name }}"
                data-name="{{ p.name }}"
                data-file="{{ p.file }}"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"
                aria-label="Zoom {{ p.name }}">⤢</button>

        <button class="photo-download"
                type="button"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"
                aria-label="Download {{ p.name }}">↓</button>
      </figure>
    {% endfor %}
  </div>
</section>

<dialog class="photo-lightbox" id="photoLightbox" aria-label="Image viewer">
  <button class="photo-lightbox-close" id="photoLightboxClose" type="button" aria-label="Close">×</button>

  <a class="photo-lightbox-download" id="photoLightboxDownload" download aria-label="Download full size">↓</a>

  <button class="photo-nav photo-prev" id="photoPrev" type="button" aria-label="Previous">‹</button>
  <button class="photo-nav photo-next" id="photoNext" type="button" aria-label="Next">›</button>

  <div class="photo-stage" id="photoStage">
    <img class="photo-lightbox-img" id="photoLightboxImg" alt="">
  </div>

  <div class="photo-meta" id="photoMeta" aria-live="polite"></div>
</dialog>

<!-- EXIF reader (small, client-side). If this fails to load, metadata just won’t show. -->
<script src="https://unpkg.com/exifr/dist/lite.umd.js"></script>

<script>
  (function () {
    const grid = document.getElementById('photoGrid');
    const dlg = document.getElementById('photoLightbox');
    const img = document.getElementById('photoLightboxImg');
    const stage = document.getElementById('photoStage');
    const closeBtn = document.getElementById('photoLightboxClose');
    const prevBtn = document.getElementById('photoPrev');
    const nextBtn = document.getElementById('photoNext');
    const dl = document.getElementById('photoLightboxDownload');
    const meta = document.getElementById('photoMeta');

    const thumbs = Array.from(grid.querySelectorAll('.photo-thumb[data-full]'));
    let index = -1;

    // zoom/pan state
    let scale = 1, tx = 0, ty = 0;
    let dragging = false, startX = 0, startY = 0;

    // to avoid toggling zoom after a drag
    let dragMoved = 0;

    function applyTransform() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function resetView() {
      scale = 1; tx = 0; ty = 0;
      applyTransform();
    }

    function fmtExposureTime(t) {
      if (!t || t <= 0) return '';
      if (t >= 1) return `${t.toFixed(1).replace(/\.0$/, '')}s`;
      const inv = Math.round(1 / t);
      return `1/${inv}s`;
    }

    function fmtNumber(x, digits = 1) {
      if (x === null || x === undefined || Number.isNaN(Number(x))) return '';
      const n = Number(x);
      return n.toFixed(digits).replace(/\.0$/, '');
    }

    function safeText(s) {
      return (s ?? '').toString().trim();
    }

    function setDownloadFor(t) {
      // Prefer Drive if present; otherwise fall back to local full image.
      const url = (t?.dataset?.download || '').trim() || (t?.dataset?.full || '').trim();
      const filename = (t?.dataset?.file || '').trim() || 'photo.jpg';

      if (!dl) return;
      if (url) {
        dl.href = url;
        dl.setAttribute('download', filename);
        dl.style.display = '';
      } else {
        dl.removeAttribute('href');
        dl.style.display = 'none';
      }
    }

    function renderMetaLoading(name, file) {
      if (!meta) return;
      const title = safeText(name) || safeText(file) || '';
      meta.innerHTML = title ? `<div><strong>${title}</strong></div><div style="opacity:.85;">Loading metadata…</div>` : `<div style="opacity:.85;">Loading metadata…</div>`;
    }

    function renderMetaNone(name, file) {
      if (!meta) return;
      const title = safeText(name) || safeText(file) || '';
      meta.innerHTML = title ? `<div><strong>${title}</strong></div><div style="opacity:.85;">No metadata available.</div>` : `<div style="opacity:.85;">No metadata available.</div>`;
    }

    function renderMeta(exif, name, file) {
      if (!meta) return;

      const title = safeText(name) || safeText(file) || '';

      // Common EXIF fields (names vary by camera/vendor; exifr normalizes many)
      const make = safeText(exif?.Make);
      const model = safeText(exif?.Model);
      const lens = safeText(exif?.LensModel) || safeText(exif?.Lens);
      const focal = exif?.FocalLength ? `${fmtNumber(exif.FocalLength, 0)}mm` : '';
      const fnum = exif?.FNumber ? `f/${fmtNumber(exif.FNumber, 1)}` : '';
      const iso = exif?.ISO ? `ISO ${exif.ISO}` : '';
      const exp = exif?.ExposureTime ? fmtExposureTime(exif.ExposureTime) : '';
      const date =
        exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString().slice(0, 10) :
        safeText(exif?.DateTimeOriginal);

      const cam = [make, model].filter(Boolean).join(' ');
      const settings = [focal, fnum, exp, iso].filter(Boolean).join(' • ');

      const lines = [];
      if (title) lines.push(`<div><strong>${title}</strong></div>`);
      if (cam) lines.push(`<div>${cam}</div>`);
      if (lens) lines.push(`<div>${lens}</div>`);
      if (settings) lines.push(`<div>${settings}</div>`);
      if (date) lines.push(`<div style="opacity:.9;">${date}</div>`);

      meta.innerHTML = lines.length ? lines.join('') : `<div style="opacity:.85;">No metadata available.</div>`;
    }

    async function loadExifFor(t) {
      if (!meta) return;

      const name = t?.dataset?.name || t?.dataset?.alt || '';
      const file = t?.dataset?.file || '';

      // Show immediate feedback
      renderMetaLoading(name, file);

      try {
        // exifr lite might not include every tag, but is fast and sufficient for camera/lens/settings/date in many cases.
        if (!window.exifr || !t?.dataset?.full) {
          renderMetaNone(name, file);
          return;
        }
        const exif = await window.exifr.parse(t.dataset.full, {
          // keep it small but useful
          pick: [
            'Make','Model','LensModel','Lens',
            'FocalLength','FNumber','ExposureTime','ISO',
            'DateTimeOriginal'
          ]
        });
        if (!exif) renderMetaNone(name, file);
        else renderMeta(exif, name, file);
      } catch (err) {
        renderMetaNone(name, file);
      }
    }

    function openAt(i) {
      if (!thumbs.length) return;
      index = (i + thumbs.length) % thumbs.length;

      const t = thumbs[index];
      img.src = t.dataset.full;
      img.alt = t.dataset.alt || '';

      setDownloadFor(t);
      loadExifFor(t);

      resetView();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }

    function closeLightbox() {
      img.src = '';
      if (meta) meta.innerHTML = '';
      dlg.close?.();
      dlg.removeAttribute('open');
    }

    function next() { openAt(index + 1); }
    function prev() { openAt(index - 1); }

    grid.addEventListener('click', (e) => {
      // Download button on thumbnail
      const dBtn = e.target.closest('.photo-download[data-download]');
      if (dBtn) {
        const url = (dBtn.dataset.download || '').trim();
        if (url) window.open(url, '_blank', 'noopener');
        return;
      }

      const btn = e.target.closest('button[data-full]');
      if (!btn) return;

      const card = btn.closest('.photo-card');
      const thumb = btn.classList.contains('photo-thumb')
        ? btn
        : card?.querySelector('.photo-thumb');

      const i = thumbs.indexOf(thumb);
      openAt(i >= 0 ? i : 0);
    });

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      const open = dlg.open || dlg.hasAttribute('open');
      if (!open) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === '+' || e.key === '=') { scale = Math.min(6, scale * 1.2); applyTransform(); }
      if (e.key === '-' || e.key === '_') { scale = Math.max(1, scale / 1.2); applyTransform(); }
      if (e.key === '0') resetView();
    });

    // Click image to toggle zoom (1x <-> 2x), but not after a drag
    stage.addEventListener('click', () => {
      if (dragMoved > 6) return;
      if (scale === 1) { scale = 2; applyTransform(); }
      else resetView();
    });

    // Wheel zoom (mouse/trackpad)
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = (e.deltaY < 0) ? 1.12 : (1 / 1.12);
      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;
      scale = newScale;
      applyTransform();
    }, { passive: false });

    // Swipe (touch) to next/prev when not zoomed
    let swipeActive = false;
    let swipeStartX = 0, swipeStartY = 0;
    const SWIPE_MIN_X = 50;
    const SWIPE_MAX_Y = 60;

    // Pinch zoom (touch)
    const pointers = new Map(); // pointerId -> {x,y}
    let pinchBaseDist = 0;
    let pinchBaseScale = 1;

    function dist(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    stage.addEventListener('pointerdown', (e) => {
      dragMoved = 0;

      // Touch swipe baseline (only when not zoomed)
      if (e.pointerType === 'touch' && scale === 1) {
        swipeActive = true;
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
      }

      // Touch pinch tracking
      if (e.pointerType === 'touch') {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        stage.setPointerCapture(e.pointerId);

        if (pointers.size === 2) {
          const [p1, p2] = Array.from(pointers.values());
          pinchBaseDist = dist(p1, p2);
          pinchBaseScale = scale;
        }
        return;
      }

      // Mouse drag-to-pan when zoomed (left button only)
      if (scale <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      dragging = true;
      startX = e.clientX - tx;
      startY = e.clientY - ty;
      stage.setPointerCapture(e.pointerId);
      applyTransform();
    });

    stage.addEventListener('pointermove', (e) => {
      // Touch pinch update
      if (e.pointerType === 'touch' && pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 2) {
          const [p1, p2] = Array.from(pointers.values());
          const d = dist(p1, p2);
          if (pinchBaseDist > 0) {
            const raw = pinchBaseScale * (d / pinchBaseDist);
            scale = Math.min(6, Math.max(1, raw));
            applyTransform();
          }
        }
        return;
      }

      // Mouse/pen panning
      if (!dragging) return;
      const nx = e.clientX - startX;
      const ny = e.clientY - startY;
      dragMoved += Math.abs(nx - tx) + Math.abs(ny - ty);
      tx = nx;
      ty = ny;
      applyTransform();
    });

    stage.addEventListener('pointerup', (e) => {
      // Touch swipe resolve (only when not zoomed)
      if (e.pointerType === 'touch') {
        if (swipeActive && scale === 1) {
          swipeActive = false;
          const dx = e.clientX - swipeStartX;
          const dy = e.clientY - swipeStartY;
          if (Math.abs(dx) >= SWIPE_MIN_X && Math.abs(dy) <= SWIPE_MAX_Y) {
            if (dx < 0) next();
            else prev();
          }
        }

        // End pinch pointer
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchBaseDist = 0;
        try { stage.releasePointerCapture(e.pointerId); } catch {}
        return;
      }

      // End mouse drag
      dragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch {}
      applyTransform();
    });

    stage.addEventListener('pointercancel', (e) => {
      swipeActive = false;
      dragging = false;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchBaseDist = 0;
      applyTransform();
    });
  })();
</script>
