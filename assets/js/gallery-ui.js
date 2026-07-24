(function () {
  function labelsForLanguage(lang) {
    if (lang === 'fi') {
      return {
        returnToTop: 'Takaisin alkuun',
        returnToTopAria: 'Palaa sivun alkuun',
        galleryHierarchy: 'Gallerian sijainti',
        descriptionLanguage: 'Kuvaustekstin kieli'
      };
    }

    return {
      returnToTop: 'Return to top',
      returnToTopAria: 'Return to top of page',
      galleryHierarchy: 'Gallery hierarchy',
      descriptionLanguage: 'Description language'
    };
  }

  function normalizedLanguage(lang) {
    return lang === 'en' ? 'en' : 'fi';
  }

  function languageFromUrl() {
    try {
      const lang = new URLSearchParams(window.location.search).get('lang');
      return lang === 'en' || lang === 'fi' ? lang : '';
    } catch (_) {
      return '';
    }
  }

  function updateTopLinkLabels(lang) {
    const labels = labelsForLanguage(lang);
    document.querySelectorAll('.gallery-top-link').forEach((link) => {
      link.textContent = labels.returnToTop;
      link.setAttribute('aria-label', labels.returnToTopAria);
    });
  }

  function updateLocalizedChrome(lang) {
    const labels = labelsForLanguage(lang);
    document.documentElement.lang = lang;

    document.querySelectorAll('.gallery-breadcrumb').forEach((breadcrumb) => {
      breadcrumb.setAttribute('aria-label', labels.galleryHierarchy);
    });

    document.querySelectorAll('[data-gallery-lang-switch]').forEach((switchEl) => {
      switchEl.setAttribute('aria-label', labels.descriptionLanguage);
    });
  }

  function updateThumbnailLabels(lang) {
    document.querySelectorAll('[data-lightbox]').forEach((thumb) => {
      const label = thumb.getAttribute(`data-open-label-${lang}`);
      if (label) thumb.setAttribute('aria-label', label);

      const alt = thumb.getAttribute(`data-alt-${lang}`);
      if (alt) thumb.setAttribute('data-alt', alt);
    });
  }

  function updateLanguageUrl(lang) {
    if (typeof window.history?.replaceState !== 'function') return;

    try {
      const url = new URL(window.location.href);
      if (lang === 'en') {
        url.searchParams.set('lang', 'en');
      } else {
        url.searchParams.delete('lang');
      }
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {}
  }

  function initGalleryTopLinks() {
    document.querySelectorAll('.gallery-top-link').forEach((link) => {
      if (link.dataset.galleryTopBound === 'true') return;
      link.dataset.galleryTopBound = 'true';

      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (link.closest('.photo-lightbox')) {
          window.SharedLightbox?.close?.();
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    });
  }

  function initGalleryLanguageSwitches() {
    const header = document.querySelector('.gallery-node-header.has-gallery-i18n');
    if (!header) return;

    function setLanguage(lang, options = {}) {
      const nextLang = normalizedLanguage(lang);
      const shouldUpdateUrl = options.updateUrl !== false;
      header.setAttribute('data-gallery-lang', nextLang);
      updateLocalizedChrome(nextLang);
      updateTopLinkLabels(nextLang);
      updateThumbnailLabels(nextLang);
      if (shouldUpdateUrl) updateLanguageUrl(nextLang);

      document.querySelectorAll('[data-gallery-lang-switch]').forEach((switchEl) => {
        switchEl.querySelectorAll('[data-gallery-lang-set]').forEach((button) => {
          const isActive = button.getAttribute('data-gallery-lang-set') === nextLang;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      });

      window.dispatchEvent(new CustomEvent('gallerylanguagechange', {
        detail: { language: nextLang }
      }));
    }

    document.querySelectorAll('[data-gallery-lang-switch]').forEach((switchEl) => {
      switchEl.addEventListener('click', (event) => {
        const button = event.target.closest('[data-gallery-lang-set]');
        if (!button) return;
        setLanguage(button.getAttribute('data-gallery-lang-set'));
      });
    });

    setLanguage(languageFromUrl() || header.getAttribute('data-gallery-lang') || 'fi', {
      updateUrl: false
    });
  }

  function initGalleryUi() {
    initGalleryTopLinks();
    initGalleryLanguageSwitches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalleryUi);
  } else {
    initGalleryUi();
  }
})();
