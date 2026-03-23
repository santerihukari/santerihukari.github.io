function inferNumberStep(paramMeta) {
  if (typeof paramMeta.step === "number") return String(paramMeta.step);
  const values = [paramMeta.min, paramMeta.max, paramMeta.default].filter(
    (value) => typeof value === "number"
  );
  return values.some((value) => !Number.isInteger(value)) ? "0.1" : "1";
}

function parseCurveString(rawValue, fallbackValue) {
  const source = typeof rawValue === "string" && rawValue ? rawValue : fallbackValue;
  return String(source)
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [xRaw, yRaw] = token.split(",");
      return { x: Number(xRaw), y: Number(yRaw) };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x);
}

function serializeCurvePoints(points) {
  return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join("|");
}

function normalizeCurvePoints(points, paramMeta) {
  const yMin = typeof paramMeta.yMin === "number" ? paramMeta.yMin : 0;
  const yMax = typeof paramMeta.yMax === "number" ? paramMeta.yMax : 2;

  let normalized = points
    .map((point) => ({
      x: Math.min(1, Math.max(0, point.x)),
      y: Math.min(yMax, Math.max(yMin, point.y))
    }))
    .sort((a, b) => a.x - b.x);

  if (!normalized.length) {
    normalized = parseCurveString(paramMeta.default, paramMeta.default);
  }

  const deduped = [];
  normalized.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 1e-6) {
      previous.y = point.y;
    } else {
      deduped.push({ ...point });
    }
  });

  if (deduped[0].x > 0) {
    deduped.unshift({ x: 0, y: deduped[0].y });
  } else {
    deduped[0].x = 0;
  }

  if (deduped[deduped.length - 1].x < 1) {
    deduped.push({ x: 1, y: deduped[deduped.length - 1].y });
  } else {
    deduped[deduped.length - 1].x = 1;
  }

  return deduped;
}

function evaluateCurveSpline(points, t, paramMeta) {
  const yMin = typeof paramMeta.yMin === "number" ? paramMeta.yMin : 0;
  const yMax = typeof paramMeta.yMax === "number" ? paramMeta.yMax : 2;
  const u = Math.min(1, Math.max(0, t));

  if (points.length === 0) return 1;
  if (points.length === 1) return points[0].y;
  if (u <= points[0].x) return points[0].y;
  if (u >= points[points.length - 1].x) return points[points.length - 1].y;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const p1 = points[index];
    const p2 = points[index + 1];
    if (u < p1.x || u > p2.x) continue;

    const p0 = points[Math.max(0, index - 1)];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const segmentWidth = Math.max(1e-9, p2.x - p1.x);
    const localT = (u - p1.x) / segmentWidth;
    const m1 = ((p2.y - p0.y) / Math.max(1e-9, p2.x - p0.x)) * segmentWidth;
    const m2 = ((p3.y - p1.y) / Math.max(1e-9, p3.x - p1.x)) * segmentWidth;
    const t2 = localT * localT;
    const t3 = t2 * localT;
    const y =
      (2 * t3 - 3 * t2 + 1) * p1.y +
      (t3 - 2 * t2 + localT) * m1 +
      (-2 * t3 + 3 * t2) * p2.y +
      (t3 - t2) * m2;

    return Math.min(yMax, Math.max(yMin, y));
  }

  return points[points.length - 1].y;
}

function coerceValue(rawValue, paramMeta, fallbackValue) {
  if (paramMeta.type === "select" && Array.isArray(paramMeta.options)) {
    const matchedOption = paramMeta.options.find(
      (option) => String(option.value) === String(rawValue)
    );
    return matchedOption ? matchedOption.value : fallbackValue;
  }

  if (paramMeta.type === "curve") {
    const normalized = normalizeCurvePoints(parseCurveString(rawValue, fallbackValue), paramMeta);
    return serializeCurvePoints(normalized);
  }

  if (paramMeta.type === "text") {
    return String(rawValue ?? fallbackValue ?? "");
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : fallbackValue;
}

function writeParamsToUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  history.replaceState(null, "", url.toString());
}

export function writeModelToUrl(modelKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("model", modelKey);
  history.replaceState(null, "", url.toString());
}

function isParamVisible(paramMeta, state) {
  if (!paramMeta.visibleIf) return true;

  const rules = Array.isArray(paramMeta.visibleIf) ? paramMeta.visibleIf : [paramMeta.visibleIf];
  return rules.every((rule) => {
    const actual = state[rule.key];
    if (rule.op === ">=") return actual >= rule.value;
    if (rule.op === "<=") return actual <= rule.value;
    if (rule.op === ">") return actual > rule.value;
    if (rule.op === "<") return actual < rule.value;
    if (rule.op === "!=") return actual !== rule.value;
    return actual === rule.value;
  });
}

function createCurveEditor(field, state, paramMeta, onStateChange) {
  field.style.display = "grid";
  field.style.gap = "4px";
  field.style.alignSelf = "start";

  const labelRow = document.createElement("div");
  labelRow.style.display = "flex";
  labelRow.style.justifyContent = "space-between";
  labelRow.style.alignItems = "center";
  labelRow.style.gap = "10px";

  const label = document.createElement("label");
  label.textContent = paramMeta.label;
  label.style.color = "white";
  label.style.fontSize = "0.82rem";
  label.style.lineHeight = "1.2";
  label.title = paramMeta.description || "";
  labelRow.appendChild(label);

  const valueLabel = document.createElement("span");
  valueLabel.style.color = "#94a3b8";
  valueLabel.style.fontSize = "0.74rem";
  valueLabel.style.whiteSpace = "nowrap";
  labelRow.appendChild(valueLabel);
  field.appendChild(labelRow);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = "1 / 1";
  canvas.style.display = "block";
  canvas.style.background = "#0f172a";
  canvas.style.border = "1px solid #334155";
  canvas.style.borderRadius = "6px";
  canvas.style.touchAction = "none";
  canvas.title = paramMeta.description || "";
  field.appendChild(canvas);

  const hintRow = document.createElement("div");
  hintRow.style.color = "#64748b";
  hintRow.style.fontSize = "0.7rem";
  hintRow.textContent = "Click add, drag move, double/right click remove.";
  field.appendChild(hintRow);

  const metaRow = document.createElement("div");
  metaRow.style.display = "flex";
  metaRow.style.justifyContent = "space-between";
  metaRow.style.gap = "8px";
  metaRow.style.color = "#64748b";
  metaRow.style.fontSize = "0.72rem";
  const xLabel = document.createElement("span");
  xLabel.textContent = paramMeta.xLabel || "0 -> 1";
  const yLabel = document.createElement("span");
  yLabel.textContent = paramMeta.yLabel || "";
  metaRow.appendChild(xLabel);
  metaRow.appendChild(yLabel);
  field.appendChild(metaRow);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let points = normalizeCurvePoints(
    parseCurveString(state[paramMeta.key], paramMeta.default),
    paramMeta
  );
  let dragIndex = -1;

  const yMin = typeof paramMeta.yMin === "number" ? paramMeta.yMin : 0;
  const yMax = typeof paramMeta.yMax === "number" ? paramMeta.yMax : 2;
  const padding = { left: 20, right: 12, top: 10, bottom: 18 };
  let metrics = null;

  function ensureCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(160, Math.round(rect.width));
    const height = Math.max(160, Math.round(rect.height));

    if (!metrics || metrics.width !== width || metrics.height !== height) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      metrics = {
        width,
        height,
        plotWidth: width - padding.left - padding.right,
        plotHeight: height - padding.top - padding.bottom
      };
    }

    return metrics;
  }

  function pointToPixels(point) {
    const { plotWidth, plotHeight } = ensureCanvasSize();
    return {
      x: padding.left + point.x * plotWidth,
      y: padding.top + (1 - (point.y - yMin) / Math.max(1e-9, yMax - yMin)) * plotHeight
    };
  }

  function pixelsToPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const { width, height, plotWidth, plotHeight } = ensureCanvasSize();
    const px = Math.min(width - padding.right, Math.max(padding.left, clientX - rect.left));
    const py = Math.min(height - padding.bottom, Math.max(padding.top, clientY - rect.top));

    return {
      x: (px - padding.left) / Math.max(1e-9, plotWidth),
      y:
        yMin +
        (1 - (py - padding.top) / Math.max(1e-9, plotHeight)) * (yMax - yMin)
    };
  }

  function draw() {
    const ctx = canvas.getContext("2d");
    const { width, height, plotWidth, plotHeight } = ensureCanvasSize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#223047";
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const x = padding.left + (plotWidth * index) / 4;
      const y = padding.top + (plotHeight * index) / 4;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    if (yMin <= 1 && yMax >= 1) {
      const baselineY =
        padding.top + (1 - (1 - yMin) / Math.max(1e-9, yMax - yMin)) * plotHeight;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(padding.left, baselineY);
      ctx.lineTo(width - padding.right, baselineY);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((point, index) => {
      const pixel = pointToPixels(point);
      if (index === 0) ctx.moveTo(pixel.x, pixel.y);
      else ctx.lineTo(pixel.x, pixel.y);
    });
    ctx.stroke();

    ctx.strokeStyle = "#36f3a2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sampleIndex = 0; sampleIndex <= 96; sampleIndex += 1) {
      const t = sampleIndex / 96;
      const x = padding.left + t * plotWidth;
      const y =
        padding.top +
        (1 - (evaluateCurveSpline(points, t, paramMeta) - yMin) / Math.max(1e-9, yMax - yMin)) *
          plotHeight;

      if (sampleIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    points.forEach((point, index) => {
      const pixel = pointToPixels(point);
      ctx.fillStyle = index === dragIndex ? "#f59e0b" : "#ffffff";
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    valueLabel.textContent = `${points.length} pts`;
  }

  function updateState() {
    points = normalizeCurvePoints(points, paramMeta);
    state[paramMeta.key] = serializeCurvePoints(points);
    onStateChange(false);
    draw();
  }

  function findClosestPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    let bestIndex = -1;
    let bestDistance = 14;

    points.forEach((point, index) => {
      const pixel = pointToPixels(point);
      const dx = pixel.x - (clientX - rect.left);
      const dy = pixel.y - (clientY - rect.top);
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function insertPoint(point) {
    const nextPoints = [...points, point].sort((a, b) => a.x - b.x);
    points = nextPoints;
    return nextPoints.findIndex(
      (candidate) =>
        Math.abs(candidate.x - point.x) < 1e-6 && Math.abs(candidate.y - point.y) < 1e-6
    );
  }

  function removePoint(index) {
    if (index <= 0 || index >= points.length - 1) return;
    points.splice(index, 1);
    updateState();
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const hitIndex = findClosestPoint(event.clientX, event.clientY);

    if (event.button === 2) {
      removePoint(hitIndex);
      return;
    }

    if (hitIndex >= 0) {
      dragIndex = hitIndex;
    } else {
      dragIndex = insertPoint(pixelsToPoint(event.clientX, event.clientY));
      updateState();
    }

    canvas.setPointerCapture(event.pointerId);
    draw();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (dragIndex < 0) return;

    const nextPoint = pixelsToPoint(event.clientX, event.clientY);
    const minGap = 0.02;
    const isEndpoint = dragIndex === 0 || dragIndex === points.length - 1;

    points[dragIndex] = {
      x: isEndpoint
        ? dragIndex === 0
          ? 0
          : 1
        : Math.min(
            points[dragIndex + 1].x - minGap,
            Math.max(points[dragIndex - 1].x + minGap, nextPoint.x)
          ),
      y: nextPoint.y
    };

    updateState();
  });

  canvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
    removePoint(findClosestPoint(event.clientX, event.clientY));
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    removePoint(findClosestPoint(event.clientX, event.clientY));
  });

  const stopDrag = (event) => {
    if (dragIndex >= 0) {
      dragIndex = -1;
      canvas.releasePointerCapture?.(event.pointerId);
      draw();
    }
  };

  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("lostpointercapture", stopDrag);
  window.addEventListener("resize", draw, { passive: true });
  draw();
}

function createStandardField(field, state, paramMeta, onStateChange) {
  field.style.display = "grid";
  field.style.gridTemplateColumns = "minmax(0, 1fr) minmax(88px, 132px)";
  field.style.columnGap = "8px";
  field.style.rowGap = "1px";
  field.style.alignItems = "center";
  field.style.alignSelf = "start";
  field.style.minHeight = "30px";

  const labelText = document.createElement("label");
  labelText.textContent = paramMeta.label;
  labelText.style.color = "white";
  labelText.style.fontSize = "0.8rem";
  labelText.style.lineHeight = "1.15";
  labelText.title = paramMeta.description || "";
  field.appendChild(labelText);

  let input;

  if (paramMeta.type === "select") {
    input = document.createElement("select");
    input.style.padding = "2px 6px";
    input.style.minHeight = "26px";
    input.style.background = "#0f172a";
    input.style.color = "white";
    input.style.border = "1px solid #334155";
    input.style.borderRadius = "4px";
    input.style.fontSize = "0.78rem";

    paramMeta.options.forEach((optionMeta) => {
      const option = document.createElement("option");
      option.value = String(optionMeta.value);
      option.textContent = optionMeta.label;
      input.appendChild(option);
    });

    input.value = String(state[paramMeta.key]);
    input.title = [
      paramMeta.description,
      paramMeta.options.find((option) => String(option.value) === String(state[paramMeta.key]))
        ?.description
    ]
      .filter(Boolean)
      .join(" ");

    input.addEventListener("change", () => {
      state[paramMeta.key] = coerceValue(input.value, paramMeta, paramMeta.default);
      onStateChange(true);
    });
  } else if (paramMeta.type === "text") {
    input = document.createElement("input");
    input.type = "text";
    input.value = String(state[paramMeta.key] ?? "");
    input.style.padding = "2px 6px";
    input.style.minHeight = "26px";
    input.style.background = "#0f172a";
    input.style.color = "white";
    input.style.border = "1px solid #334155";
    input.style.borderRadius = "4px";
    input.style.fontSize = "0.76rem";
    input.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    input.title = paramMeta.description || "";
    if (paramMeta.placeholder) input.placeholder = paramMeta.placeholder;

    input.addEventListener("change", () => {
      state[paramMeta.key] = coerceValue(input.value, paramMeta, paramMeta.default);
      input.value = String(state[paramMeta.key]);
      onStateChange(true);
    });
  } else {
    input = document.createElement("input");
    input.type = "number";
    input.value = state[paramMeta.key];
    input.min = String(paramMeta.min);
    input.max = String(paramMeta.max);
    input.step = inferNumberStep(paramMeta);
    input.style.padding = "2px 6px";
    input.style.minHeight = "26px";
    input.style.background = "#0f172a";
    input.style.color = "white";
    input.style.border = "1px solid #334155";
    input.style.borderRadius = "4px";
    input.style.fontSize = "0.78rem";
    input.title = paramMeta.description || "";

    input.addEventListener("change", () => {
      state[paramMeta.key] = coerceValue(input.value, paramMeta, paramMeta.default);
      input.value = String(state[paramMeta.key]);
      onStateChange(true);
    });
  }

  field.appendChild(input);
}

function createGroupedField(groupField, groupParams, state, onStateChange) {
  groupField.style.display = "grid";
  groupField.style.gap = "4px";
  groupField.style.alignSelf = "start";
  groupField.style.padding = "4px 6px 6px";
  groupField.style.background = "rgba(15, 23, 42, 0.55)";
  groupField.style.border = "1px solid #243244";
  groupField.style.borderRadius = "6px";

  const heading = document.createElement("div");
  heading.textContent = groupParams[0].groupLabel || groupParams[0].label;
  heading.style.color = "white";
  heading.style.fontSize = "0.76rem";
  heading.style.fontWeight = "600";
  heading.style.lineHeight = "1.1";
  heading.title = groupParams[0].groupDescription || "";
  groupField.appendChild(heading);

  const inner = document.createElement("div");
  inner.style.display = "grid";
  inner.style.gap = "2px";
  groupField.appendChild(inner);

  groupParams.forEach((paramMeta) => {
    const field = document.createElement("div");
    createStandardField(field, state, paramMeta, onStateChange);
    inner.appendChild(field);
  });
}

export function createUI(
  rootEl,
  {
    modelMeta,
    modelDescription,
    allModels,
    currentModelKey,
    initialParams,
    canExport = false,
    onModelChange,
    onRender,
    onExportSTL
  }
) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
  const paramColumnCount = viewportWidth <= 820 ? 1 : viewportWidth <= 1280 ? 2 : 3;

  const header = document.createElement("div");
  header.style.display = "grid";
  header.style.gap = "6px";
  header.style.padding = "6px 10px 8px";
  header.style.borderBottom = "1px solid #334155";

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.padding = "8px";
  select.style.background = "#1e293b";
  select.style.color = "white";
  select.style.borderRadius = "6px";
  select.style.border = "1px solid #334155";

  Object.entries(allModels).forEach(([key, model]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = model.name;
    option.selected = key === currentModelKey;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    onModelChange(select.value);
  });

  header.appendChild(select);

  if (modelDescription) {
    const description = document.createElement("div");
    description.textContent = modelDescription;
    description.style.color = "#94a3b8";
    description.style.fontSize = "0.8rem";
    description.style.lineHeight = "1.35";
    header.appendChild(description);
  }

  rootEl.appendChild(header);

  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gridTemplateColumns = `repeat(${paramColumnCount}, minmax(0, 1fr))`;
  container.style.gap = "2px 10px";
  container.style.padding = "6px 10px 8px";
  rootEl.appendChild(container);

  const footer = document.createElement("div");
  footer.style.padding = "6px 10px 10px";
  footer.style.display = "flex";
  footer.style.flexWrap = "wrap";
  footer.style.gap = "6px";

  const renderBtn = document.createElement("button");
  renderBtn.textContent = "Render Model";
  renderBtn.style.padding = "10px 12px";
  renderBtn.style.background = "#2563eb";
  renderBtn.style.color = "white";
  renderBtn.style.border = "none";
  renderBtn.style.borderRadius = "6px";
  renderBtn.style.fontWeight = "bold";
  renderBtn.style.cursor = "pointer";
  renderBtn.style.flex = "1 1 220px";
  renderBtn.onclick = () => onRender({ ...state });

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.padding = "10px 12px";
  exportBtn.style.cursor = canExport ? "pointer" : "not-allowed";
  exportBtn.style.flex = "1 1 220px";
  exportBtn.disabled = !canExport;
  exportBtn.onclick = onExportSTL;

  footer.appendChild(renderBtn);
  footer.appendChild(exportBtn);
  rootEl.appendChild(footer);

  function handleStateChange(shouldRerenderFields) {
    writeParamsToUrl(state);
    if (shouldRerenderFields) renderFields();
  }

  function renderFields() {
    container.innerHTML = "";
    const visibleParams = modelMeta.params.filter((paramMeta) => isParamVisible(paramMeta, state));

    for (let index = 0; index < visibleParams.length; index += 1) {
      const paramMeta = visibleParams[index];

      if (paramMeta.type === "curve") {
        const curveParams = [];
        let curveIndex = index;

        while (curveIndex < visibleParams.length && visibleParams[curveIndex].type === "curve") {
          curveParams.push(visibleParams[curveIndex]);
          curveIndex += 1;
        }

        const curveRow = document.createElement("div");
        curveRow.style.gridColumn = "1 / -1";
        curveRow.style.display = "grid";
        curveRow.style.gridTemplateColumns =
          paramColumnCount <= 1
            ? "minmax(0, 1fr)"
            : curveParams.length === 1
              ? "minmax(260px, 460px)"
              : "repeat(2, minmax(260px, 460px))";
        curveRow.style.gap = "6px 10px";
        curveRow.style.justifyContent = paramColumnCount <= 1 ? "stretch" : "center";

        while (index < visibleParams.length && visibleParams[index].type === "curve") {
          const curveField = document.createElement("div");
          curveField.style.width = "100%";
          createCurveEditor(curveField, state, visibleParams[index], handleStateChange);
          curveRow.appendChild(curveField);
          index += 1;
        }

        index -= 1;
        container.appendChild(curveRow);
        continue;
      }

      if (paramMeta.groupKey) {
        const groupParams = [];
        let groupIndex = index;

        while (
          groupIndex < visibleParams.length &&
          visibleParams[groupIndex].groupKey === paramMeta.groupKey &&
          visibleParams[groupIndex].type !== "curve"
        ) {
          groupParams.push(visibleParams[groupIndex]);
          groupIndex += 1;
        }

        const groupField = document.createElement("div");
        groupField.style.alignSelf = "start";
        createGroupedField(groupField, groupParams, state, handleStateChange);
        container.appendChild(groupField);
        index = groupIndex - 1;
        continue;
      }

      const field = document.createElement("div");
      field.style.alignSelf = "start";
      if (paramMeta.columnSpan === "full") {
        field.style.gridColumn = "1 / -1";
      } else if (typeof paramMeta.columnSpan === "number") {
        field.style.gridColumn = `span ${Math.min(paramColumnCount, paramMeta.columnSpan)}`;
      }

      createStandardField(field, state, paramMeta, handleStateChange);
      container.appendChild(field);
    }
  }

  renderFields();
}

export function readParamsFromUrl(defaults, paramMetaList = []) {
  const url = new URL(window.location.href);
  const out = { ...defaults };
  const metaByKey = new Map(paramMetaList.map((paramMeta) => [paramMeta.key, paramMeta]));

  Object.keys(defaults).forEach((key) => {
    const rawValue = url.searchParams.get(key);
    if (rawValue === null) return;
    const paramMeta = metaByKey.get(key) || {};
    out[key] = coerceValue(rawValue, paramMeta, defaults[key]);
  });

  return out;
}
