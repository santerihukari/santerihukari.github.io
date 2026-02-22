---
layout: page
title: Climbing
permalink: /climbing/
order: 25
---

<div class="climbing-header">
  <button
    class="portrait-link"
    type="button"
    data-full="/397A9717_lg.jpg"
    data-alt="Santeri Hukari portrait"
    aria-label="Open portrait"
    style="
      position: relative;
      width: 120px;
      height: 120px;
      padding: 0;
      border: 0;
      background: transparent;
      border-radius: 9999px;
      cursor: pointer;
    "
  >
    <img
      class="climbing-portrait"
      src="/397A9717_thumb.jpg"
      alt="Santeri Hukari portrait"
      loading="lazy"
      decoding="async"
      width="120"
      height="120"
      style="
        display: block;
        width: 120px;
        height: 120px;
        border-radius: 9999px;
      "
    />

    <!-- Circular photographer credit -->
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      style="
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: visible;
      "
    >
      <defs>
        <!-- Circle path near the edge; tweak r to move text inward/outward -->
        <path
          id="creditCircle"
          d="M 60,60 m -54,0 a 54,54 0 1,1 108,0 a 54,54 0 1,1 -108,0"
        ></path>
      </defs>

      <!-- Stroke behind text for contrast -->
      <text
        style="
          font: 600 9px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica,
            Arial, sans-serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          fill: none;
          stroke: rgba(0, 0, 0, 0.55);
          stroke-width: 2.5;
          paint-order: stroke;
        "
      >
        <textPath href="#creditCircle" startOffset="50%" text-anchor="middle">
          Photo: Olli Laaksonen • Photo: Olli Laaksonen •
        </textPath>
      </text>

      <!-- Foreground text -->
      <text
        style="
          font: 600 9px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica,
            Arial, sans-serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          fill: rgba(255, 255, 255, 0.95);
        "
      >
        <textPath href="#creditCircle" startOffset="50%" text-anchor="middle">
          Photo: Olli Laaksonen • Photo: Olli Laaksonen •
        </textPath>
      </text>
    </svg>

    <!-- Screen-reader-only fallback credit -->
    <span
      style="
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      "
    >
      Photo: Olli Laaksonen
    </span>
  </button>

  <div class="climbing-header-text">
    <p><strong>Focus:</strong> Outdoor bouldering</p>
    <p><strong>Based in:</strong> Tampere, Finland</p>
    <p><strong>Instruction experience:</strong> 2016 – present</p>
  </div>
</div>

<!-- Lightbox -->
<dialog class="photo-lightbox" id="climbLightbox" aria-label="Image viewer">
  <button
    class="photo-lightbox-close"
    id="climbLightboxClose"
    type="button"
    aria-label="Close"
  >
    ×
  </button>

  <div class="photo-stage" id="climbStage">
    <img class="photo-lightbox-img" id="climbLightboxImg" alt="" />
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

    let scale = 1,
      tx = 0,
      ty = 0;
    let dragging = false,
      startX = 0,
      startY = 0;

    function applyTransform() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      img.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function resetView() {
      scale = 1;
      tx = 0;
      ty = 0;
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

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      const open = dlg.open || dlg.hasAttribute('open');
      if (!open) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === '+' || e.key === '=') {
        scale = Math.min(6, scale * 1.2);
        applyTransform();
      }
      if (e.key === '-' || e.key === '_') {
        scale = Math.max(1, scale / 1.2);
        applyTransform();
      }
      if (e.key === '0') resetView();
    });

    stage.addEventListener('click', () => {
      if (dragging) return;
      if (scale === 1) {
        scale = 2;
        applyTransform();
      } else {
        resetView();
      }
    });

    stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.min(6, Math.max(1, scale * factor));
        if (newScale === scale) return;
        scale = newScale;
        applyTransform();
      },
      { passive: false }
    );

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
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {}
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

- Instruction of top-rope and lead climbing courses with structured progression
- Supervision during open climbing sessions

- Occasional routesetting at the university climbing facility

---

## Outdoor bouldering

- Regular outdoor bouldering with a clear performance focus (goal: 8A level this year)
- Current level: multiple 7C boulders; hardest ascents include
  [Vesipesu 7C+](https://27crags.com/crags/nimetonsuo/routes/vesipesu) and
  [Painajainen sit start 7C+](https://27crags.com/crags/killerin-kivet-pinsio/routes/painajainen-assis-3rd-edition)
- Current 8A projects:
  [Marvin](https://27crags.com/crags/keljonkangas/routes/marvin),
  [Kuntorasti](https://27crags.com/crags/rastikivi/routes/kuntorasti),
  [Veto Production](https://27crags.com/crags/mayravuori/routes/veto-production)

---

## Community projects

- Managed and coordinated the construction of a bouldering area in *Bommari* (bomb shelter, Hervanta campus)

---

## Training approach

- Systematic, theory-based training with measurable goals
- Primary focus on finger strength, mobility, and targeted weakness development
- Training priorities adapted to the specific demands of current projects
