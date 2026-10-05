---
layout: page
title: CV
permalink: /cv/
order: 20
nav_id: cv
nav_order: 20
nav_direct: true
---

<div class="cv-pdf-download" data-cv-pdf-tool data-cv-pdf-mode="download">
  <h2>Santeri Hukari</h2>
  <button class="cv-pdf-tool__action" id="cvPdfGenerate" type="button" aria-label="Download CV as PDF" title="Download CV as PDF" hidden>
    {% include download-icon.html %}
    <span>CV PDF</span>
  </button>
  <a id="cvPdfDownload" href="#" download hidden></a>
  <p class="cv-pdf-tool__status visually-hidden" id="cvPdfStatus" role="status" aria-live="polite"></p>
</div>

<p><strong>Location:</strong> Tampere, Finland</p>

<div class="cv-contact-row">
  <span class="cv-label"><strong>Email:</strong></span>
  <code id="email1" class="cv-code">santeri.hukari@tuni.fi</code>
  <button class="copy-btn icon-btn" type="button" data-copy-target="email1" aria-label="Copy email" title="Copy">
    <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
    </svg>
  </button>
</div>

<p>
  <strong>GitHub:</strong>
  <a href="https://github.com/santerihukari" target="_blank" rel="noopener">
    github.com/santerihukari
  </a>
</p>

<p>
  <strong>LinkedIn:</strong>
  <a href="https://www.linkedin.com/in/santerihukari/" target="_blank" rel="noopener">
    linkedin.com/in/santerihukari
  </a>
</p>

<p><strong>Portfolio:</strong> <a href="{{ '/projects/' | absolute_url }}">{{ site.url }}{{ site.baseurl }}/projects/</a></p>

<p>{{ site.data.cv_pdf.profile.summary }}</p>

<script>
(function () {
  function flashCopied(btn) {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 900);
  }

  function selectAllText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const id = btn.getAttribute('data-copy-target');
    const el = document.getElementById(id);
    if (!el) return;

    const text = el.textContent.trim();

    try {
      await navigator.clipboard.writeText(text);
      flashCopied(btn);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashCopied(btn);
    }
  });

  document.addEventListener('dblclick', (e) => {
    const code = e.target.closest('code.cv-code');
    if (!code) return;
    e.preventDefault();
    selectAllText(code);
  });
})();
</script>

---

## Education

[Taken courses]({{ '/courses/' | relative_url }})

<div class="cv-entry cv-entry--edu">
  <svg class="cv-entry-logo" aria-hidden="true" focusable="false">
    <use class="tuni-halo" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
    <use class="tuni-fill" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
  </svg>
  <div>
    <strong>MSc in Information Technology</strong> <em>(ongoing)</em><br>
    Tampere University<br>
    Expected graduation: 2026<br>
    Coursework completed; only the Master’s thesis remains<br>
    Thesis in progress: <em>Imitation Learning for Hydraulic Manipulators</em><br>
    Part-time studies alongside work and independent projects
  </div>
</div>

<div class="cv-entry cv-entry--edu">
  <svg class="cv-entry-logo" aria-hidden="true" focusable="false">
    <use class="tuni-halo" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
    <use class="tuni-fill" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
  </svg>
  <div>
    <strong>BSc in Information Technology</strong><br>
    Tampere University<br>
    Graduated: January 2025<br>
    Major: Signal Processing and Machine Learning<br>
    Thesis: Vision Transformer and ResNet-18 data efficiency using CIFAR-10 and TinyImageNet; grade 5/5<br>
    <a href="https://urn.fi/URN:NBN:fi:tuni-2024121711321" target="_blank" rel="noopener">Thesis record</a>
  </div>
</div>

<div class="cv-entry cv-entry--edu">
  <img class="cv-entry-logo cv-entry-logo--contain cv-entry-logo--dark-outline"
       src="{{ '/images/kpedu-logo-light.png' | relative_url }}"
       alt=""
       aria-hidden="true">
  <div>
    <strong>Vocational Qualification in Business Information Technology (Datanomi)</strong><br>
    Keski-Pohjanmaan ammattiopisto (Kpedu)<br>
    2013 – 2016<br>
    Top student of the 2016 graduating class; programming and web development<br>
    Built an SQL teaching web app for Centria students and a customer-management system at Keskikaista<br>
    Work-based learning placements (one month each): Konecranes Shanghai, Kletterzentrum Siegerland, Datafix, and Keskikaista
  </div>
</div>

<div class="cv-entry cv-entry--edu">
  <span class="cv-entry-logo cv-entry-logo--theme-pair" aria-hidden="true">
    <img class="cv-brand-logo cv-brand-logo--light"
         src="{{ '/images/kokkola-logo-light.png' | relative_url }}"
         alt="">
    <img class="cv-brand-logo cv-brand-logo--dark"
         src="{{ '/images/kokkola-logo-dark.svg' | relative_url }}"
         alt="">
  </span>
  <div>
    <strong>Finnish Matriculation Examination (Ylioppilastutkinto)</strong><br>
    Kokkolan ammattilukio<br>
    Graduated: 4 June 2016<br>
    Began upper secondary studies in autumn 2014 alongside the vocational qualification; completed 36 courses over approximately 1.5 years<br>
    In spring 2016, focused on vocational studies and matriculation examinations<br>
    Matriculation subjects: Finnish (mother tongue), English, mathematics, and physics
  </div>
</div>

---

## Experience

<div class="cv-exp-row">
  <div class="cv-exp-left">
    <svg class="cv-entry-logo" aria-hidden="true" focusable="false">
      <use class="tuni-halo" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
      <use class="tuni-fill" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
    </svg>  </div>
  <div>
    <strong>Leading Teaching Assistant</strong> — Computer Vision, Tampere University<br>
    Spring 2026
    <ul>
      <li>Coordinated six teaching assistants for approximately 100 students; primary contact for course matters.</li>
      <li>Held solution and exercise sessions, supervised weekly exams, and graded exams and exercises.</li>
    </ul>
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Research Assistant</strong> — Tampere University (ENS / IHA), FUTURA project<br>
    03/2025 – 10/2025
    <ul>
      <li>Worked on imitation learning for hydraulic manipulators using MuJoCo, Isaac Sim, PyTorch, and OpenCV.</li>
      <li>Used pretrained vision backbones and transformer-based policy models.</li>
    </ul>
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Teaching Assistant</strong> — Computer Vision and Programming 3, Tampere University<br>
    Spring 2025
    <ul>
      <li>Computer Vision: supervised exercise sessions and graded both exams and exercises while completing the course.</li>
      <li>Programming 3: supervised Kooditorio help sessions and graded projects.</li>
    </ul>
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left">
    <img class="cv-entry-logo cv-entry-logo--contain cv-entry-logo--dark-outline"
         src="{{ '/images/sportuni-logo.png' | relative_url }}"
         alt=""
         aria-hidden="true">
  </div>
  <div>
    <strong>Sports Hall Supervisor</strong> — SportUni Hervanta<br>
    06/2019 – present<br>
    Part-time facility supervision and customer service alongside university studies
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left">
    <img class="cv-entry-logo"
         src="{{ '/images/tekiila_outlined.svg' | relative_url }}"
         alt=""
         aria-hidden="true">
  </div>
  <div>
    <strong>Climbing Instructor</strong><br>
    2016 – present<br>
    Top-rope and lead climbing instruction; supervision of open climbing sessions
  </div>
</div>

---

## Selected Projects

{% assign selected_projects = site.data.cv_pdf.sections | where: 'type', 'projects' | first %}
<p>{{ selected_projects.introduction }} <a href="{{ '/projects/' | absolute_url }}">Portfolio</a></p>
{% for project in selected_projects.items %}
<h3><a href="{{ project.url }}">{{ project.title }}</a></h3>
<ul>
  {% for detail in project.details %}<li>{{ detail }}</li>{% endfor %}
</ul>
{% endfor %}

---

## Skills

{% assign skills = site.data.cv_pdf.sections | where: 'type', 'skill_groups' | first %}
<div class="cv-skill-groups">
  {% for group in skills.groups %}
  <details class="cv-skill-group">
    <summary>{{ group.title }}</summary>
    <ul>
      {% for item in group.items %}<li>{{ item }}</li>{% endfor %}
    </ul>
  </details>
  {% endfor %}
</div>

---

## Leadership and Positions of Trust

<div class="cv-exp-row">
  <div class="cv-exp-left">
    <img class="cv-entry-logo"
         src="{{ '/images/tekiila_outlined.svg' | relative_url }}"
         alt=""
         aria-hidden="true">
  </div>
  <div>
    <strong>Board Member / Official</strong> — Tekiila<br>
    2017 – 2022, 2025, 2026<br>
    <em>Chairperson in 2018</em>
    <ul>
      <li>Rebuilt the association’s WordPress website with bilingual support and expanded content.</li>
    </ul>
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left">
    <img class="cv-entry-logo"
         src="{{ '/images/turvoke.svg' | relative_url }}"
         alt=""
         aria-hidden="true">
  </div>
  <div>
    <strong>Board Member</strong> — Teekkareiden Urheilu- ja Voimailukerho ry (TUrVoKe)<br>
    2019 – 2021<br>
    <em>Chairperson in 2020</em>
  </div>
</div>

**Operational Auditor (Toiminnantarkastaja)** — Sports associations  
2024 – 2026

---

## Languages

- Finnish (native)
- English (proficient)
- German (intermediate proficiency)
- Swedish (basic proficiency)
- Spanish (basic proficiency)

<script id="cvPdfData" type="application/json">{{ site.data.cv_pdf | jsonify }}</script>
<script src="{{ '/assets/vendor/pdf-lib/1.17.1/pdf-lib.min.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/cv-pdf.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
