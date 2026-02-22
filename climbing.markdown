---
layout: page
title: Climbing
permalink: /climbing/
order: 200
---

## Climbing

<div class="climbing-header">
  <button
    class="portrait-link"
    type="button"
    data-full="/397A9717_lg.jpg"
    data-alt="Santeri Hukari portrait"
    aria-label="Open portrait"
  >
    <img
      class="climbing-portrait"
      src="/397A9717_thumb.jpg"
      alt="Santeri Hukari portrait"
      loading="lazy"
      decoding="async"
      width="120"
      height="120"
    />
  </button>

  <div class="climbing-header-text">
    <p><strong>Focus:</strong> Outdoor bouldering</p>
    <p><strong>Based in:</strong> Tampere, Finland</p>
    <p><strong>Instruction experience:</strong> 2016 – present</p>
  </div>
</div>

<!-- Lightbox -->
<dialog class="photo-lightbox" id="climbLightbox" aria-label="Image viewer">
  <button class="photo-lightbox-close" id="climbLightboxClose" type="button" aria-label="Close">×</button>

  <div class="photo-stage" id="climbStage">
    <img class="photo-lightbox-img" id="climbLightboxImg" alt="">
  </div>
</dialog>

<script>
  (function () {
    const trigger = document.querySelector('.portrait-link[data-full]');
    const dlg = document.getElementById('climbLightbox');
    const img = document.getElementById('climbLightboxImg');
    const stage = document.getElementById('climbStage');
    const closeBtn = document.getElementById('climbLightboxClose');

    if (!trigger || !dlg || !img || !stage || !closeBtn) return;

    // zoom/pan state
    let scale = 1, tx = 0, ty = 0;
    let dragging = false, startX = 0, startY = 0;

    function applyTransform() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function resetView() {
      scale = 1; tx = 0; ty = 0;
      applyTransform();
    }

    function openLightbox() {
      img.src = trigger.dataset.full;
      img.alt = trigger.dataset.alt || '';
      resetView();

      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }

    function closeLightbox() {
      img.src = '';
      dlg.close?.();
      dlg.removeAttribute('open');
    }

    trigger.addEventListener('click', openLightbox);
    closeBtn.addEventListener('click', closeLightbox);

    // click backdrop to close
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    // keyboard controls
    document.addEventListener('keydown', (e) => {
      const open = dlg.open || dlg.hasAttribute('open');
      if (!open) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === '+' || e.key === '=') { scale = Math.min(6, scale * 1.2); applyTransform(); }
      if (e.key === '-' || e.key === '_') { scale = Math.max(1, scale / 1.2); applyTransform(); }
      if (e.key === '0') resetView();
    });

    // click image to toggle zoom (1x <-> 2x)
    stage.addEventListener('click', () => {
      if (dragging) return;
      if (scale === 1) { scale = 2; applyTransform(); }
      else resetView();
    });

    // wheel zoom
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = (e.deltaY < 0) ? 1.12 : (1 / 1.12);
      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;
      scale = newScale;
      applyTransform();
    }, { passive: false });

    // drag to pan
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

---

## Instruction

**Climbing Instructor**  
2016 – present

- Instruction of top-rope and lead climbing courses
- Supervision during open climbing sessions
- Session planning and safety-focused coaching for beginners and intermediates

---

## Outdoor bouldering

- Regular outdoor bouldering (local granite and Finnish conditions)
- Emphasis on movement quality, problem-solving, and repeatable tactics
- Interested in documenting areas and sharing practical beta responsibly

---

## Community projects

- Managed the construction of a bouldering area in *Bommari* (bomb shelter, Hervanta campus)

---

## Selected strengths

- Safety mindset and clear instruction structure
- Coaching eye for technique (footwork, body positioning, pacing, confidence)
- Calm supervision in group settings
