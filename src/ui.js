// src/ui.js

export function createUI(rootEl, { modelMeta, allModels, currentModelKey, initialParams, onRender, onExportSTL }) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };

  // 1. Dropdown Selection
  const header = document.createElement("div");
  header.style.padding = "10px";
  header.style.borderBottom = "1px solid #334155";

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.padding = "10px";
  select.style.background = "#1e293b";
  select.style.color = "white";
  select.style.borderRadius = "4px";

  Object.keys(allModels).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = allModels[key].meta.name;
    opt.selected = key === currentModelKey;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const newUrl = new URL(window.location.origin + window.location.pathname);
    newUrl.searchParams.set("model", select.value);
    window.location.href = newUrl.href;
  });

  header.appendChild(select);
  rootEl.appendChild(header);

  // 2. Numerical Inputs
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gridTemplateColumns = "1fr 80px";
  container.style.gap = "8px";
  container.style.padding = "10px";

  modelMeta.params.forEach(f => {
    const label = document.createElement("label");
    label.textContent = f.label;
    label.style.alignSelf = "center";
    
    const input = document.createElement("input");
    input.type = "number";
    input.value = state[f.key];
    input.style.padding = "4px";
    input.style.background = "#0f172a";
    input.style.color = "white";
    input.style.border = "1px solid #334155";
    
    input.addEventListener("change", () => {
      state[f.key] = Number(input.value);
      writeParamsToUrl(state);
    });

    container.appendChild(label);
    container.appendChild(input);
  });

  rootEl.appendChild(container);

  // 3. Actions
  const footer = document.createElement("div");
  footer.style.padding = "10px";
  footer.style.display = "flex";
  footer.style.flexDirection = "column";
  footer.style.gap = "8px";

  const renderBtn = document.createElement("button");
  renderBtn.textContent = "Render Model";
  renderBtn.style.padding = "12px";
  renderBtn.style.background = "#2563eb";
  renderBtn.style.color = "white";
  renderBtn.style.border = "none";
  renderBtn.style.borderRadius = "4px";
  renderBtn.style.fontWeight = "bold";
  renderBtn.style.cursor = "pointer";
  renderBtn.onclick = () => onRender({ ...state });

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.padding = "12px";
  exportBtn.style.cursor = "pointer";
  exportBtn.onclick = onExportSTL;

  footer.appendChild(renderBtn);
  footer.appendChild(exportBtn);
  rootEl.appendChild(footer);
}

export function readParamsFromUrl(defaults) {
  const url = new URL(window.location.href);
  const out = { ...defaults };
  Object.keys(defaults).forEach(k => {
    const v = url.searchParams.get(k);
    if (v !== null) out[k] = Number(v);
  });
  return out;
}

function writeParamsToUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  history.replaceState(null, "", url.toString());
}
