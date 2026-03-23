import {
  FilesetResolver,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task";

const HOLD_FRAMES = 4;
const COOLDOWN_MS = 1200;
const NAV_CENTER_DEADBAND_RATIO = 0.12;
const JOYSTICK_DEADBAND_RATIO = 0.14;
const PAN_TARGET_EASE = 0.22;
const ZOOM_TARGET_EASE = 0.24;
const RESET_GESTURE_SCORE = 0.7;
const OVERVIEW_OPEN_THRESHOLD = 0.9;
const OVERVIEW_CLOSE_THRESHOLD = 0.78;
const WHEEL_ZOOM_STEP = 0.14;
const GUIDE_INSET_LEFT_RATIO = 0.2;
const GUIDE_INSET_TOP_RATIO = 0.12;
const GUIDE_INSET_RIGHT_RATIO = 0.2;
const GUIDE_INSET_BOTTOM_RATIO = 0.24;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.3;
const SMOOTHING_ALPHA = 0.28;

const ACTION_LABELS = {
  next: "Next image",
  prev: "Previous image",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  pan: "Pan image",
  reset: "Reset zoom"
};

const els = {
  start: document.getElementById("hg-start"),
  stop: document.getElementById("hg-stop"),
  prev: document.getElementById("hg-prev"),
  next: document.getElementById("hg-next"),
  zoom: document.getElementById("hg-zoom"),
  video: document.getElementById("hg-video"),
  overlay: document.getElementById("hg-overlay"),
  status: document.getElementById("hg-status"),
  gesture: document.getElementById("hg-gesture"),
  cooldown: document.getElementById("hg-cooldown"),
  action: document.getElementById("hg-action"),
  photoIndex: document.getElementById("hg-photo-index"),
  latency: document.getElementById("hg-latency"),
  title: document.getElementById("hg-title"),
  description: document.getElementById("hg-description"),
  download: document.getElementById("hg-download"),
  image: document.getElementById("hg-image"),
  figure: document.getElementById("hg-figure"),
  stageFrame: document.getElementById("hg-stage-frame"),
  stageSurface: document.getElementById("hg-stage-surface"),
  overview: document.getElementById("hg-overview"),
  command: document.getElementById("hg-command")
};

const ctx = els.overlay.getContext("2d");
const photos = JSON.parse(document.getElementById("hg-photo-data").textContent || "[]");

const state = {
  vision: null,
  recognizer: null,
  stream: null,
  rafId: 0,
  lastVideoTime: -1,
  currentIndex: 0,
  overviewOpen: false,
  overviewHoverIndex: -1,
  zoom: 1,
  panX: 0,
  panY: 0,
  stableGesture: "",
  stableFrames: 0,
  cooldownUntil: 0,
  pointerDragging: false,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerStartPanX: 0,
  pointerStartPanY: 0,
  smoothX: null,
  smoothY: null,
  smoothSpan: null,
  smoothTipX: null,
  smoothTipY: null,
  panGuide: null,
  zoomGuide: null
};

function setStatus(message) {
  els.status.textContent = message;
}

function setLatency(ms) {
  els.latency.textContent = typeof ms === "number" ? `${ms.toFixed(1)} ms` : "-";
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function toDisplayX(rawX) {
  return els.overlay.width - rawX;
}

function toRawX(displayX) {
  return els.overlay.width - displayX;
}

function getPanGuideRect() {
  const width = els.overlay.width;
  const height = els.overlay.height;
  const left = width * GUIDE_INSET_LEFT_RATIO;
  const top = height * GUIDE_INSET_TOP_RATIO;
  const right = width * (1 - GUIDE_INSET_RIGHT_RATIO);
  const bottom = height * (1 - GUIDE_INSET_BOTTOM_RATIO);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function getPanLimits() {
  const viewportWidth = els.stageSurface.clientWidth;
  const viewportHeight = els.stageSurface.clientHeight;
  const imageWidth = els.image.clientWidth * state.zoom;
  const imageHeight = els.image.clientHeight * state.zoom;

  return {
    x: Math.max(0, (imageWidth - viewportWidth) * 0.5),
    y: Math.max(0, (imageHeight - viewportHeight) * 0.5)
  };
}

function applyFigureTransform() {
  if (!state.overviewOpen) {
    const limits = getPanLimits();
    state.panX = clamp(state.panX, -limits.x, limits.x);
    state.panY = clamp(state.panY, -limits.y, limits.y);
  }
  els.figure.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function resetPan() {
  state.panX = 0;
  state.panY = 0;
  applyFigureTransform();
}

function resetZoom() {
  state.overviewOpen = false;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  renderViewMode();
  applyFigureTransform();
}

function renderViewMode() {
  els.stageSurface.hidden = state.overviewOpen;
  els.overview.hidden = !state.overviewOpen;
  els.figure.style.visibility = state.overviewOpen ? "hidden" : "visible";
}

function renderOverview() {
  const items = photos
    .map((photo, index) => {
      const classes = [
        "hg-overview-item",
        index === state.currentIndex ? "is-active" : "",
        index === state.overviewHoverIndex ? "is-hovered" : ""
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button class="${classes}" type="button" data-index="${index}" aria-label="Open ${photo.name}">
          <img src="${photo.thumb}" alt="${photo.name}">
          <span>${photo.name}</span>
        </button>
      `;
    })
    .join("");

  els.overview.innerHTML = items;
  els.overview.querySelectorAll("[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentIndex = Number(button.dataset.index);
      state.overviewOpen = false;
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      updatePhoto();
      renderViewMode();
      els.command.textContent = "Overview selection opened the image.";
    });
  });
}

function openOverview() {
  state.overviewOpen = true;
  state.overviewHoverIndex = state.currentIndex;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  renderViewMode();
  renderOverview();
  els.action.textContent = "Gallery overview";
  els.command.textContent = "Overview open. Zoom in or click a thumbnail to return to a single image.";
}

function closeOverview() {
  if (!state.overviewOpen) return;
  state.overviewOpen = false;
  state.overviewHoverIndex = -1;
  renderViewMode();
  updatePhoto();
}

function openOverviewSelection() {
  if (state.overviewHoverIndex < 0 || state.overviewHoverIndex >= photos.length) return;
  state.currentIndex = state.overviewHoverIndex;
  state.overviewOpen = false;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  updatePhoto();
  renderViewMode();
  els.action.textContent = "Open image";
  els.command.textContent = "Selected overview image opened.";
}

function updateOverviewHoverFromPointing(centerInfo) {
  if (!state.overviewOpen || !centerInfo) return;

  const guide = setPanGuide(centerInfo);
  if (!guide) return;

  const overviewRect = els.overview.getBoundingClientRect();
  if (!overviewRect.width || !overviewRect.height) return;

  const targetX = overviewRect.left + ((guide.axisX + 1) * 0.5) * overviewRect.width;
  const targetY = overviewRect.top + ((guide.axisY + 1) * 0.5) * overviewRect.height;

  const item = document.elementFromPoint(targetX, targetY)?.closest?.(".hg-overview-item");
  if (!item) return;

  const nextIndex = Number(item.dataset.index);
  if (Number.isNaN(nextIndex) || nextIndex === state.overviewHoverIndex) return;
  state.overviewHoverIndex = nextIndex;
  renderOverview();
  els.action.textContent = "Select image";
  els.command.textContent = `Overview target: ${photos[nextIndex].name}`;
}

function updatePhoto() {
  if (!photos.length) return;
  const photo = photos[state.currentIndex];
  els.image.src = photo.full || photo.thumb;
  els.image.alt = photo.name || "Gallery preview";
  els.title.textContent = photo.name || "Photo";
  els.description.textContent = photo.description || photo.captured_at || "No description.";
  els.download.href = photo.download || "#";
  els.download.hidden = !photo.download;
  els.photoIndex.textContent = `${state.currentIndex + 1} / ${photos.length}`;
  if (state.zoom <= 1.001) {
    state.panX = 0;
    state.panY = 0;
  }
  renderOverview();
  renderViewMode();
  applyFigureTransform();
}

function nextPhoto() {
  if (!photos.length) return;
  state.currentIndex = (state.currentIndex + 1) % photos.length;
  if (!state.overviewOpen) resetZoom();
  updatePhoto();
}

function prevPhoto() {
  if (!photos.length) return;
  state.currentIndex = (state.currentIndex - 1 + photos.length) % photos.length;
  if (!state.overviewOpen) resetZoom();
  updatePhoto();
}

function clearOverlay() {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
}

function resetSmoothedTracking() {
  state.smoothX = null;
  state.smoothY = null;
  state.smoothSpan = null;
  state.smoothTipX = null;
  state.smoothTipY = null;
  state.zoomGuide = null;
}

function syncCanvas() {
  const width = els.video.videoWidth || els.video.clientWidth;
  const height = els.video.videoHeight || els.video.clientHeight;
  if (!width || !height) return false;
  if (els.overlay.width !== width) els.overlay.width = width;
  if (els.overlay.height !== height) els.overlay.height = height;
  return true;
}

function getDisplayCenterAndSpan(landmarks) {
  if (!landmarks || !landmarks.length) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of landmarks) {
    const x = point.x * els.overlay.width;
    const y = point.y * els.overlay.height;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    x: 0.5 * (minX + maxX),
    y: 0.5 * (minY + maxY),
    span: Math.max(maxX - minX, maxY - minY),
    tipX: landmarks[8] ? landmarks[8].x * els.overlay.width : 0.5 * (minX + maxX),
    tipY: landmarks[8] ? landmarks[8].y * els.overlay.height : 0.5 * (minY + maxY)
  };
}

function extractHands(result) {
  const landmarksList = result.landmarks || [];
  const gesturesList = result.gestures || [];
  const handednessList = result.handednesses || [];

  return landmarksList.map((landmarks, index) => {
    const categories = gesturesList[index] || [];
    const top = categories[0] || null;
    const handedness = (handednessList[index] && handednessList[index][0]) || null;
    return {
      landmarks,
      centerInfo: getDisplayCenterAndSpan(landmarks),
      gestureName: top && top.categoryName ? top.categoryName : "",
      gestureScore: top && typeof top.score === "number" ? top.score : 0,
      handedness: handedness && handedness.displayName ? handedness.displayName : ""
    };
  });
}

function smoothCenterInfo(centerInfo) {
  if (!centerInfo) {
    resetSmoothedTracking();
    return null;
  }

  if (state.smoothX === null) {
    state.smoothX = centerInfo.x;
    state.smoothY = centerInfo.y;
    state.smoothSpan = centerInfo.span;
    state.smoothTipX = centerInfo.tipX;
    state.smoothTipY = centerInfo.tipY;
  } else {
    state.smoothX += (centerInfo.x - state.smoothX) * SMOOTHING_ALPHA;
    state.smoothY += (centerInfo.y - state.smoothY) * SMOOTHING_ALPHA;
    state.smoothSpan += (centerInfo.span - state.smoothSpan) * SMOOTHING_ALPHA;
    state.smoothTipX += (centerInfo.tipX - state.smoothTipX) * SMOOTHING_ALPHA;
    state.smoothTipY += (centerInfo.tipY - state.smoothTipY) * SMOOTHING_ALPHA;
  }

  return {
    x: state.smoothX,
    y: state.smoothY,
    span: state.smoothSpan,
    tipX: state.smoothTipX,
    tipY: state.smoothTipY
  };
}

function getBestHand(hands, gestureName, minScore = 0.55) {
  return hands
    .filter((hand) => hand.gestureName === gestureName && hand.gestureScore >= minScore && hand.centerInfo)
    .sort((a, b) => b.gestureScore - a.gestureScore)[0];
}

function getJoystickAxis(valuePx, sizePx) {
  if (sizePx <= 1e-6) return 0;

  const t = clamp(valuePx / sizePx, 0, 1);
  let axis = 0;
  if (t <= 1 / 3) {
    axis = -1;
  } else if (t >= 2 / 3) {
    axis = 1;
  } else {
    axis = (t - 0.5) * 6;
  }

  const absAxis = Math.abs(axis);
  if (absAxis <= JOYSTICK_DEADBAND_RATIO) return 0;
  return Math.sign(axis) * ((absAxis - JOYSTICK_DEADBAND_RATIO) / (1 - JOYSTICK_DEADBAND_RATIO));
}

function setPanGuide(centerInfo) {
  if (!centerInfo) {
    state.panGuide = null;
    return null;
  }

  const guideRect = getPanGuideRect();
  const displayTipX = toDisplayX(centerInfo.tipX);
  const axisX = getJoystickAxis(displayTipX - guideRect.left, guideRect.width);
  const axisY = getJoystickAxis(centerInfo.tipY - guideRect.top, guideRect.height);
  state.panGuide = {
    tipX: centerInfo.tipX,
    tipY: centerInfo.tipY,
    displayTipX,
    guideRect,
    axisX,
    axisY
  };
  return state.panGuide;
}

function drawPanGuide() {
  const guideRect = getPanGuideRect();
  if (!els.overlay.width || !els.overlay.height) return;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fillStyle = "rgba(8, 15, 26, 0.16)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(guideRect.left, guideRect.top, guideRect.width, guideRect.height);
  ctx.strokeRect(guideRect.left, guideRect.top, guideRect.width, guideRect.height);

  for (let i = 1; i <= 2; i += 1) {
    const x = guideRect.left + (guideRect.width * i) / 3;
    const y = guideRect.top + (guideRect.height * i) / 3;
    ctx.beginPath();
    ctx.moveTo(x, guideRect.top);
    ctx.lineTo(x, guideRect.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(guideRect.left, y);
    ctx.lineTo(guideRect.right, y);
    ctx.stroke();
  }

  const centerX = guideRect.left + guideRect.width / 2;
  const centerY = guideRect.top + guideRect.height / 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
  ctx.fill();

  if (state.zoomGuide) {
    const leftX = toRawX(state.zoomGuide.leftDisplayX);
    const rightX = toRawX(state.zoomGuide.rightDisplayX);
    const y = state.zoomGuide.averageY;
    ctx.strokeStyle = "rgba(255, 179, 71, 0.95)";
    ctx.fillStyle = "rgba(255, 179, 71, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(leftX, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightX, y, 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  if (state.panGuide) {
    const targetDisplayX =
      guideRect.left + ((state.panGuide.axisX + 1) * 0.5) * guideRect.width;
    const targetY = guideRect.top + ((state.panGuide.axisY + 1) * 0.5) * guideRect.height;
    const targetX = toRawX(targetDisplayX);

    ctx.strokeStyle = "rgba(54, 243, 162, 0.92)";
    ctx.fillStyle = "rgba(54, 243, 162, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(state.panGuide.tipX, state.panGuide.tipY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(targetX, targetY, 7, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHands(hands) {
  clearOverlay();
  drawPanGuide();
  if (!hands.length) return;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#36f3a2";
  ctx.fillStyle = "#fff6a2";

  for (const hand of hands) {
    const landmarks = hand.landmarks;
    const xs = [];
    const ys = [];

    for (const point of landmarks) {
      const x = point.x * els.overlay.width;
      const y = point.y * els.overlay.height;
      xs.push(x);
      ys.push(y);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    ctx.strokeRect(minX - 8, minY - 8, maxX - minX + 16, maxY - minY + 16);

    const label = hand.handedness
      ? `${hand.handedness}: ${hand.gestureName || "Unknown"}`
      : hand.gestureName || "Hand";
    ctx.fillStyle = "rgba(54, 243, 162, 0.95)";
    ctx.fillRect(minX - 8, Math.max(8, minY - 34), Math.max(88, label.length * 7), 20);
    ctx.fillStyle = "#06131b";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, minX - 2, Math.max(22, minY - 20));
    ctx.fillStyle = "#fff6a2";
  }
}

async function ensureRecognizer() {
  if (!state.recognizer) {
    setStatus("Loading gesture recognizer...");
    state.vision = state.vision || await FilesetResolver.forVisionTasks(WASM_ROOT);
    state.recognizer = await GestureRecognizer.createFromOptions(state.vision, {
      baseOptions: { modelAssetPath: GESTURE_MODEL_URL },
      runningMode: "VIDEO",
      numHands: 2
    });
    setStatus("Gesture recognizer ready.");
  }
  return state.recognizer;
}

function runAction(action) {
  if (action === "next") nextPhoto();
  if (action === "prev") prevPhoto();
  if (action === "reset") resetZoom();

  els.action.textContent = ACTION_LABELS[action] || action;
  els.command.textContent =
    action === "pan" ? "Pointing finger acts as a joystick for panning." : `Triggered: ${ACTION_LABELS[action] || action}`;
}

function handlePointingPan(centerInfo) {
  if (!centerInfo) return;

  if (state.overviewOpen) {
    updateOverviewHoverFromPointing(centerInfo);
    return;
  }

  if (state.zoom <= 1.001) return;

  const guide = setPanGuide(centerInfo);
  if (!guide) return;
  const limits = getPanLimits();
  const targetPanX = clamp(-guide.axisX * limits.x, -limits.x, limits.x);
  const targetPanY = clamp(-guide.axisY * limits.y, -limits.y, limits.y);

  state.panX += (targetPanX - state.panX) * PAN_TARGET_EASE;
  state.panY += (targetPanY - state.panY) * PAN_TARGET_EASE;
  applyFigureTransform();
  els.action.textContent = ACTION_LABELS.pan;
  els.command.textContent = "Pointing finger acts as a joystick for panning.";
}

function handleTwoPointZoom(pointingHands) {
  if (!pointingHands || pointingHands.length < 2) return;

  const guideRect = getPanGuideRect();
  const sorted = [...pointingHands]
    .map((hand) => ({
      hand,
      displayTipX: clamp(toDisplayX(hand.centerInfo.tipX), guideRect.left, guideRect.right),
      tipY: clamp(hand.centerInfo.tipY, guideRect.top, guideRect.bottom)
    }))
    .sort((a, b) => a.displayTipX - b.displayTipX);

  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const distance = Math.max(0, right.displayTipX - left.displayTipX);
  const normalizedDistance = clamp(distance / guideRect.width, 0, 1);
  const closeness = 1 - normalizedDistance;

  if (state.overviewOpen) {
    if (normalizedDistance <= OVERVIEW_CLOSE_THRESHOLD) {
      if (state.overviewHoverIndex >= 0) {
        openOverviewSelection();
      } else {
        closeOverview();
      }
    } else {
      state.zoomGuide = {
        leftDisplayX: left.displayTipX,
        rightDisplayX: right.displayTipX,
        averageY: 0.5 * (left.tipY + right.tipY)
      };
      els.action.textContent = "Gallery overview";
      els.command.textContent =
        state.overviewHoverIndex >= 0
          ? `Bring the two pointing fingers together to open ${photos[state.overviewHoverIndex].name}.`
          : "Bring the two pointing fingers together to leave overview.";
      return;
    }
  }

  if (!state.overviewOpen && state.zoom <= 1.001 && normalizedDistance >= OVERVIEW_OPEN_THRESHOLD) {
    state.zoomGuide = {
      leftDisplayX: left.displayTipX,
      rightDisplayX: right.displayTipX,
      averageY: 0.5 * (left.tipY + right.tipY)
    };
    openOverview();
    return;
  }

  const targetZoom = MIN_ZOOM + closeness * (MAX_ZOOM - MIN_ZOOM);
  const prevZoom = state.zoom;
  state.zoom += (targetZoom - state.zoom) * ZOOM_TARGET_EASE;

  if (state.zoom <= 1.001) {
    state.zoom = MIN_ZOOM;
    state.panX = 0;
    state.panY = 0;
  } else {
    const limits = getPanLimits();
    state.panX = clamp(state.panX, -limits.x, limits.x);
    state.panY = clamp(state.panY, -limits.y, limits.y);
  }

  state.zoomGuide = {
    leftDisplayX: left.displayTipX,
    rightDisplayX: right.displayTipX,
    averageY: 0.5 * (left.tipY + right.tipY)
  };
  applyFigureTransform();
  els.action.textContent = state.zoom >= prevZoom ? ACTION_LABELS.zoomIn : ACTION_LABELS.zoomOut;
  els.command.textContent =
    "Two pointing fingers control zoom: farther apart zooms out, closer together zooms in.";
}

function handleThumbsUpNavigation(centerInfo, now) {
  if (!centerInfo || now < state.cooldownUntil) return;

  const halfWidth = els.overlay.width / 2;
  const centerDeadband = els.overlay.width * NAV_CENTER_DEADBAND_RATIO;
  const displayCenterX = toDisplayX(centerInfo.x);
  if (Math.abs(displayCenterX - halfWidth) <= centerDeadband) {
    els.command.textContent = "Thumbs up detected near center. Move further left or right.";
    return;
  }

  const side = displayCenterX >= halfWidth ? "right" : "left";
  runAction(side === "right" ? "next" : "prev");
  state.cooldownUntil = now + COOLDOWN_MS;
  state.stableFrames = 0;
}

function applyGestureLogic(hands) {
  const now = performance.now();
  els.gesture.textContent = hands.length
    ? hands
        .map((hand) => {
          const label = hand.handedness ? `${hand.handedness}: ` : "";
          return `${label}${hand.gestureName || "Unknown"} ${Math.round(hand.gestureScore * 100)}%`;
        })
        .join(" | ")
    : "-";

  const openPalmHand = getBestHand(hands, "Open_Palm", 0.55);
  const pointingHands = hands.filter(
    (hand) => hand.gestureName === "Pointing_Up" && hand.gestureScore >= 0.55 && hand.centerInfo
  );
  const pointingHand = [...pointingHands].sort((a, b) => b.gestureScore - a.gestureScore)[0];
  const thumbsUpHands = hands.filter(
    (hand) => hand.gestureName === "Thumb_Up" && hand.gestureScore >= 0.55 && hand.centerInfo
  );
  const closedFists = hands.filter(
    (hand) => hand.gestureName === "Closed_Fist" && hand.gestureScore >= RESET_GESTURE_SCORE
  );

  state.zoomGuide = null;

  if (pointingHands.length >= 2) {
    state.panGuide = null;
  } else if (pointingHand) {
    setPanGuide(pointingHand.centerInfo);
  } else {
    state.panGuide = null;
  }

  const thumbsUpHand = thumbsUpHands.sort((a, b) => {
    const aDist = Math.abs(toDisplayX(a.centerInfo.x) - els.overlay.width / 2);
    const bDist = Math.abs(toDisplayX(b.centerInfo.x) - els.overlay.width / 2);
    return bDist - aDist || b.gestureScore - a.gestureScore;
  })[0];

  let actionKey = "";
  if (closedFists.length >= 2) {
    actionKey = "Double_Closed_Fist";
  } else if (pointingHands.length >= 2) {
    actionKey = "Two_Pointing_Up";
  } else if (pointingHand && (state.zoom > 1.001 || state.overviewOpen)) {
    actionKey = "Pointing_Up";
  } else if (thumbsUpHand) {
    actionKey =
      toDisplayX(thumbsUpHand.centerInfo.x) >= els.overlay.width / 2
        ? "Thumb_Up_Right"
        : "Thumb_Up_Left";
  } else if (openPalmHand) {
    actionKey = "Open_Palm";
  }

  if (!actionKey) {
    state.stableGesture = "";
    state.stableFrames = 0;
    if (!pointingHand) {
      state.panGuide = null;
    }
    return;
  }

  if (state.stableGesture === actionKey) {
    state.stableFrames += 1;
  } else {
    state.stableGesture = actionKey;
    state.stableFrames = 1;
  }

  if (actionKey === "Two_Pointing_Up" && state.stableFrames >= HOLD_FRAMES) {
    handleTwoPointZoom(pointingHands);
    return;
  }

  if (actionKey === "Pointing_Up" && state.stableFrames >= HOLD_FRAMES) {
    handlePointingPan(smoothCenterInfo(pointingHand.centerInfo));
    return;
  }

  if (now < state.cooldownUntil) return;

  if (actionKey === "Double_Closed_Fist" && state.stableFrames >= HOLD_FRAMES + 1) {
    runAction("reset");
    state.cooldownUntil = now + COOLDOWN_MS;
    state.stableFrames = 0;
    return;
  }

  if (actionKey.startsWith("Thumb_Up") && state.stableFrames >= HOLD_FRAMES) {
    handleThumbsUpNavigation(thumbsUpHand.centerInfo, now);
    return;
  }

  if (actionKey === "Open_Palm") {
    els.command.textContent =
      "Open palm detected. For zoom, use two pointing fingers and move them together/apart.";
  }
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

  const recognizer = await ensureRecognizer();
  const t0 = performance.now();
  const result = recognizer.recognizeForVideo(els.video, t0);
  const elapsed = performance.now() - t0;
  const hands = extractHands(result);

  applyGestureLogic(hands);
  drawHands(hands);
  setLatency(elapsed);

  const remaining = state.cooldownUntil - performance.now();
  els.cooldown.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)} s` : "Ready";

  state.rafId = requestAnimationFrame(renderLoop);
}

function stopLoop() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
}

function handleWheelZoom(event) {
  event.preventDefault();
  if (state.overviewOpen) {
    if (event.deltaY < 0) {
      closeOverview();
      els.command.textContent = "Wheel zoom closed the overview.";
    }
    return;
  }

  if (state.zoom <= 1.001 && event.deltaY > 0) {
    openOverview();
    return;
  }

  const factor = event.deltaY < 0 ? 1 + WHEEL_ZOOM_STEP : 1 - WHEEL_ZOOM_STEP;
  state.zoom = clamp(state.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (state.zoom <= 1.001) {
    state.panX = 0;
    state.panY = 0;
  } else {
    const limits = getPanLimits();
    state.panX = clamp(state.panX, -limits.x, limits.x);
    state.panY = clamp(state.panY, -limits.y, limits.y);
  }
  applyFigureTransform();
  els.action.textContent = event.deltaY < 0 ? ACTION_LABELS.zoomIn : ACTION_LABELS.zoomOut;
  els.command.textContent =
    event.deltaY < 0
      ? "Pointer wheel: zooming in."
      : "Pointer wheel: zooming out.";
}

function handlePointerDown(event) {
  if (state.zoom <= 1.001 || state.overviewOpen) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  state.pointerDragging = true;
  state.pointerStartX = event.clientX;
  state.pointerStartY = event.clientY;
  state.pointerStartPanX = state.panX;
  state.pointerStartPanY = state.panY;
  els.figure.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.pointerDragging || state.zoom <= 1.001 || state.overviewOpen) return;

  const dx = event.clientX - state.pointerStartX;
  const dy = event.clientY - state.pointerStartY;
  const limits = getPanLimits();
  state.panX = clamp(state.pointerStartPanX + dx, -limits.x, limits.x);
  state.panY = clamp(state.pointerStartPanY + dy, -limits.y, limits.y);
  applyFigureTransform();
  els.action.textContent = ACTION_LABELS.pan;
  els.command.textContent = "Pointer drag: panning while zoomed.";
}

function handlePointerUp(event) {
  state.pointerDragging = false;
  els.figure.releasePointerCapture?.(event.pointerId);
}

function stopCamera() {
  stopLoop();
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
  els.video.srcObject = null;
  clearOverlay();
  resetSmoothedTracking();
  state.panGuide = null;
  state.overviewOpen = false;
  renderViewMode();
  els.start.disabled = false;
  els.stop.disabled = true;
  els.gesture.textContent = "-";
  els.cooldown.textContent = "Ready";
  setLatency(null);
  setStatus("Ready.");
}

async function startCamera() {
  stopCamera();
  setStatus("Requesting camera...");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 }
    },
    audio: false
  });

  state.stream = stream;
  els.video.srcObject = stream;
  await els.video.play();

  els.start.disabled = true;
  els.stop.disabled = false;
  setStatus("Live hand tracking running.");
  state.rafId = requestAnimationFrame(renderLoop);
}

window.addEventListener("resize", () => applyFigureTransform(), { passive: true });

els.image.addEventListener("load", () => applyFigureTransform(), { passive: true });
els.stageFrame.addEventListener("wheel", handleWheelZoom, { passive: false });
els.stageFrame.addEventListener("pointerdown", handlePointerDown);
els.stageFrame.addEventListener("pointermove", handlePointerMove);
els.stageFrame.addEventListener("pointerup", handlePointerUp);
els.stageFrame.addEventListener("pointercancel", handlePointerUp);

els.start.addEventListener("click", () => {
  startCamera().catch((error) => {
    console.error(error);
    setStatus("Camera start failed.");
  });
});

els.stop.addEventListener("click", stopCamera);
els.prev.addEventListener("click", () => {
  prevPhoto();
  els.action.textContent = ACTION_LABELS.prev;
});
els.next.addEventListener("click", () => {
  nextPhoto();
  els.action.textContent = ACTION_LABELS.next;
});
els.zoom.addEventListener("click", () => {
  runAction("reset");
});

updatePhoto();
