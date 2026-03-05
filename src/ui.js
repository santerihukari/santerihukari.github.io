// src/ui.js

export function createUI(rootEl, { modelMeta, allModels, currentModelKey, initialParams, onRender, onExportSTL }) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };

  // --- 1. Model Selector Dropdown ---
  const selectorContainer = document.createElement("div");
  selectorContainer.style.padding = "10px";
  selectorContainer.style.borderBottom = "1px solid #334155";
  selectorContainer.style.marginBottom = "10px";

  const selectorLabel = document.createElement("label");
  selectorLabel.textContent = "Select Model:";
  selectorLabel.style.display = "block";
  selectorLabel.style.marginBottom = "5px";
  selectorLabel.style.fontSize = "0.85rem";
  selectorLabel.style.color = "#94a3b8";

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.padding = "8px";
  select.style.backgroundColor = "#1e293b";
  select.style.color = "white";
  select.style.border = "1px solid #334155";
  select.style.borderRadius = "4px";

  // Populated from the MODELS registry
  Object.keys(allModels).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = allModels[key].meta.name;
    opt.selected = key === currentModelKey;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("model", select.value);
    // Clear old model params to avoid contamination
    const keysToKeep = ["model"];
    const params = new URLSearchParams();
    keysToKeep.forEach(k => params.set(k, url.searchParams.get(k)));
    window.location.href = url.pathname + "?" + params.toString();
  });

  selectorContainer.appendChild(selectorLabel);
  selectorContainer.appendChild(select);
  rootEl.appendChild(selectorContainer);

  // --- 2. Dynamic Parameter Inputs ---
  const container = document.createElement("div");
  container.className = "ui-container";
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
    input.style.backgroundColor = "#0f172a";
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

  // --- 3. Action Buttons ---
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
  renderBtn.style.border = "none";
  renderBtn.style.borderRadius = "4px";
  renderBtn.style.fontWeight = "bold";
  renderBtn.onclick = () => onRender({ ...state });

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.padding = "12px";
  exportBtn.style.cursor = "pointer";
  exportBtn.style.backgroundColor = "#475569";
  exportBtn.style.color = "white";
  exportBtn.style.border = "none";
  exportBtn.style.borderRadius = "4px";
  exportBtn.onclick = onExportSTL;

  btnRow.appendChild(renderBtn);
  btnRow.appendChild(exportBtn);
  rootEl.appendChild(btnRow);
}

// ... readParamsFromUrl and writeParamsToUrl stay the same ...
