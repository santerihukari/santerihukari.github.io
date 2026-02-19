---
layout: page
title: Curriculum Vitae
permalink: /cv/
order: 20
---

## Santeri Hukari

<p><strong>Location:</strong> Tampere, Finland</p>

<p>
  <strong>Email:</strong>
  <code id="email1">santeri.hukari@tuni.fi</code>
  <button class="copy-btn" type="button" data-copy-target="email1" aria-label="Copy email">Copy</button>
</p>

<p>
  <strong>Alternative email:</strong>
  <code id="email2">santeri.hukari@gmail.com</code>
  <button class="copy-btn" type="button" data-copy-target="email2" aria-label="Copy alternative email">Copy</button>
</p>

<p>
  <strong>GitHub:</strong>
  <a href="https://github.com/santerihukari" target="_blank" rel="noopener">github.com/santerihukari</a>
</p>

<p>
  <strong>LinkedIn:</strong>
  <a href="https://www.linkedin.com/in/santerihukari/" target="_blank" rel="noopener">linkedin.com/in/santerihukari</a>
</p>

<script>
  (function () {
    function setButtonState(btn, text) {
      const old = btn.textContent;
      btn.textContent = text;
      setTimeout(() => (btn.textContent = old), 1200);
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
        setButtonState(btn, 'Copied');
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setButtonState(btn, 'Copied');
      }
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
- *[Optional: add MSc specialization/track]*  

**BSc in Information Technology**  
Tampere University  
Graduated: January 2025

- Major: Signal Processing and Machine Learning  
- Bachelor’s thesis:  
  *Comparative Study of Data Efficiency in Vision Transformer and ResNet-18 Architectures: Using CIFAR-10 and TinyImageNet*  
  Grade: 5  
  Link:
<a href="https://urn.fi/URN:NBN:fi:tuni-2024121711321" target="_blank" rel="noopener">
  urn.fi/URN:NBN:fi:tuni-2024121711321
</a>
---

## Experience

**Research Assistant** — Tampere University (ENS / IHA), FUTURA project  
03/2025 – 10/2025

- Research focus: imitation learning for hydraulic manipulators  
- *[Add methods/tools/outcomes if desired]*

**Teaching Assistant** — Computer Vision, Tampere University  
Spring 2025

**Teaching Assistant** — Programming 3, Tampere University  
Spring 2025

**Leading Teaching Assistant** — Computer Vision, Tampere University  
Spring 2026

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

---

## Skills

**Programming**
- Python (strong; PyTorch, OpenCV, NumPy, Pandas)
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

- *[Add languages and proficiency]*
