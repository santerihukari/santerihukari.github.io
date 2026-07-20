---
layout: page
title: Face Detection
permalink: /face_detection/
parent: projects
nav_order: 4
nav_exclude: true
---

<style>
  .fd-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 920px) {
    .fd-grid { grid-template-columns: 1fr; }
  }

  .fd-card {
    border: 1px solid var(--border, #e5e7eb);
    background: var(--card, #fff);
    border-radius: 14px;
    padding: 14px;
  }

  .fd-stack {
    display: grid;
    gap: 12px;
  }

  .fd-title {
    margin: 0;
    font-size: 1rem;
  }

  .fd-muted {
    color: var(--muted, #6b7280);
    font-size: 0.94rem;
    line-height: 1.45;
  }

  .fd-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fd-btn,
  .fd-file {
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border, #d1d5db);
    background: var(--card, #fff);
    color: var(--fg, #111827);
    cursor: pointer;
    font: inherit;
  }

  .fd-btn[disabled] {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .fd-row {
    display: grid;
    gap: 6px;
  }

  .fd-row label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.95rem;
  }

  .fd-row input[type="range"] {
    width: 100%;
  }

  .fd-statlist {
    display: grid;
    gap: 8px;
  }

  .fd-stat {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.95rem;
    border-top: 1px solid var(--border, #e5e7eb);
    padding-top: 8px;
  }

  .fd-view {
    position: relative;
    min-height: min(72vh, 760px);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 16px;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.15), transparent 40%),
      linear-gradient(160deg, #04111c 0%, #071827 48%, #091d24 100%);
  }

  .fd-stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .fd-media-frame {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
  }

  .fd-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: none;
  }

  .fd-media.is-active {
    display: block;
  }

  .fd-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .fd-placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    text-align: center;
    color: rgba(255, 255, 255, 0.86);
  }

  .fd-placeholder.is-hidden {
    display: none;
  }

  .fd-placeholder-inner {
    max-width: 520px;
  }

  .fd-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.42);
    font-size: 0.9rem;
    backdrop-filter: blur(10px);
  }

  .fd-status {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 2;
  }

  .fd-note {
    position: absolute;
    right: 14px;
    bottom: 14px;
    z-index: 2;
    max-width: min(430px, calc(100% - 28px));
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.38);
    color: rgba(255, 255, 255, 0.82);
    font-size: 0.9rem;
    line-height: 1.35;
    backdrop-filter: blur(8px);
  }

  .fd-view.is-mirrored .fd-media,
  .fd-view.is-mirrored .fd-overlay {
    transform: scaleX(-1);
  }

  .fd-select {
    width: 100%;
    padding: 0.65rem 0.8rem;
    border-radius: 10px;
    border: 1px solid var(--border, #d1d5db);
    background: var(--card, #fff);
    color: var(--fg, #111827);
    font: inherit;
  }
</style>

This page runs a lightweight **browser-side face detector** using **MediaPipe Tasks Vision**. The demo supports live webcam input and uploaded still images, then draws **bounding boxes** and **facial keypoints** directly in the browser.

The current version focuses on real-time detection rather than recognition or identity. Everything runs client-side after the model assets load.

<div class="fd-grid">
  <div class="fd-card fd-stack">
    <div>
      <h3 class="fd-title">Controls</h3>
      <div class="fd-muted">Start the webcam or upload an image. You can switch between face detection and semantic image segmentation directly in the browser.</div>
    </div>

    <div class="fd-row">
      <label for="fd-task-select">
        <span>Model / task</span>
      </label>
      <select class="fd-select" id="fd-task-select">
        <option value="face">Face detector</option>
        <option value="segment">Image segmenter</option>
      </select>
    </div>

    <div class="fd-actions">
      <button class="fd-btn" id="fd-start" type="button">Start camera</button>
      <button class="fd-btn" id="fd-stop" type="button" disabled>Stop</button>
      <label class="fd-file" for="fd-file-input">Upload image</label>
      <input id="fd-file-input" type="file" accept="image/*" hidden>
    </div>

    <div class="fd-row" id="fd-detection-controls">
      <label for="fd-min-confidence">
        <span>Min confidence</span>
        <span id="fd-min-confidence-value">0.50</span>
      </label>
      <input id="fd-min-confidence" type="range" min="0.1" max="0.95" step="0.05" value="0.5">
    </div>

    <div class="fd-row">
      <label for="fd-suppression">
        <span>Suppression</span>
        <span id="fd-suppression-value">0.30</span>
      </label>
      <input id="fd-suppression" type="range" min="0.1" max="0.95" step="0.05" value="0.3">
    </div>

    <div class="fd-row">
      <label>
        <span>Mirror webcam</span>
        <input id="fd-mirror" type="checkbox" checked>
      </label>
    </div>

    <div class="fd-statlist">
      <div class="fd-stat"><span>Mode</span><strong id="fd-mode">Idle</strong></div>
      <div class="fd-stat"><span>Faces</span><strong id="fd-face-count">0</strong></div>
      <div class="fd-stat"><span>Last inference</span><strong id="fd-latency">-</strong></div>
      <div class="fd-stat"><span>Model</span><strong id="fd-model-label">BlazeFace short-range</strong></div>
    </div>

    <div class="fd-muted" id="fd-help">
      Camera access stays in the browser. If live mode feels choppy, try a still image first or reduce other GPU-heavy tabs.
    </div>
  </div>

  <div class="fd-view" id="fd-view">
    <div class="fd-status fd-badge" id="fd-status">Ready.</div>

    <div class="fd-stage">
      <div class="fd-media-frame" id="fd-media-frame">
        <video class="fd-media" id="fd-video" playsinline autoplay muted></video>
        <img class="fd-media" id="fd-image" alt="Uploaded image for browser vision demo">
        <canvas class="fd-overlay" id="fd-overlay"></canvas>
      </div>
    </div>

    <div class="fd-placeholder" id="fd-placeholder">
      <div class="fd-placeholder-inner">
        <div class="fd-badge" style="margin-bottom: 14px;">Browser neural net demo</div>
        <p style="margin:0;font-size:1.05rem;line-height:1.55;">
          Start the webcam or upload an image to run real-time face detection locally in the browser.
        </p>
      </div>
    </div>

    <div class="fd-note">
      <span id="fd-note-text">Output shows a face bounding box and six keypoints per face: both eyes, nose tip, mouth center, and both ear-side tragion points.</span>
    </div>
  </div>
</div>

<script type="module" src="{{ '/assets/js/face-detection-demo.js' | relative_url }}"></script>
