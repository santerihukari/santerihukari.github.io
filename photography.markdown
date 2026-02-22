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

The gallery is under active development, and interaction may vary across devices. Smaller versions of the photos are stored on GitHub. Downloading the original size photos is possible via the download button, which initializes download from Google Drive. Not all photos have download functionality yet - I'm working on an automated workflow for this.

<section class="photo-gallery">
  <div class="photo-grid" id="photoGrid">
    {% assign photos = site.data.gallery.photos %}
    {% for p in photos %}
      <figure class="photo-card">
        <button class="photo-thumb"
                type="button"
                data-full="{{ '/' | relative_url }}{{ p.full }}"
                data-thumb="{{ '/' | relative_url }}{{ p.thumb }}"
                data-alt="{{ p.name }}"
                data-name="{{ p.name }}"
                data-file="{{ p.file }}"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"

                data-captured-at="{{ p.captured_at | default: '' }}"
                data-camera-make="{{ p.camera_make | default: '' }}"
                data-camera-model="{{ p.camera_model | default: '' }}"
                data-lens-model="{{ p.lens_model | default: '' }}"
                data-focal-length="{{ p.focal_length | default: '' }}"
                data-aperture="{{ p.aperture | default: '' }}"
                data-exposure-time="{{ p.exposure_time | default: '' }}"
                data-iso="{{ p.iso | default: '' }}"
                aria-label="Open {{ p.name }}">
          <img src="{{ '/' | relative_url }}{{ p.thumb }}"
               alt="{{ p.name }}" loading="lazy">
        </button>

        <button class="photo-zoom"
                type="button"
                data-full="{{ '/' | relative_url }}{{ p.full }}"
                data-thumb="{{ '/' | relative_url }}{{ p.thumb }}"
                data-alt="{{ p.name }}"
                data-name="{{ p.name }}"
                data-file="{{ p.file }}"
                data-download="{% if p.drive_id %}https://drive.google.com/uc?export=download&id={{ p.drive_id }}{% endif %}"

                data-captured-at="{{ p.captured_at | default: '' }}"
                data-camera-make="{{ p.camera_make | default: '' }}"
                data-camera-model="{{ p.camera_model | default: '' }}"
                data-lens-model="{{ p.lens_model | default: '' }}"
                data-focal-length="{{ p.focal_length | default: '' }}"
                data-aperture="{{ p.aperture | default: '' }}"
                data-exposure-time="{{ p.exposure_time | default: '' }}"
                data-iso="{{ p.iso | default: '' }}"
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

    function safeText(s) {
      return (s ?? '').toString().trim();
    }

    function setDownloadFor(t) {
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

    function renderMetaFromDataset(t) {
      if (!meta) return;

      const name = safeText(t?.dataset?.name || t?.dataset?.alt);
      const file = safeText(t?.dataset?.file);

      const make = safeText(t?.dataset?.cameraMake);
      const model = safeText(t?.dataset?.cameraModel);
      const lens = safeText(t?.dataset?.lensModel);

      const focal = safeText(t?.dataset?.focalLength);
      const aperture = safeText(t?.dataset?.aperture);
      const exp = safeText(t?.dataset?.exposureTime);
      const iso = safeText(t?.dataset?.iso);
      const capturedAt = safeText(t?.dataset?.capturedAt);

      const title = name || file || '';

      const cam = [make, model].filter(Boolean).join(' ');
      const settings = [focal, aperture, exp, iso ? `ISO ${iso}` : ''].filter(Boolean).join(' • ');

      const lines = [];
      if (title) lines.push(`<div><strong>${title}</strong></div>`);
      if (cam) lines.push(`<div>${cam}</div>`);
      if (lens) lines.push(`<div>${lens}</div>`);
      if (settings) lines.push(`<div>${settings}</div>`);
      if (capturedAt) {
        // captured_at is ISO string; show YYYY-MM-DD if possible
        const shortDate = capturedAt.length >= 10 ? capturedAt.slice(0, 10) : capturedAt;
        lines.push(`<div style="opacity:.9;">${shortDate}</div>`);
      }

      meta.innerHTML = lines.length ? lines.join('') : `<div style="opacity:.85;">No metadata available.</div>`;
    }

    function openAt(i) {
      if (!thumbs.length) return;
      index = (i + thumbs.length) % thumbs.length;

      const t = thumbs[index];
      img.src = t.dataset.full;
      img.alt = t.dataset.alt || '';

      setDownloadFor(t);
      renderMetaFromDataset(t);

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

    stage.addEventListener('click', (e) => {
      if (dragMoved > 6) return;

      if (e.target === stage) {
        closeLightbox();
        return;
      }

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

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = (e.deltaY < 0) ? 1.12 : (1 / 1.12);
      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;

      scale = newScale;
      applyTransform();
    }, { passive: false });

    img.addEventListener('load', () => {
      requestAnimationFrame(() => {
        computeBaseSize();
        applyTransform();
      });
    });

    stage.addEventListener('pointerdown', (e) => {
      dragMoved = 0;

      if (e.pointerType === 'touch') {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        stage.setPointerCapture(e.pointerId);

        if (scale === 1 && pointers.size === 1) {
          swipeActive = true;
          swipeStartX = e.clientX;
          swipeStartY = e.clientY;
        } else {
          swipeActive = false;
        }

        if (pointers.size === 2) {
          const [p1, p2] = Array.from(pointers.values());
          pinchBaseDist = dist(p1, p2);
          pinchBaseScale = scale;
        }

        if (scale > 1 && pointers.size === 1) {
          dragging = true;
          dragPointerType = 'touch';
          startX = e.clientX - tx;
          startY = e.clientY - ty;
          applyTransform();
        }

        return;
      }

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
      if (e.pointerType === 'touch' && pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 2) {
          dragging = false;
          const [p1, p2] = Array.from(pointers.values());
          const d = dist(p1, p2);
          if (pinchBaseDist > 0) {
            const raw = pinchBaseScale * (d / pinchBaseDist);
            scale = Math.min(6, Math.max(1, raw));
            applyTransform();
          }
          return;
        }

        if (dragging && dragPointerType === 'touch' && scale > 1 && pointers.size === 1) {
          const nx = e.clientX - startX;
          const ny = e.clientY - startY;
          dragMoved += Math.abs(nx - tx) + Math.abs(ny - ty);
          tx = nx;
          ty = ny;
          applyTransform();
        }

        return;
      }

      if (!dragging) return;
      const nx = e.clientX - startX;
      const ny = e.clientY - startY;
      dragMoved += Math.abs(nx - tx) + Math.abs(ny - ty);
      tx = nx;
      ty = ny;
      applyTransform();
    });

    stage.addEventListener('pointerup', (e) => {
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

        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchBaseDist = 0;

        if (pointers.size === 0) {
          dragging = false;
          dragPointerType = '';
        }

        try { stage.releasePointerCapture(e.pointerId); } catch {}
        applyTransform();
        return;
      }

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
