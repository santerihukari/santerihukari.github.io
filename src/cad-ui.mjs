import {createCoordinateIndicator} from './cad-orientation.mjs';
import {setupCadInputs} from './cad-inputs.mjs';

const viewers = new WeakMap();

export function mobileViewerLayout(viewportHeight, documentTop) {
  const preview = Math.max(1, Math.round(viewportHeight / 2));
  return {preview, controls: Math.max(160, Math.floor(viewportHeight - documentTop - preview - 8))};
}

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

export function resizeViewerProjection(camera, previousWidth, previousHeight, width, height, projection=camera) {
  if (Math.min(previousWidth,previousHeight,width,height)<=0) return;
  // Growing only the canvas height must not crop a model fitted to its width.
  const scale=Math.min(width/previousWidth,height/previousHeight);
  const vertical=height/previousHeight/scale;
  if(camera.isOrthographicCamera){
    const center=(projection.top+projection.bottom)/2,half=(projection.top-projection.bottom)*vertical/2;
    camera.top=center+half;camera.bottom=center-half;
  }else camera.fov=2*Math.atan(Math.tan(projection.fov*Math.PI/360)*vertical)*180/Math.PI;
  resizeCamera(camera,width,height);
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
  setupCadInputs(root);
  setupDownloads(root);
  setupFullscreen(root);
  const viewport = root.querySelector('.viewport, #latch-viewport');
  if (viewport) {
    createCoordinateIndicator(viewport,viewer.camera,viewer.controls);
    let width=viewport.clientWidth,height=viewport.clientHeight,wasFull=Boolean(root.closest('.is-full-window')),projection,applied;
    new ResizeObserver(() => {
      const full=Boolean(root.closest('.is-full-window'));
      if((full||wasFull)&&(width!==viewport.clientWidth||height!==viewport.clientHeight||full!==wasFull)){
        // Explicit Fit/view actions can replace the span while fullscreen is open.
        if(applied&&['fov','top','bottom'].some(key=>viewer.camera[key]!==applied[key]))projection=null;
        // Reuse one reference across rotation and exit, avoiding framing drift.
        projection||={width,height,fov:viewer.camera.fov,top:viewer.camera.top,bottom:viewer.camera.bottom};
        resizeViewerProjection(viewer.camera,projection.width,projection.height,viewport.clientWidth,viewport.clientHeight,projection);
        applied={fov:viewer.camera.fov,top:viewer.camera.top,bottom:viewer.camera.bottom};
      }
      width=viewport.clientWidth;height=viewport.clientHeight;wasFull=full;
      if(!full){projection=null;applied=null;}
      root.style.setProperty('--cad-view-height', `${height}px`);
    }).observe(viewport);
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
  const viewport = root.querySelector('.viewport, #latch-viewport');
  viewport.classList.add('cad-view-surface');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'cad-fullscreen-button';
  button.append(icon('maximize')); picker.append(button);
  const mobile = matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1100px) and (max-height:550px)');
  let scroll = window.scrollY, navigating = false;
  const active = () => shell.classList.contains('is-full-window');
  const layout = () => {
    shell.classList.toggle('is-mobile', mobile.matches);
    const visible = window.visualViewport;
    const height = visible?.height || innerHeight;
    shell.style.setProperty('--cad-window-height', `${height}px`);
    if (!active()) {
      const sizes = mobileViewerLayout(height, root.getBoundingClientRect().top + window.scrollY);
      root.style.setProperty('--cad-mobile-preview-height', `${sizes.preview}px`);
      root.style.setProperty('--cad-mobile-controls-height', `${sizes.controls}px`);
    }
  };
  const sync = () => {
    const full = active(); document.documentElement.classList.toggle('cad-fullscreen', full);
    if (full) {
      document.documentElement.style.setProperty('--cad-scroll-top', `${-scroll}px`);
      viewport.append(button); shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true');
    } else {
      picker.append(button); shell.removeAttribute('role'); shell.removeAttribute('aria-modal');
      document.documentElement.style.removeProperty('--cad-scroll-top');
    }
    button.replaceChildren(icon(full ? 'x' : 'maximize'));
    button.setAttribute('aria-pressed', String(full)); button.title = full ? 'Exit fullscreen' : 'Fullscreen';
    button.setAttribute('aria-label', button.title);
    if (!full && !navigating) { try { sessionStorage.removeItem('cad-fullscreen'); } catch {} window.scrollTo({top:scroll,behavior:'instant'}); }
    layout(); button.focus({preventScroll:true});
    window.dispatchEvent(new Event('resize'));
  };
  const exit = () => { shell.classList.remove('is-full-window'); sync(); };
  button.addEventListener('click', () => {
    if (active()) { exit(); return; }
    scroll = window.scrollY;
    shell.classList.add('is-full-window');
    for (const menu of viewport.querySelectorAll('details[open]')) menu.open = false;
    sync();
  });
  document.addEventListener('keydown', event => {
    if (!active()) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...shell.querySelectorAll('a[href],button,input,select,summary,textarea,[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !shell.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !shell.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });
  picker.querySelector('select')?.addEventListener('change', () => {
    if (active()) { navigating = true; try { sessionStorage.setItem('cad-fullscreen','1'); } catch {} }
  }, {capture:true});
  window.addEventListener('resize', layout, {passive:true});
  window.visualViewport?.addEventListener('resize', layout, {passive:true});
  mobile.addEventListener('change', layout);
  new ResizeObserver(layout).observe(picker);
  const header = document.querySelector('.site-header');
  if (header) new ResizeObserver(layout).observe(header);
  try { if (sessionStorage.getItem('cad-fullscreen') === '1') shell.classList.add('is-full-window'); } catch {}
  if (active()) sync();
  else { layout(); button.setAttribute('aria-pressed','false'); button.title='Fullscreen'; button.setAttribute('aria-label',button.title); }
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
