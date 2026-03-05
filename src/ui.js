// src/ui.js

export function createUI(rootEl, { modelMeta, initialParams, onRender, onExportSTL }) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };

  const title = document.createElement("h2");
  title.textContent = modelMeta.name;
  title.style.margin = "10px";
  rootEl.appendChild(title);

  const container = document.createElement("div");
  container.className = "ui-container";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "1fr 80px";
  container.style.gap = "8px";
  container.style.padding = "10px";

  modelMeta.params.forEach(f => {
    const label = document.createElement("label");
    label.textContent = f.label;
    
    const input = document.createElement("input");
    input.type = "number";
    input.value = state[f.key];
    
    input.addEventListener("change", () => {
      state[f.key] = Number(input.value);
      writeParamsToUrl(state);
    });

    container.appendChild(label);
    container.appendChild(input);
  });

  rootEl.appendChild(container);

  const btnRow = document.createElement("div");
  btnRow.style.padding = "10px";
  btnRow.style.display = "flex";
  btnRow.style.flexDirection = "column";
  btnRow.style.gap = "10px";

  const renderBtn = document.createElement("button");
  renderBtn.textContent = "Render Model";
  renderBtn.style.padding = "12px";
  renderBtn.style.cursor = "pointer";
  renderBtn.style.backgroundColor = "#2563eb";
  renderBtn.style.color = "white";
  renderBtn.onclick = () => onRender({ ...state });

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.padding = "12px";
  exportBtn.onclick = onExportSTL;

  btnRow.appendChild(renderBtn);
  btnRow.appendChild(exportBtn);
  rootEl.appendChild(btnRow);
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
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  history.replaceState(null, "", url.toString());
}
