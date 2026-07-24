import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
    import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
    import { STLLoader } from "three/addons/loaders/STLLoader.js";

    const els = {
      summary: document.getElementById("summary"),
      search: document.getElementById("search"),
      category: document.getElementById("category"),
      projects: document.getElementById("projects"),
      entries: document.getElementById("entries"),
      projectTitle: document.getElementById("project-title"),
      projectMeta: document.getElementById("project-meta"),
      srkNote: document.getElementById("srk-note"),
      openViewer: document.getElementById("open-viewer"),
      openModel: document.getElementById("open-model"),
      copyId: document.getElementById("copy-id"),
      toggleAxes: document.getElementById("toggle-axes"),
      viewFront: document.getElementById("view-front"),
      viewLeft: document.getElementById("view-left"),
      viewRight: document.getElementById("view-right"),
      viewTop: document.getElementById("view-top"),
      viewPosX: document.getElementById("view-pos-x"),
      viewNegX: document.getElementById("view-neg-x"),
      viewPosY: document.getElementById("view-pos-y"),
      viewNegY: document.getElementById("view-neg-y"),
      viewPosZ: document.getElementById("view-pos-z"),
      viewNegZ: document.getElementById("view-neg-z"),
      axisLeftRight: document.getElementById("axis-left-right"),
      axisUpDown: document.getElementById("axis-up-down"),
      axisHeading: document.getElementById("axis-heading"),
      axisTilt: document.getElementById("axis-tilt"),
      axisRoll: document.getElementById("axis-roll"),
      pickPivot: document.getElementById("pick-pivot"),
      centerPivot: document.getElementById("center-pivot"),
      copySetup: document.getElementById("copy-setup"),
      viewReset: document.getElementById("view-reset"),
      rotateX: document.getElementById("rotate-x"),
      rotateY: document.getElementById("rotate-y"),
      rotateZ: document.getElementById("rotate-z"),
      rotateFlip: document.getElementById("rotate-flip"),
      toggleAuto: document.getElementById("toggle-auto"),
      cycleLight: document.getElementById("cycle-light"),
      viewer: document.getElementById("model-viewer"),
      viewerActions: document.getElementById("viewer-actions"),
      viewerHint: document.getElementById("viewer-hint"),
      viewFullscreen: document.getElementById("view-fullscreen"),
      routePanel: document.getElementById("route-panel"),
      routeCount: document.getElementById("route-count"),
      routeToggleAll: document.getElementById("route-toggle-all"),
      routeList: document.getElementById("route-list"),
      canvas: document.getElementById("canvas"),
      axisReadout: document.getElementById("axis-readout"),
      cameraReadout: document.getElementById("camera-readout"),
      empty: document.getElementById("empty"),
      loading: document.getElementById("loading"),
      metricModel: document.getElementById("metric-model"),
      metricSize: document.getElementById("metric-size"),
      metricVertices: document.getElementById("metric-vertices"),
      metricFaces: document.getElementById("metric-faces"),
      pathbox: document.getElementById("pathbox"),
    };

    const state = {
      manifest: null,
      activeProjectId: null,
      activeEntryId: null,
      search: "",
      category: "",
      object: null,
      loadedEntryId: null,
      loadingEntryId: null,
      loadRequestId: 0,
      loadError: "",
      viewerHintDismissed: false,
      routeRoot: null,
      routeItems: [],
      selectedRouteItem: null,
      cameraAnimation: null,
      raf: 0,
      pendingFrames: 0,
      autoRotate: false,
      lightMode: 0,
      axesVisible: false,
      pickPivotMode: false,
      leftRightAxisName: "pos-y",
      upDownAxisName: "neg-z",
      axisHeadingDegrees: 0,
      axisTiltDegrees: 0,
      axisRollDegrees: 0,
      basisUp: new THREE.Vector3(0, 1, 0),
      basisFront: new THREE.Vector3(1, 0, 0),
      basisRight: new THREE.Vector3(0, 0, -1),
      defaultViewSide: new THREE.Vector3(0, 0, 1),
      orbitTarget: new THREE.Vector3(0, 0, 0),
      boulderOrbitTarget: new THREE.Vector3(0, 0, 0),
      orbitRadius: 4,
      orbitTheta: 0,
      orbitPhi: Math.PI / 2.35,
      orbitRoll: 0,
      minRadius: 0.05,
      maxRadius: 1000,
      fitMaxDim: 1,
      fitDistance: 1,
      fitBox: null,
      fitCenter: new THREE.Vector3(0, 0, 0),
      pointerState: new Map(),
      lastPinchDistance: null,
    };

    const baseUrl = (window.ModelLibraryBaseUrl || "").replace(/\/$/, "");

    function siteUrl(url) {
      const raw = String(url || "").trim();
      if (!raw) return "";
      if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
      if (raw.startsWith("./")) return raw;
      if (raw.startsWith("/")) return `${baseUrl}${raw}`;
      return `${baseUrl}/${raw.replace(/^\/+/, "")}`;
    }

    function loadEmbeddedManifest() {
      const manifestEl = document.getElementById("model-library-manifest");
      if (!manifestEl?.textContent) {
        throw new Error("Model library manifest was not found on this page.");
      }
      return JSON.parse(manifestEl.textContent);
    }

    const renderer = new THREE.WebGLRenderer({
      canvas: els.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f6f8);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
    camera.position.set(0, 0, 4);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x87909a, 1.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1.5, 2.5, 2.0);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2.0, 1.2, -2.4);
    scene.add(fill);

    const axisGroup = new THREE.Group();
    axisGroup.visible = false;
    scene.add(axisGroup);
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    function syncViewerTheme() {
      const isDark = document.documentElement.dataset.theme === "dark";
      scene.background.setHex(isDark ? 0x080a0e : 0xf4f6f8);
      hemi.groundColor.setHex(isDark ? 0x272d35 : 0x87909a);
      hemi.intensity = isDark ? 2.0 : 1.8;
      requestRender(2);
    }

    const themeObserver = new MutationObserver(syncViewerTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    syncViewerTheme();

    function resize() {
      const rect = els.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (els.canvas.width !== width || els.canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      requestRender(2);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(els.canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestRender(2);
    });

    function shortestAngleDelta(from, to) {
      return Math.atan2(Math.sin(to - from), Math.cos(to - from));
    }

    function cancelCameraAnimation() {
      state.cameraAnimation = null;
    }

    function startCameraAnimation({ target, radius, theta, phi }, duration = 520) {
      const targetRadius = THREE.MathUtils.clamp(radius, state.minRadius, state.maxRadius);
      const targetPhi = THREE.MathUtils.clamp(phi, 0.06, Math.PI - 0.06);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        state.orbitTarget.copy(target);
        state.orbitRadius = targetRadius;
        state.orbitTheta = theta;
        state.orbitPhi = targetPhi;
        state.cameraAnimation = null;
        state.autoRotate = false;
        els.toggleAuto.classList.remove("primary");
        els.toggleAuto.setAttribute("aria-pressed", "false");
        updateCamera();
        return;
      }
      state.cameraAnimation = {
        startedAt: performance.now(),
        duration,
        fromTarget: state.orbitTarget.clone(),
        toTarget: target.clone(),
        fromRadius: state.orbitRadius,
        toRadius: targetRadius,
        fromTheta: state.orbitTheta,
        thetaDelta: shortestAngleDelta(state.orbitTheta, theta),
        fromPhi: state.orbitPhi,
        toPhi: targetPhi,
      };
      state.autoRotate = false;
      els.toggleAuto.classList.remove("primary");
      els.toggleAuto.setAttribute("aria-pressed", "false");
      requestRender(2);
    }

    function animateOnce(now = performance.now()) {
      state.raf = 0;
      if (state.cameraAnimation) {
        const animation = state.cameraAnimation;
        const progress = THREE.MathUtils.clamp(
          (now - animation.startedAt) / animation.duration,
          0,
          1
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        state.orbitTarget.lerpVectors(animation.fromTarget, animation.toTarget, eased);
        state.orbitRadius = THREE.MathUtils.lerp(animation.fromRadius, animation.toRadius, eased);
        state.orbitTheta = animation.fromTheta + animation.thetaDelta * eased;
        state.orbitPhi = THREE.MathUtils.lerp(animation.fromPhi, animation.toPhi, eased);
        updateCamera(false);
        if (progress >= 1) {
          state.cameraAnimation = null;
        } else {
          state.pendingFrames = Math.max(state.pendingFrames, 2);
        }
      } else if (state.autoRotate && state.object) {
        state.orbitTheta += 0.006;
        updateCamera(false);
        state.pendingFrames = Math.max(state.pendingFrames, 2);
      }
      renderer.render(scene, camera);
      state.pendingFrames = Math.max(0, state.pendingFrames - 1);
      if (!document.hidden && state.pendingFrames > 0) {
        state.raf = requestAnimationFrame(animateOnce);
      }
    }

    function requestRender(frames = 1) {
      state.pendingFrames = Math.max(state.pendingFrames, frames);
      if (document.hidden || state.raf) return;
      state.raf = requestAnimationFrame(animateOnce);
    }

    function clampOrbit() {
      state.orbitPhi = THREE.MathUtils.clamp(state.orbitPhi, 0.06, Math.PI - 0.06);
      state.orbitRadius = THREE.MathUtils.clamp(state.orbitRadius, state.minRadius, state.maxRadius);
    }

    function axisVector(name) {
      const axes = {
        "pos-x": new THREE.Vector3(1, 0, 0),
        "neg-x": new THREE.Vector3(-1, 0, 0),
        "pos-y": new THREE.Vector3(0, 1, 0),
        "neg-y": new THREE.Vector3(0, -1, 0),
        "pos-z": new THREE.Vector3(0, 0, 1),
        "neg-z": new THREE.Vector3(0, 0, -1),
      };
      return (axes[name] || axes["pos-z"]).clone();
    }

    function axisLabel(name) {
      return {
        "pos-x": "+X",
        "neg-x": "-X",
        "pos-y": "+Y",
        "neg-y": "-Y",
        "pos-z": "+Z",
        "neg-z": "-Z",
      }[name] || "+Z";
    }

    function axisNameFromVector(vector) {
      const components = [
        { axis: "x", value: vector.x },
        { axis: "y", value: vector.y },
        { axis: "z", value: vector.z },
      ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const strongest = components[0];
      return `${strongest.value >= 0 ? "pos" : "neg"}-${strongest.axis}`;
    }

    function firstPerpendicularAxis(primaryName, secondaryName) {
      const primary = axisVector(primaryName);
      const candidates = ["neg-z", "pos-z", "pos-x", "neg-x", "pos-y", "neg-y"];
      for (const candidate of candidates) {
        if (candidate !== primaryName && candidate !== secondaryName && Math.abs(axisVector(candidate).dot(primary)) < 0.99) {
          return candidate;
        }
      }
      return "neg-z";
    }

    function setOrbitAxes(
      leftRightName = "pos-y",
      upDownName = "neg-z",
      resetToFront = false,
      rollDegrees = state.axisRollDegrees,
      headingDegrees = state.axisHeadingDegrees,
      tiltDegrees = state.axisTiltDegrees
    ) {
      const leftRight = axisVector(leftRightName).normalize();
      let upDown = axisVector(upDownName).normalize();
      if (Math.abs(leftRight.dot(upDown)) > 0.98) {
        upDownName = firstPerpendicularAxis(leftRightName, upDownName);
        upDown = axisVector(upDownName).normalize();
      }
      upDown.addScaledVector(leftRight, -upDown.dot(leftRight)).normalize();
      const front = upDown.clone().cross(leftRight).normalize();
      const safeHeading = Number.isFinite(headingDegrees) ? headingDegrees : 0;
      const safeTilt = Number.isFinite(tiltDegrees) ? tiltDegrees : 0;
      const safeRoll = Number.isFinite(rollDegrees) ? rollDegrees : 0;
      const headingRadians = THREE.MathUtils.degToRad(safeHeading);
      const tiltRadians = THREE.MathUtils.degToRad(safeTilt);
      const rollRadians = THREE.MathUtils.degToRad(safeRoll);
      if (Math.abs(headingRadians) > 0.000001) {
        upDown.applyAxisAngle(leftRight, headingRadians).normalize();
        front.applyAxisAngle(leftRight, headingRadians).normalize();
      }
      if (Math.abs(tiltRadians) > 0.000001) {
        leftRight.applyAxisAngle(upDown, tiltRadians).normalize();
        front.applyAxisAngle(upDown, tiltRadians).normalize();
      }
      if (Math.abs(rollRadians) > 0.000001) {
        leftRight.applyAxisAngle(front, rollRadians).normalize();
        upDown.applyAxisAngle(front, rollRadians).normalize();
      }

      state.leftRightAxisName = leftRightName;
      state.upDownAxisName = upDownName;
      state.axisHeadingDegrees = safeHeading;
      state.axisTiltDegrees = safeTilt;
      state.axisRollDegrees = safeRoll;
      state.basisUp.copy(leftRight);
      state.basisRight.copy(upDown);
      state.basisFront.copy(front);
      els.axisLeftRight.value = leftRightName;
      els.axisUpDown.value = upDownName;
      els.axisHeading.value = String(Math.round(state.axisHeadingDegrees * 100) / 100);
      els.axisTilt.value = String(Math.round(state.axisTiltDegrees * 100) / 100);
      els.axisRoll.value = String(Math.round(state.axisRollDegrees * 100) / 100);

      if (state.object) {
        if (resetToFront) {
          state.orbitTarget.copy(state.boulderOrbitTarget);
          state.orbitTheta = 0;
          state.orbitPhi = Math.PI / 2;
          state.orbitRoll = 0;
        }
        updateCamera();
      } else {
        updateCameraReadout();
      }
    }

    function legacyCameraBasisToOrbitAxes(basis) {
      const upName = basis?.up || "pos-y";
      const frontName = basis?.front || "pos-z";
      const up = axisVector(upName).normalize();
      const front = axisVector(frontName).normalize();
      let upDown = up.clone().cross(front);
      if (upDown.lengthSq() < 0.000001) {
        return { leftRightAxis: upName, upDownAxis: firstPerpendicularAxis(upName, frontName) };
      }
      upDown.normalize();
      return { leftRightAxis: upName, upDownAxis: axisNameFromVector(upDown) };
    }

    function orbitAnglesFromSideVector(sideVector) {
      const side = sideVector.clone().normalize();
      const upDot = THREE.MathUtils.clamp(side.dot(state.basisUp), -1, 1);
      const horizontal = side.clone().addScaledVector(state.basisUp, -upDot);
      let theta = 0;
      if (horizontal.lengthSq() > 0.000001) {
        horizontal.normalize();
        theta = Math.atan2(horizontal.dot(state.basisRight), horizontal.dot(state.basisFront));
      }
      return {
        theta,
        phi: Math.acos(upDot),
      };
    }

    function setOrbitFromSideVector(sideVector) {
      const angles = orbitAnglesFromSideVector(sideVector);
      state.orbitTheta = angles.theta;
      state.orbitPhi = angles.phi;
    }

    function updateCamera(queue = true) {
      clampOrbit();
      const sinPhi = Math.sin(state.orbitPhi);
      const side = new THREE.Vector3()
        .addScaledVector(state.basisRight, sinPhi * Math.sin(state.orbitTheta))
        .addScaledVector(state.basisUp, Math.cos(state.orbitPhi))
        .addScaledVector(state.basisFront, sinPhi * Math.cos(state.orbitTheta));
      camera.position.copy(state.orbitTarget).addScaledVector(side, state.orbitRadius);
      const viewDirection = state.orbitTarget.clone().sub(camera.position).normalize();
      const screenUp = state.basisUp.clone().projectOnPlane(viewDirection);
      if (screenUp.lengthSq() < 0.000001) {
        screenUp.copy(state.basisFront).projectOnPlane(viewDirection);
      }
      if (screenUp.lengthSq() < 0.000001) {
        screenUp.copy(state.basisRight).projectOnPlane(viewDirection);
      }
      screenUp.normalize().applyAxisAngle(viewDirection, state.orbitRoll);
      camera.up.copy(screenUp);
      camera.lookAt(state.orbitTarget);
      updateCameraReadout();
      if (queue) requestRender(2);
    }

    function strafeByPixels(dx, dy) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const scale = Math.max(state.orbitRadius, 0.001) * 0.0016;
      const movement = new THREE.Vector3()
        .addScaledVector(right, -dx * scale)
        .addScaledVector(up, dy * scale);
      state.orbitTarget.add(movement);
    }

    function setPickPivotMode(enabled) {
      state.pickPivotMode = Boolean(enabled);
      els.pickPivot.classList.toggle("primary", state.pickPivotMode);
      els.pickPivot.setAttribute("aria-pressed", state.pickPivotMode ? "true" : "false");
      els.canvas.style.cursor = state.pickPivotMode ? "crosshair" : "";
    }

    function setPivot(point, keepView = true) {
      if (!state.object || !point) return;
      const previousCameraSide = camera.position.clone().sub(point);
      state.boulderOrbitTarget.copy(point);
      state.orbitTarget.copy(point);
      if (keepView && previousCameraSide.lengthSq() > 0.000001) {
        state.orbitRadius = previousCameraSide.length();
        setOrbitFromSideVector(previousCameraSide);
      }
      if (state.fitBox) rebuildAxes(state.fitBox);
      updateCamera();
    }

    function resetPivotToCenter() {
      if (!state.object) return;
      setPivot(state.fitCenter.clone(), true);
    }

    function pickModelPoint(event) {
      if (!state.object) return null;
      const rect = els.canvas.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointerNdc.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
      raycaster.params.Points.threshold = Math.max(state.fitMaxDim * 0.015, 0.001);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(state.object, true);
      return hits[0]?.point?.clone() || null;
    }

    function roundedVector(vector) {
      return {
        x: Number(vector.x.toFixed(5)),
        y: Number(vector.y.toFixed(5)),
        z: Number(vector.z.toFixed(5)),
      };
    }

    async function copyCurrentSetup() {
      const entry = activeEntry();
      if (!entry || !state.object) return;
      const radiusMultiplier = state.fitDistance > 0 ? state.orbitRadius / state.fitDistance : 1.55;
      const payload = {
        [entry.id]: {
          orbit_controls: {
            pivot: roundedVector(state.boulderOrbitTarget),
            left_right_axis: state.leftRightAxisName,
            up_down_axis: state.upDownAxisName,
            axis_heading_degrees: Number(state.axisHeadingDegrees.toFixed(2)),
            axis_tilt_degrees: Number(state.axisTiltDegrees.toFixed(2)),
            axis_roll_degrees: Number(state.axisRollDegrees.toFixed(2)),
          },
          initial_view: {
            theta: Number(state.orbitTheta.toFixed(5)),
            phi: Number(state.orbitPhi.toFixed(5)),
            roll: Number(state.orbitRoll.toFixed(5)),
            radius_multiplier: Number(radiusMultiplier.toFixed(5)),
          },
        },
      };
      const text = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      const original = els.copySetup.textContent;
      els.copySetup.textContent = "Copied Setup";
      window.setTimeout(() => { els.copySetup.textContent = original; }, 1100);
    }

    function applyViewPreset(name) {
      if (!state.object) return;
      state.orbitTarget.copy(state.boulderOrbitTarget);
      state.orbitRoll = 0;
      const preset = {
        front: "basis-front",
        left: "basis-left",
        right: "basis-right",
        top: "basis-up",
      }[name] || name;

      if (preset === "basis-front") {
        setOrbitFromSideVector(state.basisFront);
      } else if (preset === "basis-left") {
        setOrbitFromSideVector(state.basisRight.clone().negate());
      } else if (preset === "basis-right") {
        setOrbitFromSideVector(state.basisRight);
      } else if (preset === "basis-up") {
        setOrbitFromSideVector(state.basisUp);
      } else {
        setOrbitFromSideVector(axisVector(preset));
      }
      updateCamera();
    }

    function rotateObject(axis, degrees) {
      if (!state.object) return;
      const previousCenter = computeGeometryCenter(state.object);
      state.object.rotation[axis] += THREE.MathUtils.degToRad(degrees);
      state.object.updateMatrixWorld(true);
      const nextCenter = computeGeometryCenter(state.object);
      state.object.position.add(previousCenter.clone().sub(nextCenter));
      state.object.updateMatrixWorld(true);
      state.boulderOrbitTarget.copy(previousCenter);
      requestRender(4);
    }

    function resetObjectView() {
      if (!state.object) return;
      cancelCameraAnimation();
      clearRouteSelection();
      state.object.rotation.set(0, 0, 0);
      fitObject(state.object);
    }

    function cycleLight() {
      state.lightMode = (state.lightMode + 1) % 3;
      hemi.intensity = [2.0, 3.4, 1.25][state.lightMode];
      key.intensity = [1.2, 2.2, 0.7][state.lightMode];
      fill.intensity = [0.35, 1.0, 0.15][state.lightMode];
      requestRender(2);
    }

    async function toggleFullscreen() {
      if (!els.viewer?.requestFullscreen) return;
      if (document.fullscreenElement === els.viewer) {
        await document.exitFullscreen();
      } else {
        await els.viewer.requestFullscreen();
      }
    }

    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = document.fullscreenElement === els.viewer;
      els.viewFullscreen.textContent = isFullscreen ? "Exit full screen" : "Full screen";
      window.setTimeout(resize, 0);
    });

    function dismissViewerHint() {
      if (!els.viewerHint || els.viewerHint.classList.contains("hidden")) return;
      state.viewerHintDismissed = true;
      els.viewerHint.classList.add("hidden");
      try {
        window.localStorage.setItem("photogrammetryViewerHintSeen", "true");
      } catch {
        // The hint can still be dismissed when storage is unavailable.
      }
    }

    els.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      dismissViewerHint();
      cancelCameraAnimation();
      if (state.pickPivotMode && event.button === 0) {
        const point = pickModelPoint(event);
        if (point) setPivot(point, true);
        setPickPivotMode(false);
        return;
      }
      els.canvas.setPointerCapture(event.pointerId);
      state.pointerState.set(event.pointerId, { x: event.clientX, y: event.clientY, button: event.button });
      state.lastPinchDistance = null;
    });

    els.canvas.addEventListener("pointermove", (event) => {
      if (!state.pointerState.has(event.pointerId)) return;
      const previous = state.pointerState.get(event.pointerId);
      const previousPoints = Array.from(state.pointerState.values());
      state.pointerState.set(event.pointerId, { x: event.clientX, y: event.clientY, button: previous.button });
      const points = Array.from(state.pointerState.values());

      if (points.length >= 2) {
        const previousCenter = previousPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
        previousCenter.x /= previousPoints.length;
        previousCenter.y /= previousPoints.length;
        const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
        center.x /= points.length;
        center.y /= points.length;
        strafeByPixels(center.x - previousCenter.x, center.y - previousCenter.y);

        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        const distance = Math.hypot(dx, dy);
        if (state.lastPinchDistance !== null && distance > 0) {
          state.orbitRadius *= state.lastPinchDistance / distance;
        }
        state.lastPinchDistance = distance;
        updateCamera();
        return;
      }

      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if ((event.buttons & 2) || previous.button === 2) {
        strafeByPixels(dx, dy);
      } else {
        state.orbitTheta -= dx * 0.007;
        state.orbitPhi -= dy * 0.007;
      }
      updateCamera();
    });

    function endPointer(event) {
      state.pointerState.delete(event.pointerId);
      state.lastPinchDistance = null;
    }

    els.canvas.addEventListener("pointerup", endPointer);
    els.canvas.addEventListener("pointercancel", endPointer);
    els.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    els.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      dismissViewerHint();
      cancelCameraAnimation();
      state.orbitRadius *= Math.exp(event.deltaY * 0.001);
      updateCamera();
    }, { passive: false });

    function disposeObject(object) {
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!material) continue;
          for (const value of Object.values(material)) {
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        }
      });
    }

    function clearRouteUi() {
      state.routeRoot = null;
      state.routeItems = [];
      state.selectedRouteItem = null;
      els.routeList.innerHTML = "";
      els.routeCount.textContent = "Routes";
      els.routeToggleAll.textContent = "Hide all";
      els.routePanel.classList.add("hidden");
      els.viewer.classList.remove("viewer--has-routes");
    }

    function updateRouteButton(item) {
      const isSelected = state.selectedRouteItem === item;
      item.button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      item.button.classList.toggle("is-selected", isSelected);
    }

    function updateRouteAllButton() {
      const anyVisible = state.routeItems.some((item) => item.mesh.visible);
      els.routeToggleAll.textContent = anyVisible ? "Hide all" : "Show all";
    }

    function clearRouteSelection() {
      state.selectedRouteItem = null;
      for (const item of state.routeItems) {
        item.mesh.material.opacity = item.baseOpacity;
        item.mesh.material.depthTest = true;
        item.mesh.renderOrder = 30;
        updateRouteButton(item);
      }
      requestRender(2);
    }

    function toggleAllRoutes() {
      const anyVisible = state.routeItems.some((item) => item.mesh.visible);
      for (const item of state.routeItems) {
        item.mesh.visible = !anyVisible;
        updateRouteButton(item);
      }
      updateRouteAllButton();
      requestRender(2);
    }

    function selectRoute(item) {
      state.selectedRouteItem = item;
      for (const routeItem of state.routeItems) {
        const isSelected = routeItem === item;
        routeItem.mesh.visible = routeItem.mesh.visible || isSelected;
        routeItem.mesh.material.opacity = isSelected
          ? 1
          : Math.min(routeItem.baseOpacity, 0.34);
        routeItem.mesh.material.depthTest = !isSelected;
        routeItem.mesh.renderOrder = isSelected ? 40 : 30;
        updateRouteButton(routeItem);
      }
      updateRouteAllButton();
    }

    function focusRoute(item) {
      if (!state.object || !state.routeRoot || !item?.points?.length) return;
      cancelCameraAnimation();
      state.routeRoot.updateMatrixWorld(true);
      const worldPoints = item.points.map((point) => state.routeRoot.localToWorld(point.clone()));
      const box = new THREE.Box3().setFromPoints(worldPoints);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (sphere.isEmpty()) return;

      const routeCenter = sphere.center;
      let viewSide = routeCenter.clone().sub(state.boulderOrbitTarget);
      if (viewSide.lengthSq() < 0.000001) {
        viewSide.copy(state.defaultViewSide);
      } else {
        viewSide.normalize();
        if (viewSide.dot(state.defaultViewSide) < 0) viewSide.negate();
      }
      if (item.reverseFocusSide) viewSide.negate();

      const angles = orbitAnglesFromSideVector(viewSide);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const limitingFov = Math.min(verticalFov, horizontalFov);
      const routeRadius = Math.max(sphere.radius, state.fitMaxDim * 0.045);
      const distance = Math.max(
        routeRadius / Math.sin(limitingFov / 2) * 1.6,
        state.fitMaxDim * 0.14
      );

      selectRoute(item);
      startCameraAnimation({
        target: routeCenter,
        radius: distance,
        theta: angles.theta,
        phi: angles.phi,
      });
    }

    async function loadEntryRoutes(entry, targetObject = state.object) {
      if (!entry?.route_lines?.url || !targetObject) {
        clearRouteUi();
        return;
      }

      const response = await fetch(siteUrl(entry.route_lines.url));
      if (!response.ok) {
        throw new Error(`Route data returned HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (state.object !== targetObject) return;
      const settings = payload.rendering || {};
      const routeRoot = new THREE.Group();
      routeRoot.name = "model_routes";
      targetObject.add(routeRoot);
      state.routeRoot = routeRoot;
      state.routeItems = [];
      els.routeList.innerHTML = "";
      const reverseFocusSide = new Set(entry.route_lines.reverse_focus_side || []);

      for (const route of payload.routes || []) {
        const points = (route.points || []).map(
          (point) => new THREE.Vector3(Number(point[0]), Number(point[1]), Number(point[2]))
        );
        if (points.length < 2) continue;

        const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.25);
        const geometry = new THREE.TubeGeometry(
          curve,
          Math.max(32, points.length * 2),
          Number(route.radius ?? settings.radius) || Math.max(state.fitMaxDim * 0.0017, 0.001),
          Number(settings.radial_segments) || 6,
          false
        );
        const material = new THREE.MeshBasicMaterial({
          color: route.color || "#ffd400",
          transparent: true,
          opacity: Number(settings.opacity) || 0.96,
          depthTest: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = route.id || route.display || route.name || "route";
        mesh.visible = settings.default_visible !== false;
        mesh.renderOrder = 30;
        routeRoot.add(mesh);

        const button = document.createElement("button");
        button.className = "route-button";
        button.type = "button";
        const swatch = document.createElement("span");
        swatch.className = "route-swatch";
        swatch.style.background = route.color || "#ffd400";
        const label = document.createElement("span");
        label.textContent = route.display || route.name || "Route";
        button.append(swatch, label);
        button.title = `Focus ${label.textContent}`;

        const item = {
          mesh,
          button,
          points,
          baseOpacity: material.opacity,
          reverseFocusSide: reverseFocusSide.has(route.id),
        };
        button.addEventListener("click", () => focusRoute(item));
        state.routeItems.push(item);
        els.routeList.appendChild(button);
        updateRouteButton(item);
      }

      if (state.routeItems.length) {
        els.routeCount.textContent = `${state.routeItems.length} routes`;
        els.routePanel.classList.remove("hidden");
        els.viewer.classList.add("viewer--has-routes");
        updateRouteAllButton();
        window.setTimeout(() => {
          resize();
          if (window.matchMedia("(max-width: 820px)").matches) {
            const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth";
            els.viewer.scrollIntoView({ behavior, block: "start" });
          }
        }, 0);
        requestRender(3);
      } else {
        clearRouteUi();
      }
    }

    function clearAxisGroup() {
      const children = [...axisGroup.children];
      for (const child of children) {
        axisGroup.remove(child);
        disposeObject(child);
      }
    }

    function makeAxisLabel(text, color) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = "600 32px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 7;
      context.strokeStyle = "rgba(0, 0, 0, .82)";
      context.fillStyle = color;
      context.strokeText(text, canvas.width / 2, canvas.height / 2);
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      return new THREE.Sprite(material);
    }

    function makeAlwaysVisible(object, opacity = 0.95) {
      object.traverse((child) => {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!material) continue;
          material.depthTest = false;
          material.depthWrite = false;
          material.transparent = true;
          material.opacity = opacity;
        }
        child.renderOrder = 20;
      });
    }

    function addAxisArrow(origin, direction, label, colorHex, colorCss, length) {
      const arrow = new THREE.ArrowHelper(
        direction,
        origin,
        length,
        colorHex,
        length * 0.14,
        length * 0.065
      );
      makeAlwaysVisible(arrow);
      axisGroup.add(arrow);

      const sprite = makeAxisLabel(label, colorCss);
      sprite.position.copy(origin).addScaledVector(direction, length * 1.18);
      sprite.scale.set(length * 0.28, length * 0.14, 1);
      sprite.renderOrder = 30;
      axisGroup.add(sprite);
    }

    function rebuildAxes(box) {
      clearAxisGroup();
      if (!box || box.isEmpty()) return;

      const origin = state.boulderOrbitTarget.clone();
      const length = Math.max(state.fitMaxDim * 0.66, 0.001);
      const axes = [
        { label: "+X", direction: new THREE.Vector3(1, 0, 0), colorHex: 0xff5e5b, colorCss: "#ff5e5b" },
        { label: "-X", direction: new THREE.Vector3(-1, 0, 0), colorHex: 0xff5e5b, colorCss: "#ff5e5b" },
        { label: "+Y", direction: new THREE.Vector3(0, 1, 0), colorHex: 0x7ee36d, colorCss: "#7ee36d" },
        { label: "-Y", direction: new THREE.Vector3(0, -1, 0), colorHex: 0x7ee36d, colorCss: "#7ee36d" },
        { label: "+Z", direction: new THREE.Vector3(0, 0, 1), colorHex: 0x61a8ff, colorCss: "#61a8ff" },
        { label: "-Z", direction: new THREE.Vector3(0, 0, -1), colorHex: 0x61a8ff, colorCss: "#61a8ff" },
      ];

      for (const axis of axes) {
        addAxisArrow(origin, axis.direction, axis.label, axis.colorHex, axis.colorCss, length);
      }

      const centerMarker = new THREE.Mesh(
        new THREE.SphereGeometry(length * 0.035, 16, 10),
        new THREE.MeshBasicMaterial({
          color: 0xf2f7ef,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          depthWrite: false,
        })
      );
      centerMarker.position.copy(origin);
      centerMarker.renderOrder = 25;
      axisGroup.add(centerMarker);

      const boxHelper = new THREE.Box3Helper(box.clone(), 0xc8d6c2);
      makeAlwaysVisible(boxHelper, 0.28);
      boxHelper.renderOrder = 12;
      axisGroup.add(boxHelper);
      setAxesVisible(state.axesVisible);
    }

    function viewDirectionName() {
      if (!state.object) return "-";
      const side = camera.position.clone().sub(state.orbitTarget);
      const components = [
        { axis: "X", value: side.x },
        { axis: "Y", value: side.y },
        { axis: "Z", value: side.z },
      ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const strongest = components[0];
      return `${strongest.value >= 0 ? "+" : "-"}${strongest.axis}`;
    }

    function updateCameraReadout() {
      if (!els.cameraReadout) return;
      if (!state.object) {
        els.cameraReadout.textContent = "View -";
        return;
      }
      els.cameraReadout.textContent = `View ${viewDirectionName()}  L/R ${axisLabel(state.leftRightAxisName)}  U/D ${axisLabel(state.upDownAxisName)}  heading ${state.axisHeadingDegrees.toFixed(1)}  tilt ${state.axisTiltDegrees.toFixed(1)}  roll ${state.axisRollDegrees.toFixed(1)}  theta ${state.orbitTheta.toFixed(2)}  phi ${state.orbitPhi.toFixed(2)}`;
    }

    function setAxesVisible(visible) {
      state.axesVisible = visible;
      const show = visible && Boolean(state.object);
      axisGroup.visible = show;
      els.axisReadout.classList.toggle("hidden", !show);
      els.toggleAxes.classList.toggle("primary", visible);
      els.toggleAxes.setAttribute("aria-pressed", visible ? "true" : "false");
      updateCameraReadout();
      requestRender(2);
    }

    function clearSceneObject(invalidatePendingLoad = true) {
      if (invalidatePendingLoad) {
        state.loadRequestId += 1;
        state.loadingEntryId = null;
      }
      cancelCameraAnimation();
      clearRouteUi();
      if (state.object) {
        scene.remove(state.object);
        disposeObject(state.object);
        state.object = null;
      }
      state.loadedEntryId = null;
      state.loadError = "";
      state.autoRotate = false;
      els.toggleAuto.classList.remove("primary");
      els.toggleAuto.setAttribute("aria-pressed", "false");
      clearAxisGroup();
      setPickPivotMode(false);
      state.fitBox = null;
      axisGroup.visible = false;
      els.axisReadout.classList.add("hidden");
      updateCameraReadout();
    }

    function computeGeometryCenter(object) {
      const center = new THREE.Vector3();
      const point = new THREE.Vector3();
      let count = 0;
      object.updateMatrixWorld(true);
      object.traverse((child) => {
        const geometry = child.geometry;
        if (!geometry) return;
        const position = geometry.getAttribute("position");
        if (!position) return;
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
          center.add(point);
        }
        count += position.count;
      });
      if (count > 0) center.divideScalar(count);
      return center;
    }

    function applyEntryOrientation(entry) {
      if (!state.object || !entry) return;
      const rotation = entry.model_rotation_degrees || {};
      state.object.rotation.set(
        THREE.MathUtils.degToRad(rotation.x || 0),
        THREE.MathUtils.degToRad(rotation.y || 0),
        THREE.MathUtils.degToRad(rotation.z || 0)
      );
      state.object.updateMatrixWorld(true);
    }

    function fitObject(object) {
      const entry = activeEntry();
      applyEntryOrientation(entry);
      let box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      const fitCenter = box.getCenter(new THREE.Vector3());
      object.position.sub(fitCenter);
      object.updateMatrixWorld(true);

      box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance = maxDim / (2 * Math.tan(limitingFov / 2));

      state.fitMaxDim = maxDim;
      state.fitDistance = distance;
      state.fitBox = box.clone();
      state.fitCenter.copy(center);
      state.minRadius = Math.max(maxDim * 0.08, 0.0001);
      state.maxRadius = Math.max(maxDim * 18, 10);
      state.boulderOrbitTarget.copy(center);
      const controls = entry?.orbit_controls || {};
      if (controls.pivot) {
        state.boulderOrbitTarget.set(
          Number(controls.pivot.x) || 0,
          Number(controls.pivot.y) || 0,
          Number(controls.pivot.z) || 0
        );
      }
      state.orbitTarget.copy(center);
      state.orbitTarget.copy(state.boulderOrbitTarget);
      rebuildAxes(box);
      const legacyOrbitAxes = (!controls.left_right_axis && entry?.camera_basis)
        ? legacyCameraBasisToOrbitAxes(entry.camera_basis)
        : null;
      setOrbitAxes(
        controls.left_right_axis || legacyOrbitAxes?.leftRightAxis || "pos-y",
        controls.up_down_axis || legacyOrbitAxes?.upDownAxis || "neg-z",
        false,
        Number(controls.axis_roll_degrees) || 0,
        Number(controls.axis_heading_degrees) || 0,
        Number(controls.axis_tilt_degrees) || 0
      );

      const view = entry?.initial_view || {};
      state.orbitRadius = distance * (view.radius_multiplier || 1.55);
      if (view.side) {
        setOrbitFromSideVector(axisVector(view.side));
      } else {
        state.orbitTheta = view.theta ?? 0;
        state.orbitPhi = view.phi ?? Math.PI / 2.35;
      }
      state.orbitRoll = view.roll ?? 0;

      camera.near = Math.max(distance / 1000, 0.0001);
      camera.far = Math.max(distance * 100, 10);
      camera.updateProjectionMatrix();
      updateCamera();
      state.defaultViewSide.copy(camera.position).sub(state.orbitTarget).normalize();
    }

    function geometryHasFaces(geometry, entry) {
      const counts = entry?.model?.ply_counts;
      if (counts && counts.faces === 0) return false;
      if (geometry.index && geometry.index.count >= 3) return true;
      return Boolean(counts && counts.faces > 0);
    }

    function materialForGeometry(geometry, asPoints = false) {
      const hasColor = Boolean(geometry.attributes.color);
      if (asPoints) {
        return new THREE.PointsMaterial({
          size: 0.01,
          vertexColors: hasColor,
          color: hasColor ? 0xffffff : 0xc6cbd1,
          sizeAttenuation: true,
        });
      }
      if (hasColor) {
        return new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      }
      return new THREE.MeshStandardMaterial({
        color: 0xa7abb0,
        roughness: 0.88,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
    }

    async function loadPly(entry) {
      const loader = new PLYLoader();
      const geometry = await loader.loadAsync(siteUrl(entry.model.url));
      geometry.computeBoundingBox();
      const asPoints = !geometryHasFaces(geometry, entry);
      if (!asPoints) geometry.computeVertexNormals();
      return asPoints
        ? new THREE.Points(geometry, materialForGeometry(geometry, true))
        : new THREE.Mesh(geometry, materialForGeometry(geometry, false));
    }

    async function loadGlb(entry) {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(siteUrl(entry.model.url));
      return gltf.scene;
    }

    async function loadObj(entry) {
      const loader = new OBJLoader();
      const object = await loader.loadAsync(siteUrl(entry.model.url));
      object.traverse((child) => {
        if (child.isMesh && !child.material) child.material = materialForGeometry(child.geometry, false);
      });
      return object;
    }

    async function loadStl(entry) {
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(siteUrl(entry.model.url));
      geometry.computeVertexNormals();
      return new THREE.Mesh(geometry, materialForGeometry(geometry, false));
    }

    async function loadActiveModel(entry = activeEntry()) {
      if (!entry || !entry.model) return;
      const requestId = state.loadRequestId + 1;
      state.loadRequestId = requestId;
      state.loadingEntryId = entry.id;
      state.loadError = "";
      document.getElementById("loading-text").textContent =
        `Loading ${entry.title} (${entry.model.size_mb} MB)...`;
      els.loading.style.display = "grid";
      els.empty.classList.add("hidden");
      clearSceneObject(false);
      try {
        const ext = entry.model.extension;
        let object;
        if (ext === ".ply") object = await loadPly(entry);
        else if (ext === ".glb" || ext === ".gltf") object = await loadGlb(entry);
        else if (ext === ".obj") object = await loadObj(entry);
        else if (ext === ".stl") object = await loadStl(entry);
        else throw new Error(`Unsupported model extension: ${ext}`);
        if (
          requestId !== state.loadRequestId ||
          state.activeEntryId !== entry.id
        ) {
          disposeObject(object);
          return;
        }
        state.object = object;
        state.loadedEntryId = entry.id;
        scene.add(object);
        fitObject(object);
        try {
          await loadEntryRoutes(entry, object);
        } catch (routeError) {
          if (requestId === state.loadRequestId) {
            console.warn(`Could not load route overlays: ${routeError.message}`);
            clearRouteUi();
          }
        }
      } catch (error) {
        if (requestId === state.loadRequestId) {
          state.loadError = `Could not load this model: ${error.message}`;
          els.empty.classList.remove("hidden");
        }
      } finally {
        if (requestId === state.loadRequestId) {
          state.loadingEntryId = null;
          els.loading.style.display = "none";
          updateDetail();
        }
      }
    }

    function filteredProjects() {
      const manifest = state.manifest;
      if (!manifest) return [];
      return manifest.projects
        .filter((project) => !state.category || project.category === state.category)
        .sort(
          (first, second) =>
            Number(first.sort_order ?? 100) - Number(second.sort_order ?? 100)
        );
    }

    function projectMatchesEntry(entry) {
      const query = state.search.trim().toLowerCase();
      if (!query) return true;
      const haystack = [
        entry.title,
        entry.relative_folder,
        entry.project_label,
        entry.model?.name,
        entry.viewer?.name,
        ...(entry.tags || []),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    }

    function activeProject() {
      if (!state.activeProjectId) return null;
      const projects = filteredProjects();
      return projects.find((project) => project.id === state.activeProjectId) || null;
    }

    function activeEntry() {
      if (!state.activeEntryId) return null;
      const project = activeProject();
      if (!project) return null;
      const entries = project.entries.filter(projectMatchesEntry);
      return entries.find((entry) => entry.id === state.activeEntryId) || null;
    }

    function setButtonHref(button, payload) {
      if (payload?.url) {
        button.href = siteUrl(payload.url);
        button.classList.remove("hidden");
      } else {
        button.removeAttribute("href");
        button.classList.add("hidden");
      }
    }

    function updateDetail() {
      const entry = activeEntry();
      setButtonHref(els.openViewer, entry?.viewer);
      setButtonHref(els.openModel, entry?.model);
      const isLoaded = Boolean(entry && state.object && state.loadedEntryId === entry.id);
      const isLoading = Boolean(entry && state.loadingEntryId === entry.id);
      els.viewerActions.classList.toggle("hidden", !isLoaded);
      els.viewerHint.classList.toggle("hidden", !isLoaded || state.viewerHintDismissed);
      els.viewReset.disabled = !isLoaded;
      els.toggleAuto.disabled = !isLoaded;
      els.viewFullscreen.disabled = !isLoaded;
      els.viewFullscreen.classList.toggle("hidden", !els.viewer?.requestFullscreen);
      els.copyId.disabled = !entry;

      const model = entry?.model;
      els.metricModel.textContent = model?.name || "viewer only";
      els.metricSize.textContent = model ? `${model.size_mb} MB` : (entry?.viewer ? `${entry.viewer.size_mb} MB viewer` : "-");
      els.metricVertices.textContent = model?.ply_counts?.vertices?.toLocaleString() || "-";
      els.metricFaces.textContent = model?.ply_counts?.faces?.toLocaleString() || "-";
      els.pathbox.textContent = model?.path || entry?.viewer?.path || "";

      if (!isLoaded) {
        if (state.loadError) {
          els.empty.textContent = state.loadError;
          els.empty.classList.remove("hidden");
        } else if (isLoading) {
          els.empty.classList.add("hidden");
        } else if (model) {
          els.empty.textContent = `Select ${entry.title} again to retry loading it.`;
          els.empty.classList.remove("hidden");
        } else if (entry?.viewer) {
          els.empty.textContent = "Use Open route viewer to view this project.";
          els.empty.classList.remove("hidden");
        } else {
          els.empty.textContent = "Select a model from the library.";
          els.empty.classList.remove("hidden");
        }
      } else {
        els.empty.classList.add("hidden");
      }
    }

    async function copyActiveEntryId() {
      const entry = activeEntry();
      if (!entry) return;
      try {
        await navigator.clipboard.writeText(entry.id);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = entry.id;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      const original = els.copyId.textContent;
      els.copyId.textContent = "Copied";
      window.setTimeout(() => { els.copyId.textContent = original; }, 900);
    }

    function renderProjects() {
      const projects = filteredProjects();
      els.projects.innerHTML = "";
      for (const project of projects) {
        const visibleEntries = project.entries.filter(projectMatchesEntry);
        for (const entry of visibleEntries) {
          const button = document.createElement("button");
          const isActive =
            project.id === state.activeProjectId &&
            entry.id === state.activeEntryId;
          button.className = "project-button" + (isActive ? " active" : "");
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
          button.innerHTML = `
            <span class="project-button__title">${entry.title}</span>
            <span class="project-button__description">${entry.description || project.label}</span>
          `;
          button.addEventListener("click", () => {
            const isAlreadyLoaded =
              state.activeEntryId === entry.id &&
              state.loadedEntryId === entry.id;
            const isAlreadyLoading =
              state.activeEntryId === entry.id &&
              state.loadingEntryId === entry.id;
            if (isAlreadyLoaded || isAlreadyLoading) return;
            clearSceneObject();
            state.activeProjectId = project.id;
            state.activeEntryId = entry.id;
            state.loadingEntryId = entry.model ? entry.id : null;
            render();
            if (entry.model) loadActiveModel(entry);
          });
          els.projects.appendChild(button);
        }
      }
    }

    function renderEntries() {
      els.entries.innerHTML = "";
      els.srkNote.classList.add("hidden");
    }

    function render() {
      const entry = activeEntry();
      const copyrightNotice =
        entry?.copyright_notice ||
        state.manifest?.copyright_notice ||
        "";
      els.projectTitle.textContent = entry?.title || "No model selected";
      els.projectMeta.textContent = entry
        ? [entry.description, copyrightNotice].filter(Boolean).join(" · ")
        : "";
      renderProjects();
      renderEntries();
      updateDetail();
    }

    async function boot() {
      state.manifest = loadEmbeddedManifest();
      const totals = state.manifest.totals;
      els.summary.textContent = `${totals.models} models`;
      try {
        if (window.localStorage.getItem("photogrammetryViewerHintSeen") === "true") {
          state.viewerHintDismissed = true;
        }
      } catch {
        // Storage is optional.
      }
      render();
      resize();
    }

    els.search.addEventListener("input", (event) => {
      state.search = event.target.value;
      state.activeEntryId = null;
      render();
    });
    els.category.addEventListener("change", (event) => {
      state.category = event.target.value;
      state.activeProjectId = null;
      state.activeEntryId = null;
      render();
    });
    els.copyId.addEventListener("click", copyActiveEntryId);
    els.toggleAxes.addEventListener("click", () => setAxesVisible(!state.axesVisible));
    els.viewFront.addEventListener("click", () => applyViewPreset("front"));
    els.viewLeft.addEventListener("click", () => applyViewPreset("left"));
    els.viewRight.addEventListener("click", () => applyViewPreset("right"));
    els.viewTop.addEventListener("click", () => applyViewPreset("top"));
    els.viewPosX.addEventListener("click", () => applyViewPreset("pos-x"));
    els.viewNegX.addEventListener("click", () => applyViewPreset("neg-x"));
    els.viewPosY.addEventListener("click", () => applyViewPreset("pos-y"));
    els.viewNegY.addEventListener("click", () => applyViewPreset("neg-y"));
    els.viewPosZ.addEventListener("click", () => applyViewPreset("pos-z"));
    els.viewNegZ.addEventListener("click", () => applyViewPreset("neg-z"));
    function applyAxisAdjustmentInput() {
      setOrbitAxes(
        state.leftRightAxisName,
        state.upDownAxisName,
        false,
        Number(els.axisRoll.value) || 0,
        Number(els.axisHeading.value) || 0,
        Number(els.axisTilt.value) || 0
      );
    }

    els.axisLeftRight.addEventListener("change", () => setOrbitAxes(els.axisLeftRight.value, state.upDownAxisName, false));
    els.axisUpDown.addEventListener("change", () => setOrbitAxes(state.leftRightAxisName, els.axisUpDown.value, false));
    els.axisHeading.addEventListener("input", applyAxisAdjustmentInput);
    els.axisHeading.addEventListener("change", applyAxisAdjustmentInput);
    els.axisTilt.addEventListener("input", applyAxisAdjustmentInput);
    els.axisTilt.addEventListener("change", applyAxisAdjustmentInput);
    els.axisRoll.addEventListener("input", applyAxisAdjustmentInput);
    els.axisRoll.addEventListener("change", applyAxisAdjustmentInput);
    els.pickPivot.addEventListener("click", () => setPickPivotMode(!state.pickPivotMode));
    els.centerPivot.addEventListener("click", resetPivotToCenter);
    els.copySetup.addEventListener("click", copyCurrentSetup);
    els.viewReset.addEventListener("click", resetObjectView);
    els.rotateX.addEventListener("click", () => rotateObject("x", 90));
    els.rotateY.addEventListener("click", () => rotateObject("y", 90));
    els.rotateZ.addEventListener("click", () => rotateObject("z", 90));
    els.rotateFlip.addEventListener("click", () => rotateObject("x", 180));
    els.toggleAuto.addEventListener("click", () => {
      cancelCameraAnimation();
      state.autoRotate = !state.autoRotate;
      els.toggleAuto.classList.toggle("primary", state.autoRotate);
      els.toggleAuto.setAttribute("aria-pressed", state.autoRotate ? "true" : "false");
      requestRender(state.autoRotate ? 3 : 1);
    });
    els.viewFullscreen.addEventListener("click", toggleFullscreen);
    els.routeToggleAll.addEventListener("click", toggleAllRoutes);
    els.cycleLight.addEventListener("click", cycleLight);

    boot().catch((error) => {
      els.summary.textContent = "Could not load manifest.";
      els.empty.textContent = error.message;
    });
