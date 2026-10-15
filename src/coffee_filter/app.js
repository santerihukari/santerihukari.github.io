import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { defaults, parameters, selectLayout, selectProfile, editParameter, frontRiseMaximum } from './parameters.mjs';
import { createModelLink, readModelLink, profileForParameters } from './model-link.mjs';
import { defaultPaperDensity, checkedPaperDensity, paperStack } from './paper-preview.mjs';
import { registerViewer, resizeCamera } from '../cad-ui.mjs';
import { createInspector } from '../cad-inspector.mjs';

for (const p of parameters) {
  const element = document.createElement('div');
  element.className = `parameter${p.key === 'front_rise' ? ' emphasis' : ''}`;
  element.dataset.param = p.key;
  element.innerHTML = `<div class="parameter-head"><label for="${p.key}Number">${p.label}</label><span>${p.unit === 'deg' ? '&deg;' : p.unit}</span></div>
    <div class="parameter-inputs"><input id="${p.key}Range" aria-label="${p.label}" type="range" min="${p.min}" max="${p.max}" step="${p.step}"><input id="${p.key}Number" type="number" min="${p.min}" max="${p.max}" step="${p.step}" inputmode="decimal"></div>
    ${p.key === 'front_rise' ? '<output id="riseReadout" class="parameter-readout"></output>' : ''}`;
  document.querySelector(`[data-parameter-group="${p.key === 'usable_depth' ? 'basic' : p.group}"]`).appendChild(element);
}

let params = { ...defaults };
let initialLink = null;
let initialLinkError = '';
try {
  initialLink = readModelLink(window.location.href);
  if (initialLink) params = initialLink.parameters;
} catch (error) {
  initialLinkError = `Model link could not be opened: ${error.message} Reset parameters to start a new model.`;
}
let modelData = null;
let requestNumber = 0;
let updateTimer = null;
let exporting = false;
let copying = false;
let copyFeedbackTimer = null;
let currentView = "iso";
let holderObject = null;
let holderEdges = null;
let holderColor = "#16817d";
let fitPending = true;

const canvas = document.getElementById("modelCanvas");
const viewport = document.querySelector(".viewport");
const modelStatus = document.getElementById("modelStatus");
const previewTitle = document.getElementById("previewTitle");
const dimensions = document.getElementById("dimensions");
const errorBanner = document.getElementById("errorBanner");
const downloadButton = document.getElementById("downloadStl");
const downloadGlb = document.getElementById("downloadGlb");
const showPaper = document.getElementById("showPaper");
let paperDensity = initialLink?.preview.density ?? defaultPaperDensity;
let previewRevision = 0;
const densityInput = document.getElementById('paperDensity');
const densityRange = document.getElementById('paperDensityRange');
const preset = document.getElementById("preset");
const workbench = document.getElementById('coffeeWorkbench');
const copyLinkButton = document.getElementById('copyModelLink');
const copyLinkStatus = document.getElementById('copyLinkStatus');
const linkDialog = document.getElementById('modelLinkDialog');
const linkValue = document.getElementById('modelLinkValue');
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0xf4f7f5, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f7f5);
function updateTheme() {
  const color = getComputedStyle(viewport).backgroundColor;
  scene.background.set(color);
  renderer.setClearColor(color, 1);
}
new MutationObserver(updateTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
updateTheme();
const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 2000);
camera.up.set(0, 0, 1);
camera.position.set(-180, 220, 130);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minZoom = 0.35;
controls.maxZoom = 8;
controls.target.set(0, 8, 20);
registerViewer(workbench, { camera, controls });

scene.add(new THREE.AmbientLight(0xffffff, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(-100, 130, 200);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xd6ebdf, 1.3);
fillLight.position.set(100, -100, 90);
scene.add(fillLight);

const holderGroup = new THREE.Group();
const papersGroup = new THREE.Group();
scene.add(holderGroup, papersGroup);
const inspector = createInspector({scene,camera,canvas,root:workbench,objects:()=>new Map([['holder',holderObject],['papers',papersGroup]]),labelFor:id=>id==='holder'?'Coffee filter holder':'Filter papers (preview)'});

function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.dispose();
        }
      }
    });
    group.remove(child);
  }
}

function setStatus(label, state = "") {
  modelStatus.textContent = label;
  modelStatus.className = `status ${state}`;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  setStatus("Check dimensions", "error");
  downloadButton.disabled = true;
  downloadGlb.disabled = true;
  updateShareAvailability();
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function setHolderColor(color) {
  resetCopyFeedback();
  holderColor = color;
  if (holderObject) holderObject.material.color.set(color);
  if (holderEdges) holderEdges.material.color.copy(new THREE.Color(color).multiplyScalar(0.4));
}


function syncControls() {
  for (const input of [document.getElementById('front_riseRange'), document.getElementById('front_riseNumber')]) input.max = frontRiseMaximum(params.usable_depth);
  for (const [key, value] of Object.entries(params)) {
    const range = document.getElementById(`${key}Range`);
    const number = document.getElementById(`${key}Number`);
    if (range && number) {
      range.value = value;
      number.value = value;
    }
  }
  for (const button of document.querySelectorAll("[data-layout]")) {
    button.setAttribute("aria-pressed", String(button.dataset.layout === params.layout));
  }
  previewTitle.textContent = params.layout === 'symmetric' ? 'Symmetric holder' : params.layout === 'side_rest_right' ? 'Side-rest right' : 'Side-rest left';
  document.getElementById('coffeeMounting').value = params.mounting;
  document.querySelector('[data-param=screw_spacing]').hidden = params.mounting !== 'screws';
  document.getElementById("riseReadout").textContent =
    `Front sheet +${params.front_rise} mm over ${params.usable_depth} mm depth`;
  updatePaperReadout();
}

function updatePaperReadout() {
  const built = modelData?.parameters ?? params;
  const stack = paperStack(built.usable_depth, built.front_rise, paperDensity);
  densityInput.value = densityRange.value = paperDensity;
  document.getElementById('paperStackReadout').textContent = `${stack.count} paper previews; ${stack.spacing} mm spacing. Density ${paperDensity} per 10 mm.`;
  document.getElementById('paperSlopeReadout').textContent = `Slope ${stack.slope} (${(Math.atan(stack.slope) * 180 / Math.PI).toFixed(3)} deg).`;
  document.getElementById('frontAccessReadout').textContent = built.mounting === 'free_standing' ? 'No screw passages (self-standing).' : ({round:'Screw access: round front holes.', open_bottom:'Screw access: open-bottom front notches.', clear_below:'Screw access: below the raised front wall.'}[modelData?.front_access] ?? 'Preparing screw access.');
  workbench.dataset.paperDensity = String(paperDensity);
  workbench.dataset.paperCount = String(stack.count);
  workbench.dataset.paperSpacing = String(stack.spacing);
  workbench.dataset.paperSlope = String(stack.slope);
}

function scheduleUpdate() {
  resetCopyFeedback();
  clearTimeout(updateTimer);
  const sequence = ++requestNumber;
  downloadButton.disabled = true;
  downloadGlb.disabled = true;
  updateShareAvailability();
  setStatus('Updating');
  updateTimer = setTimeout(() => updateModel(sequence), 220);
}

function setParameter(key, value, paperParameter = false) {
  if (!Number.isFinite(value)) return;
  params = editParameter(params, key, value);
  if (paperParameter) preset.value = "custom";
  syncControls();
  scheduleUpdate();
}

for (const section of document.querySelectorAll(".parameter[data-param]")) {
  const key = section.dataset.param;
  const range = document.getElementById(`${key}Range`);
  const number = document.getElementById(`${key}Number`);
  const isPaperParameter = ["angle", "radius", "tip_cut"].includes(key);
  range.addEventListener("input", () => setParameter(key, Number(range.value), isPaperParameter));
  number.addEventListener("change", () => {
    const value = Number(number.value);
    const low = Number(number.min);
    const high = Number(number.max);
    if (number.value === "" || !Number.isFinite(value)) {
      number.value = params[key];
      return;
    }
    const clamped = Math.min(high, Math.max(low, value));
    const step = Number(range.step);
    const normalized = Number.isFinite(step) ? Number((low + Math.round((clamped - low) / step) * step).toFixed(6)) : clamped;
    setParameter(key, normalized, isPaperParameter);
  });
}

for (const button of document.querySelectorAll("[data-layout]")) {
  button.addEventListener("click", () => {
    if (params.layout === button.dataset.layout) return;
    params = selectLayout(params, button.dataset.layout);
    syncControls();
    scheduleUpdate();
  });
}

preset.addEventListener("change", () => {
  params = selectProfile(params, preset.value);
  syncControls();
  scheduleUpdate();
});
document.getElementById('coffeeMounting').addEventListener('change',event=>{params.mounting=event.target.value;syncControls();scheduleUpdate();});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#coffeeDownloads'))document.getElementById('coffeeDownloads').open=false;});
workbench.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('coffeeDownloads').open=false;});

document.getElementById("resetParams").addEventListener("click", () => {
  params = { ...defaults };
  preset.value = "measured";
  showPaper.checked = true;
  paperDensity = defaultPaperDensity;
  currentView = 'iso';
  camera.zoom = 1;
  fitPending = true;
  setHolderColor("#16817d");
  syncControls();
  scheduleUpdate();
});

function buildHolder(data) {
  disposeGroup(holderGroup);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: holderColor,
    metalness: 0.04,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  holderObject = new THREE.Mesh(geometry, material);
  holderObject.name = 'Coffee filter holder';
  holderGroup.add(holderObject);
  holderEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 30),
    new THREE.LineBasicMaterial({ color: new THREE.Color(holderColor).multiplyScalar(0.4), transparent: true, opacity: 0.36 }),
  );
  holderGroup.add(holderEdges);
}

function buildPapers() {
  ++previewRevision;
  disposeGroup(papersGroup);
  updatePaperReadout();
  if (!modelData || !showPaper.checked) {
    papersGroup.visible = false;
    inspector.refresh();
    return;
  }
  papersGroup.visible = true;
  const outline = modelData.paper_outline;
  const built = modelData.parameters;
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (const point of outline.slice(1)) shape.lineTo(point[0], point[1]);
  shape.closePath();
  const stack = paperStack(built.usable_depth, built.front_rise, paperDensity);
  for (let i = 0; i < stack.count; i += 1) {
    const [y, lift] = stack.positions[i];
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0xc28c53,
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    });
    const sheet = new THREE.Mesh(geometry, material);
    sheet.name = `Non-printing filter paper ${i + 1}`;
    sheet.userData.printable = false;
    sheet.position.set(0, y, lift - modelData.contact_z);
    sheet.renderOrder = 2 + i;
    papersGroup.add(sheet);

    const linePoints = outline.map(([x, z]) => new THREE.Vector3(x, y, z + lift - modelData.contact_z));
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(linePoints),
      new THREE.LineBasicMaterial({ color: 0x965d34, transparent: true, opacity: 0.72, depthTest: false }),
    );
    line.renderOrder = 20 + i;
    papersGroup.add(line);
  }
  inspector.refresh();
}

function frameModel(resetDirection = false) {
  if (!modelData) return;
  const bounds = modelData.bounds;
  const built = modelData.parameters;
  const low = new THREE.Vector3(bounds[0], bounds[1], bounds[2]);
  const high = new THREE.Vector3(bounds[3], bounds[4], bounds[5]);
  if (showPaper.checked) {
    for (const [x, z] of modelData.paper_outline) {
      low.x = Math.min(low.x, x);
      high.x = Math.max(high.x, x);
      low.z = Math.min(low.z, z - modelData.contact_z);
      high.z = Math.max(high.z, z - modelData.contact_z + built.front_rise);
    }
    low.y = Math.min(low.y, 0);
    high.y = Math.max(high.y, built.usable_depth);
  }
  const center = low.clone().add(high).multiplyScalar(0.5);
  const size = high.clone().sub(low);
  const viewportHeight = Math.max(1, viewport.clientHeight);
  const toolbar = viewport.querySelector('.coffee-toolbar');
  const viewBar = viewport.querySelector('.viewport-bar');
  const topInset = toolbar.offsetTop + toolbar.offsetHeight + 8;
  const bottomInset = viewportHeight - viewBar.offsetTop + 8;
  const usableHeight = Math.max(64, viewportHeight - topInset - bottomInset);
  const usableAspect = viewport.clientWidth / usableHeight;
  const aspect = viewport.clientWidth / viewportHeight;
  const halfHeight = 0.65 * Math.max((size.x + 20) / usableAspect, size.z + 20, size.y + 20) * viewportHeight / usableHeight;
  // Keep the initial framing clear of the floating controls while leaving the canvas full-height.
  const verticalOffset = halfHeight * (topInset - bottomInset) / viewportHeight;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight + verticalOffset;
  camera.bottom = -halfHeight + verticalOffset;
  camera.updateProjectionMatrix();

  let direction = camera.position.clone().sub(controls.target);
  if (resetDirection || direction.lengthSq() < 1) direction = new THREE.Vector3(-0.55, 1, 0.48);
  const distance = Math.max(250, Math.max(size.x, size.y, size.z) * 3);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
  controls.target.copy(center);
  camera.lookAt(center);
  controls.update();
}

function setView(view) {
  currentView = view;
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  }
  if (!modelData) return;
  const b = modelData.bounds;
  const center = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
  const vectors = {
    iso: new THREE.Vector3(-0.55, 1, 0.48),
    front: new THREE.Vector3(0, 1, 0.08),
    side: new THREE.Vector3(1, 0, 0.08),
    bottom: new THREE.Vector3(0, 0, -1),
  };
  camera.up.set(...(view === "bottom" ? [0, 1, 0] : [0, 0, 1]));
  camera.position.copy(center).add(vectors[view].normalize().multiplyScalar(400));
  controls.target.copy(center);
  frameModel();
}

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => setView(button.dataset.view));
}

showPaper.addEventListener("change", () => {
  resetCopyFeedback();
  buildPapers();
});
function editDensity(value) {
  try { paperDensity = checkedPaperDensity(Number(value)); }
  catch { densityInput.value = paperDensity; return; }
  resetCopyFeedback(); buildPapers();
}
densityInput.addEventListener('change', () => editDensity(densityInput.value));
densityRange.addEventListener('input', () => editDensity(densityRange.value));
document.getElementById('coffeeFit').addEventListener('click', () => frameModel());

function updateModel(sequence = ++requestNumber) {
  setStatus("Updating");
  clearError();
  downloadButton.disabled = true;
  downloadGlb.disabled = true;
  updateShareAvailability();
  worker.postMessage({ sequence, parameters: { ...params } });
}

worker.onmessage = ({ data: message }) => {
  if (message.sequence !== requestNumber) return;
  if (message.error) { showError(message.error); return; }
  try {
    const data = message.result;
    data.sequence = message.sequence;
    modelData = data;
    buildHolder(data);
    buildPapers();
    if (fitPending) { setView(currentView); fitPending = false; }
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === currentView));
    const b = data.bounds;
    dimensions.textContent = `${(b[3] - b[0]).toFixed(1)} × ${(b[4] - b[1]).toFixed(1)} × ${(b[5] - b[2]).toFixed(1)} mm`;
    setStatus("Ready", "ready");
    modelStatus.dataset.buildSequence = String(message.sequence);
    downloadButton.disabled = exporting;
    downloadGlb.disabled = exporting;
    updateShareAvailability();
  } catch (error) {
    showError(error.message);
  }
};
worker.onerror = () => showError('The geometry engine could not start. Reload to try again.');

function updateShareAvailability() {
  copyLinkButton.disabled = copying || !modelData || modelData.sequence !== requestNumber || !errorBanner.hidden;
}

function resetCopyFeedback() {
  clearTimeout(copyFeedbackTimer);
  copyLinkButton.querySelector('[data-copy-icon]').hidden = false;
  copyLinkButton.querySelector('[data-copied-icon]').hidden = true;
  copyLinkButton.title = 'Copy model link';
  copyLinkButton.setAttribute('aria-label', 'Copy model link');
  copyLinkStatus.textContent = '';
}

function fallbackCopyLink(value) {
  const focus = document.activeElement;
  const area = document.createElement('textarea');
  area.value = value;
  area.readOnly = true;
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  document.body.appendChild(area);
  area.select();
  try { return document.execCommand('copy'); }
  catch { return false; }
  finally { area.remove(); focus?.focus({ preventScroll: true }); }
}

copyLinkButton.addEventListener('click', async () => {
  if (copyLinkButton.disabled) return;
  const restoreFocus = document.activeElement === copyLinkButton;
  const link = createModelLink(window.location.href, modelData.parameters, {
    color: holderColor, papers: showPaper.checked, density: paperDensity
  });
  copying = true;
  updateShareAvailability();
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(link); copied = true; }
      catch { copied = fallbackCopyLink(link); }
    } else copied = fallbackCopyLink(link);
    if (copied) {
      resetCopyFeedback();
      copyLinkButton.querySelector('[data-copy-icon]').hidden = true;
      copyLinkButton.querySelector('[data-copied-icon]').hidden = false;
      copyLinkButton.title = 'Model link copied';
      copyLinkButton.setAttribute('aria-label', 'Model link copied');
      copyLinkStatus.textContent = 'Model link copied.';
      copyFeedbackTimer = setTimeout(resetCopyFeedback, 2500);
    } else {
      linkValue.value = link;
      linkDialog.showModal();
      linkValue.focus();
      linkValue.select();
    }
  } finally {
    copying = false;
    updateShareAvailability();
    if (restoreFocus && !linkDialog.open && !copyLinkButton.disabled) copyLinkButton.focus({ preventScroll: true });
  }
});

linkDialog.addEventListener('close', () => {
  if (!copyLinkButton.disabled) copyLinkButton.focus({ preventScroll: true });
});
linkDialog.addEventListener('click', event => {
  const bounds = linkDialog.getBoundingClientRect();
  if (event.target === linkDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) linkDialog.close();
});

function saveFile(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportModel(format) {
  if (!modelData || modelData.sequence !== requestNumber || exporting || !errorBanner.hidden) return;
  exporting = true;
  downloadButton.disabled = downloadGlb.disabled = true;
  const snapshot = modelData, paperState = showPaper.checked, paperRevision = previewRevision;
  const filename = `coffee_filter_holder_${snapshot.parameters.layout}_${snapshot.parameters.mounting}_${snapshot.parameters.angle}deg.${format}`;
  const exportRoot = new THREE.Group();
  exportRoot.userData={parameters:snapshot.parameters,original_design_copyright:'Santeri Hukari',physical_status:'Experimental fit; not physically validated'};
  try {
    if (format === 'stl') {
      saveFile(new STLExporter().parse(holderObject, { binary: true }), filename, 'model/stl');
    } else {
      for (const object of [holderObject, ...(showPaper.checked ? papersGroup.children.filter(child => child.isMesh) : [])]) {
        const copy = object.clone();
        copy.geometry = object.geometry.clone();
        copy.material = object.material.clone();
        exportRoot.add(copy);
      }
      exportRoot.rotation.x = -Math.PI / 2;
      exportRoot.scale.setScalar(0.001);
      exportRoot.updateMatrixWorld(true);
      const bytes = await new GLTFExporter().parseAsync(exportRoot, { binary: true });
      if (snapshot === modelData && snapshot.sequence === requestNumber && paperState === showPaper.checked && paperRevision === previewRevision && errorBanner.hidden) saveFile(bytes, filename, 'model/gltf-binary');
    }
  } catch (error) {
    showError(error.message);
  } finally {
    disposeGroup(exportRoot);
    exporting = false;
    const unavailable = !errorBanner.hidden || modelData.sequence !== requestNumber;
    downloadButton.disabled = downloadGlb.disabled = unavailable;
  }
}
downloadButton.addEventListener('click', () => exportModel('stl'));
downloadGlb.addEventListener('click', () => exportModel('glb'));

function resizeRenderer() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height, false);
  resizeCamera(camera, width, height);
}

new ResizeObserver(resizeRenderer).observe(viewport);
function updateHeight() {
  workbench.style.setProperty('--coffee-height', `${Math.max(180, (window.visualViewport?.height || innerHeight) - workbench.getBoundingClientRect().top - 8)}px`);
}
updateHeight();
window.addEventListener('resize', updateHeight, { passive: true });
window.visualViewport?.addEventListener('resize', updateHeight, { passive: true });
const siteHeader = document.querySelector('.site-header');
if (siteHeader) new ResizeObserver(updateHeight).observe(siteHeader);
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  inspector.update();
  renderer.render(scene, camera);
}

if (initialLink) {
  preset.value = profileForParameters(params);
  showPaper.checked = initialLink.preview.papers;
  const color = initialLink.preview.color;
  setHolderColor(color);
}
syncControls();
resizeRenderer();
animate();
if (initialLinkError) showError(initialLinkError);
else updateModel();
