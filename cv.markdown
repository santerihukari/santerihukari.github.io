---
layout: page
title: Curriculum Vitae
permalink: /cv/
order: 20
---

## Santeri Hukari

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

<div class="cv-contact-row">
  <span class="cv-label"><strong>Alternative email:</strong></span>
  <code id="email2" class="cv-code">santeri.hukari@gmail.com</code>
  <button class="copy-btn icon-btn" type="button" data-copy-target="email2" aria-label="Copy alternative email" title="Copy">
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

  // Double-click selects entire email only
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

**MSc in Information Technology** *(ongoing)*  
Tampere University  
Expected completion: Spring 2026

- Remaining requirements: Master’s thesis, one course (Speech Processing)  
- Master’s thesis (planned): *Imitation Learning for Hydraulic Manipulators*

**BSc in Information Technology**  
Tampere University  
Graduated: January 2025

- Major: Signal Processing and Machine Learning  
- Bachelor’s thesis: *Comparative Study of Data Efficiency in Vision Transformer and ResNet-18 Architectures: Using CIFAR-10 and TinyImageNet*  
  Thesis grade: 5  
  Link: <a href="https://urn.fi/URN:NBN:fi:tuni-2024121711321" target="_blank" rel="noopener"> urn.fi/URN:NBN:fi:tuni-2024121711321
  </a>

---

## Experience

**Research Assistant** — Tampere University (ENS / IHA), FUTURA project  
03/2025 – 10/2025

- Research focus: imitation learning for hydraulic manipulators

**Teaching Assistant** — Computer Vision, Tampere University  
Spring 2025

**Teaching Assistant** — Programming 3, Tampere University  
Spring 2025

**Leading Teaching Assistant** — Computer Vision, Tampere University  
Spring 2026

**Board Member** — Tekiila  
2017 – 2022, 2025

**Official** — Tekiila  
2026

**Board Member** — Teekkareiden Urheilu- ja Voimailukerho ry (TUrVoKe)  
2019 – 2021

**Sports Hall Supervisor** — SportUni Hervanta  
06/2019 – present

- Facility supervision and customer service

**Climbing Instructor**  
2016 – present

- Instruction of top-rope and lead climbing courses  
- Supervision during open climbing sessions

---

## Projects and Activities

- Managed the construction of a bouldering area in *Bommari* (bomb shelter, Hervanta campus)
- Home device control system using ESP8266 microcontrollers, relay boards, microphone input, Raspberry Pi, and Telegram / web interfaces
- Elementary CAD kernel implemented in Kotlin for a mobile app generating customizable STL models for 3D printing
- Tindeq Progressor–like load cell data logger for finger strength testing and dynamic load measurement (e.g., mid-lift forces at different phases), using an HX711 ADC and a 100 kg S-type load cell; operated via Raspberry Pi/ESP8266 and logging measurement data to a database for multi-device analysis
- This website: Github pages with Jekyll, gallery uses thumbnails and medium sized images hosted on Github, and download button accesses original files from Google Drive. So far I've implemented one new functionality per free evening, so expect more awesome functionalities soon!

---

## Skills

**Programming**
- Python (strong; PyTorch, OpenCV, NumPy, Pandas, ...)
- MATLAB
- C++
- Experience with multiple other programming languages

**Systems and Tools**
- Linux (daily use for over a decade)
- Git (advanced, regular use)

**Domains**
- Machine learning
- Computer vision
- Robotics and manipulation
- Signal processing

---

## Languages

- Finnish (native)
- English (proficient)
- German (limited working proficiency)
- Swedish (limited working proficiency)
- Spanish (limited working proficiency)
