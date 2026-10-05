---
layout: page
title: CV PDF prototype
permalink: /cv/pdf/
nav_exclude: true
sitemap: false
robots: noindex, nofollow
---

<section class="cv-pdf-tool" data-cv-pdf-tool aria-labelledby="cvPdfTitle">
  <header class="cv-pdf-tool__header">
    <p class="cv-pdf-tool__eyebrow">Unlisted prototype</p>
    <h1 id="cvPdfTitle">CV PDF generator</h1>
    <p class="cv-pdf-tool__intro">The PDF is created locally in this browser. CV data is not uploaded or sent to a third party.</p>
  </header>

  <div class="cv-pdf-tool__actions" aria-label="PDF actions">
    <button class="cv-pdf-tool__action cv-pdf-tool__action--primary" id="cvPdfGenerate" type="button">Generate PDF</button>
    <a class="cv-pdf-tool__action download-action" id="cvPdfDownload" href="#" download hidden aria-label="Download CV as PDF" title="Download CV as PDF">{% include download-icon.html %}</a>
    <a class="cv-pdf-tool__action" id="cvPdfOpen" href="#" target="_blank" rel="noopener" hidden>Open PDF</a>
  </div>

  <p class="cv-pdf-tool__status" id="cvPdfStatus" role="status" aria-live="polite">Preparing generator...</p>

  <noscript>
    <p class="cv-pdf-tool__noscript">JavaScript is required to generate the PDF in your browser.</p>
  </noscript>
</section>

<script id="cvPdfData" type="application/json">{{ site.data.cv_pdf | jsonify }}</script>
<script src="{{ '/assets/vendor/pdf-lib/1.17.1/pdf-lib.min.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/cv-pdf.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
