(function () {
  function initGalleryTopLinks() {
    document.querySelectorAll('.gallery-top-link').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    });
  }

  function initGalleryLanguageSwitches() {
    const header = document.querySelector('.gallery-node-header.has-gallery-i18n');
    if (!header) return;

    const switches = Array.from(document.querySelectorAll('[data-gallery-lang-switch]'));
    if (!switches.length) return;

    function setLanguage(lang) {
      const nextLang = lang === 'en' ? 'en' : 'fi';
      header.setAttribute('data-gallery-lang', nextLang);

      switches.forEach((switchEl) => {
        switchEl.querySelectorAll('[data-gallery-lang-set]').forEach((button) => {
          const isActive = button.getAttribute('data-gallery-lang-set') === nextLang;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      });
    }

    switches.forEach((switchEl) => {
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
