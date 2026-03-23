import {
  FaceDetector,
  FilesetResolver,
  ImageSegmenter
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const SEGMENTATION_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite";

const TASK_INFO = {
  face: {
    modeLabel: "Face detector",
    modelLabel: "BlazeFace short-range",
    note:
      "Output shows a face bounding box and six keypoints per face: both eyes, nose tip, mouth center, and both ear-side tragion points."
  },
  segment: {
    modeLabel: "Image segmenter",
    modelLabel: "DeepLab v3",
    note:
      "Output shows a semantic segmentation mask over the visible scene. Non-background categories are tinted with a translucent overlay."
  }
};

const els = {
  start: document.getElementById("fd-start"),
  stop: document.getElementById("fd-stop"),
  fileInput: document.getElementById("fd-file-input"),
  taskSelect: document.getElementById("fd-task-select"),
  detectionControls: document.getElementById("fd-detection-controls"),
  minConfidence: document.getElementById("fd-min-confidence"),
  minConfidenceValue: document.getElementById("fd-min-confidence-value"),
  suppression: document.getElementById("fd-suppression"),
  suppressionValue: document.getElementById("fd-suppression-value"),
  mirror: document.getElementById("fd-mirror"),
  mode: document.getElementById("fd-mode"),
  modelLabel: document.getElementById("fd-model-label"),
  faceCount: document.getElementById("fd-face-count"),
  latency: document.getElementById("fd-latency"),
  help: document.getElementById("fd-help"),
  status: document.getElementById("fd-status"),
  view: document.getElementById("fd-view"),
  stage: document.querySelector(".fd-stage"),
  mediaFrame: document.getElementById("fd-media-frame"),
  placeholder: document.getElementById("fd-placeholder"),
  video: document.getElementById("fd-video"),
  image: document.getElementById("fd-image"),
  overlay: document.getElementById("fd-overlay"),
  noteText: document.getElementById("fd-note-text")
};

const ctx = els.overlay.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

const state = {
  vision: null,
  faceDetector: null,
  imageSegmenter: null,
  runningMode: "IMAGE",
  stream: null,
  rafId: 0,
  lastVideoTime: -1,
  objectUrl: null,
  isStarting: false,
  currentTask: "face"
};

function setStatus(message) {
  els.status.textContent = message;
}

function setModeLabel(message) {
  els.mode.textContent = message;
}

function setFaceCount(count, label = "Faces") {
  els.faceCount.textContent = String(count);
  const row = els.faceCount.closest(".fd-stat");
  if (row) {
    const heading = row.querySelector("span");
    if (heading) heading.textContent = label;
  }
}

function setLatency(ms) {
  els.latency.textContent = typeof ms === "number" ? `${ms.toFixed(1)} ms` : "-";
}

function syncSliders() {
  els.minConfidenceValue.textContent = Number(els.minConfidence.value).toFixed(2);
  els.suppressionValue.textContent = Number(els.suppression.value).toFixed(2);
}

function clearOverlay() {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
}

function setActiveMedia(kind) {
  const usingVideo = kind === "video";
  const usingImage = kind === "image";

  els.video.classList.toggle("is-active", usingVideo);
  els.image.classList.toggle("is-active", usingImage);
  els.placeholder.classList.toggle("is-hidden", usingVideo || usingImage);
}

function syncMirrorClass() {
  const shouldMirror = els.mirror.checked && state.runningMode === "VIDEO";
  els.view.classList.toggle("is-mirrored", shouldMirror);
}

function getActiveMediaEl() {
  if (els.video.classList.contains("is-active")) return els.video;
  if (els.image.classList.contains("is-active")) return els.image;
  return null;
}

function syncMediaLayout() {
  const mediaEl = getActiveMediaEl();
  if (!mediaEl) {
    els.mediaFrame.style.width = "100%";
    els.mediaFrame.style.height = "100%";
    return false;
  }

  const sourceWidth = mediaEl.videoWidth || mediaEl.naturalWidth;
  const sourceHeight = mediaEl.videoHeight || mediaEl.naturalHeight;
  if (!sourceWidth || !sourceHeight) return false;

  const stageWidth = els.stage.clientWidth;
  const stageHeight = els.stage.clientHeight;
  if (!stageWidth || !stageHeight) return false;

  const mediaAspect = sourceWidth / sourceHeight;
  const stageAspect = stageWidth / stageHeight;

  let drawWidth = stageWidth;
  let drawHeight = stageHeight;

  if (mediaAspect > stageAspect) {
    drawHeight = stageWidth / mediaAspect;
  } else {
    drawWidth = stageHeight * mediaAspect;
  }

  els.mediaFrame.style.width = `${drawWidth}px`;
  els.mediaFrame.style.height = `${drawHeight}px`;
  return true;
}

function syncCanvasToMedia(mediaEl) {
  const width = mediaEl.videoWidth || mediaEl.naturalWidth;
  const height = mediaEl.videoHeight || mediaEl.naturalHeight;
  if (!width || !height) return false;

  if (els.overlay.width !== width) els.overlay.width = width;
  if (els.overlay.height !== height) els.overlay.height = height;
  syncMediaLayout();
  return true;
}

function drawFaceDetections(detections) {
  clearOverlay();
  if (!detections || detections.length === 0) return;

  ctx.lineWidth = 3;
  ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "top";

  for (const detection of detections) {
    const box = detection.boundingBox;
    if (box) {
      const x = box.originX || 0;
      const y = box.originY || 0;
      const w = box.width || 0;
      const h = box.height || 0;

      ctx.strokeStyle = "#36f3a2";
      ctx.fillStyle = "rgba(54, 243, 162, 0.14)";
      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);

      const category = detection.categories && detection.categories[0];
      if (category) {
        const score = Math.round((category.score || 0) * 100);
        const label = `${category.categoryName || "face"} ${score}%`;
        const metrics = ctx.measureText(label);
        const textWidth = metrics.width + 14;
        const textY = Math.max(0, y - 24);

        ctx.fillStyle = "#36f3a2";
        ctx.fillRect(x, textY, textWidth, 20);
        ctx.fillStyle = "#04291a";
        ctx.fillText(label, x + 7, textY + 4);
      }
    }

    if (Array.isArray(detection.keypoints)) {
      for (const point of detection.keypoints) {
        const px = point.x <= 1 ? point.x * els.overlay.width : point.x;
        const py = point.y <= 1 ? point.y * els.overlay.height : point.y;

        ctx.beginPath();
        ctx.fillStyle = "#fff6a2";
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#04291a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}

function colorForCategory(id) {
  const palette = [
    [0, 0, 0, 0],
    [54, 243, 162, 135],
    [255, 214, 94, 135],
    [98, 177, 255, 135],
    [246, 112, 138, 135],
    [192, 132, 252, 135],
    [250, 204, 21, 135]
  ];
  return palette[id % palette.length];
}

function readCategoryMask(categoryMask) {
  if (!categoryMask) return null;

  const width = categoryMask.width || categoryMask.cols || els.overlay.width;
  const height = categoryMask.height || categoryMask.rows || els.overlay.height;

  let data = null;
  if (typeof categoryMask.getAsUint8Array === "function") {
    data = categoryMask.getAsUint8Array();
  } else if (typeof categoryMask.getAsFloat32Array === "function") {
    const floats = categoryMask.getAsFloat32Array();
    data = new Uint8Array(floats.length);
    for (let i = 0; i < floats.length; i++) data[i] = Math.round(floats[i]);
  } else if (categoryMask.buffer instanceof ArrayBuffer) {
    data = new Uint8Array(categoryMask.buffer);
  }

  if (!data || !data.length) return null;
  return { width, height, data };
}

function drawSegmentationMask(result) {
  clearOverlay();
  const maskInfo = readCategoryMask(result && result.categoryMask);
  if (!maskInfo) return 0;

  if (maskCanvas.width !== maskInfo.width) maskCanvas.width = maskInfo.width;
  if (maskCanvas.height !== maskInfo.height) maskCanvas.height = maskInfo.height;

  const img = maskCtx.createImageData(maskInfo.width, maskInfo.height);
  let nonBackgroundCount = 0;

  for (let i = 0; i < maskInfo.data.length; i++) {
    const category = maskInfo.data[i];
    const [r, g, b, a] = colorForCategory(category);
    const idx = i * 4;

    if (category !== 0) nonBackgroundCount++;

    img.data[idx] = r;
    img.data[idx + 1] = g;
    img.data[idx + 2] = b;
    img.data[idx + 3] = category === 0 ? 0 : a;
  }

  maskCtx.putImageData(img, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0, els.overlay.width, els.overlay.height);
  return nonBackgroundCount;
}

async function ensureVision() {
  if (!state.vision) {
    state.vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  }
  return state.vision;
}

async function ensureFaceDetector(mode) {
  if (!state.faceDetector) {
    const vision = await ensureVision();
    state.faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL },
      runningMode: mode,
      minDetectionConfidence: Number(els.minConfidence.value),
      minSuppressionThreshold: Number(els.suppression.value)
    });
    state.runningMode = mode;
    return state.faceDetector;
  }

  const updates = {
    minDetectionConfidence: Number(els.minConfidence.value),
    minSuppressionThreshold: Number(els.suppression.value)
  };
  if (state.runningMode !== mode) {
    updates.runningMode = mode;
    state.runningMode = mode;
  }

  await state.faceDetector.setOptions(updates);
  return state.faceDetector;
}

async function ensureImageSegmenter(mode) {
  if (!state.imageSegmenter) {
    const vision = await ensureVision();
    state.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: SEGMENTATION_MODEL_URL },
      runningMode: mode,
      outputCategoryMask: true,
      outputConfidenceMasks: false
    });
    state.runningMode = mode;
    return state.imageSegmenter;
  }

  if (state.runningMode !== mode) {
    await state.imageSegmenter.setOptions({ runningMode: mode });
    state.runningMode = mode;
  }

  return state.imageSegmenter;
}

function segmentImage(segmenter, imageEl) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      const maybeResult = segmenter.segment(imageEl, finish);
      if (maybeResult && !settled) finish(maybeResult);
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }
  });
}

function segmentVideo(segmenter, videoEl, timestampMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      const maybeResult = segmenter.segmentForVideo(videoEl, timestampMs, finish);
      if (maybeResult && !settled) finish(maybeResult);
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }
  });
}

async function runImageTask() {
  if (!els.image.src) return;

  setActiveMedia("image");
  syncMirrorClass();
  if (!syncCanvasToMedia(els.image)) return;

  const t0 = performance.now();

  if (state.currentTask === "face") {
    const detector = await ensureFaceDetector("IMAGE");
    setStatus("Running face detector...");
    const result = detector.detect(els.image);
    const elapsed = performance.now() - t0;

    drawFaceDetections(result.detections || []);
    setFaceCount((result.detections || []).length, "Faces");
    setLatency(elapsed);
    setStatus((result.detections || []).length ? "Image processed." : "No faces detected.");
    return;
  }

  const segmenter = await ensureImageSegmenter("IMAGE");
  setStatus("Running image segmenter...");
  const result = await segmentImage(segmenter, els.image);
  const elapsed = performance.now() - t0;
  const painted = drawSegmentationMask(result);

  setFaceCount(painted > 0 ? 1 : 0, "Mask");
  setLatency(elapsed);
  setStatus(painted > 0 ? "Segmentation ready." : "No segmented regions detected.");
}

async function renderVideoFrame() {
  if (!state.stream) return;

  if (els.video.readyState < 2) {
    state.rafId = requestAnimationFrame(renderVideoFrame);
    return;
  }

  if (els.video.currentTime === state.lastVideoTime) {
    state.rafId = requestAnimationFrame(renderVideoFrame);
    return;
  }

  state.lastVideoTime = els.video.currentTime;
  if (!syncCanvasToMedia(els.video)) {
    state.rafId = requestAnimationFrame(renderVideoFrame);
    return;
  }

  const t0 = performance.now();

  if (state.currentTask === "face") {
    const detector = await ensureFaceDetector("VIDEO");
    const result = detector.detectForVideo(els.video, t0);
    const elapsed = performance.now() - t0;

    drawFaceDetections(result.detections || []);
    setFaceCount((result.detections || []).length, "Faces");
    setLatency(elapsed);
    setStatus((result.detections || []).length ? "Live detection running." : "Live camera active. No faces detected.");
  } else {
    const segmenter = await ensureImageSegmenter("VIDEO");
    const result = await segmentVideo(segmenter, els.video, t0);
    const elapsed = performance.now() - t0;
    const painted = drawSegmentationMask(result);

    setFaceCount(painted > 0 ? 1 : 0, "Mask");
    setLatency(elapsed);
    setStatus(painted > 0 ? "Live segmentation running." : "Live camera active. No segmented regions detected.");
  }

  state.rafId = requestAnimationFrame(renderVideoFrame);
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

  state.lastVideoTime = -1;
  els.video.srcObject = null;
  els.start.disabled = false;
  els.stop.disabled = true;
  clearOverlay();
  setFaceCount(0, state.currentTask === "face" ? "Faces" : "Mask");
  setLatency(null);
  setModeLabel(els.image.src ? "Image" : "Idle");
  setStatus(els.image.src ? "Camera stopped." : "Ready.");
  if (!els.image.src) setActiveMedia(null);
  syncMirrorClass();
}

async function startCamera() {
  if (state.isStarting) return;
  state.isStarting = true;

  try {
    stopCamera();
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
    els.image.removeAttribute("src");

    setStatus("Requesting camera access...");
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

    state.runningMode = "VIDEO";
    setModeLabel("Live camera");
    setActiveMedia("video");
    syncMirrorClass();
    syncCanvasToMedia(els.video);

    els.start.disabled = true;
    els.stop.disabled = false;
    state.rafId = requestAnimationFrame(renderVideoFrame);
  } catch (error) {
    console.error(error);
    setStatus("Camera access failed.");
    els.help.textContent =
      "Camera access was denied or unavailable. You can still test the detector with an uploaded image.";
  } finally {
    state.isStarting = false;
  }
}

async function handleUploadedFile(file) {
  if (!file) return;

  stopCamera();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);

  els.image.onload = () => {
    runImageTask().catch((error) => {
      console.error(error);
      setStatus("Image processing failed.");
    });
  };
  els.image.src = state.objectUrl;
}

function handleResize() {
  const mediaEl = getActiveMediaEl();
  if (!mediaEl) return;
  if (!syncCanvasToMedia(mediaEl)) return;

  if (els.image.classList.contains("is-active")) {
    runImageTask().catch(console.error);
  }
}

async function refreshFaceDetectorSettings() {
  syncSliders();
  if (state.currentTask !== "face" || !state.faceDetector) return;

  await state.faceDetector.setOptions({
    minDetectionConfidence: Number(els.minConfidence.value),
    minSuppressionThreshold: Number(els.suppression.value)
  });

  if (state.runningMode === "IMAGE" && els.image.src) {
    await runImageTask();
  }
}

function applyTaskUI() {
  const info = TASK_INFO[state.currentTask];
  els.noteText.textContent = info.note;
  els.modelLabel.textContent = info.modelLabel;
  els.detectionControls.style.display = state.currentTask === "face" ? "grid" : "none";
  setFaceCount(0, state.currentTask === "face" ? "Faces" : "Mask");

  if (state.currentTask === "face") {
    els.help.textContent =
      "Camera access stays in the browser. If live mode feels choppy, try a still image first or reduce other GPU-heavy tabs.";
  } else {
    els.help.textContent =
      "Segmentation is heavier than face detection. On slower devices, image mode may feel much smoother than the live webcam.";
  }
}

async function switchTask(nextTask) {
  if (!TASK_INFO[nextTask] || state.currentTask === nextTask) return;
  state.currentTask = nextTask;
  applyTaskUI();
  clearOverlay();
  setLatency(null);
  setStatus(`Switched to ${TASK_INFO[nextTask].modeLabel.toLowerCase()}.`);

  if (state.stream) {
    stopLoop();
    state.lastVideoTime = -1;
    state.rafId = requestAnimationFrame(renderVideoFrame);
    return;
  }

  if (els.image.src) {
    await runImageTask();
  }
}

function checkBrowserSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    els.start.disabled = true;
    els.help.textContent =
      "This browser does not expose camera capture through getUserMedia. Image upload mode should still work.";
  }
}

els.start.addEventListener("click", () => {
  startCamera().catch((error) => {
    console.error(error);
    setStatus("Failed to start camera.");
  });
});

els.stop.addEventListener("click", stopCamera);

els.fileInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  handleUploadedFile(file).catch((error) => {
    console.error(error);
    setStatus("Failed to process uploaded image.");
  });
});

els.taskSelect.addEventListener("change", () => {
  switchTask(els.taskSelect.value).catch((error) => {
    console.error(error);
    setStatus("Failed to switch model.");
  });
});

els.minConfidence.addEventListener("input", () => {
  refreshFaceDetectorSettings().catch(console.error);
});

els.suppression.addEventListener("input", () => {
  refreshFaceDetectorSettings().catch(console.error);
});

els.mirror.addEventListener("change", syncMirrorClass);
window.addEventListener("resize", handleResize, { passive: true });

syncSliders();
syncMirrorClass();
applyTaskUI();
checkBrowserSupport();
