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
      this.metaContent = null;
      this.selectionBox = null;

      this.items = [];
      this.index = -1;
      this.currentGroup = '';

      this.scale = 1;
      this.tx = 0;
      this.ty = 0;

      this.targetScale = 1;
      this.targetTx = 0;
      this.targetTy = 0;

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

      this.zoomAnimFrame = null;
      this.zoomEase = 0.18;

      this.lastPointerStageX = null;
      this.lastPointerStageY = null;

      this.selectionActive = false;
      this.selectionPointerId = null;
      this.selectionStartX = 0;
      this.selectionStartY = 0;

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
        isoAttribute: 'data-iso',
        fullWidthAttribute: 'data-full-width',
        fullHeightAttribute: 'data-full-height',
        originalWidthAttribute: 'data-original-width',
        originalHeightAttribute: 'data-original-height',
        originalFileSizeAttribute: 'data-original-file-size',
        suggestedLabelsAttribute: 'data-suggested-labels',
        vlmLabelsAttribute: 'data-vlm-labels',
        vlmLocationAttribute: 'data-vlm-location',
        vlmEventSettingAttribute: 'data-vlm-event-setting',
        vlmCaptionAttribute: 'data-vlm-caption',
        vlmNotesAttribute: 'data-vlm-notes',
        vlmErrorAttribute: 'data-vlm-error',
        cropMethodAttribute: 'data-crop-method',
        cropBoxAttribute: 'data-crop-box'
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
        this.metaBox = existing.querySelector('.photo-meta');
        this.downloadLink = existing.querySelector('.photo-meta-download');
        this.metaContent = existing.querySelector('.photo-meta-content');
        this.metaBox?.removeAttribute('aria-live');
        this.metaContent?.setAttribute('aria-live', 'polite');
        existing.querySelector('.photo-lightbox-download')?.remove();
        if (this.metaBox && !this.downloadLink) {
          this.downloadLink = document.createElement('a');
          this.downloadLink.className = 'photo-meta-download';
          this.downloadLink.setAttribute('aria-label', 'Download original photo');
          this.downloadLink.setAttribute('target', '_blank');
          this.downloadLink.setAttribute('rel', 'noopener');
          this.metaBox.prepend(this.downloadLink);
        }
        if (this.metaBox && !this.metaContent) {
          this.metaContent = document.createElement('div');
          this.metaContent.className = 'photo-meta-content';
          this.metaContent.setAttribute('aria-live', 'polite');
          this.metaBox.appendChild(this.metaContent);
        }
        this.ensureViewerHelp();
        this.selectionBox = existing.querySelector('.photo-zoom-selection');
        if (this.stage && !this.selectionBox) {
          this.selectionBox = document.createElement('div');
          this.selectionBox.className = 'photo-zoom-selection';
          this.selectionBox.hidden = true;
          this.stage.appendChild(this.selectionBox);
        }
        this.normalizeControls();
        return;
      }

      const dialog = document.createElement('dialog');
      dialog.className = 'photo-lightbox';
      dialog.id = 'sharedLightbox';
      dialog.setAttribute('aria-label', 'Image viewer');

      dialog.innerHTML = `
        <button class="photo-lightbox-close" type="button" aria-label="Close">×</button>
        <button class="photo-nav photo-prev" type="button" aria-label="Previous">‹</button>
        <button class="photo-nav photo-next" type="button" aria-label="Next">›</button>
        <div class="photo-lightbox-shell">
          <div class="photo-stage">
            <img class="photo-lightbox-img" alt="">
            <div class="photo-zoom-selection" hidden></div>
          </div>
          <aside class="photo-meta">
            <a class="photo-meta-download" aria-label="Download original photo" target="_blank" rel="noopener">Download original</a>
            <div class="photo-meta-content" aria-live="polite"></div>
            <details class="photo-viewer-help" open>
              <summary>Viewer controls</summary>
              <ul>
                <li>Click, scroll, or pinch to zoom.</li>
                <li>Drag to pan after zooming.</li>
                <li><kbd>Ctrl</kbd> + drag selects a zoom area.</li>
                <li>Use arrows, side buttons, or swipe to move.</li>
                <li><kbd>Esc</kbd> or the close button exits.</li>
              </ul>
            </details>
          </aside>
        </div>
      `;

      document.body.appendChild(dialog);

      this.dialog = dialog;
      this.stage = dialog.querySelector('.photo-stage');
      this.image = dialog.querySelector('.photo-lightbox-img');
      this.closeBtn = dialog.querySelector('.photo-lightbox-close');
      this.prevBtn = dialog.querySelector('.photo-prev');
      this.nextBtn = dialog.querySelector('.photo-next');
      this.metaBox = dialog.querySelector('.photo-meta');
      this.downloadLink = dialog.querySelector('.photo-meta-download');
      this.metaContent = dialog.querySelector('.photo-meta-content');
      this.selectionBox = dialog.querySelector('.photo-zoom-selection');
      this.normalizeControls();
    }

    ensureViewerHelp() {
      if (!this.metaBox) return;
      const existingHelp = this.metaBox.querySelector('.photo-viewer-help');
      if (existingHelp) {
        existingHelp.open = true;
        return;
      }

      const help = document.createElement('details');
      help.className = 'photo-viewer-help';
      help.open = true;
      help.innerHTML = `
        <summary>Viewer controls</summary>
        <ul>
          <li>Click, scroll, or pinch to zoom.</li>
          <li>Drag to pan after zooming.</li>
          <li><kbd>Ctrl</kbd> + drag selects a zoom area.</li>
          <li>Use arrows, side buttons, or swipe to move.</li>
          <li><kbd>Esc</kbd> or the close button exits.</li>
        </ul>
      `;
      this.metaBox.appendChild(help);
    }

    normalizeControls() {
      if (this.closeBtn) this.closeBtn.innerHTML = '&times;';
      if (this.downloadLink) this.downloadLink.textContent = 'Download original';
      if (this.prevBtn) this.prevBtn.innerHTML = '&#8249;';
      if (this.nextBtn) this.nextBtn.innerHTML = '&#8250;';
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
          const rect = this.stage.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;

          if (this.targetScale === 1) {
            this.setZoomTargetAboutStagePoint(2, px, py);
            this.startZoomAnimation();
          } else {
            this.resetView();
          }
          return;
        }

        if (e.target === this.stage) {
          if (this.targetScale > 1) {
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
          const newScale = Math.min(6, Math.max(1, this.targetScale * factor));
          if (newScale === this.targetScale) return;

          this.setZoomTargetAboutStagePoint(newScale, px, py);
          this.startZoomAnimation();
          this.suppressClickUntil = Date.now() + 250;
        },
        { passive: false }
      );

      this.stage?.addEventListener('pointermove', (e) => {
        const rect = this.stage.getBoundingClientRect();
        this.lastPointerStageX = e.clientX - rect.left;
        this.lastPointerStageY = e.clientY - rect.top;
      });

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

      let hasDownload = false;
      if (this.downloadLink && downloadEnabled) {
        const downloadUrl =
          this.readAttr(item, this.options.downloadAttribute) ||
          this.readAttr(item, this.options.fullAttribute);
        const filename = this.readAttr(item, this.options.fileAttribute) || 'image.jpg';

        if (downloadUrl) {
          this.downloadLink.href = downloadUrl;
          this.downloadLink.setAttribute('download', filename);
          this.toggleElement(this.downloadLink, true);
          hasDownload = true;
        } else {
          this.toggleElement(this.downloadLink, false);
          this.downloadLink.removeAttribute('href');
        }
      } else if (this.downloadLink) {
        this.toggleElement(this.downloadLink, false);
        this.downloadLink.removeAttribute('href');
      }

      if (metaEnabled) {
        this.renderMeta(item);
      } else {
        this.clearMeta();
      }

      const showMetaPanel = metaEnabled || hasDownload;
      this.toggleElement(this.metaBox, showMetaPanel);
      this.dialog.classList.toggle('has-meta', showMetaPanel);
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
      this.cancelSelection();
      this.stopMomentum();
      this.stopZoomAnimation();
      this.vx = 0;
      this.vy = 0;
      this.image.src = '';
      this.clearMeta();
      this.dialog.close?.();
      this.dialog.removeAttribute('open');
    }

    clearMeta() {
      const target = this.metaContent || this.metaBox;
      if (target) target.innerHTML = '';
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
      this.cancelSelection();
      this.stopMomentum();
      this.stopZoomAnimation();
      this.vx = 0;
      this.vy = 0;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.targetScale = 1;
      this.targetTx = 0;
      this.targetTy = 0;
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

    clampTranslationValues(scale, tx, ty) {
      if (scale <= 1 || !this.baseW || !this.baseH) {
        return { tx: 0, ty: 0 };
      }

      const sr = this.stage.getBoundingClientRect();
      const stageW = sr.width || 0;
      const stageH = sr.height || 0;

      const scaledW = this.baseW * scale;
      const scaledH = this.baseH * scale;

      const maxX = Math.max(0, (scaledW - stageW) / 2);
      const maxY = Math.max(0, (scaledH - stageH) / 2);

      return {
        tx: this.clamp(tx, -maxX, maxX),
        ty: this.clamp(ty, -maxY, maxY)
      };
    }

    clampTranslation() {
      const c = this.clampTranslationValues(this.scale, this.tx, this.ty);
      this.tx = c.tx;
      this.ty = c.ty;
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

    stagePointFromEvent(e) {
      const r = this.stage.getBoundingClientRect();
      return {
        x: this.clamp(e.clientX - r.left, 0, r.width),
        y: this.clamp(e.clientY - r.top, 0, r.height)
      };
    }

    startSelection(e) {
      if (!this.selectionBox) return;

      const p = this.stagePointFromEvent(e);
      this.selectionActive = true;
      this.selectionPointerId = e.pointerId;
      this.selectionStartX = p.x;
      this.selectionStartY = p.y;
      this.selectionBox.hidden = false;
      this.stage.style.cursor = 'crosshair';
      this.stage.setPointerCapture(e.pointerId);
      this.updateSelectionBox(p.x, p.y);
      e.preventDefault();
    }

    updateSelectionBox(x, y) {
      if (!this.selectionBox) return;

      const left = Math.min(this.selectionStartX, x);
      const top = Math.min(this.selectionStartY, y);
      const width = Math.abs(x - this.selectionStartX);
      const height = Math.abs(y - this.selectionStartY);

      this.selectionBox.style.left = `${left}px`;
      this.selectionBox.style.top = `${top}px`;
      this.selectionBox.style.width = `${width}px`;
      this.selectionBox.style.height = `${height}px`;
    }

    updateSelection(e) {
      const p = this.stagePointFromEvent(e);
      this.updateSelectionBox(p.x, p.y);
      e.preventDefault();
    }

    finishSelection(e) {
      if (!this.selectionActive) return;

      const p = this.stagePointFromEvent(e);
      const left = Math.min(this.selectionStartX, p.x);
      const top = Math.min(this.selectionStartY, p.y);
      const width = Math.abs(p.x - this.selectionStartX);
      const height = Math.abs(p.y - this.selectionStartY);

      this.cancelSelection(e);

      if (width < 12 || height < 12) {
        this.setZoomTargetAboutStagePoint(Math.min(6, Math.max(2, this.targetScale * 1.75)), p.x, p.y);
      } else {
        this.setZoomTargetToStageRect({ left, top, width, height });
      }

      this.startZoomAnimation();
      this.suppressClickUntil = Date.now() + 300;
      e.preventDefault();
    }

    cancelSelection(e) {
      this.selectionActive = false;
      this.selectionPointerId = null;
      this.stage.style.cursor = '';
      if (this.selectionBox) this.selectionBox.hidden = true;

      if (e?.pointerId !== undefined) {
        try {
          this.stage.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    setZoomTargetAboutStagePoint(newScale, px, py) {
      const oldScale = this.targetScale;
      if (newScale === oldScale) return;

      const stageRect = this.stage.getBoundingClientRect();
      const stageW = stageRect.width || 0;
      const stageH = stageRect.height || 0;

      const oldTx = this.targetTx;
      const oldTy = this.targetTy;

      const ix = (px - stageW / 2 - oldTx) / oldScale;
      const iy = (py - stageH / 2 - oldTy) / oldScale;

      this.targetScale = newScale;
      this.targetTx = px - stageW / 2 - ix * newScale;
      this.targetTy = py - stageH / 2 - iy * newScale;

      const c = this.clampTranslationValues(this.targetScale, this.targetTx, this.targetTy);
      this.targetTx = c.tx;
      this.targetTy = c.ty;
    }

    setZoomTargetToStageRect(selection) {
      const stageRect = this.stage.getBoundingClientRect();
      const stageW = stageRect.width || 1;
      const stageH = stageRect.height || 1;

      const width = Math.max(1, selection.width);
      const height = Math.max(1, selection.height);
      const centerX = selection.left + width / 2;
      const centerY = selection.top + height / 2;
      const factor = Math.min(stageW / width, stageH / height);
      const newScale = this.clamp(this.targetScale * factor, 1, 6);

      const ix = (centerX - stageW / 2 - this.targetTx) / this.targetScale;
      const iy = (centerY - stageH / 2 - this.targetTy) / this.targetScale;

      this.targetScale = newScale;
      this.targetTx = -ix * newScale;
      this.targetTy = -iy * newScale;

      const c = this.clampTranslationValues(this.targetScale, this.targetTx, this.targetTy);
      this.targetTx = c.tx;
      this.targetTy = c.ty;
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
        this.targetTx = this.tx;
        this.targetTy = this.ty;

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

    stopZoomAnimation() {
      if (this.zoomAnimFrame) {
        cancelAnimationFrame(this.zoomAnimFrame);
        this.zoomAnimFrame = null;
      }
    }

    startZoomAnimation() {
      if (this.zoomAnimFrame) return;

      const step = () => {
        const ds = this.targetScale - this.scale;
        const dx = this.targetTx - this.tx;
        const dy = this.targetTy - this.ty;

        this.scale += ds * this.zoomEase;
        this.tx += dx * this.zoomEase;
        this.ty += dy * this.zoomEase;

        if (Math.abs(ds) < 0.001 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          this.scale = this.targetScale;
          this.tx = this.targetTx;
          this.ty = this.targetTy;
          this.applyTransform();
          this.zoomAnimFrame = null;
          return;
        }

        this.applyTransform();
        this.zoomAnimFrame = requestAnimationFrame(step);
      };

      this.zoomAnimFrame = requestAnimationFrame(step);
    }

    onPointerDown(e) {
      this.dragMoved = 0;
      this.stopMomentum();
      this.vx = 0;
      this.vy = 0;
      this.lastMoveTime = performance.now();
      this.lastMoveX = e.clientX;
      this.lastMoveY = e.clientY;

      const rect = this.stage.getBoundingClientRect();
      this.lastPointerStageX = e.clientX - rect.left;
      this.lastPointerStageY = e.clientY - rect.top;

      if (e.pointerType === 'mouse' && e.button === 0 && e.ctrlKey) {
        this.startSelection(e);
        return;
      }

      if (e.pointerType === 'touch') {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.stage.setPointerCapture(e.pointerId);

        if (this.targetScale === 1 && this.pointers.size === 1 && this.getCurrentItems().length > 1) {
          this.swipeActive = true;
          this.swipeStartX = e.clientX;
          this.swipeStartY = e.clientY;
        } else {
          this.swipeActive = false;
        }

        if (this.pointers.size === 2) {
          const [p1, p2] = Array.from(this.pointers.values());
          this.pinchBaseDist = this.dist(p1, p2);
          this.pinchBaseScale = this.targetScale;
        }

        if (this.targetScale > 1 && this.pointers.size === 1) {
          this.stopZoomAnimation();
          this.dragging = true;
          this.dragPointerType = 'touch';
          this.startX = e.clientX - this.tx;
          this.startY = e.clientY - this.ty;
          this.applyTransform();
        }

        return;
      }

      if (this.targetScale <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      this.stopZoomAnimation();
      this.dragging = true;
      this.dragPointerType = e.pointerType || 'mouse';
      this.startX = e.clientX - this.tx;
      this.startY = e.clientY - this.ty;
      this.stage.setPointerCapture(e.pointerId);
      this.applyTransform();
    }

    onPointerMove(e) {
      if (this.selectionActive) {
        this.updateSelection(e);
        return;
      }

      if (e.pointerType === 'touch' && this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const rect = this.stage.getBoundingClientRect();
        this.lastPointerStageX = e.clientX - rect.left;
        this.lastPointerStageY = e.clientY - rect.top;

        if (this.pointers.size === 2) {
          this.dragging = false;
          const [p1, p2] = Array.from(this.pointers.values());
          const d = this.dist(p1, p2);

          if (this.pinchBaseDist > 0) {
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const px = centerX - rect.left;
            const py = centerY - rect.top;

            const raw = this.pinchBaseScale * (d / this.pinchBaseDist);
            const newScale = Math.min(6, Math.max(1, raw));
            this.setZoomTargetAboutStagePoint(newScale, px, py);
            this.startZoomAnimation();
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
          this.targetTx = nx;
          this.targetTy = ny;

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

      const rect = this.stage.getBoundingClientRect();
      this.lastPointerStageX = e.clientX - rect.left;
      this.lastPointerStageY = e.clientY - rect.top;

      if (!this.dragging) return;

      const nx = e.clientX - this.startX;
      const ny = e.clientY - this.startY;
      this.dragMoved += Math.abs(nx - this.tx) + Math.abs(ny - this.ty);
      this.tx = nx;
      this.ty = ny;
      this.targetTx = nx;
      this.targetTy = ny;

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
      if (this.selectionActive) {
        this.finishSelection(e);
        return;
      }

      if (this.dragMoved > 6) {
        this.suppressClickUntil = Date.now() + 250;
      }

      if (e.pointerType === 'touch') {
        if (this.swipeActive && this.targetScale === 1) {
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
      if (this.selectionActive) {
        this.cancelSelection(e);
      }

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

    formatCapturedAt(value) {
      const text = this.safeText(value);
      if (!text) return '';
      return text
        .replace('T', ' ')
        .replace(/\.\d+/, '')
        .replace(/([+-]\d{2}:\d{2}|Z)$/i, '')
        .trim();
    }

    numberFromAttribute(value) {
      const n = Number(this.safeText(value));
      return Number.isFinite(n) && n > 0 ? n : 0;
    }

    formatMegapixels(width, height) {
      if (!width || !height) return '';
      const mp = (width * height) / 1000000;
      return `${mp.toFixed(1).replace(/\.0$/, '')} MP`;
    }

    formatDimensions(width, height) {
      if (!width || !height) return '';
      return `${width} x ${height} (${this.formatMegapixels(width, height)})`;
    }

    formatFileSize(bytes) {
      const n = this.numberFromAttribute(bytes);
      if (!n) return '';

      const units = [
        ['GB', 1024 ** 3],
        ['MB', 1024 ** 2],
        ['KB', 1024]
      ];
      const unit = units.find(([, size]) => n >= size);
      if (!unit) return `${n} B`;

      const value = n / unit[1];
      const decimals = value >= 10 ? 1 : 2;
      return `${value.toFixed(decimals).replace(/\.0$/, '')} ${unit[0]}`;
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
      const shownWidth = this.numberFromAttribute(this.readAttr(item, this.options.fullWidthAttribute));
      const shownHeight = this.numberFromAttribute(this.readAttr(item, this.options.fullHeightAttribute));
      const originalWidth = this.numberFromAttribute(this.readAttr(item, this.options.originalWidthAttribute));
      const originalHeight = this.numberFromAttribute(this.readAttr(item, this.options.originalHeightAttribute));
      const originalFileSize = this.formatFileSize(this.readAttr(item, this.options.originalFileSizeAttribute));
      const labels = this.safeText(this.readAttr(item, this.options.suggestedLabelsAttribute));
      const vlmLabels = this.safeText(this.readAttr(item, this.options.vlmLabelsAttribute));
      const vlmLocation = this.safeText(this.readAttr(item, this.options.vlmLocationAttribute));
      const vlmEvent = this.safeText(this.readAttr(item, this.options.vlmEventSettingAttribute));
      const vlmCaption = this.safeText(this.readAttr(item, this.options.vlmCaptionAttribute));
      const vlmNotes = this.safeText(this.readAttr(item, this.options.vlmNotesAttribute));
      const vlmError = this.safeText(this.readAttr(item, this.options.vlmErrorAttribute));
      const cropMethod = this.safeText(this.readAttr(item, this.options.cropMethodAttribute));
      const cropBox = this.safeText(this.readAttr(item, this.options.cropBoxAttribute));

      const title = name || file || '';
      const settings = [focal, aperture, exp, iso ? `ISO ${iso}` : ''].filter(Boolean).join(' • ');
      const lines = [];

      if (title) lines.push(`<div><strong>${this.escapeHtml(title)}</strong></div>`);
      if (desc) {
        lines.push(
          `<div style="opacity:.95; margin-top:.25rem;"><strong>Desc:</strong> ${this.escapeHtml(desc)}</div>`
        );
      }
      if (camModel) lines.push(`<div style="margin-top:.25rem;"><strong>Camera:</strong> ${this.escapeHtml(camModel)}</div>`);
      if (lens) lines.push(`<div><strong>Lens:</strong> ${this.escapeHtml(lens)}</div>`);
      if (settings) lines.push(`<div><strong>Exposure:</strong> ${this.escapeHtml(settings)}</div>`);
      if (capturedAt) {
        lines.push(`<div style="opacity:.9;"><strong>Captured:</strong> ${this.escapeHtml(this.formatCapturedAt(capturedAt))}</div>`);
      }

      const shownDimensions = this.formatDimensions(shownWidth, shownHeight);
      const originalDimensions = this.formatDimensions(originalWidth, originalHeight);
      if (shownDimensions || originalDimensions || originalFileSize) {
        lines.push(`<div style="margin-top:.75rem;"><strong>Image size</strong></div>`);
        if (shownDimensions) {
          lines.push(`<div><strong>Shown:</strong> ${this.escapeHtml(shownDimensions)}</div>`);
        }
        if (originalDimensions || originalFileSize) {
          const originalParts = [originalDimensions, originalFileSize].filter(Boolean).join(', ');
          lines.push(`<div><strong>Full quality:</strong> ${this.escapeHtml(originalParts)}</div>`);
        }
      }

      if (labels) {
        lines.push(
          `<div style="margin-top:.75rem;"><strong>Suggested labels:</strong> ${this.escapeHtml(labels)}</div>`
        );
      }
      if (vlmCaption || vlmLabels || vlmEvent || vlmLocation || vlmNotes || vlmError) {
        lines.push(`<div style="margin-top:.75rem;"><strong>VLM visual read</strong></div>`);
        if (vlmCaption) lines.push(`<div>${this.escapeHtml(vlmCaption)}</div>`);
        if (vlmLabels) lines.push(`<div><strong>Labels:</strong> ${this.escapeHtml(vlmLabels)}</div>`);
        if (vlmEvent) lines.push(`<div><strong>Setting:</strong> ${this.escapeHtml(vlmEvent)}</div>`);
        if (vlmLocation) lines.push(`<div><strong>Location:</strong> ${this.escapeHtml(vlmLocation)}</div>`);
        if (vlmNotes) lines.push(`<div><strong>Uncertainty:</strong> ${this.escapeHtml(vlmNotes)}</div>`);
        if (vlmError) lines.push(`<div><strong>VLM error:</strong> ${this.escapeHtml(vlmError)}</div>`);
      }
      if (cropMethod) {
        const cropText = cropBox ? `${cropMethod} (${cropBox})` : cropMethod;
        lines.push(
          `<div style="opacity:.9;"><strong>Crop:</strong> ${this.escapeHtml(cropText)}</div>`
        );
      }

      const target = this.metaContent || this.metaBox;
      if (!target) return;

      target.innerHTML = lines.length
        ? lines.join('')
        : `<div style="opacity:.85;">No metadata available.</div>`;
    }
  }

  window.SharedLightbox = new Lightbox();

  document.addEventListener('DOMContentLoaded', function () {
    window.SharedLightbox.init();
  });
})();
