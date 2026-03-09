---
layout: page
title: Force Logger
permalink: /forcelogger/
parent: projects
nav_order: 3
---

## Overview

**Force Logger** is a compact load-cell data logger designed for measuring finger strength and dynamic pulling forces in climbing training. The device is conceptually similar to the Tindeq Progressor but focuses on a simple and transparent hardware setup that can be built and modified easily.

The system uses a **100 kg S-type load cell** connected to an **HX711 precision ADC**, with a microcontroller or single-board computer handling acquisition and logging. Measurements can be performed through a **Raspberry Pi** or **ESP8266**, enabling real-time telemetry and recording of force curves during maximal pulls, hangs, or dynamic loading.

The primary goal of the project is to provide a flexible platform for **quantitative finger strength testing** and **high-resolution load measurements**, while keeping the hardware inexpensive and easy to reproduce. The logged data enables analysis of peak force, force-time characteristics, and consistency across repeated tests.

<button
  class="project-image-link"
  type="button"
  data-full="/images/telemetry.jpg"
  data-alt="Force Logger telemetry"
  aria-label="Open telemetry image"
  style="padding:0;border:0;background:transparent;cursor:pointer;display:inline-block;"
>
  <img
    src="/images/telemetry_thumb.jpg"
    alt="Force Logger telemetry"
    loading="lazy"
    decoding="async"
    style="display:block;max-width:220px;width:100%;height:auto;object-fit:contain;border-radius:12px;"
    onerror="this.onerror=null;this.src='/images/telemetry.jpg';"
  />
</button>

<dialog class="photo-lightbox" id="projectLightbox" aria-label="Image viewer">
  <button
    class="photo-lightbox-close"
    id="projectLightboxClose"
    type="button"
    aria-label="Close"
  >
    ×
  </button>

  <div class="photo-stage" id="projectStage">
    <img class="photo-lightbox-img" id="projectLightboxImg" alt="" />
  </div>
</dialog>

<script>
  (function () {
    const trigger = document.querySelector('.project-image-link[data-full]');
    const dlg = document.getElementById('projectLightbox');
    const img = document.getElementById('projectLightboxImg');
    const stage = document.getElementById('projectStage');
    const closeBtn = document.getElementById('projectLightboxClose');

    if (!trigger || !dlg || !img || !stage || !closeBtn) return;

    let scale = 1, tx = 0, ty = 0;
    let dragging = false, startX = 0, startY = 0;

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

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.min(6, Math.max(1, scale * factor));
      if (newScale === scale) return;
      scale = newScale;
      applyTransform();
    }, { passive: false });

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

