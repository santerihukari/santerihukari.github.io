---
layout: page
title: CV
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

<div class="cv-entry cv-entry--edu">
  <svg class="cv-entry-logo" aria-hidden="true" focusable="false">
    <use class="tuni-halo" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
    <use class="tuni-fill" href="{{ '/images/icons.svg#tuni-mark' | relative_url }}"></use>
  </svg>
  <div>
    <strong>MSc in Information Technology</strong> <em>(ongoing)</em><br>
    Tampere University<br>
    Expected completion: Spring 2026<br>
    Remaining requirements: Master’s thesis, one course (Speech Processing)<br>
    Master’s thesis (planned): <em>Imitation Learning for Hydraulic Manipulators</em>
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
    Bachelor’s thesis: <em>Comparative Study of Data Efficiency in Vision Transformer and ResNet-18 Architectures: Using CIFAR-10 and TinyImageNet</em><br>
    Thesis grade: 5<br>
    Link: <a href="https://urn.fi/URN:NBN:fi:tuni-2024121711321" target="_blank" rel="noopener">urn.fi/URN:NBN:fi:tuni-2024121711321</a>
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
    <strong>Research Assistant</strong> — Tampere University (ENS / IHA), FUTURA project<br>
    03/2025 – 10/2025<br>
    Research focus: imitation learning for hydraulic manipulators
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Teaching Assistant</strong> — Computer Vision, Tampere University<br>
    Spring 2025
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Teaching Assistant</strong> — Programming 3, Tampere University<br>
    Spring 2025
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Leading Teaching Assistant</strong> — Computer Vision, Tampere University<br>
    Spring 2026
  </div>
</div>

<div class="cv-exp-row">
  <div class="cv-exp-left"></div>
  <div>
    <strong>Sports Hall Supervisor</strong> — SportUni Hervanta<br>
    06/2019 – present<br>
    Facility supervision and customer service
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
    Instruction of top-rope and lead climbing courses<br>
    Supervision during open climbing sessions
  </div>
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
      <li>Redesigned and rebuilt the association’s website: new WordPress theme, bilingual support, and substantial content expansion.</li>
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

## Projects and Activities

* **[Parametric CAD Tool (Wasm)](https://santerihukari.github.io/stl_param/)**: Developed a web-based CAD configurator utilizing the **OpenCascade** kernel compiled to **WebAssembly**. Supports real-time B-rep (Boundary Representation) modeling for generating 3D-printable STLs of climbing equipment and organizers directly in the browser.
* Managed the construction of a bouldering area in **Bommari** (bomb shelter, Hervanta campus).
* Home device control system using ESP8266 microcontrollers, relay boards, microphone input, Raspberry Pi, and Telegram / web interfaces.
* **[Portable fingerboard](https://santerihukari.github.io/stl/)**: Optimized for minimal plastic use; latest model uses ~25 g of PLA, withstands 70 kg training loads without structural fatigue, and features a wooden finger-contact surface.
* **[Tindeq Progressor](https://tindeq.com/product/progressor/)–like load cell data logger**: For finger strength testing and dynamic load measurement using an HX711 ADC and a 100 kg S-type load cell; operated via Raspberry Pi/ESP8266 and logging measurement data to a database for multi-device analysis.
* **Personal website**: Built with GitHub Pages and Jekyll; custom gallery with thumbnail/medium image pipeline and external file delivery via Google Drive; ongoing iterative development with regular feature additions.
* **Kaggle forecasting competition — [Hull Tactical: Market Prediction](https://www.kaggle.com/competitions/hull-tactical-market-prediction)**: Stability-focused, leak-free ensemble model for market exposure control; **ranked 26 / 3,677 teams (top 0.7%) on the live leaderboard as of March 2026**, with submissions closed and evaluation continuing on realized market data.

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

**Other**
- 3D printing
- CAD modeling

---

## Languages

- Finnish (native)
- English (proficient)
- German (limited working proficiency)
- Swedish (limited working proficiency)
- Spanish (limited working proficiency)
