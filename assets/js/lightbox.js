(function () {
  class Lightbox {
    constructor() {
      this.dialog = null;
      this.stage = null;
      this.image = null;
      this.closeBtn = null;
      this.prevBtn = null;
      this.nextBtn = null;
      this.downloadLink = null;
      this.metaBox = null;

      this.items = [];
      this.index = -1;
      this.currentGroup = '';

      this.scale = 1;
      this.tx = 0;
      this.ty = 0;

      this.dragging = false;
      this.dragPointerType = '';
      this.startX = 0;
      this.startY = 0;
      this.dragMoved = 0;

      this.baseW = 0;
      this.baseH = 0;

      this.pointers = new Map();
      this.pinchBaseDist = 0;
      this.pinchBaseScale = 1;

      this.swipeActive = false;
      this.swipeStartX = 0;
      this.swipeStartY = 0;
      this.SWIPE_MIN_X = 50;
      this.SWIPE_MAX_Y = 60;

      this.suppressClickUntil = 0;

      this.vx = 0;
      this.vy = 0;
      this.lastMoveTime = 0;
      this.lastMoveX = 0;
      this.lastMoveY = 0;
      this.momentumFrame = null;

      this.initialized = false;
    }

    init(options = {}) {
      if (this.initialized) return this;

      this.options = {
        selector: '[data-lightbox]',
        galleryAttribute: 'data-lightbox-group',
        fullAttribute: 'data-full',
        thumbAttribute: 'data-thumb',
        altAttribute: 'data-alt',
        nameAttribute: 'data-name',
        fileAttribute: 'data-file',
        downloadAttribute: 'data-download',
        descriptionAttribute: 'data-description',
        capturedAtAttribute: 'data-captured-at',
        cameraModelAttribute: 'data-camera-model',
        lensModelAttribute: 'data-lens-model',
        focalLengthAttribute: 'data-focal-length',
        apertureAttribute: 'data-aperture',
        exposureTimeAttribute: 'data-exposure-time',
        isoAttribute: 'data-iso'
      };

      Object.assign(this.options, options);

      this.buildDialog();
      this.collectItems();
      this.bindGlobalEvents();

      this.initialized = true;
      return this;
    }

    buildDialog() {
      const existing = document.getElementById('sharedLightbox');
      if (existing) {
        this.dialog = existing;
        this.stage = existing.querySelector('.photo-stage');
        this.image = existing.querySelector('.photo-lightbox-img');
        this.closeBtn = existing.querySelector('.photo-lightbox-close');
        this.prevBtn = existing.querySelector('.photo-prev');
        this.nextBtn = existing.querySelector('.photo-next');
        this.downloadLink = existing.querySelector('.photo-lightbox-download');
        this.metaBox = existing.querySelector('.photo-meta');
        return;
      }

      const dialog = document.createElement('dialog');
      dialog.className = 'photo-lightbox';
      dialog.id = 'sharedLightbox';
      dialog.setAttribute('aria-label', 'Image viewer');

      dialog.innerHTML = `
        <button class="photo-lightbox-close" type="button" aria-label="Close">×</button>
        <a class="photo-lightbox-download" aria-label="Download full size">↓</a>
        <button class="photo-nav photo-prev" type="button" aria-label="Previous">‹</button>
        <button class="photo-nav photo-next" type="button" aria-label="Next">›</button>
        <div class="photo-stage">
          <img class="photo-lightbox-img" alt="">
        </div>
        <div class="photo-meta" aria-live="polite"></div>
      `;

      document.body.appendChild(dialog);

      this.dialog = dialog;
      this.stage = dialog.querySelector('.photo-stage');
      this.image = dialog.querySelector('.photo-lightbox-img');
      this.closeBtn = dialog.querySelector('.photo-lightbox-close');
      this.prevBtn = dialog.querySelector('.photo-prev');
      this.nextBtn = dialog.querySelector('.photo-next');
      this.downloadLink = dialog.querySelector('.photo-lightbox-download');
      this.metaBox = dialog.querySelector('.photo-meta');
    }

    collectItems() {
      this.items = Array.from(document.querySelectorAll(this.options.selector)).filter((el) => {
        return !!this.readAttr(el, this.options.fullAttribute);
      });
    }

    bindGlobalEvents() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest(this.options.selector);
        if (!trigger) return;

        const full = this.readAttr(trigger, this.options.fullAttribute);
        if (!full) return;

        e.preventDefault();

        const group = this.readAttr(trigger, this.options.galleryAttribute) || '';
        const groupItems = this.getGroupItems(group);
        const index = groupItems.indexOf(trigger);

        this.openAt(index >= 0 ? index : 0, group);
      });

      this.closeBtn?.addEventListener('click', () => this.close());
      this.prevBtn?.addEventListener('click', () => this.prev());
      this.nextBtn?.addEventListener('click', () => this.next());

      this.dialog?.addEventListener('click', (e) => {
        if (e.target === this.dialog) this.close();
      });

      document.addEventListener('keydown', (e) => {
        if (!this.isOpen()) return;

        if (e.key === 'Escape') {
          this.close();
          return;
        }

        if (this.prevBtn && this.isVisible(this.prevBtn) && e.key === 'ArrowLeft') {
          this.prev();
          return;
        }

        if (this.nextBtn && this.isVisible(this.nextBtn) && e.key === 'ArrowRight') {
          this.next();
        }
      });

      this.stage?.addEventListener('click', (e) => {
        if (Date.now() < this.suppressClickUntil) return;
        if (this.dragMoved > 6) return;

        if (e.target === this.image) {
          if (this.scale === 1) {
            this.zoomAboutStagePoint(2, this.stageCenterX(), this.stageCenterY());
          } else {
            this.resetView();
          }
          return;
        }

        if (e.target === this.stage) {
          if (this.scale > 1) {
            this.resetView();
          } else {
            this.close();
          }
        }
      });

      this.stage?.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.stopMomentum();

          const rect = this.stage.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;

          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
          const newScale = Math.min(6, Math.max(1, this.scale * factor));
          if (newScale === this.scale) return;

          this.zoomAboutStagePoint(newScale, px, py);
          this.suppressClickUntil = Date.now() + 250;
        },
        { passive: false }
      );

      this.image?.addEventListener('load', () => {
        requestAnimationFrame(() => {
          this.computeBaseSize();
          this.applyTransform();
        });
      });

      this.stage?.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.stage?.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.stage?.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.stage?.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    }

    readAttr(el, name) {
      if (!el || !name) return '';
      return (el.getAttribute(name) || '').trim();
    }

    getGroupItems(group) {
      if (!group) {
        return this.items.filter((el) => !this.readAttr(el, this.options.galleryAttribute));
      }
      return this.items.filter((el) => this.readAttr(el, this.options.galleryAttribute) === group);
    }

    getCurrentItems() {
      return this.getGroupItems(this.currentGroup);
    }

    openAt(index, group = '') {
      const items = this.getGroupItems(group);
      if (!items.length) return;

      this.currentGroup = group;
      this.index = ((index % items.length) + items.length) % items.length;

      const item = items[this.index];
      this.loadItem(item);
      this.configureUiForItem(item, items.length);
      this.resetView();

      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
    }

    loadItem(item) {
      const full = this.readAttr(item, this.options.fullAttribute);
      const alt =
        this.readAttr(item, this.options.altAttribute) ||
        item.getAttribute('alt') ||
        '';

      this.image.src = full;
      this.image.alt = alt;
    }

    configureUiForItem(item, groupLength) {
      const navEnabled = item.getAttribute('data-lightbox-nav') !== 'false' && groupLength > 1;
      const downloadEnabled = item.getAttribute('data-lightbox-download') !== 'false';
      const metaEnabled = item.getAttribute('data-lightbox-meta') === 'true';

      this.toggleElement(this.prevBtn, navEnabled);
      this.toggleElement(this.nextBtn, navEnabled);

      if (downloadEnabled) {
        const downloadUrl =
          this.readAttr(item, this.options.downloadAttribute) ||
          this.readAttr(item, this.options.fullAttribute);
        const filename = this.readAttr(item, this.options.fileAttribute) || 'image.jpg';

        if (downloadUrl) {
          this.downloadLink.href = downloadUrl;
          this.downloadLink.setAttribute('download', filename);
          this.toggleElement(this.downloadLink, true);
        } else {
          this.toggleElement(this.downloadLink, false);
          this.downloadLink.removeAttribute('href');
        }
      } else {
        this.toggleElement(this.downloadLink, false);
        this.downloadLink.removeAttribute('href');
      }

      if (metaEnabled) {
        this.renderMeta(item);
        this.toggleElement(this.metaBox, true);
      } else {
        this.metaBox.innerHTML = '';
        this.toggleElement(this.metaBox, false);
      }
    }

    toggleElement(el, show) {
      if (!el) return;
      el.hidden = !show;
      el.style.display = show ? '' : 'none';
    }

    isVisible(el) {
      return !!el && !el.hidden && el.style.display !== 'none';
    }

    close() {
      this.stopMomentum();
      this.vx = 0;
      this.vy = 0;
      this.image.src = '';
      this.metaBox.innerHTML = '';
      this.dialog.close?.();
      this.dialog.removeAttribute('open');
    }

    isOpen() {
      return !!(this.dialog && (this.dialog.open || this.dialog.hasAttribute('open')));
    }

    next() {
      const items = this.getCurrentItems();
      if (items.length < 2) return;
      this.openAt(this.index + 1, this.currentGroup);
    }

    prev() {
      const items = this.getCurrentItems();
      if (items.length < 2) return;
      this.openAt(this.index - 1, this.currentGroup);
    }

    resetView() {
      this.stopMomentum();
      this.vx = 0;
      this.vy = 0;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.dragging = false;
      this.dragPointerType = '';
      this.dragMoved = 0;
      this.pointers.clear();
      this.pinchBaseDist = 0;
      this.pinchBaseScale = 1;
      this.applyTransform();
    }

    clamp(v, lo, hi) {
      return Math.min(hi, Math.max(lo, v));
    }

    dist(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    computeBaseSize() {
      const prev = this.image.style.transform;
      this.image.style.transform = 'translate(0px, 0px) scale(1)';
      const r = this.image.getBoundingClientRect();
      this.image.style.transform = prev;
      this.baseW = r.width || this.baseW;
      this.baseH = r.height || this.baseH;
    }

    clampTranslation() {
      if (this.scale <= 1 || !this.baseW || !this.baseH) {
        this.tx = 0;
        this.ty = 0;
        return;
      }

      const sr = this.stage.getBoundingClientRect();
      const stageW = sr.width || 0;
      const stageH = sr.height || 0;

      const scaledW = this.baseW * this.scale;
      const scaledH = this.baseH * this.scale;

      const maxX = Math.max(0, (scaledW - stageW) / 2);
      const maxY = Math.max(0, (scaledH - stageH) / 2);

      this.tx = this.clamp(this.tx, -maxX, maxX);
      this.ty = this.clamp(this.ty, -maxY, maxY);
    }

    applyTransform() {
      this.clampTranslation();
      this.image.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
      this.image.style.cursor =
        this.scale > 1 ? (this.dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    stageCenterX() {
      const r = this.stage.getBoundingClientRect();
      return r.width / 2;
    }

    stageCenterY() {
      const r = this.stage.getBoundingClientRect();
      return r.height / 2;
    }

    zoomAboutStagePoint(newScale, px, py) {
      const oldScale = this.scale;
      if (newScale === oldScale) return;

      const stageRect = this.stage.getBoundingClientRect();
      const stageW = stageRect.width || 0;
      const stageH = stageRect.height || 0;

      const oldTx = this.tx;
      const oldTy = this.ty;

      const ix = (px - stageW / 2 - oldTx) / oldScale;
      const iy = (py - stageH / 2 - oldTy) / oldScale;

      this.scale = newScale;
      this.tx = px - stageW / 2 - ix * newScale;
      this.ty = py - stageH / 2 - iy * newScale;

      this.applyTransform();
    }

    stopMomentum() {
      if (this.momentumFrame) {
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = null;
      }
    }

    startMomentum() {
      this.stopMomentum();

      const friction = 0.95;
      const minVelocity = 0.02;
      let lastTs = performance.now();

      const step = (ts) => {
        const dt = Math.min(32, ts - lastTs);
        lastTs = ts;

        const prevTx = this.tx;
        const prevTy = this.ty;

        this.tx += this.vx * dt;
        this.ty += this.vy * dt;

        this.applyTransform();

        if (Math.abs(this.tx - prevTx) < 0.001) this.vx = 0;
        if (Math.abs(this.ty - prevTy) < 0.001) this.vy = 0;

        this.vx *= friction;
        this.vy *= friction;

        if (Math.abs(this.vx) < minVelocity && Math.abs(this.vy) < minVelocity) {
          this.vx = 0;
          this.vy = 0;
          this.momentumFrame = null;
          return;
        }

        this.momentumFrame = requestAnimationFrame(step);
      };

      this.momentumFrame = requestAnimationFrame(step);
    }

    onPointerDown(e) {
      this.dragMoved = 0;
      this.stopMomentum();
      this.vx = 0;
      this.vy = 0;
      this.lastMoveTime = performance.now();
      this.lastMoveX = e.clientX;
      this.lastMoveY = e.clientY;

      if (e.pointerType === 'touch') {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.stage.setPointerCapture(e.pointerId);

        if (this.scale === 1 && this.pointers.size === 1 && this.getCurrentItems().length > 1) {
          this.swipeActive = true;
          this.swipeStartX = e.clientX;
          this.swipeStartY = e.clientY;
        } else {
          this.swipeActive = false;
        }

        if (this.pointers.size === 2) {
          const [p1, p2] = Array.from(this.pointers.values());
          this.pinchBaseDist = this.dist(p1, p2);
          this.pinchBaseScale = this.scale;
        }

        if (this.scale > 1 && this.pointers.size === 1) {
          this.dragging = true;
          this.dragPointerType = 'touch';
          this.startX = e.clientX - this.tx;
          this.startY = e.clientY - this.ty;
          this.applyTransform();
        }

        return;
      }

      if (this.scale <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      this.dragging = true;
      this.dragPointerType = e.pointerType || 'mouse';
      this.startX = e.clientX - this.tx;
      this.startY = e.clientY - this.ty;
      this.stage.setPointerCapture(e.pointerId);
      this.applyTransform();
    }

    onPointerMove(e) {
      if (e.pointerType === 'touch' && this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 2) {
          this.dragging = false;
          const [p1, p2] = Array.from(this.pointers.values());
          const d = this.dist(p1, p2);

          if (this.pinchBaseDist > 0) {
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const rect = this.stage.getBoundingClientRect();
            const px = centerX - rect.left;
            const py = centerY - rect.top;

            const raw = this.pinchBaseScale * (d / this.pinchBaseDist);
            const newScale = Math.min(6, Math.max(1, raw));
            this.zoomAboutStagePoint(newScale, px, py);
          }
          return;
        }

        if (
          this.dragging &&
          this.dragPointerType === 'touch' &&
          this.scale > 1 &&
          this.pointers.size === 1
        ) {
          const nx = e.clientX - this.startX;
          const ny = e.clientY - this.startY;
          this.dragMoved += Math.abs(nx - this.tx) + Math.abs(ny - this.ty);
          this.tx = nx;
          this.ty = ny;

          const now = performance.now();
          const dt = Math.max(1, now - this.lastMoveTime);
          this.vx = (e.clientX - this.lastMoveX) / dt;
          this.vy = (e.clientY - this.lastMoveY) / dt;
          this.lastMoveTime = now;
          this.lastMoveX = e.clientX;
          this.lastMoveY = e.clientY;

          this.applyTransform();
        }

        return;
      }

      if (!this.dragging) return;

      const nx = e.clientX - this.startX;
      const ny = e.clientY - this.startY;
      this.dragMoved += Math.abs(nx - this.tx) + Math.abs(ny - this.ty);
      this.tx = nx;
      this.ty = ny;

      const now = performance.now();
      const dt = Math.max(1, now - this.lastMoveTime);
      this.vx = (e.clientX - this.lastMoveX) / dt;
      this.vy = (e.clientY - this.lastMoveY) / dt;
      this.lastMoveTime = now;
      this.lastMoveX = e.clientX;
      this.lastMoveY = e.clientY;

      this.applyTransform();
    }

    onPointerUp(e) {
      if (this.dragMoved > 6) {
        this.suppressClickUntil = Date.now() + 250;
      }

      if (e.pointerType === 'touch') {
        if (this.swipeActive && this.scale === 1) {
          this.swipeActive = false;
          const dx = e.clientX - this.swipeStartX;
          const dy = e.clientY - this.swipeStartY;

          if (Math.abs(dx) >= this.SWIPE_MIN_X && Math.abs(dy) <= this.SWIPE_MAX_Y) {
            if (dx < 0) this.next();
            else this.prev();
          }
        }

        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinchBaseDist = 0;

        if (this.pointers.size === 0) {
          this.dragging = false;
          this.dragPointerType = '';
          if (this.scale > 1 && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) {
            this.startMomentum();
          }
        }

        try {
          this.stage.releasePointerCapture(e.pointerId);
        } catch (_) {}

        this.applyTransform();
        return;
      }

      this.dragging = false;
      this.dragPointerType = '';
      if (this.scale > 1 && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) {
        this.startMomentum();
      }

      try {
        this.stage.releasePointerCapture(e.pointerId);
      } catch (_) {}

      this.applyTransform();
    }

    onPointerCancel(e) {
      this.stopMomentum();
      this.vx = 0;
      this.vy = 0;
      this.swipeActive = false;
      this.dragging = false;
      this.dragPointerType = '';
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchBaseDist = 0;
      this.applyTransform();
    }

    safeText(s) {
      return (s ?? '').toString().trim();
    }

    escapeHtml(s) {
      return this.safeText(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    renderMeta(item) {
      const name = this.safeText(
        this.readAttr(item, this.options.nameAttribute) ||
          this.readAttr(item, this.options.altAttribute)
      );
      const file = this.safeText(this.readAttr(item, this.options.fileAttribute));
      const desc = this.safeText(this.readAttr(item, this.options.descriptionAttribute));
      const camModel = this.safeText(this.readAttr(item, this.options.cameraModelAttribute));
      const lens = this.safeText(this.readAttr(item, this.options.lensModelAttribute));
      const focal = this.safeText(this.readAttr(item, this.options.focalLengthAttribute));
      const aperture = this.safeText(this.readAttr(item, this.options.apertureAttribute));
      const exp = this.safeText(this.readAttr(item, this.options.exposureTimeAttribute));
      const iso = this.safeText(this.readAttr(item, this.options.isoAttribute));
      const capturedAt = this.safeText(this.readAttr(item, this.options.capturedAtAttribute));

      const title = name || file || '';
      const settings = [focal, aperture, exp, iso ? `ISO ${iso}` : ''].filter(Boolean).join(' • ');
      const lines = [];

      if (title) lines.push(`<div><strong>${this.escapeHtml(title)}</strong></div>`);
      if (desc) {
        lines.push(
          `<div style="opacity:.95; margin-top:.25rem;"><strong>Desc:</strong> ${this.escapeHtml(desc)}</div>`
        );
      }
      if (camModel) lines.push(`<div style="margin-top:.25rem;">${this.escapeHtml(camModel)}</div>`);
      if (lens) lines.push(`<div>${this.escapeHtml(lens)}</div>`);
      if (settings) lines.push(`<div>${this.escapeHtml(settings)}</div>`);
      if (capturedAt) {
        const shortDate = capturedAt.length >= 10 ? capturedAt.slice(0, 10) : capturedAt;
        lines.push(`<div style="opacity:.9;">${this.escapeHtml(shortDate)}</div>`);
      }

      this.metaBox.innerHTML = lines.length
        ? lines.join('')
        : `<div style="opacity:.85;">No metadata available.</div>`;
    }
  }

  window.SharedLightbox = new Lightbox();

  document.addEventListener('DOMContentLoaded', function () {
    window.SharedLightbox.init();
  });
})();
