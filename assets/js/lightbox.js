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
      this.toolbar = null;
      this.toolbarBreadcrumb = null;
      this.toolbarLangSwitch = null;
      this.selectionBox = null;
      this.liveRegion = null;
      this.lastTrigger = null;
      this.openScrollX = 0;
      this.openScrollY = 0;

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
        altFiAttribute: 'data-alt-fi',
        altEnAttribute: 'data-alt-en',
        nameAttribute: 'data-name',
        fileAttribute: 'data-file',
        fileFormatAttribute: 'data-file-format',
        photoIdAttribute: 'data-photo-id',
        filenameStemAttribute: 'data-filename-stem',
        indexAttribute: 'data-index',
        totalAttribute: 'data-total',
        openLabelFiAttribute: 'data-open-label-fi',
        openLabelEnAttribute: 'data-open-label-en',
        creditAttribute: 'data-credit',
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
      this.openFromHash();
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
        this.toolbar = existing.querySelector('.photo-lightbox-toolbar');
        this.toolbarBreadcrumb = existing.querySelector('.photo-lightbox-breadcrumb');
        this.toolbarLangSwitch = existing.querySelector('.photo-lightbox-lang-switch');
        this.metaBox?.removeAttribute('aria-live');
        this.metaContent?.removeAttribute('aria-live');
        this.ensureToolbar();
        this.ensureDialogSemantics();
        this.ensureLiveRegion();
        this.prepareImageElement();
        existing.querySelector('.photo-lightbox-download')?.remove();
        if (this.downloadLink) {
          this.downloadLink.remove();
          this.downloadLink = null;
        }
        if (this.metaBox && !this.metaContent) {
          this.metaContent = document.createElement('div');
          this.metaContent.className = 'photo-meta-content';
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
        this.updateControlLabels();
        return;
      }

      const dialog = document.createElement('dialog');
      dialog.className = 'photo-lightbox';
      dialog.id = 'sharedLightbox';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', this.label('viewerDialog'));

      dialog.innerHTML = `
        <div class="photo-lightbox-status visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="photo-lightbox-toolbar" hidden>
          <nav class="gallery-breadcrumb photo-lightbox-breadcrumb" aria-label="${this.escapeHtml(this.label('galleryHierarchy'))}"></nav>
          <div class="gallery-sticky-actions">
            <div class="gallery-lang-switch photo-lightbox-lang-switch" aria-label="${this.escapeHtml(this.label('descriptionLanguage'))}" data-gallery-lang-switch hidden>
              <button class="gallery-lang-option is-active"
                      type="button"
                      data-gallery-lang-set="fi"
                      aria-pressed="true">FI</button>
              <button class="gallery-lang-option"
                      type="button"
                      data-gallery-lang-set="en"
                      aria-pressed="false">EN</button>
            </div>
          </div>
        </div>
        <button class="photo-lightbox-close" type="button" aria-label="${this.escapeHtml(this.label('closeViewer'))}">×</button>
        <button class="photo-nav photo-prev" type="button" aria-label="${this.escapeHtml(this.label('previousPhoto'))}">‹</button>
        <button class="photo-nav photo-next" type="button" aria-label="${this.escapeHtml(this.label('nextPhoto'))}">›</button>
        <div class="photo-lightbox-shell">
          <div class="photo-stage">
            <img class="photo-lightbox-img" alt="" draggable="false">
            <div class="photo-zoom-selection" hidden></div>
          </div>
          <aside class="photo-meta">
            <div class="photo-meta-content"></div>
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
      this.downloadLink = null;
      this.metaContent = dialog.querySelector('.photo-meta-content');
      this.toolbar = dialog.querySelector('.photo-lightbox-toolbar');
      this.toolbarBreadcrumb = dialog.querySelector('.photo-lightbox-breadcrumb');
      this.toolbarLangSwitch = dialog.querySelector('.photo-lightbox-lang-switch');
      this.selectionBox = dialog.querySelector('.photo-zoom-selection');
      this.liveRegion = dialog.querySelector('.photo-lightbox-status');
      this.prepareImageElement();
      this.normalizeControls();
      this.updateControlLabels();
    }

    ensureToolbar() {
      if (!this.dialog) return;
      if (!this.toolbar) {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'photo-lightbox-toolbar';
        this.toolbar.hidden = true;
        this.toolbar.innerHTML = `
          <nav class="gallery-breadcrumb photo-lightbox-breadcrumb" aria-label="${this.escapeHtml(this.label('galleryHierarchy'))}"></nav>
          <div class="gallery-sticky-actions">
            <div class="gallery-lang-switch photo-lightbox-lang-switch" aria-label="${this.escapeHtml(this.label('descriptionLanguage'))}" data-gallery-lang-switch hidden>
              <button class="gallery-lang-option is-active" type="button" data-gallery-lang-set="fi" aria-pressed="true">FI</button>
              <button class="gallery-lang-option" type="button" data-gallery-lang-set="en" aria-pressed="false">EN</button>
            </div>
          </div>
        `;
        this.dialog.prepend(this.toolbar);
      }

      this.toolbar.querySelectorAll('.gallery-top-link').forEach((link) => link.remove());
      this.toolbarBreadcrumb = this.toolbar.querySelector('.photo-lightbox-breadcrumb');
      this.toolbarLangSwitch = this.toolbar.querySelector('.photo-lightbox-lang-switch');
    }

    prepareImageElement() {
      if (!this.image) return;
      this.image.draggable = false;
      this.image.setAttribute('draggable', 'false');
      if (this.image.dataset.dragGuardAttached === 'true') return;
      this.image.addEventListener('dragstart', (e) => e.preventDefault());
      this.image.dataset.dragGuardAttached = 'true';
    }

    ensureViewerHelp() {
      if (!this.metaBox) return;
      const existingHelp = this.metaBox.querySelector('.photo-viewer-help');
      if (existingHelp) existingHelp.remove();
    }

    normalizeControls() {
      if (this.closeBtn) this.closeBtn.innerHTML = '&times;';
      if (this.prevBtn) this.prevBtn.innerHTML = '&#8249;';
      if (this.nextBtn) this.nextBtn.innerHTML = '&#8250;';
    }

    ensureDialogSemantics() {
      if (!this.dialog) return;
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');
      this.dialog.setAttribute('aria-label', this.label('viewerDialog', {
        eventName: this.currentEventName()
      }));
    }

    ensureLiveRegion() {
      if (!this.dialog) return;
      this.liveRegion = this.dialog.querySelector('.photo-lightbox-status');
      if (this.liveRegion) return;

      this.liveRegion = document.createElement('div');
      this.liveRegion.className = 'photo-lightbox-status visually-hidden';
      this.liveRegion.setAttribute('role', 'status');
      this.liveRegion.setAttribute('aria-live', 'polite');
      this.liveRegion.setAttribute('aria-atomic', 'true');
      this.dialog.prepend(this.liveRegion);
    }

    updateControlLabels(item = null) {
      const currentItem = item || this.getCurrentItems()[this.index] || null;
      const eventName = this.currentEventName(currentItem);
      this.ensureDialogSemantics();
      this.dialog?.setAttribute('aria-label', this.label('viewerDialog', { eventName }));

      if (this.closeBtn) {
        this.closeBtn.setAttribute('aria-label', this.label('closeViewer'));
        this.closeBtn.setAttribute('title', this.label('closeViewer'));
      }
      if (this.prevBtn) {
        this.prevBtn.setAttribute('aria-label', this.label('previousPhoto'));
        this.prevBtn.setAttribute('title', this.label('previousPhoto'));
      }
      if (this.nextBtn) {
        this.nextBtn.setAttribute('aria-label', this.label('nextPhoto'));
        this.nextBtn.setAttribute('title', this.label('nextPhoto'));
      }
      if (this.toolbarBreadcrumb) {
        this.toolbarBreadcrumb.setAttribute('aria-label', this.label('galleryHierarchy'));
      }
      if (this.toolbarLangSwitch) {
        this.toolbarLangSwitch.setAttribute('aria-label', this.label('descriptionLanguage'));
      }
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

        this.openAt(index >= 0 ? index : 0, group, {
          trigger,
          history: this.isOpen() ? 'replace' : 'push'
        });
      });

      window.addEventListener('hashchange', () => this.handleHashChange());

      this.closeBtn?.addEventListener('click', () => this.close());
      this.prevBtn?.addEventListener('click', () => {
        this.markViewerHintSeen();
        this.prev();
      });
      this.nextBtn?.addEventListener('click', () => {
        this.markViewerHintSeen();
        this.next();
      });

      this.metaBox?.addEventListener('click', (e) => {
        const button = e.target.closest('[data-copy-value]');
        if (button) {
          this.copyText(button.getAttribute('data-copy-value') || '', button);
          return;
        }

        if (e.target === this.metaBox) {
          this.close();
        }
      });

      this.dialog?.addEventListener('click', (e) => {
        if (e.target === this.dialog) this.close();
      });

      this.dialog?.addEventListener('cancel', (e) => {
        e.preventDefault();
        this.close();
      });

      document.addEventListener('keydown', (e) => {
        this.handleKeyDown(e);
      });

      const refreshLayout = () => {
        if (!this.isOpen()) return;
        this.configureToolbar(false);
        this.computeBaseSize();
        this.applyTransform();
      };
      window.addEventListener('resize', refreshLayout);
      window.visualViewport?.addEventListener('resize', refreshLayout);
      window.addEventListener('gallerylanguagechange', () => {
        this.syncToolbarLanguageState();
        this.updateControlLabels();
        this.updateCurrentImageAlt();
        if (!this.isOpen()) return;
        const item = this.getCurrentItems()[this.index];
        if (item) {
          this.renderMeta(item);
          this.renderToolbarBreadcrumb(document.querySelector('#gallery-top.gallery-sticky-bar'), item, this.getCurrentItems().length);
          this.announcePhoto(item);
        }
      });

      this.stage?.addEventListener('click', (e) => {
        this.markViewerHintSeen();
        if (Date.now() < this.suppressClickUntil) return;
        if (this.dragMoved > 6) return;

        if (e.target === this.image || this.isPointInsideImage(e.clientX, e.clientY)) {
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

        this.close();
      });

      this.stage?.addEventListener(
        'wheel',
        (e) => {
          this.markViewerHintSeen();
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

      this.image?.addEventListener('error', () => {
        this.announce(this.label('imageLoadFailed'));
      });

      this.stage?.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.stage?.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.stage?.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.stage?.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    }

    isPointInsideImage(clientX, clientY) {
      if (!this.image) return false;
      const rect = this.image.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
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

    photoIdForItem(item) {
      return this.safeText(
        this.readAttr(item, this.options.photoIdAttribute) ||
          this.readAttr(item, this.options.nameAttribute) ||
          this.readAttr(item, this.options.fileAttribute)
      ).replace(/\.(jpe?g|png|webp|gif)$/i, '');
    }

    photoLinkForItem(item) {
      const photoId = this.photoIdForItem(item);
      if (!photoId) return window.location.href;
      return `${window.location.origin}${window.location.pathname}${window.location.search}#${encodeURIComponent(photoId)}`;
    }

    updateHashForItem(item, historyMode = 'replace') {
      const photoId = this.photoIdForItem(item);
      if (!photoId || typeof window.history?.replaceState !== 'function') return;

      const nextHash = `#${encodeURIComponent(photoId)}`;
      if (window.location.hash === nextHash) return;
      const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
      if (historyMode === 'push' && typeof window.history.pushState === 'function') {
        window.history.pushState({ lightbox: true, photoId }, '', nextUrl);
      } else {
        window.history.replaceState({ lightbox: true, photoId }, '', nextUrl);
      }
    }

    handleHashChange() {
      if (!window.location.hash) {
        if (this.isOpen()) this.close({ skipHash: true });
        return;
      }
      this.openFromHash({ fromHash: true });
    }

    openFromHash(options = {}) {
      const rawHash = window.location.hash.slice(1);
      if (!rawHash) return false;

      let photoId = rawHash;
      try {
        photoId = decodeURIComponent(rawHash);
      } catch (_) {}

      this.collectItems();
      const item = this.items.find((candidate) => {
        return this.photoIdForItem(candidate) === photoId || candidate.id === photoId;
      });
      if (!item) return false;

      const group = this.readAttr(item, this.options.galleryAttribute) || '';
      const groupItems = this.getGroupItems(group);
      const index = groupItems.indexOf(item);
      if (index < 0) return false;

      if (this.isOpen() && this.currentGroup === group && this.index === index) return true;
      this.openAt(index, group, {
        trigger: item,
        history: null,
        fromHash: !!options.fromHash
      });
      return true;
    }

    openAt(index, group = '', options = {}) {
      const items = this.getGroupItems(group);
      if (!items.length) return;
      const wasOpen = this.isOpen();

      this.currentGroup = group;
      this.index = ((index % items.length) + items.length) % items.length;

      const item = items[this.index];
      if (!wasOpen) {
        this.openScrollX = window.scrollX || window.pageXOffset || 0;
        this.openScrollY = window.scrollY || window.pageYOffset || 0;
      }
      if (options.trigger) {
        this.lastTrigger = options.trigger;
      } else if (!this.lastTrigger) {
        this.lastTrigger = item;
      }

      this.loadItem(item);
      this.configureUiForItem(item, items.length);
      this.resetView();
      if (options.history) {
        this.updateHashForItem(item, options.history);
      }

      if (!this.isOpen()) {
        if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
        else this.dialog.setAttribute('open', '');
      }
      this.setModalActive(true);
      this.updateControlLabels(item);
      if (!wasOpen) {
        requestAnimationFrame(() => this.closeBtn?.focus({ preventScroll: true }));
      }

      requestAnimationFrame(() => {
        this.computeBaseSize();
        this.applyTransform();
      });
    }

    loadItem(item) {
      const full = this.readAttr(item, this.options.fullAttribute);
      const alt = this.altTextForItem(item);

      this.image.src = full;
      this.image.alt = alt;
    }

    configureUiForItem(item, groupLength) {
      const navEnabled = item.getAttribute('data-lightbox-nav') !== 'false' && groupLength > 1;
      const downloadEnabled = item.getAttribute('data-lightbox-download') !== 'false';
      const metaEnabled = item.getAttribute('data-lightbox-meta') === 'true';

      this.toggleElement(this.prevBtn, navEnabled);
      this.toggleElement(this.nextBtn, navEnabled);

      const hasDownload =
        downloadEnabled &&
        !!(
          this.readAttr(item, this.options.downloadAttribute) ||
          this.readAttr(item, this.options.fullAttribute)
        );

      if (metaEnabled || hasDownload) {
        this.renderMeta(item);
      } else {
        this.clearMeta();
      }
      this.configureToolbar(true, item, groupLength);

      const showMetaPanel = metaEnabled || hasDownload;
      this.toggleElement(this.metaBox, showMetaPanel);
      this.dialog.classList.toggle('has-meta', showMetaPanel);
      this.updateControlLabels(item);
      this.announcePhoto(item);
    }

    configureToolbar(announce = true, item = null, groupLength = 0) {
      if (!this.toolbar) return;

      const pageBar = document.querySelector('#gallery-top.gallery-sticky-bar');
      if (!pageBar) {
        this.detachCloseFromToolbar();
        this.toggleElement(this.toolbar, false);
        return;
      }

      this.attachCloseToToolbar();
      this.renderToolbarBreadcrumb(pageBar, item, groupLength);
      this.positionToolbarFromPageBar(pageBar);

      const hasLanguageSwitch = !!document.querySelector('.gallery-node-header.has-gallery-i18n');
      this.toggleElement(this.toolbarLangSwitch, hasLanguageSwitch);
      this.toggleElement(this.toolbar, true);
      this.syncToolbarLanguageState();

      if (announce) {
        window.dispatchEvent(new CustomEvent('gallerylanguagechange', {
          detail: { language: this.currentLanguage() }
        }));
      }
    }

    renderToolbarBreadcrumb(pageBar, item = null, groupLength = 0) {
      if (!this.toolbarBreadcrumb || !pageBar) return;

      const pageBreadcrumb = pageBar.querySelector('.gallery-breadcrumb');
      const galleryRoot = pageBreadcrumb?.querySelector('a');
      const galleryTitle = pageBreadcrumb?.querySelector('span:last-child');
      const currentItems = this.getCurrentItems();
      const currentItem = item || currentItems[this.index] || null;
      const position = currentItem && currentItems.indexOf(currentItem) >= 0
        ? currentItems.indexOf(currentItem) + 1
        : this.index + 1;
      const count = groupLength || currentItems.length || 1;
      const rootLabel = this.safeText(galleryRoot?.textContent) || 'Gallery';
      const rootHref = this.safeText(galleryRoot?.getAttribute('href')) || '/gallery/';
      const galleryName = this.safeText(galleryTitle?.textContent);
      const photoName = currentItem
        ? this.safeText(
            this.readAttr(currentItem, this.options.photoIdAttribute) ||
              this.readAttr(currentItem, this.options.nameAttribute) ||
              this.readAttr(currentItem, this.options.fileAttribute)
          ).replace(/\.(jpe?g|png|webp|gif)$/i, '')
        : '';

      const separator = '<span class="photo-lightbox-breadcrumb__separator" aria-hidden="true">&rsaquo;</span>';
      const photoContext = photoName
        ? `${separator}<span class="photo-lightbox-breadcrumb__photo-group"><span class="photo-lightbox-breadcrumb__photo" title="${this.escapeHtml(photoName)}">${this.escapeHtml(photoName)}</span><span class="photo-lightbox-breadcrumb__count">(${this.escapeHtml(`${position}/${count}`)})</span></span>`
        : `${separator}<span class="photo-lightbox-breadcrumb__count">(${this.escapeHtml(`${position}/${count}`)})</span>`;

      this.toolbarBreadcrumb.innerHTML = [
        `<a class="photo-lightbox-breadcrumb__root" href="${this.escapeHtml(rootHref)}">${this.escapeHtml(rootLabel)}</a>`,
        galleryName
          ? `${separator}<span class="photo-lightbox-breadcrumb__gallery" title="${this.escapeHtml(galleryName)}">${this.escapeHtml(galleryName)}</span>`
          : '',
        photoContext
      ].join('');
    }

    attachCloseToToolbar() {
      if (!this.toolbar || !this.closeBtn) return;

      const actions = this.toolbar.querySelector('.gallery-sticky-actions');
      if (!actions) return;

      if (this.closeBtn.parentElement !== actions) {
        actions.appendChild(this.closeBtn);
        return;
      }

      actions.appendChild(this.closeBtn);
    }

    detachCloseFromToolbar() {
      if (!this.dialog || !this.closeBtn || !this.toolbar?.contains(this.closeBtn)) return;

      this.dialog.insertBefore(this.closeBtn, this.toolbar.nextSibling);
    }

    positionToolbarFromPageBar(pageBar = document.querySelector('#gallery-top.gallery-sticky-bar')) {
      if (!this.toolbar || !pageBar) return;

      const rect = pageBar.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const viewportTop = window.visualViewport?.offsetTop || 0;

      this.toolbar.style.left = `${Math.max(0, rect.left)}px`;
      this.toolbar.style.top = `${Math.max(0, viewportTop)}px`;
      this.toolbar.style.width = `${Math.min(rect.width, window.innerWidth - rect.left)}px`;
      this.toolbar.style.right = 'auto';
      this.toolbar.style.transform = 'none';
    }

    syncToolbarLanguageState() {
      if (!this.toolbar) return;
      const lang = this.currentLanguage();

      this.toolbar.querySelectorAll('[data-gallery-lang-set]').forEach((button) => {
        const isActive = button.getAttribute('data-gallery-lang-set') === lang;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    toggleElement(el, show) {
      if (!el) return;
      el.hidden = !show;
      el.style.display = show ? '' : 'none';
    }

    isVisible(el) {
      return !!el && !el.hidden && el.style.display !== 'none';
    }

    close(options = {}) {
      this.cancelSelection();
      this.stopMomentum();
      this.stopZoomAnimation();
      if (!options.skipHash) this.clearPhotoHash();
      this.vx = 0;
      this.vy = 0;
      this.image.src = '';
      this.clearMeta();
      this.setModalActive(false);
      this.dialog.close?.();
      this.dialog.removeAttribute('open');

      requestAnimationFrame(() => {
        window.scrollTo(this.openScrollX || 0, this.openScrollY || 0);
        if (options.restoreFocus === false) return;
        if (this.lastTrigger && typeof this.lastTrigger.focus === 'function') {
          this.lastTrigger.focus({ preventScroll: true });
        }
      });
    }

    clearPhotoHash() {
      if (!window.location.hash || typeof window.history?.replaceState !== 'function') return;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    setModalActive(active) {
      document.documentElement.classList.toggle('lightbox-open', active);
      document.body.classList.toggle('lightbox-open', active);

      Array.from(document.body.children).forEach((child) => {
        if (child === this.dialog) return;
        if (active) {
          if (child.dataset.lightboxInertState) return;
          child.dataset.lightboxInertState = child.inert ? 'already' : 'set';
          child.inert = true;
          return;
        }

        if (!child.dataset.lightboxInertState) return;
        if (child.dataset.lightboxInertState === 'set') {
          child.inert = false;
        }
        delete child.dataset.lightboxInertState;
      });
    }

    clearMeta() {
      const target = this.metaContent || this.metaBox;
      if (target) target.innerHTML = '';
    }

    isOpen() {
      return !!(this.dialog && (this.dialog.open || this.dialog.hasAttribute('open')));
    }

    isEditableTarget(target) {
      const el = target instanceof Element ? target : null;
      if (!el) return false;
      return !!el.closest('input, textarea, select, [contenteditable="true"]');
    }

    focusableElements() {
      if (!this.dialog) return [];
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');

      return Array.from(this.dialog.querySelectorAll(selector)).filter((el) => {
        if (el.hidden) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      });
    }

    trapFocus(e) {
      const focusable = this.focusableElements();
      if (!focusable.length) {
        e.preventDefault();
        this.dialog?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    handleKeyDown(e) {
      if (!this.isOpen()) return;

      if (e.key === 'Tab') {
        this.trapFocus(e);
        return;
      }

      if (this.isEditableTarget(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (this.prevBtn && this.isVisible(this.prevBtn) && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.markViewerHintSeen();
        this.prev();
        return;
      }

      if (this.nextBtn && this.isVisible(this.nextBtn) && e.key === 'ArrowRight') {
        e.preventDefault();
        this.markViewerHintSeen();
        this.next();
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.markViewerHintSeen();
        this.zoomIn();
        return;
      }

      if (e.key === '-') {
        e.preventDefault();
        this.markViewerHintSeen();
        this.zoomOut();
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        this.markViewerHintSeen();
        this.fitToScreen();
      }
    }

    next() {
      const items = this.getCurrentItems();
      if (items.length < 2) return;
      this.openAt(this.index + 1, this.currentGroup, { history: 'replace' });
    }

    prev() {
      const items = this.getCurrentItems();
      if (items.length < 2) return;
      this.openAt(this.index - 1, this.currentGroup, { history: 'replace' });
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

    zoomStagePoint() {
      return {
        x: this.lastPointerStageX ?? this.stageCenterX(),
        y: this.lastPointerStageY ?? this.stageCenterY()
      };
    }

    zoomIn() {
      const p = this.zoomStagePoint();
      const nextScale = this.clamp(this.targetScale * 1.35, 1, 6);
      this.setZoomTargetAboutStagePoint(nextScale, p.x, p.y);
      this.startZoomAnimation();
    }

    zoomOut() {
      const p = this.zoomStagePoint();
      const nextScale = this.clamp(this.targetScale / 1.35, 1, 6);
      if (nextScale <= 1.01) {
        this.fitToScreen();
        return;
      }
      this.setZoomTargetAboutStagePoint(nextScale, p.x, p.y);
      this.startZoomAnimation();
    }

    fitToScreen() {
      this.resetView();
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

    getMobileUnzoomedCenterOffsetY() {
      if (!this.dialog || !this.stage || !this.image || !this.metaBox) return 0;
      if (!this.dialog.classList.contains('has-meta') || this.dialog.classList.contains('is-zoomed')) return 0;
      if (this.scale > 1.001 || this.targetScale > 1.001) return 0;
      if (!window.matchMedia?.('(max-width: 780px)').matches) return 0;

      const stageRect = this.stage.getBoundingClientRect();
      const metaRect = this.metaBox.getBoundingClientRect();
      const imageHeight = this.baseH || this.image.getBoundingClientRect().height || 0;
      if (!stageRect.height || !metaRect.height || !imageHeight) return 0;

      const spareBelow = Math.max(0, (stageRect.height - imageHeight) / 2);
      if (spareBelow < 1) return 0;

      return Math.min(metaRect.height / 2, spareBelow);
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

    updateZoomMode() {
      if (!this.dialog) return;
      const zoomed = this.scale > 1.001 || this.targetScale > 1.001 || this.dragging || this.selectionActive;
      if (this.dialog.classList.contains('is-zoomed') === zoomed) return;

      this.dialog.classList.toggle('is-zoomed', zoomed);
      this.computeBaseSize();
    }

    applyTransform() {
      this.updateZoomMode();
      this.clampTranslation();
      const visualTy = this.ty + this.getMobileUnzoomedCenterOffsetY();
      this.image.style.transform = `translate(${this.tx}px, ${visualTy}px) scale(${this.scale})`;
      const cursor = this.scale > 1 ? (this.dragging ? 'grabbing' : 'grab') : 'zoom-in';
      this.image.style.cursor = cursor;
      if (!this.selectionActive) this.stage.style.cursor = cursor;
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
      this.markViewerHintSeen();
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

      e.preventDefault();
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
      e.preventDefault();

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

    collectionAttr(item, key) {
      const gallery = item?.closest?.('.photo-gallery') || document.querySelector('.photo-gallery');
      return this.safeText(gallery?.dataset?.[key]);
    }

    currentEventName(item = null) {
      return this.collectionAttr(item, 'galleryEventName') || 'Image';
    }

    filenameStemForItem(item) {
      return this.safeText(
        this.readAttr(item, this.options.filenameStemAttribute) ||
          this.photoIdForItem(item)
      );
    }

    currentPosition(item) {
      const currentItems = this.getCurrentItems();
      const indexFromGroup = currentItems.indexOf(item);
      const index = this.numberFromAttribute(this.readAttr(item, this.options.indexAttribute));
      const total = this.numberFromAttribute(this.readAttr(item, this.options.totalAttribute));
      return {
        index: indexFromGroup >= 0 ? indexFromGroup + 1 : index || this.index + 1,
        total: currentItems.length || total || 1
      };
    }

    altTextForItem(item) {
      const lang = this.currentLanguage();
      const localized = lang === 'fi'
        ? this.readAttr(item, this.options.altFiAttribute)
        : this.readAttr(item, this.options.altEnAttribute);
      if (localized) return localized;

      const { index, total } = this.currentPosition(item);
      return this.label('fallbackAlt', {
        eventName: this.currentEventName(item),
        index,
        total,
        filenameStem: this.filenameStemForItem(item)
      }, lang);
    }

    updateCurrentImageAlt() {
      if (!this.isOpen()) return;
      const item = this.getCurrentItems()[this.index];
      if (item && this.image) this.image.alt = this.altTextForItem(item);
    }

    labelsForLanguage(lang) {
      if (lang === 'fi') {
        return {
          technicalDetails: 'Tekniset tiedot',
          file: 'Tiedosto',
          camera: 'Kamera',
          lens: 'Objektiivi',
          exposure: 'Valotus',
          captured: 'Kuvattu',
          preview: 'Esikatselukuva',
          fullResolutionDownload: 'Täysikokoinen ladattava kuva',
          originalFile: 'Alkuperäinen tiedosto',
          copyright: 'Tekijänoikeus',
          previousPhoto: 'Edellinen kuva',
          nextPhoto: 'Seuraava kuva',
          closeViewer: 'Sulje kuvankatselu',
          zoomIn: 'Lähennä',
          zoomOut: 'Loitonna',
          fitToScreen: 'Sovita kuva näyttöön',
          copyLink: 'Kopioi linkki',
          copyPreviewLink: 'Kopioi esikatselulinkki',
          downloadFullResolution: 'Lataa täysikokoinen kuva',
          downloadFullRes: 'Lataa täysikokoinen kuva',
          linkCopied: 'Linkki kopioitu',
          copyFailed: 'Linkin kopiointi epäonnistui',
          imageLoadFailed: 'Kuvan lataaminen epäonnistui',
          viewerDialog: '{eventName} -kuvankatselu',
          viewerHint: 'Vaihda kuvaa pyyhkäisemällä tai nuolinäppäimillä; lähennä nipistämällä tai vierittämällä.',
          photoStatus: 'Kuva {index}/{total}, tiedosto {filenameStem}',
          openPhoto: 'Avaa {eventName} -kuva {index}/{total}, tiedosto {filenameStem}',
          fallbackAlt: '{eventName} -tapahtumakuva, kuva {index}/{total}, tiedosto {filenameStem}',
          galleryHierarchy: 'Gallerian sijainti',
          descriptionLanguage: 'Kuvaustekstin kieli',
          noMetadata: 'Metatietoja ei ole saatavilla.'
        };
      }

      return {
        technicalDetails: 'Technical details',
        file: 'File',
        camera: 'Camera',
        lens: 'Lens',
        exposure: 'Exposure',
        captured: 'Captured',
        preview: 'Preview',
        fullResolutionDownload: 'Full-resolution download',
        originalFile: 'Original file',
        copyright: 'Copyright',
        previousPhoto: 'Previous photo',
        nextPhoto: 'Next photo',
        closeViewer: 'Close image viewer',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        fitToScreen: 'Fit image to screen',
        copyLink: 'Copy link',
        copyPreviewLink: 'Copy preview link',
        downloadFullResolution: 'Download full-resolution image',
        downloadFullRes: 'Download full-res',
        linkCopied: 'Link copied',
        copyFailed: 'Link could not be copied',
        imageLoadFailed: 'Image could not be loaded',
        viewerDialog: '{eventName} image viewer',
        viewerHint: 'Swipe or use arrow keys to change photo; pinch or scroll to zoom.',
        photoStatus: 'Photo {index} of {total}, file {filenameStem}',
        openPhoto: 'Open {eventName} photo {index} of {total}, file {filenameStem}',
        fallbackAlt: '{eventName} event photograph, photo {index} of {total}, file {filenameStem}',
        galleryHierarchy: 'Gallery hierarchy',
        descriptionLanguage: 'Description language',
        noMetadata: 'No metadata available.'
      };
    }

    label(key, params = {}, lang = this.currentLanguage()) {
      const labels = this.labelsForLanguage(lang);
      const template = labels[key] || this.labelsForLanguage('en')[key] || key;
      return template.replace(/\{(\w+)\}/g, (_, name) => {
        return params[name] === undefined ? '' : String(params[name]);
      });
    }

    currentLanguage() {
      const galleryHeader = document.querySelector('.gallery-node-header.has-gallery-i18n');
      const galleryLang = galleryHeader?.getAttribute('data-gallery-lang');
      if (galleryLang === 'fi' || galleryLang === 'en') return galleryLang;

      const activeGalleryLang = document.querySelector('[data-gallery-lang-set].is-active');
      const activeLang = activeGalleryLang?.getAttribute('data-gallery-lang-set');
      if (activeLang === 'fi' || activeLang === 'en') return activeLang;

      const documentLang = document.documentElement.lang || '';
      return documentLang.toLowerCase().startsWith('fi') ? 'fi' : 'en';
    }

    formatCapturedAt(value) {
      const text = this.safeText(value);
      if (!text) return '';

      const match = text.match(/^(\d{4})[-:](\d{2})[-:](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
      let date = null;
      if (match) {
        date = new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6])
        );
      } else {
        const parsed = new Date(text);
        if (!Number.isNaN(parsed.getTime())) date = parsed;
      }

      if (!date || Number.isNaN(date.getTime())) {
        return text
          .replace('T', ' ')
          .replace(/\.\d+/, '')
          .replace(/([+-]\d{2}:\d{2}|Z)$/i, '')
          .trim();
      }

      const lang = this.currentLanguage();
      const locale = lang === 'fi' ? 'fi-FI' : 'en-GB';
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: lang === 'fi' ? 'numeric' : 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
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
      return `${width} × ${height} px · ${this.formatMegapixels(width, height)}`;
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

    fileFormatForItem(item) {
      const explicit = this.safeText(this.readAttr(item, this.options.fileFormatAttribute));
      if (explicit) return explicit;
      const file = this.safeText(this.readAttr(item, this.options.fileAttribute));
      const ext = file.includes('.') ? file.split('.').pop().toUpperCase() : '';
      if (ext === 'JPG' || ext === 'JPEG') return 'JPEG';
      return ext;
    }

    formatExposureTime(value) {
      return this.safeText(value).replace(/(\d)s$/, '$1 s');
    }

    viewerHintSeen() {
      try {
        return window.localStorage?.getItem('galleryViewerHintSeen') === '1';
      } catch (_) {
        return false;
      }
    }

    markViewerHintSeen() {
      if (this.viewerHintSeen()) return;

      try {
        window.localStorage?.setItem('galleryViewerHintSeen', '1');
      } catch (_) {}

      const hint = this.metaContent?.querySelector('.photo-viewer-hint');
      if (hint) hint.hidden = true;
    }

    announce(message) {
      const text = this.safeText(message);
      if (!text) return;
      this.ensureLiveRegion();
      if (!this.liveRegion) return;
      this.liveRegion.textContent = '';
      window.setTimeout(() => {
        if (this.liveRegion) this.liveRegion.textContent = text;
      }, 20);
    }

    announcePhoto(item) {
      const { index, total } = this.currentPosition(item);
      this.announce(this.label('photoStatus', {
        index,
        total,
        filenameStem: this.filenameStemForItem(item)
      }));
    }

    copyText(text, button) {
      const value = this.safeText(text);
      if (!value) return;

      const done = () => {
        this.flashCopyButton(button);
        this.announce(this.label('linkCopied'));
      };
      const failed = () => {
        this.announce(this.label('copyFailed'));
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(() => {
          if (this.fallbackCopyText(value)) done();
          else failed();
        });
        return;
      }

      if (this.fallbackCopyText(value)) done();
      else failed();
    }

    fallbackCopyText(text) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      area.remove();
      return ok;
    }

    flashCopyButton(button) {
      if (!button) return;
      const previous = button.textContent;
      button.textContent = this.label('linkCopied');
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1400);
    }

    renderMeta(item) {
      const file = this.safeText(this.readAttr(item, this.options.fileAttribute));
      const desc = this.safeText(this.readAttr(item, this.options.descriptionAttribute));
      const camModel = this.safeText(this.readAttr(item, this.options.cameraModelAttribute));
      const lens = this.safeText(this.readAttr(item, this.options.lensModelAttribute));
      const focal = this.safeText(this.readAttr(item, this.options.focalLengthAttribute));
      const aperture = this.safeText(this.readAttr(item, this.options.apertureAttribute));
      const exp = this.formatExposureTime(this.readAttr(item, this.options.exposureTimeAttribute));
      const iso = this.safeText(this.readAttr(item, this.options.isoAttribute));
      const capturedAt = this.safeText(this.readAttr(item, this.options.capturedAtAttribute));
      const previewWidth = this.numberFromAttribute(this.readAttr(item, this.options.fullWidthAttribute));
      const previewHeight = this.numberFromAttribute(this.readAttr(item, this.options.fullHeightAttribute));
      const downloadWidth = this.numberFromAttribute(this.readAttr(item, this.options.originalWidthAttribute));
      const downloadHeight = this.numberFromAttribute(this.readAttr(item, this.options.originalHeightAttribute));
      const downloadFileSize = this.formatFileSize(this.readAttr(item, this.options.originalFileSizeAttribute));
      const copyrightNotice = this.collectionAttr(item, 'galleryCopyrightNotice');

      const photoId = this.filenameStemForItem(item) || file;
      const { index, total } = this.currentPosition(item);
      const photoLink = this.photoLinkForItem(item);
      const downloadEnabled = item.getAttribute('data-lightbox-download') !== 'false';
      const downloadUrl = downloadEnabled
        ? this.safeText(
            this.readAttr(item, this.options.downloadAttribute) ||
              this.readAttr(item, this.options.fullAttribute)
          )
        : '';
      const filename = file || 'image.jpg';
      const fileFormat = this.fileFormatForItem(item);
      const exposure = [focal, aperture, exp, iso ? `ISO ${iso}` : ''].filter(Boolean).join(' · ');
      const lines = [];
      const rows = [];

      const addRow = (labelKey, value) => {
        const text = this.safeText(value);
        if (!text) return;
        rows.push(`
          <div>
            <dt>${this.escapeHtml(this.label(labelKey))}</dt>
            <dd>${this.escapeHtml(text)}</dd>
          </div>
        `);
      };

      lines.push(`
        <div class="photo-meta-summary">
          <span class="photo-meta-count">${this.escapeHtml(`${index} / ${total}`)}</span>
          ${photoId ? `<strong class="photo-meta-id">${this.escapeHtml(photoId)}</strong>` : ''}
        </div>
      `);
      if (desc) {
        lines.push(
          `<p class="photo-meta-description">${this.escapeHtml(desc)}</p>`
        );
      }

      if (!this.viewerHintSeen()) {
        lines.push(`<p class="photo-viewer-hint">${this.escapeHtml(this.label('viewerHint'))}</p>`);
      }

      const actions = [];
      if (photoLink) {
        actions.push(
          `<button class="photo-meta-action" type="button" data-copy-value="${this.escapeHtml(photoLink)}" aria-label="${this.escapeHtml(this.label('copyLink'))}">${this.escapeHtml(this.label('copyPreviewLink'))}</button>`
        );
      }
      if (downloadUrl) {
        actions.push(
          `<a class="photo-meta-action photo-meta-action-link" href="${this.escapeHtml(downloadUrl)}" target="_blank" rel="noopener" aria-label="${this.escapeHtml(this.label('downloadFullResolution'))}">${this.escapeHtml(this.label('downloadFullRes'))}</a>`
        );
      }
      if (actions.length) {
        lines.push(`<div class="photo-meta-actions">${actions.join('')}</div>`);
      }

      addRow('file', [file, fileFormat].filter(Boolean).join(' · '));
      addRow('camera', camModel);
      addRow('lens', lens);
      addRow('exposure', exposure);
      if (capturedAt) addRow('captured', this.formatCapturedAt(capturedAt));
      addRow('preview', this.formatDimensions(previewWidth, previewHeight));

      const downloadDetails = [
        this.formatDimensions(downloadWidth, downloadHeight),
        fileFormat,
        downloadFileSize
      ].filter(Boolean).join(' · ');
      addRow('fullResolutionDownload', downloadDetails);
      addRow('copyright', copyrightNotice);

      if (rows.length) {
        lines.push(`
          <details class="photo-technical-details">
            <summary>${this.escapeHtml(this.label('technicalDetails'))}</summary>
            <div class="photo-technical-details__content">
              <dl class="photo-technical-list">${rows.join('')}</dl>
            </div>
          </details>
        `);
      }

      const target = this.metaContent || this.metaBox;
      if (!target) return;

      target.innerHTML = lines.length
        ? lines.join('')
        : `<div style="opacity:.85;">${this.escapeHtml(this.label('noMetadata'))}</div>`;
    }
  }

  window.SharedLightbox = new Lightbox();

  document.addEventListener('DOMContentLoaded', function () {
    window.SharedLightbox.init();
  });
})();
