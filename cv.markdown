---
layout: page
title: CV
permalink: /cv/
order: 20
nav_id: cv
nav_order: 20
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
    Expected graduation: 2026<br>
    Remaining requirements: Master’s thesis, one course (Speech Processing)<br>
    Master’s thesis (in progress): <em>Imitation Learning for Hydraulic Manipulators</em>
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

<div class="cv-entry cv-entry--edu">
  <img class="cv-entry-logo cv-entry-logo--contain cv-entry-logo--dark-outline"
       src="{{ '/images/kpedu-logo-light.png' | relative_url }}"
       alt=""
       aria-hidden="true">
  <div>
    <strong>Vocational Qualification in Business Information Technology (Datanomi)</strong><br>
    Keski-Pohjanmaan ammattiopisto (Kpedu)<br>
    2013 – 2016<br>
    Work-based learning placements (one month each): Konecranes Shanghai, Kletterzentrum Siegerland, Datafix, and Keskikaista<br>
    Recognition: Top student of the 2016 graduating class
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
    <strong>General Upper Secondary Studies</strong><br>
    Kokkolan ammattilukio<br>
    2014 – 2016<br>
    Completed alongside the vocational qualification
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

## Skills

<div class="cv-skill-groups">
  <details class="cv-skill-group">
    <summary>Programming and Software Engineering</summary>
    <ul>
      <li>Python — strong proficiency; PyTorch, OpenCV, NumPy, and Pandas</li>
      <li>C++ and MATLAB; project experience with Kotlin</li>
      <li>Algorithms, data structures, and numerical computing</li>
      <li>Software debugging, testing, and memory-error analysis</li>
      <li>Automation, API integration, and data-processing pipelines</li>
      <li>Additional familiarity with C, R, Scala, Haskell, Lua, and Bash</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>AI-Assisted Engineering and Orchestration</summary>
    <ul>
      <li>Advanced proficiency with Codex, ChatGPT, and Antigravity for software development and technical workflows</li>
      <li>Task decomposition, project-specific instructions, and context management</li>
      <li>Coordination of implementation, testing, documentation, and integration across projects and tools</li>
      <li>AI-assisted LaTeX document generation and automated document-production workflows</li>
      <li>System orchestration connecting AI tools, scripts, applications, and data-processing pipelines</li>
      <li>Integration of AI into CAD model generation, photogrammetry, 3D reconstruction, and physical prototyping</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Web Development and Systems</summary>
    <ul>
      <li>Full-stack web development — HTML, CSS, JavaScript, and PHP</li>
      <li>WordPress, Jekyll, and GitHub Pages</li>
      <li>Additional familiarity with React and Node.js</li>
      <li>UI/UX design and responsive, interactive web interfaces</li>
      <li>SQL and SQLite; database-backed applications and measurement logging</li>
      <li>Linux — over a decade of active use</li>
      <li>Git — advanced, regular use</li>
      <li>GitHub Actions and automated deployment workflows</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Machine Learning, Data, and Research</summary>
    <ul>
      <li>Deep learning, convolutional neural networks, and transformer models</li>
      <li>Computer vision, image processing, and signal processing</li>
      <li>Imitation learning and policy models for robotic manipulation</li>
      <li>Time-series forecasting and ensemble modeling</li>
      <li>Data preprocessing, experimental design, and model benchmarking</li>
      <li>Validation practices that prevent data leakage</li>
      <li>Scientific writing and technical documentation using LaTeX and Overleaf</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Embedded Systems and Instrumentation</summary>
    <ul>
      <li>Teensy 4.1, ESP8266/ESP32, and Raspberry Pi development</li>
      <li>Sensor integration, data acquisition, and measurement systems</li>
      <li>MQTT communication, telemetry, and analysis of recorded sensor data</li>
      <li>Hardware–software integration and communication-protocol reverse engineering</li>
      <li>Electronics prototyping, soldering, and electrical fault diagnosis</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Computational Geometry and Prototyping</summary>
    <ul>
      <li>CAD modeling, parametric design, and iterative physical prototyping</li>
      <li>CAD-kernel development, boundary representation, and STL generation</li>
      <li>Browser-based CAD with OpenCascade and WebAssembly</li>
      <li>Photogrammetry and 3D reconstruction</li>
      <li>3D printing and model optimization for fabrication</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Mechanical and Practical Skills</summary>
    <ul>
      <li>Automotive maintenance, repair, and systematic fault diagnosis</li>
      <li>Brake-system servicing, timing-belt replacement, and rust repair</li>
      <li>Bicycle maintenance, repair, and wheel building</li>
      <li>Mechanical assembly, component selection, and compatibility assessment</li>
      <li>Troubleshooting interactions between mechanical, electrical, and control systems</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Teaching, Communication, and Coordination</summary>
    <ul>
      <li>University teaching in computer vision and programming</li>
      <li>Technical explanation, student guidance, and instructional support</li>
      <li>Teaching-team coordination and task allocation</li>
      <li>Project coordination, association leadership, and event organization</li>
      <li>Climbing instruction and group supervision</li>
    </ul>
  </details>

  <details class="cv-skill-group">
    <summary>Photography and Digital Imaging</summary>
    <ul>
      <li>Sports, action, and event photography</li>
      <li>Photo selection, RAW processing, and batch-editing workflows</li>
      <li>Online galleries, image-processing pipelines, and client delivery</li>
    </ul>
  </details>
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
* Managed the construction of a [bouldering area in **Bommari**](https://www.tekiila.fi/en/bommari-en/) (bomb shelter, Hervanta campus).
* Home device control system using ESP8266 microcontrollers, relay boards, microphone input, Raspberry Pi, and Telegram / web interfaces.
* **[Portable fingerboard](https://santerihukari.github.io/stl/)**: Optimized for minimal plastic use; latest model uses ~25 g of PLA, withstands 70 kg training loads without structural fatigue, and features a wooden finger-contact surface.
* **[Tindeq Progressor](https://tindeq.com/product/progressor/)–like load cell data logger**: For finger strength testing and dynamic load measurement using an HX711 ADC and a 100 kg S-type load cell; operated via Raspberry Pi/ESP8266 and logging measurement data to a database for multi-device analysis.
* **Personal website**: Built with Jekyll and deployed via GitHub Actions; includes a custom gallery with zoomable lightbox navigation, downloadable full-resolution images, STL model previews, a browser-based parametric CAD tool for printable models, and course/topic filtering.

---

## Languages

- Finnish (native)
- English (proficient)
- German (intermediate proficiency)
- Swedish (basic proficiency)
- Spanish (basic proficiency)
