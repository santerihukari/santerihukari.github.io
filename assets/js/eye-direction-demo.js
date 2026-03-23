import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-tasks/face_landmarker/face_landmarker.task";

const RIGHT_EYE = {
  irisCenter: 468,
  leftCorner: 33,
  rightCorner: 133,
  top: 159,
  bottom: 145
};

const LEFT_EYE = {
  irisCenter: 473,
  leftCorner: 362,
  rightCorner: 263,
  top: 386,
  bottom: 374
};

const FACE_CONF_LANDMARKS = [1, 33, 133, 263, 362, 152];

const els = {
  start: document.getElementById("ed-start"),
  stop: document.getElementById("ed-stop"),
  video: document.getElementById("ed-video"),
  overlay: document.getElementById("ed-overlay"),
  status: document.getElementById("ed-status"),
  direction: document.getElementById("ed-direction"),
  directionText: document.getElementById("ed-direction-text"),
  horizontal: document.getElementById("ed-horizontal"),
  vertical: document.getElementById("ed-vertical"),
  confidence: document.getElementById("ed-confidence"),
  latency: document.getElementById("ed-latency"),
  barX: document.getElementById("ed-bar-x"),
  barY: document.getElementById("ed-bar-y")
};

const ctx = els.overlay.getContext("2d");

const state = {
  vision: null,
  landmarker: null,
  stream: null,
  rafId: 0,
  lastVideoTime: -1
};

function setStatus(message) {
  els.status.textContent = message;
}

function setLatency(ms) {
  els.latency.textContent = typeof ms === "number" ? `${ms.toFixed(1)} ms` : "-";
}

function clearOverlay() {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
}

function syncCanvas() {
  const width = els.video.videoWidth || els.video.clientWidth;
  const height = els.video.videoHeight || els.video.clientHeight;
  if (!width || !height) return false;
  if (els.overlay.width !== width) els.overlay.width = width;
  if (els.overlay.height !== height) els.overlay.height = height;
  return true;
}

function pointFromIndex(landmarks, index) {
  const p = landmarks[index];
  return p ? { x: p.x * els.overlay.width, y: p.y * els.overlay.height } : null;
}

function ratio(value, min, max) {
  const span = max - min;
  if (Math.abs(span) < 1e-6) return 0.5;
  return (value - min) / span;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function computeEyeSignal(landmarks, eye) {
  const center = pointFromIndex(landmarks, eye.irisCenter);
  const a = pointFromIndex(landmarks, eye.leftCorner);
  const b = pointFromIndex(landmarks, eye.rightCorner);
  const top = pointFromIndex(landmarks, eye.top);
  const bottom = pointFromIndex(landmarks, eye.bottom);

  if (!center || !a || !b || !top || !bottom) return null;

  return {
    xRatio: ratio(center.x, a.x, b.x),
    yRatio: ratio(center.y, top.y, bottom.y),
    points: { center, a, b, top, bottom }
  };
}

function drawEyeGuide(eyeSignal) {
  if (!eyeSignal) return;
  const { center, a, b, top, bottom } = eyeSignal.points;

  ctx.strokeStyle = "#36f3a2";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.stroke();

  ctx.fillStyle = "#fff6a2";
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
  ctx.fill();
}

function estimateDirection(horizontal, vertical) {
  const h =
    horizontal < -0.12 ? "left" :
    horizontal > 0.12 ? "right" :
    "center";

  const v =
    vertical < -0.1 ? "up" :
    vertical > 0.1 ? "down" :
    "center";

  if (h === "center" && v === "center") return "center";
  if (h === "center") return v;
  if (v === "center") return h;
  return `${v}-${h}`;
}

function updateMeters(horizontal, vertical) {
  const xNorm = clamp(0.5 + horizontal, 0, 1);
  const yNorm = clamp(0.5 + vertical, 0, 1);
  els.barX.style.width = `${xNorm * 100}%`;
  els.barY.style.width = `${yNorm * 100}%`;
  els.horizontal.textContent = horizontal.toFixed(2);
  els.vertical.textContent = vertical.toFixed(2);
}

function computeFaceConfidence(landmarks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const index of FACE_CONF_LANDMARKS) {
    const p = pointFromIndex(landmarks, index);
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (!isFinite(minX)) return 0;
  const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const normalized = area / Math.max(1, els.overlay.width * els.overlay.height);
  return clamp(normalized * 8, 0, 1);
}

async function ensureLandmarker() {
  if (!state.landmarker) {
    setStatus("Loading face landmarker...");
    state.vision = state.vision || await FilesetResolver.forVisionTasks(WASM_ROOT);
    state.landmarker = await FaceLandmarker.createFromOptions(state.vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
    setStatus("Face landmarker ready.");
  }
  return state.landmarker;
}

async function renderLoop() {
  if (!state.stream) return;

  if (els.video.readyState < 2) {
    state.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  if (els.video.currentTime === state.lastVideoTime) {
    state.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  state.lastVideoTime = els.video.currentTime;
  if (!syncCanvas()) {
    state.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  const landmarker = await ensureLandmarker();
  const t0 = performance.now();
  const result = landmarker.detectForVideo(els.video, t0);
  const elapsed = performance.now() - t0;
  setLatency(elapsed);
  clearOverlay();

  const landmarks = result.faceLandmarks && result.faceLandmarks[0];
  if (!landmarks) {
    els.direction.textContent = "-";
    els.directionText.textContent = "No face tracked yet.";
    els.confidence.textContent = "-";
    updateMeters(0, 0);
    setStatus("Live tracking active. No face detected.");
    state.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  const left = computeEyeSignal(landmarks, LEFT_EYE);
  const right = computeEyeSignal(landmarks, RIGHT_EYE);
  drawEyeGuide(left);
  drawEyeGuide(right);

  if (!left || !right) {
    els.direction.textContent = "insufficient landmarks";
    els.directionText.textContent = "Tracked face, but not enough eye landmarks for a coarse estimate.";
    state.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  const horizontal = clamp((((left.xRatio - 0.5) + (right.xRatio - 0.5)) / 2) * 2.2, -1, 1);
  const vertical = clamp((((left.yRatio - 0.5) + (right.yRatio - 0.5)) / 2) * 2.1, -1, 1);
  const direction = estimateDirection(horizontal, vertical);
  const confidence = computeFaceConfidence(landmarks);

  els.direction.textContent = direction;
  els.directionText.textContent = `Coarse estimate: ${direction}.`;
  els.confidence.textContent = `${Math.round(confidence * 100)}%`;
  updateMeters(horizontal, vertical);
  setStatus("Coarse eye direction running.");

  state.rafId = requestAnimationFrame(renderLoop);
}

function stopLoop() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
}

function stopCamera() {
  stopLoop();
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
  els.video.srcObject = null;
  clearOverlay();
  els.start.disabled = false;
  els.stop.disabled = true;
  setStatus("Ready.");
  setLatency(null);
}

async function startCamera() {
  stopCamera();
  setStatus("Requesting camera...");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  state.stream = stream;
  els.video.srcObject = stream;
  await els.video.play();

  els.start.disabled = true;
  els.stop.disabled = false;
  setStatus("Live eye direction tracking running.");
  state.rafId = requestAnimationFrame(renderLoop);
}

window.addEventListener("resize", syncCanvas, { passive: true });

els.start.addEventListener("click", () => {
  startCamera().catch((error) => {
    console.error(error);
    setStatus("Camera start failed.");
  });
});

els.stop.addEventListener("click", stopCamera);
