---
layout: page
title: Photography
permalink: /photography/
order: 50
---

<dialog class="photo-lightbox" id="photoLightbox" aria-label="Image viewer">
  <button class="photo-lightbox-close" id="photoLightboxClose" type="button" aria-label="Close">×</button>

  <button class="photo-nav photo-prev" id="photoPrev" type="button" aria-label="Previous">‹</button>
  <button class="photo-nav photo-next" id="photoNext" type="button" aria-label="Next">›</button>

  <div class="photo-stage" id="photoStage">
    <img class="photo-lightbox-img" id="photoLightboxImg" alt="">
  </div>
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

    let items = [];
    let index = -1;

    // zoom/pan state
    let scale = 1;
    let tx = 0, ty = 0;
    let dragging = false;
    let startX = 0, startY = 0;

    function applyTransform() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function resetView() {
      scale = 1;
      tx = 0; ty = 0;
      applyTransform();
    }

    function openAt(i) {
      if (!items.length) return;
      index = (i + items.length) % items.length;

      const el = items[index];
      img.src = el.dataset.full;
      img.alt = el.dataset.alt || '';

      resetView();

      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }

    function closeLightbox() {
      img.src = '';
      dlg.close?.();
      dlg.removeAttribute('open');
    }

    function next() { openAt(index + 1); }
    function prev() { openAt(index - 1); }

    // Build ordered list from DOM
    function refreshItems() {
      items = Array.from(grid.querySelectorAll('button[data-full]'))
        .filter((b) => b.classList.contains('photo-thumb')); // only thumbs, not zoom buttons
    }

    refreshItems();

    // Open from thumbnail click
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-full]');
      if (!btn) return;

      // If zoom button was clicked, find the corresponding thumb in the same card
      const card = btn.closest('.photo-card');
      const thumb = card ? card.querySelector('.photo-thumb[data-full]') : btn;

      refreshItems();
      const i = items.indexOf(thumb);
      openAt(i >= 0 ? i : 0);
    });

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    // Close when clicking backdrop
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    // Keyboard controls
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

    // Click to toggle zoom (1x <-> 2x) around center
    stage.addEventListener('click', (e) => {
      // prevent click-drag from toggling zoom
      if (dragging) return;

      if (scale === 1) {
        scale = 2;
        applyTransform();
      } else {
        resetView();
      }
    });

    // Wheel zoom (trackpad/mouse)
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.12 : 1 / 1.12;

      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;

      scale = newScale;
      applyTransform();
    }, { passive: false });

    // Drag to pan (only when zoomed)
    stage.addEventListener('pointerdown', (e) => {
      if (scale <= 1) return;
      dragging = true;
      startX = e.clientX - tx;
      startY = e.clientY - ty;
      stage.setPointerCapture(e.pointerId);
      applyTransform();
    });

    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      tx = e.clientX - startX;
      ty = e.clientY - startY;
      applyTransform();
    });

    stage.addEventListener('pointerup', (e) => {
      dragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch {}
      applyTransform();
    });

    stage.addEventListener('pointercancel', () => {
      dragging = false;
      applyTransform();
    });
  })();
</script>
