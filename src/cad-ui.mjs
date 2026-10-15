import {createCoordinateIndicator} from './cad-orientation.mjs';

const viewers = new WeakMap();

export function resizeCamera(camera, width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  if (camera.isOrthographicCamera) {
    const halfHeight = (camera.top - camera.bottom) / 2;
    const center = (camera.left + camera.right) / 2;
    camera.left = center - halfHeight * aspect;
    camera.right = center + halfHeight * aspect;
  } else camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

export function cameraState(root) {
  const viewer = viewers.get(typeof root === 'string' ? document.querySelector(root) : root);
  if (!viewer) return null;
  return {
    position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(),
    quaternion: viewer.camera.quaternion.toArray(), zoom: viewer.camera.zoom,
    projection: viewer.camera.projectionMatrix.toArray()
  };
}

export function registerViewer(root, viewer) {
  viewers.set(root, viewer);
  root.classList.add('cad-workbench');
  setupControlPanel(root);
  setupDownloads(root);
  setupFullscreen(root);
  const viewport = root.querySelector('.viewport, #latch-viewport');
  if (viewport) {
    createCoordinateIndicator(viewport,viewer.camera,viewer.controls);
    new ResizeObserver(() => root.style.setProperty('--cad-view-height', `${viewport.clientHeight}px`)).observe(viewport);
  }
}

function icon(name) {
  const image = document.createElement('img'); image.alt = '';
  image.src = new URL(`../assets/icons/${name}.svg`, import.meta.url).href;
  return image;
}

function setupDownloads(root) {
  const formats = {
    downloadStl:'STL', downloadGlb:'GLB', droneStl:'STL', droneGlb:'GLB',
    droneParametersDownload:'JSON', droneReportDownload:'JSON', droneCreditsDownload:'TXT',
    'latch-download':'STL', 'latch-glb':'GLB', damperSTL:'STL', damperZIP:'ZIP', damperGLB:'GLB'
  };
  const formatButtons = root.querySelectorAll('button');
  for (const button of formatButtons) {
    if (!formats[button.id] && button.id !== 'volumeDownload') continue;
    const accessibleLabel = button.getAttribute('aria-label');
    const original = document.createElement('span'); original.className = 'cad-export-label';
    while (button.firstChild) original.append(button.firstChild);
    const badge = document.createElement('small'); badge.className = 'cad-format-badge';
    button.append(original, icon('download'), badge); button.classList.add('cad-download-file');
    const update = () => {
      const format = formats[button.id] || ({ stl:'STL', svg:'SVG', support_stl:'STL', zip:'ZIP', glb:'GLB', report:'JSON', params:'JSON' }[root.querySelector('#volumeExportKind')?.value] || 'STL');
      badge.textContent = format; button.dataset.format = format;
      button.title ||= `Download ${original.textContent.trim() || format}`;
      button.setAttribute('aria-label', accessibleLabel || `Download ${original.textContent.trim() || format}`);
    };
    new MutationObserver(update).observe(original, {childList:true,subtree:true,characterData:true});
    root.querySelector('#volumeExportKind')?.addEventListener('change', update); update();
  }
  for (const trigger of root.querySelectorAll('#droneExport, #volumeExport, #latch-downloads>summary, #damperDownloads>summary, #coffeeDownloads>summary')) {
    trigger.replaceChildren(icon('download'), icon('chevron-down')); trigger.classList.add('cad-download-trigger');
    trigger.title = 'Download options'; trigger.setAttribute('aria-label', 'Download options');
  }
}

function setupFullscreen(root) {
  const picker = document.querySelector('.cad-model-picker');
  if (!picker || picker.closest('.cad-app')) return;
  const shell = document.createElement('section'); shell.className = 'cad-app';
  shell.setAttribute('aria-label', 'Parametric model library'); picker.before(shell); shell.append(picker, root);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'cad-fullscreen-button';
  button.append(icon('maximize')); picker.append(button);
  let scroll = 0, navigating = false;
  const active = () => document.fullscreenElement === shell || shell.classList.contains('is-full-window');
  const sync = () => {
    const full = active(); document.documentElement.classList.toggle('cad-fullscreen', full);
    button.setAttribute('aria-pressed', String(full)); button.title = full ? 'Exit fullscreen' : 'Fullscreen';
    button.setAttribute('aria-label', button.title);
    if (!full && !navigating) { try { sessionStorage.removeItem('cad-fullscreen'); } catch {} window.scrollTo({top:scroll,behavior:'instant'}); }
  };
  const exit = async () => {
    shell.classList.remove('is-full-window');
    if (document.fullscreenElement === shell) await document.exitFullscreen(); sync();
  };
  button.addEventListener('click', async () => {
    if (active()) { await exit(); return; }
    scroll = window.scrollY;
    try { if (!shell.requestFullscreen) throw new Error('Fullscreen unavailable'); await shell.requestFullscreen(); }
    catch { shell.classList.add('is-full-window'); }
    sync();
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && shell.classList.contains('is-full-window')) exit(); });
  picker.querySelector('select')?.addEventListener('change', () => {
    if (active()) { navigating = true; try { sessionStorage.setItem('cad-fullscreen','1'); } catch {} }
  }, {capture:true});
  try { if (sessionStorage.getItem('cad-fullscreen') === '1') shell.classList.add('is-full-window'); } catch {}
  sync();
}

function setupControlPanel(root) {
  const panel = root.querySelector('aside');
  if (!panel || panel.closest('.cad-control-region')) return;
  const region = document.createElement('div'); region.className = 'cad-control-region';
  const content = document.createElement('div'); content.className = 'cad-panel-content';
  while (panel.firstChild) content.append(panel.firstChild);
  panel.append(content); panel.before(region); region.append(panel);
  panel.id ||= `${root.id}Controls`;
  const rail = document.createElement('div'); rail.className = 'cad-scroll-rail';
  rail.setAttribute('role', 'scrollbar'); rail.setAttribute('aria-label', 'Scroll controls');
  rail.setAttribute('aria-controls', panel.id); rail.setAttribute('aria-orientation', 'vertical');
  rail.title = 'Scroll controls';
  const grip = document.createElement('img'); grip.alt = '';
  grip.src = new URL('../assets/icons/grip-vertical.svg', import.meta.url).href;
  rail.append(grip); region.append(rail);
  const update = () => {
    region.classList.toggle('has-expanded', Boolean(content.querySelector(':scope > details.cad-options[open]')));
    const style = getComputedStyle(panel);
    root.style.setProperty('--cad-content-height', `${Math.ceil(content.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom))}px`);
    const maximum = Math.max(0, panel.scrollHeight - panel.clientHeight);
    rail.setAttribute('aria-valuemin', '0'); rail.setAttribute('aria-valuemax', String(maximum));
    rail.setAttribute('aria-valuenow', String(Math.round(panel.scrollTop)));
    rail.setAttribute('aria-disabled', String(maximum <= 1)); rail.tabIndex = maximum > 1 ? 0 : -1;
    rail.classList.toggle('can-scroll', maximum > 1);
  };
  let drag;
  rail.addEventListener('pointerdown', event => {
    if (event.button !== 0 || rail.getAttribute('aria-disabled') === 'true') return;
    drag = { id: event.pointerId, y: event.clientY, scroll: panel.scrollTop };
    rail.setPointerCapture(event.pointerId); rail.focus({ preventScroll: true }); event.preventDefault();
  });
  rail.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    panel.scrollTop = drag.scroll + drag.y - event.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) rail.addEventListener(name, () => { drag = null; });
  rail.addEventListener('wheel', event => {
    const previous = panel.scrollTop; panel.scrollTop += event.deltaY * (event.deltaMode === 1 ? 20 : 1);
    if (panel.scrollTop !== previous) event.preventDefault();
  }, { passive: false });
  rail.addEventListener('keydown', event => {
    const step = { ArrowDown: 40, ArrowUp: -40, PageDown: panel.clientHeight * .8, PageUp: -panel.clientHeight * .8 }[event.key];
    if (step !== undefined) panel.scrollTop += step;
    else if (event.key === 'Home') panel.scrollTop = 0;
    else if (event.key === 'End') panel.scrollTop = panel.scrollHeight;
    else return;
    event.preventDefault();
  });
  panel.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(content);
  new ResizeObserver(update).observe(region);
  update();
}

const picker = typeof document === 'undefined' ? null : document.getElementById('cadModel');
picker?.addEventListener('change', () => {
  const url = new URL(picker.value, location.href);
  if (url.origin === location.origin) location.assign(url.href);
});
