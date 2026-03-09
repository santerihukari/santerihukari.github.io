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
      this.minScale = 1;
      this.maxScale = 6;

      this.baseW = 0;
      this.baseH = 0;

      this.dragging = false;
      this.dragPointerType = '';
      this.dragPointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.dragMoved = 0;

      this.pointers = new Map();
      this.pinchBaseDist = 0;
      this.pinchBaseScale = 1;
      this.pinchAnchorPx = 0;
      this.pinchAnchorPy = 0;
      this.pinching = false;

      this.suppressClickUntil = 0;

      this.vx = 0;
      this.vy = 0;
      this.lastMoveTime = 0;
      this.lastMoveX = 0;
      this.lastMoveY = 0;
      this.momentumFrame = null;

      this.zoomAnimFrame = null;

      this.lastTapTime = 0;
      this.lastTapX = 0;
      this.lastTapY = 0;
      this.doubleTapThresholdMs = 280;
      this.doubleTapRadius = 28;

      this.doubleHoldActive = false;
      this.doubleHoldPointerId = null;
      this.doubleHoldStartY = 0;
      this.doubleHoldAnchorPx = 0;
      this.doubleHoldAnchorPy = 0;
      this.doubleHoldStartScale = 1;
      this.doubleHoldStartTime = 0;
      this.doubleHoldMoved = false;
      this.doubleHoldTimeoutMs = 500;
      this.doubleHoldSensitivity = 0.008;

      this.doubleZoomInScale = 2.5;
      this.doubleZoomOutThreshold = 2.2;

      this.initialized = false;
    }

    init(options = {}) {
      if (this.initialized) return this;

      this.options = {
        selector: '[data-lightbox]',
        galleryAttribute: 'data-lightbox-group',
        fullAttribute: 'data-full',
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

      // Desktop double-click zoom
      this.image?.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = this.stage.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        if (this.scale < this.doubleZoomOutThreshold) {
          this.animateZoomAboutStagePoint(this.doubleZoomInScale, px, py, 180);
        } else {
          this.animateZoomAboutStagePoint(1, px, py, 180);
        }

        this.suppressClickUntil = Date.now() + 250;
      });

      // Stage background click closes
      this.stage?.addEventListener('click', (e) => {
        if (Date.now() < this.suppressClickUntil) return;
        if (this.dragMoved > 6) return;
        if (this.doubleHoldActive) return;
        if (this.pinching) return;

        if (e.target === this.stage) {
          this.close();
        }
      });

      // Desktop wheel zoom at pointer
      this.stage?.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.stopMomentum();
          this.stopZoomAnimation();

          const rect = this.stage.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;

          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
          const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
          if (newScale === this.scale) return;

          this.animateZoomAboutStagePoint(newScale, px, py, 100);
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
      this.stopZoomAnimation();
      this.vx = 0;
      this.vy = 0;
      this.image.src = '';
      this.metaBox.innerHTML = '';
      this.dialog.close?.();
      this.dialog.removeAttribute('open');
      this.resetGestureState();
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

    resetGestureState() {
      this.dragging = false;
      this.dragPointerType = '';
      this.dragPointerId = null;
      this.dragMoved = 0;

      this.pointers.clear();
      this.pinching = false;
      this.pinchBaseDist = 0;
      this.pinchBaseScale = 1;

      this.doubleHoldActive = false;
      this.doubleHoldPointerId = null;
      this.doubleHoldMoved = false;
    }

    resetView() {
      this.stopMomentum();
      this.stopZoomAnimation();
      this.vx = 0;
      this.vy = 0;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.resetGestureState();
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
      this.image.style.cursor = this.scale > 1 ? (this.dragging ? 'grabbing' : 'grab') : 'default';
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

    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    stopZoomAnimation() {
      if (this.zoomAnimFrame) {
        cancelAnimationFrame(this.zoomAnimFrame);
        this.zoomAnimFrame = null;
      }
    }

    animateZoomAboutStagePoint(targetScale, px, py, duration = 140) {
      this.stopZoomAnimation();
      this.stopMomentum();

      const startScale = this.scale;
      const clampedTarget = Math.min(this.maxScale, Math.max(this.minScale, targetScale));
      if (Math.abs(clampedTarget - startScale) < 1e-4) return;

      const startTime = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = this.easeOutCubic(t);
        const s = startScale + (clampedTarget - startScale) * eased;
        this.zoomAboutStagePoint(s, px, py);

        if (t < 1) {
          this.zoomAnimFrame = requestAnimationFrame(step);
        } else {
          this.zoomAnimFrame = null;
          this.zoomAboutStagePoint(clampedTarget, px, py);
        }
      };

      this.zoomAnimFrame = requestAnimationFrame(step);
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

    beginDrag(e) {
      this.dragging = true;
      this.dragPointerType = e.pointerType || 'mouse';
      this.dragPointerId = e.pointerId;
      this.startX = e.clientX - this.tx;
      this.startY = e.clientY - this.ty;
      this.dragMoved = 0;
      this.lastMoveTime = performance.now();
      this.lastMoveX = e.clientX;
      this.lastMoveY = e.clientY;
      this.vx = 0;
      this.vy = 0;
      this.stage.setPointerCapture?.(e.pointerId);
      this.applyTransform();
    }

    updateDrag(e) {
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

    endDrag(e) {
      if (!this.dragging) return;

      this.dragging = false;
      this.dragPointerType = '';
      this.dragPointerId = null;

      if (this.dragMoved > 6) {
        this.suppressClickUntil = Date.now() + 250;
      }

      if (this.scale > 1 && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) {
        this.startMomentum();
      }

      try {
        this.stage.releasePointerCapture(e.pointerId);
      } catch (_) {}

      this.applyTransform();
    }

    onPointerDown(e) {
      this.stopMomentum();
      this.stopZoomAnimation();

      if (e.pointerType === 'touch') {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 2) {
          const [p1, p2] = Array.from(this.pointers.values());
          const rect = this.stage.getBoundingClientRect();
          this.pinching = true;
          this.pinchBaseDist = this.dist(p1, p2);
          this.pinchBaseScale = this.scale;
          this.pinchAnchorPx = (p1.x + p2.x) / 2 - rect.left;
          this.pinchAnchorPy = (p1.y + p2.y) / 2 - rect.top;
          this.dragging = false;
          this.doubleHoldActive = false;
          return;
        }

        if (this.scale > 1 && this.pointers.size === 1 && e.target === this.image) {
          this.beginDrag(e);
        }

        return;
      }

      if (e.pointerType === 'mouse') {
        const now = Date.now();
        const dx = e.clientX - this.lastTapX;
        const dy = e.clientY - this.lastTapY;
        const dist2 = dx * dx + dy * dy;

        const isSecondPress =
          now - this.lastTapTime <= this.doubleTapThresholdMs &&
          dist2 <= this.doubleTapRadius * this.doubleTapRadius &&
          e.target === this.image &&
          e.button === 0;

        if (isSecondPress) {
          const rect = this.stage.getBoundingClientRect();
          this.doubleHoldActive = true;
          this.doubleHoldPointerId = e.pointerId;
          this.doubleHoldStartY = e.clientY;
          this.doubleHoldAnchorPx = e.clientX - rect.left;
          this.doubleHoldAnchorPy = e.clientY - rect.top;
          this.doubleHoldStartScale = this.scale;
          this.doubleHoldStartTime = now;
          this.doubleHoldMoved = false;
          this.stage.setPointerCapture?.(e.pointerId);
          this.suppressClickUntil = Date.now() + this.doubleHoldTimeoutMs + 150;
          return;
        }

        if (this.scale > 1 && e.button === 0 && e.target === this.image) {
          this.beginDrag(e);
        }
      }
    }

    onPointerMove(e) {
      if (e.pointerType === 'touch' && this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 2) {
          const [p1, p2] = Array.from(this.pointers.values());
          const rect = this.stage.getBoundingClientRect();
          const d = this.dist(p1, p2);
          const anchorPx = (p1.x + p2.x) / 2 - rect.left;
          const anchorPy = (p1.y + p2.y) / 2 - rect.top;

          if (this.pinchBaseDist > 0) {
            const raw = this.pinchBaseScale * (d / this.pinchBaseDist);
            const newScale = Math.min(this.maxScale, Math.max(this.minScale, raw));
            this.zoomAboutStagePoint(newScale, anchorPx, anchorPy);
          }

          this.pinching = true;
          this.suppressClickUntil = Date.now() + 250;
          return;
        }

        if (
          this.dragging &&
          this.dragPointerId === e.pointerId &&
          this.scale > 1 &&
          e.target === this.image
        ) {
          this.updateDrag(e);
        }

        return;
      }

      if (this.doubleHoldActive && e.pointerId === this.doubleHoldPointerId) {
        const elapsed = Date.now() - this.doubleHoldStartTime;
        if (elapsed > this.doubleHoldTimeoutMs) {
          this.doubleHoldActive = false;
          this.doubleHoldPointerId = null;
          try {
            this.stage.releasePointerCapture(e.pointerId);
          } catch (_) {}
          return;
        }

        const dy = e.clientY - this.doubleHoldStartY;
        if (Math.abs(dy) > 2) this.doubleHoldMoved = true;

        const targetScale = Math.min(
          this.maxScale,
          Math.max(this.minScale, this.doubleHoldStartScale + dy * this.doubleHoldSensitivity)
        );

        this.zoomAboutStagePoint(
          targetScale,
          this.doubleHoldAnchorPx,
          this.doubleHoldAnchorPy
        );
        this.suppressClickUntil = Date.now() + 250;
        return;
      }

      if (this.dragging && this.dragPointerId === e.pointerId) {
        this.updateDrag(e);
      }
    }

    onPointerUp(e) {
      if (e.pointerType === 'touch') {
        // Two-finger pinch ended
        if (this.pointers.has(e.pointerId)) {
          this.pointers.delete(e.pointerId);
        }

        if (this.pinching) {
          if (this.pointers.size < 2) {
            this.pinching = false;
            this.pinchBaseDist = 0;
            this.pinchBaseScale = this.scale;
            this.suppressClickUntil = Date.now() + 250;
          }
          return;
        }

        // Touch double-tap zoom
        if (
          e.target === this.image &&
          this.dragMoved <= 6 &&
          Date.now() >= this.suppressClickUntil
        ) {
          const now = Date.now();
          const dx = e.clientX - this.lastTapX;
          const dy = e.clientY - this.lastTapY;
          const dist2 = dx * dx + dy * dy;

          const isDoubleTap =
            now - this.lastTapTime <= this.doubleTapThresholdMs &&
            dist2 <= this.doubleTapRadius * this.doubleTapRadius;

          if (isDoubleTap) {
            const rect = this.stage.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;

            if (this.scale < this.doubleZoomOutThreshold) {
              this.animateZoomAboutStagePoint(this.doubleZoomInScale, px, py, 180);
            } else {
              this.animateZoomAboutStagePoint(1, px, py, 180);
            }

            this.lastTapTime = 0;
            this.suppressClickUntil = Date.now() + 250;
            return;
          }

          this.lastTapTime = now;
          this.lastTapX = e.clientX;
          this.lastTapY = e.clientY;
        }

        // Touch panning end
        if (this.dragging && this.dragPointerId === e.pointerId) {
          this.endDrag(e);
        }

        return;
      }

      if (this.doubleHoldActive && e.pointerId === this.doubleHoldPointerId) {
        const elapsed = Date.now() - this.doubleHoldStartTime;

        this.doubleHoldActive = false;
        this.doubleHoldPointerId = null;

        try {
          this.stage.releasePointerCapture(e.pointerId);
        } catch (_) {}

        // If user did not move during second press and released quickly,
        // let dblclick handler do the zoom. If they held too long without moving,
        // do nothing, as requested.
        if (elapsed > this.doubleHoldTimeoutMs) {
          this.suppressClickUntil = Date.now() + 250;
        }

        return;
      }

      if (this.dragging && this.dragPointerId === e.pointerId) {
        this.endDrag(e);
      }

      // Track last mouse press/release position for double-hold detection
      this.lastTapTime = Date.now();
      this.lastTapX = e.clientX;
      this.lastTapY = e.clientY;
    }

    onPointerCancel(e) {
      this.stopMomentum();
      this.stopZoomAnimation();
      this.vx = 0;
      this.vy = 0;

      if (this.pointers.has(e.pointerId)) {
        this.pointers.delete(e.pointerId);
      }

      this.resetGestureState();

      try {
        this.stage.releasePointerCapture(e.pointerId);
      } catch (_) {}

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
