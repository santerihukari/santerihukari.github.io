(function () {
  function labelsForLanguage(lang) {
    if (lang === 'fi') {
      return {
        returnToTop: 'Takaisin alkuun',
        returnToTopAria: 'Palaa sivun alkuun'
      };
    }

    return {
      returnToTop: 'Return to top',
      returnToTopAria: 'Return to top of page'
    };
  }

  function updateTopLinkLabels(lang) {
    const labels = labelsForLanguage(lang);
    document.querySelectorAll('.gallery-top-link').forEach((link) => {
      link.textContent = labels.returnToTop;
      link.setAttribute('aria-label', labels.returnToTopAria);
    });
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

    function setLanguage(lang) {
      const nextLang = lang === 'en' ? 'en' : 'fi';
      header.setAttribute('data-gallery-lang', nextLang);
      updateTopLinkLabels(nextLang);

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

    setLanguage(header.getAttribute('data-gallery-lang') || 'fi');
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
