---
layout: page
title: Hand Gesture Gallery
permalink: /hand_gesture_gallery/
parent: projects
nav_order: 5
---

<style>
  .page-content .wrapper {
    max-width: min(1680px, calc(100vw - 48px));
  }

  .hg-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .hg-card {
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    border-radius: 14px;
    padding: 14px;
  }

  .hg-stack {
    display: grid;
    gap: 12px;
  }

  @media (min-width: 1100px) {
    .hg-card.hg-stack {
      grid-template-columns: minmax(320px, 1.4fr) minmax(220px, 0.9fr) minmax(260px, 1fr);
      align-items: start;
    }
  }

  .hg-muted {
    color: var(--muted, #6b7280);
    font-size: 0.94rem;
    line-height: 1.45;
  }

  .hg-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hg-btn {
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border, #d1d5db);
    background: var(--card, #fff);
    color: var(--fg, #111827);
    cursor: pointer;
    font: inherit;
  }

  .hg-btn[disabled] {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .hg-statlist {
    display: grid;
    gap: 8px;
  }

  .hg-stat {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.95rem;
    border-top: 1px solid var(--border, #e5e7eb);
    padding-top: 8px;
  }

  .hg-map {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px solid var(--border, #e5e7eb);
    font-size: 0.92rem;
  }

  .hg-map strong {
    display: inline-block;
    min-width: 96px;
  }

  .hg-view {
    position: relative;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 18px;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(56, 189, 248, 0.18), transparent 36%),
      linear-gradient(160deg, #04111c 0%, #091827 52%, #101a28 100%);
  }

  .hg-stage {
    position: relative;
    display: grid;
    gap: 14px;
    padding: 14px;
  }

  .hg-status {
    position: absolute;
    left: 14px;
    top: 14px;
    z-index: 2;
  }

  .hg-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.42);
    color: #fff;
    font-size: 0.92rem;
    backdrop-filter: blur(10px);
  }

  .hg-preview {
    position: relative;
    min-height: min(76vh, 860px);
    padding-top: 42px;
  }

  .hg-stage-frame {
    position: relative;
    min-height: min(70vh, 760px);
    border-radius: 18px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .hg-stage-surface,
  .hg-overview {
    position: absolute;
    inset: 0;
  }

  .hg-stage-surface {
    display: grid;
    place-items: center;
    padding: 18px;
    z-index: 1;
  }

  .hg-overview {
    columns: 180px 3;
    column-gap: 12px;
    overflow: auto;
    padding: 18px;
    background: rgba(6, 18, 30, 0.96);
    backdrop-filter: blur(10px);
    z-index: 2;
  }

  .hg-overview[hidden] {
    display: none !important;
  }

  .hg-overview-item {
    display: block;
    width: 100%;
    margin: 0 0 12px;
    break-inside: avoid;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(0, 0, 0, 0.28);
    border-radius: 14px;
    overflow: hidden;
    padding: 0;
    cursor: pointer;
  }

  .hg-overview-item.is-active {
    border-color: rgba(54, 243, 162, 0.95);
    box-shadow: 0 0 0 2px rgba(54, 243, 162, 0.2);
  }

  .hg-overview-item.is-hovered {
    border-color: rgba(255, 179, 71, 0.95);
    box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.22);
  }

  .hg-overview-item img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    background: rgba(255, 255, 255, 0.04);
  }

  .hg-overview-item span {
    display: block;
    padding: 0.6rem 0.7rem 0.8rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.9);
    text-align: left;
  }

  .hg-figure {
    position: relative;
    width: fit-content;
    max-width: 100%;
    margin: 0;
    transition: transform 180ms ease;
    transform-origin: center center;
  }

  .hg-figure img {
    display: block;
    width: auto;
    max-width: min(100%, 1320px);
    max-height: min(66vh, 760px);
    object-fit: contain;
    border-radius: 16px;
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.32);
    background: rgba(255, 255, 255, 0.05);
  }

  .hg-lower {
    display: grid;
    grid-template-columns: 1.4fr 280px;
    gap: 14px;
    align-items: start;
  }

  @media (max-width: 860px) {
    .hg-lower { grid-template-columns: 1fr; }
  }

  .hg-meta,
  .hg-camera-shell {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(0, 0, 0, 0.42);
    color: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    border-radius: 14px;
  }

  .hg-meta {
    padding: 12px 14px;
  }

  .hg-meta p {
    margin: 0.3rem 0 0 0;
    font-size: 0.92rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.82);
  }

  .hg-camera-shell {
    position: relative;
    width: min(100%, 280px);
    justify-self: end;
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }

  .hg-camera-shell video,
  .hg-camera-shell canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hg-camera-shell video {
    object-fit: cover;
    transform: scaleX(-1);
  }

  .hg-camera-shell canvas {
    pointer-events: none;
    transform: scaleX(-1);
  }

  .hg-command {
    width: 100%;
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    color: var(--fg, #111827);
  }

  .hg-meta-top {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }

  .hg-download {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    min-height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.95);
    text-decoration: none;
    background: rgba(255, 255, 255, 0.06);
  }

  .hg-download:hover,
  .hg-download:focus-visible {
    color: rgba(255, 255, 255, 1);
    border-color: rgba(54, 243, 162, 0.75);
    text-decoration: none;
  }
</style>

This page prototypes **hand-gesture control for the photography gallery**. It uses MediaPipe's **Gesture Recognizer** to detect canned gestures and combines them with movement for gallery-like actions.

The current command mapping is:
- `Thumb_Up` on right side -> next image
- `Thumb_Up` on left side -> previous image
- `Pointing_Up` with one hand -> pan image like a joystick
- `Pointing_Up` with two hands -> zoom based on fingertip distance
- zoom out beyond the single-image view -> whole gallery overview
- `Closed_Fist` with both hands -> reset zoom and pan

This is a sandbox page rather than a direct modification of the photography gallery, so we can test gesture reliability and cooldown behavior first.

{% assign photos = site.data.gallery.photos %}
<script type="application/json" id="hg-photo-data">
[
{% for p in photos %}
  {
    "name": {{ p.name | jsonify }},
    "thumb": {{ p.thumb | prepend: "/" | relative_url | jsonify }},
    "full": {{ p.full | prepend: "/" | relative_url | jsonify }},
    "description": {{ p.description | default: "" | jsonify }},
    "captured_at": {{ p.captured_at | default: "" | jsonify }},
    "download": {% if p.drive_id %}{{ "https://drive.google.com/uc?export=download&id=" | append: p.drive_id | jsonify }}{% else %}""{% endif %}
  }{% unless forloop.last %},{% endunless %}
{% endfor %}
]
</script>

<div class="hg-grid">
  <div class="hg-card hg-stack">
    <div class="hg-muted">
      Start the webcam, give a thumbs up on the left or right side to switch photos, point with one index finger to steer the zoomed image, and use two pointing index fingers together or apart to control zoom. Zooming out past the single-image state opens an overview of the whole gallery.
    </div>

    <div class="hg-actions">
      <button class="hg-btn" id="hg-start" type="button">Start camera</button>
      <button class="hg-btn" id="hg-stop" type="button" disabled>Stop</button>
      <button class="hg-btn" id="hg-prev" type="button">Previous</button>
      <button class="hg-btn" id="hg-next" type="button">Next</button>
      <button class="hg-btn" id="hg-zoom" type="button">Reset zoom</button>
    </div>

    <div class="hg-statlist">
      <div class="hg-stat"><span>Gesture</span><strong id="hg-gesture">-</strong></div>
      <div class="hg-stat"><span>Cooldown</span><strong id="hg-cooldown">Ready</strong></div>
      <div class="hg-stat"><span>Action</span><strong id="hg-action">Waiting</strong></div>
      <div class="hg-stat"><span>Photo</span><strong id="hg-photo-index">1 / {{ photos.size }}</strong></div>
      <div class="hg-stat"><span>Inference</span><strong id="hg-latency">-</strong></div>
    </div>

    <div class="hg-map">
      <div><strong>Thumb_Up</strong> left / right side for previous / next</div>
      <div><strong>Pointing_Up</strong> one finger acts like a pan joystick</div>
      <div><strong>Two Pointing_Up</strong> closer together zooms in</div>
      <div><strong>Zoom out fully</strong> opens the whole gallery</div>
      <div><strong>Pointing in overview</strong> highlights a photo</div>
      <div><strong>Two Closed_Fist</strong> reset zoom and pan</div>
      <div><strong>Mouse / trackpad</strong> wheel zoom and drag pan also work</div>
    </div>

    <div class="hg-muted" id="hg-help">
      The recognizer is using canned gestures from MediaPipe. False positives are possible, so this page includes a cooldown and a short hold requirement before a gesture becomes active.
    </div>
  </div>

  <div>
    <div class="hg-view">
      <div class="hg-stage">
        <div class="hg-status hg-badge" id="hg-status">Ready.</div>

        <div class="hg-preview">
          <div class="hg-stage-frame" id="hg-stage-frame">
            <div class="hg-stage-surface" id="hg-stage-surface">
              <figure class="hg-figure" id="hg-figure">
                <img id="hg-image" alt="">
              </figure>
            </div>
            <div class="hg-overview" id="hg-overview" hidden></div>
          </div>
        </div>

        <div class="hg-lower">
          <aside class="hg-meta">
            <div class="hg-meta-top">
              <strong id="hg-title">Photo preview</strong>
              <a class="hg-download" id="hg-download" href="#" target="_blank" rel="noopener" aria-label="Download original">&#8595;</a>
            </div>
            <p id="hg-description"></p>
          </aside>

          <div class="hg-camera-shell">
            <video id="hg-video" playsinline autoplay muted></video>
            <canvas id="hg-overlay"></canvas>
          </div>
        </div>

      </div>
    </div>

    <div class="hg-command" id="hg-command">
      Use thumbs up to navigate, one pointing finger for pan or overview highlight, and two pointing fingers for zoom or opening a highlighted image.
    </div>
  </div>
</div>

<script type="module" src="{{ '/assets/js/hand-gesture-gallery-demo.js' | relative_url }}"></script>
