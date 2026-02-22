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

<!-- EXIF reader (client-side) -->
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

    // pan state
    let dragging = false;
    let dragPointerType = '';
    let startX = 0, startY = 0;
    let dragMoved = 0;

    // base (fit-to-stage) size at scale=1, used for clamping
    let baseW = 0, baseH = 0;

    // swipe (touch) when not zoomed
    let swipeActive = false;
    let swipeStartX = 0, swipeStartY = 0;
    const SWIPE_MIN_X = 50;
    const SWIPE_MAX_Y = 60;

    // pinch zoom (touch)
    const pointers = new Map(); // pointerId -> {x,y}
    let pinchBaseDist = 0;
    let pinchBaseScale = 1;

    function dist(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    function clamp(v, lo, hi) {
      return Math.min(hi, Math.max(lo, v));
    }

    function computeBaseSize() {
      // base size should be measured with transform reset
      const prev = img.style.transform;
      img.style.transform = 'translate(0px, 0px) scale(1)';
      const r = img.getBoundingClientRect();
      img.style.transform = prev;

      baseW = r.width || baseW;
      baseH = r.height || baseH;
    }

    function clampTranslation() {
      if (scale <= 1 || !baseW || !baseH) {
        tx = 0; ty = 0;
        return;
      }
      const sr = stage.getBoundingClientRect();
      const stageW = sr.width || 0;
      const stageH = sr.height || 0;

      const scaledW = baseW * scale;
      const scaledH = baseH * scale;

      // allowable translation so image never leaves the stage bounds
      const maxX = Math.max(0, (scaledW - stageW) / 2);
      const maxY = Math.max(0, (scaledH - stageH) / 2);

      tx = clamp(tx, -maxX, maxX);
      ty = clamp(ty, -maxY, maxY);
    }

    function applyTransform() {
      clampTranslation();
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function resetView() {
      scale = 1; tx = 0; ty = 0;
      dragging = false;
      dragMoved = 0;
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
      meta.innerHTML = title
        ? `<div><strong>${title}</strong></div><div style="opacity:.85;">Loading metadata…</div>`
        : `<div style="opacity:.85;">Loading metadata…</div>`;
    }

    function renderMetaNone(name, file) {
      if (!meta) return;
      const title = safeText(name) || safeText(file) || '';
      meta.innerHTML = title
        ? `<div><strong>${title}</strong></div><div style="opacity:.85;">No metadata available.</div>`
        : `<div style="opacity:.85;">No metadata available.</div>`;
    }

    function renderMeta(exif, name, file) {
      if (!meta) return;

      const title = safeText(name) || safeText(file) || '';

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

      renderMetaLoading(name, file);

      try {
        if (!window.exifr || !t?.dataset?.full) {
          renderMetaNone(name, file);
          return;
        }
        const exif = await window.exifr.parse(t.dataset.full, {
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

    // Close when clicking on the dialog backdrop (outside the dialog content)
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    // (3) Close when clicking empty stage area (not on the image)
    stage.addEventListener('click', (e) => {
      // prevent accidental close after a pan/drag
      if (dragMoved > 6) return;

      // if clicking the empty stage (outside the image), close
      if (e.target === stage) {
        closeLightbox();
        return;
      }

      // clicking the image toggles zoom
      if (e.target === img) {
        if (scale === 1) { scale = 2; applyTransform(); }
        else resetView();
      }
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

    // Wheel zoom (mouse/trackpad)
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = (e.deltaY < 0) ? 1.12 : (1 / 1.12);
      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;

      scale = newScale;
      applyTransform();
    }, { passive: false });

    // Ensure base size is known after the image loads at scale=1
    img.addEventListener('load', () => {
      // allow layout to settle before measuring
      requestAnimationFrame(() => {
        computeBaseSize();
        applyTransform();
      });
    });

    // ----- Pointer interactions: swipe / pinch / pan -----

    stage.addEventListener('pointerdown', (e) => {
      dragMoved = 0;

      // Touch: track pointers for pinch and also enable 1-finger pan when zoomed
      if (e.pointerType === 'touch') {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        stage.setPointerCapture(e.pointerId);

        // Swipe baseline (only when not zoomed)
        if (scale === 1 && pointers.size === 1) {
          swipeActive = true;
          swipeStartX = e.clientX;
          swipeStartY = e.clientY;
        } else {
          swipeActive = false;
        }

        // Pinch baseline
        if (pointers.size === 2) {
          const [p1, p2] = Array.from(pointers.values());
          pinchBaseDist = dist(p1, p2);
          pinchBaseScale = scale;
        }

        // (1) One-finger pan when zoomed
        if (scale > 1 && pointers.size === 1) {
          dragging = true;
          dragPointerType = 'touch';
          startX = e.clientX - tx;
          startY = e.clientY - ty;
          applyTransform();
        }

        return;
      }

      // Mouse/pen drag-to-pan when zoomed (left mouse only)
      if (scale <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      dragging = true;
      dragPointerType = e.pointerType || 'mouse';
      startX = e.clientX - tx;
      startY = e.clientY - ty;
      stage.setPointerCapture(e.pointerId);
      applyTransform();
    });

    stage.addEventListener('pointermove', (e) => {
      // Touch pinch update
      if (e.pointerType === 'touch' && pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // If pinching (2 pointers), zoom
        if (pointers.size === 2) {
          dragging = false; // pinch overrides single-finger pan
          const [p1, p2] = Array.from(pointers.values());
          const d = dist(p1, p2);
          if (pinchBaseDist > 0) {
            const raw = pinchBaseScale * (d / pinchBaseDist);
            scale = Math.min(6, Math.max(1, raw));
            applyTransform();
          }
          return;
        }

        // (1) One-finger pan while zoomed
        if (dragging && dragPointerType === 'touch' && scale > 1 && pointers.size === 1) {
          const nx = e.clientX - startX;
          const ny = e.clientY - startY;
          dragMoved += Math.abs(nx - tx) + Math.abs(ny - ty);
          tx = nx;
          ty = ny;
          applyTransform(); // (2) clamp inside applyTransform
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
      applyTransform(); // (2) clamp inside applyTransform
    });

    stage.addEventListener('pointerup', (e) => {
      // Touch end
      if (e.pointerType === 'touch') {
        // Resolve swipe only when not zoomed and it was a single-finger gesture
        if (swipeActive && scale === 1) {
          swipeActive = false;
          const dx = e.clientX - swipeStartX;
          const dy = e.clientY - swipeStartY;
          if (Math.abs(dx) >= SWIPE_MIN_X && Math.abs(dy) <= SWIPE_MAX_Y) {
            if (dx < 0) next();
            else prev();
          }
        }

        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchBaseDist = 0;

        // stop dragging when the last pointer is up
        if (pointers.size === 0) {
          dragging = false;
          dragPointerType = '';
        }

        try { stage.releasePointerCapture(e.pointerId); } catch {}
        applyTransform();
        return;
      }

      // Mouse/pen end
      dragging = false;
      dragPointerType = '';
      try { stage.releasePointerCapture(e.pointerId); } catch {}
      applyTransform();
    });

    stage.addEventListener('pointercancel', (e) => {
      swipeActive = false;
      dragging = false;
      dragPointerType = '';
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchBaseDist = 0;
      applyTransform();
    });
  })();
</script>
