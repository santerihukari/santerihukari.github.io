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

  function initBibSearch() {
    document.querySelectorAll('[data-bib-search]').forEach((search) => {
      const input = search.querySelector('[data-bib-search-input]');
      const clearButton = search.querySelector('[data-bib-search-clear]');
      const label = search.querySelector('[data-bib-search-label]');
      const status = search.querySelector('[data-bib-search-status]');
      const grid = document.getElementById(search.getAttribute('data-bib-search-target'));
      if (!input || !clearButton || !label || !status || !grid) return;

      const cards = Array.from(grid.querySelectorAll('.photo-card'));
      let currentBib = '';

      function currentLanguage() {
        const headerLanguage = document.querySelector('.gallery-node-header')?.getAttribute('data-gallery-lang');
        return headerLanguage === 'en' ? 'en' : 'fi';
      }

      function localizedValue(name, lang = currentLanguage()) {
        return search.getAttribute(`data-${name}-${lang}`) || '';
      }

      function formatMessage(template, values) {
        return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
      }

      function updateUrl(bib) {
        if (typeof window.history?.replaceState !== 'function') return;
        const url = new URL(window.location.href);
        if (bib) url.searchParams.set('bib', bib);
        else url.searchParams.delete('bib');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }

      function updateLanguage() {
        const lang = currentLanguage();
        label.textContent = localizedValue('label', lang);
        input.placeholder = localizedValue('placeholder', lang);
        search.querySelectorAll('[data-bib-search-note-lang]').forEach((note) => {
          note.hidden = note.getAttribute('data-bib-search-note-lang') !== lang;
        });
        const clearText = localizedValue('clear', lang);
        clearButton.setAttribute('aria-label', clearText);
        clearButton.title = clearText;
        applyFilter(currentBib, { updateUrl: false });
      }

      function applyFilter(value, options = {}) {
        const digits = String(value || '').replace(/\D/g, '');
        const bib = digits ? String(Number.parseInt(digits, 10)) : '';
        currentBib = bib;
        if (input.value !== bib) input.value = bib;

        let visibleCount = 0;
        cards.forEach((card) => {
          const bibs = (card.getAttribute('data-bib-numbers') || '').split(/\s+/).filter(Boolean);
          const visible = !bib || bibs.includes(bib);
          card.hidden = !visible;
          if (visible) visibleCount += 1;
        });

        clearButton.hidden = !bib;
        grid.classList.toggle('is-bib-filtered', !!bib);
        if (!bib) {
          status.textContent = '';
        } else {
          const messageKey = visibleCount ? 'result' : 'empty';
          status.textContent = formatMessage(localizedValue(messageKey), {
            bib,
            count: visibleCount
          });
        }
        if (options.updateUrl !== false) updateUrl(bib);
      }

      input.addEventListener('input', () => applyFilter(input.value));
      input.addEventListener('search', () => applyFilter(input.value));
      clearButton.addEventListener('click', () => {
        applyFilter('');
        input.focus();
      });
      window.addEventListener('gallerylanguagechange', updateLanguage);

      const initialBib = new URLSearchParams(window.location.search).get('bib') || '';
      search.hidden = false;
      applyFilter(initialBib, { updateUrl: false });
      updateLanguage();
    });
  }

  function initGalleryUi() {
    initGalleryTopLinks();
    initBibSearch();
    initGalleryLanguageSwitches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalleryUi);
  } else {
    initGalleryUi();
  }
})();
