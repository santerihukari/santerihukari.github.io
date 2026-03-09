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
    let dragging = false;
    let dragPointerType = '';
    let startX = 0, startY = 0;
    let dragMoved = 0;

    let baseW = 0, baseH = 0;

    const pointers = new Map();
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
        tx = 0;
        ty = 0;
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
      scale = 1;
      tx = 0;
      ty = 0;
      dragging = false;
      dragPointerType = '';
      dragMoved = 0;
      pointers.clear();
      pinchBaseDist = 0;
      pinchBaseScale = 1;
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
    });

    stage.addEventListener('click', (e) => {
      if (dragMoved > 6) return;

      if (e.target === stage) {
        closeLightbox();
        return;
      }

      if (e.target === img) {
        if (scale === 1) {
          scale = 2;
          applyTransform();
        } else {
          resetView();
        }
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
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchBaseDist = 0;

        if (pointers.size === 0) {
          dragging = false;
          dragPointerType = '';
        }

        try {
          stage.releasePointerCapture(e.pointerId);
        } catch {}

        applyTransform();
        return;
      }

      dragging = false;
      dragPointerType = '';
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {}
      applyTransform();
    });

    stage.addEventListener('pointercancel', (e) => {
      dragging = false;
      dragPointerType = '';
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchBaseDist = 0;
      applyTransform();
    });
  })();
</script>
