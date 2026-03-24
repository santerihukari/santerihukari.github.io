---
layout: page
title: Eye Direction
permalink: /eye_direction/
parent: projects
nav_order: 6
nav_exclude: true
---

<style>
  .ed-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 960px) {
    .ed-grid { grid-template-columns: 1fr; }
  }

  .ed-card {
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    border-radius: 14px;
    padding: 14px;
  }

  .ed-stack {
    display: grid;
    gap: 12px;
  }

  .ed-muted {
    color: var(--muted, #6b7280);
    font-size: 0.94rem;
    line-height: 1.45;
  }

  .ed-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ed-btn {
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border, #d1d5db);
    background: var(--card, #fff);
    color: var(--fg, #111827);
    cursor: pointer;
    font: inherit;
  }

  .ed-btn[disabled] {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ed-statlist {
    display: grid;
    gap: 8px;
  }

  .ed-stat {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.95rem;
    border-top: 1px solid var(--border, #e5e7eb);
    padding-top: 8px;
  }

  .ed-view {
    position: relative;
    min-height: min(76vh, 820px);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 18px;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(56, 189, 248, 0.16), transparent 36%),
      linear-gradient(160deg, #08121c 0%, #0d1724 48%, #0f1e2d 100%);
  }

  .ed-stage {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .ed-video-shell {
    position: relative;
    width: min(88%, 1020px);
    aspect-ratio: 16 / 10;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    background: rgba(0, 0, 0, 0.34);
  }

  .ed-video-shell video,
  .ed-video-shell canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .ed-video-shell video {
    object-fit: cover;
    transform: scaleX(-1);
  }

  .ed-video-shell canvas {
    pointer-events: none;
    transform: scaleX(-1);
  }

  .ed-badge {
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

  .ed-status {
    position: absolute;
    left: 14px;
    top: 14px;
    z-index: 2;
  }

  .ed-panel {
    position: absolute;
    right: 14px;
    bottom: 14px;
    z-index: 2;
    max-width: min(420px, calc(100% - 28px));
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(0, 0, 0, 0.42);
    color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
  }

  .ed-meter {
    display: grid;
    gap: 8px;
  }

  .ed-bar {
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .ed-bar-fill {
    height: 100%;
    width: 50%;
    border-radius: inherit;
    background: linear-gradient(90deg, #38bdf8 0%, #34d399 100%);
    transform-origin: left center;
  }
</style>

This page experiments with **coarse eye/head direction estimation** in the browser. It uses MediaPipe’s **Face Landmarker** to track a face mesh and then estimates left/right and up/down attention from iris placement inside the eyes.

This is **not calibrated gaze tracking**. It is only a rough directional estimate, but it is useful for testing whether eye-direction-like interaction feels feasible on a laptop webcam.

<div class="ed-grid">
  <div class="ed-card ed-stack">
    <div class="ed-muted">
      Start the webcam and look around naturally. The page tracks both irises and reports a coarse direction estimate. Good lighting helps a lot.
    </div>

    <div class="ed-actions">
      <button class="ed-btn" id="ed-start" type="button">Start camera</button>
      <button class="ed-btn" id="ed-stop" type="button" disabled>Stop</button>
    </div>

    <div class="ed-statlist">
      <div class="ed-stat"><span>Direction</span><strong id="ed-direction">-</strong></div>
      <div class="ed-stat"><span>Horizontal</span><strong id="ed-horizontal">0.00</strong></div>
      <div class="ed-stat"><span>Vertical</span><strong id="ed-vertical">0.00</strong></div>
      <div class="ed-stat"><span>Face confidence</span><strong id="ed-confidence">-</strong></div>
      <div class="ed-stat"><span>Inference</span><strong id="ed-latency">-</strong></div>
    </div>

    <div class="ed-muted" id="ed-help">
      This estimate combines iris position and eye corners. It should be treated as a rough directional cue, not as reliable gaze tracking.
    </div>
  </div>

  <div class="ed-view">
    <div class="ed-status ed-badge" id="ed-status">Ready.</div>

    <div class="ed-stage">
      <div class="ed-video-shell">
        <video id="ed-video" playsinline autoplay muted></video>
        <canvas id="ed-overlay"></canvas>
      </div>
    </div>

    <div class="ed-panel">
      <div style="font-weight:600; margin-bottom: 8px;" id="ed-direction-text">No face tracked yet.</div>
      <div class="ed-meter">
        <div>
          <div style="font-size:0.85rem; opacity:.8; margin-bottom:4px;">Left / right</div>
          <div class="ed-bar"><div class="ed-bar-fill" id="ed-bar-x"></div></div>
        </div>
        <div>
          <div style="font-size:0.85rem; opacity:.8; margin-bottom:4px;">Up / down</div>
          <div class="ed-bar"><div class="ed-bar-fill" id="ed-bar-y"></div></div>
        </div>
      </div>
    </div>
  </div>
</div>

<script type="module" src="{{ '/assets/js/eye-direction-demo.js' | relative_url }}"></script>
