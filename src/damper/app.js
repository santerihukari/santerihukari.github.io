import * as THREE from 'three';
import { publicAssetUrl } from '../public-assets.mjs';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { createViewer, save } from '../cad-viewer.mjs';
import { exportParts, printPartFor, springGeometry, travel } from './geometry.mjs';
import { registerViewer } from '../cad-ui.mjs';
import { DEFAULTS, CONTROLS, validateSettings } from './sealed-parameters.mjs';
import { createModelLink, readModelLink } from './model-link.mjs';

const root = document.getElementById('damperWorkbench'), $ = id => document.getElementById(`damper${id}`);
const asset = name => new URL(publicAssetUrl(new URL(`../../assets/cad/air-damper/${name}`, import.meta.url).href));
const rows = new Map(), full = new Map(), sections = new Map(), visible = new Map(), centers = new Map(), fields = new Map(), ranges = new Map();
const legacyText = Object.fromEntries(['PrintSummary', 'Warning', 'ReferenceLabel'].map(id => [id, $(id).textContent]));
let data, baselinePromise, design = 'legacy', settings = { ...DEFAULTS };
let stroke = 0, explosion = 0, playing = false, phase = 0, lastTime = 0;
let sequence = 0, readySequence = -1, timer, worker, workerReady, workerReject, workerTimeout;
let glbBusy = false, invalid = false, fitSequence = -1;
let strokeRevision = 0, previousStroke = 0;
const paths = new THREE.Group(), cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const viewer = createViewer($('Canvas'), name => {
  for (const [key, row] of rows) row.querySelector('button').setAttribute('aria-pressed', String(key === name));
  const part = data?.parts.find(part => part.name === name), file = part?.print_part || printPartFor(name || '');
  if (data?.print_manifest.some(item => item.part === file)) { $('PrintPart').value = file; quantity(); }
});
registerViewer(root, { camera: viewer.camera, controls: viewer.controls });

function geometry(positions, indices) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setIndex(Array.from(indices)); result.computeVertexNormals(); return result;
}
function current() { return Boolean(data && !invalid && readySequence === sequence); }
function exportControls() {
  for (const id of ['STL', 'ZIP', 'Report', 'PrintPart', 'Copy']) $(id).disabled = !current();
  $('GLB').disabled = !current() || glbBusy;
  root.setAttribute('aria-busy', String(!invalid && readySequence !== sequence));
}
function clearError() { $('Error').hidden = true; $('Error').textContent = ''; }
function failure(error) { $('Error').textContent = error.message || String(error); $('Error').hidden = false; }
function invalidate() {
  clearTimeout(timer); sequence++; readySequence = -1; playing = false; syncPlay(); exportControls();
  return sequence;
}
function syncPlay() {
  $('Play').setAttribute('aria-pressed', String(playing));
  $('Play').setAttribute('aria-label', playing ? 'Pause motion' : 'Play motion');
  $('Play').title = playing ? 'Pause motion' : 'Play motion';
  $('PlayIcon').src = asset(`icons/${playing ? 'pause' : 'play'}.svg`).href;
}
function quantity() {
  const item = data?.print_manifest.find(item => item.part === $('PrintPart').value);
  $('Quantity').textContent = item ? `Print ${item.quantity} | ${item.dimensions_mm.map(v => v.toFixed(2)).join(' x ')} mm` : '';
}
function motion() {
  if (!data) return;
  if (stroke !== previousStroke) { strokeRevision++; previousStroke = stroke; }
  const spring = full.get('spring');
  if (spring) {
    const shape = springGeometry(data.parameters, stroke), position = spring.getAttribute('position');
    position.array.set(shape.positions); position.needsUpdate = true;
    spring.computeVertexNormals(); spring.computeBoundingSphere();
  }
  for (const part of data.parts) {
    const mesh = viewer.objects.get(part.name), center = centers.get(part.name);
    mesh.position.set(part.moving ? stroke : 0, 0, 0); mesh.scale.set(1, 1, 1);
    if (explosion) {
      const sign = part.name.includes('rear') ? 1 : part.name.includes('front') ? -1 : 0;
      mesh.position.x += sign * explosion; mesh.position.y += (center.y > 1 ? 1 : center.y < -1 ? -1 : 0) * explosion;
    }
  }
  const gap = paths.children.find(line => line.name === 'gap');
  if (gap) gap.position.x = stroke;
  $('Stroke').value = $('StrokeNumber').value = stroke.toFixed(1);
  const p = data.parameters;
  $('Metrics').textContent = `Spring seats ${(p.chamber_length - p.piston_length - stroke).toFixed(1)} mm | Stop reserve ${(data.maximum_stroke_mm - stroke).toFixed(1)} mm`;
}
function appearance() {
  if (!data) return;
  const cut = $('Section').checked, refs = $('References').checked;
  for (const part of data.parts) {
    const mesh = viewer.objects.get(part.name);
    mesh.geometry = cut && !part.reference && sections.has(part.name) ? sections.get(part.name) : full.get(part.name);
    mesh.visible = visible.get(part.name) && (part.reference ? refs : !cut || sections.has(part.name));
    mesh.material.clippingPlanes = cut && part.reference ? [cutPlane] : [];
  }
  paths.visible = $('Air').checked;
}
function modeControls() {
  const sealed = design === 'sealed';
  $('Design').value = design; $('SealedBasic').hidden = $('Seals').hidden = !sealed; $('LegacyLinks').hidden = sealed;
  if (sealed) $('Preview').querySelector('summary').after($('MotionControls'));
  else $('MotionAnchor').after($('MotionControls'));
  $('Description').textContent = sealed ? 'A slow-closing cabinet-door damper. First seal-free print leaked; this sealed redesign is unprinted and unvalidated.' : 'A slow-closing cabinet-door damper. First seal-free prototype was printed and leaked; Fixed V1 is the unvalidated measured-fit trial.';
}
function populateSettings() {
  $('RingCount').value = String(settings.piston_rings);
  $('BleedRange').value = $('BleedNumber').value = String(settings.bleed_opening);
  for (const [key, input] of fields) {
    if (input.type === 'checkbox') input.checked = settings[key]; else input.value = String(settings[key]);
    if (ranges.has(key)) { ranges.get(key).value = String(settings[key]); ranges.get(key).setAttribute('aria-invalid', 'false'); }
    input.setAttribute('aria-invalid', 'false');
  }
  $('BleedNumber').setAttribute('aria-invalid', 'false');
}
function setSetting(key, input) {
  settings = { ...settings, [key]: input.type === 'checkbox' ? input.checked : input.value.trim() === '' ? NaN : Number(input.value) };
  if (key === 'bleed_opening' && Number.isFinite(settings[key])) (input === $('BleedRange') ? $('BleedNumber') : $('BleedRange')).value = input.value;
  if (ranges.has(key) && Number.isFinite(settings[key])) {
    fields.get(key).value = input.value; ranges.get(key).value = input.value;
  }
  requestModel();
  input.setAttribute('aria-invalid', String(invalid));
}
function buildControls() {
  for (const group of CONTROLS) {
    const fold = document.createElement('details'), summary = document.createElement('summary');
    fold.className = 'damper-seal-group'; summary.textContent = group.title; fold.append(summary);
    for (const field of group.fields) {
      if (['piston_rings', 'bleed_opening'].includes(field.key)) continue;
      const row = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
      input.id = `damperSetting_${field.key}`; input.dataset.sealedSetting = field.key;
      label.htmlFor = input.id; label.textContent = field.label;
      if (field.type === 'boolean') { row.className = 'checkbox-line'; input.type = 'checkbox'; row.append(input, label); }
      else {
        row.className = 'damper-number-setting'; input.type = 'number'; input.inputMode = 'decimal';
        const range = document.createElement('input'), pair = document.createElement('div');
        range.type = 'range'; range.id = `${input.id}_range`; range.setAttribute('aria-label', field.label);
        for (const key of ['min', 'max', 'step']) input[key] = range[key] = String(field[key]);
        range.addEventListener('input', () => setSetting(field.key, range)); ranges.set(field.key, range);
        pair.className = 'damper-number-inputs'; pair.append(range, input); row.append(label, pair);
      }
      input.addEventListener('input', () => setSetting(field.key, input)); fields.set(field.key, input); fold.append(row);
    }
    $('SealControls').append(fold);
  }
  const bleed = CONTROLS.flatMap(group => group.fields).find(field => field.key === 'bleed_opening');
  for (const id of ['BleedRange', 'BleedNumber']) for (const key of ['min', 'max', 'step']) $(id)[key] = String(bleed[key]);
  populateSettings();
}
function getBaseline() {
  baselinePromise ||= fetch(asset('model.json')).then(response => {
    if (!response.ok) throw new Error('Model could not load'); return response.json();
  });
  return baselinePromise;
}
function getWorker() {
  if (workerReady) return workerReady;
  let resolve;
  const promise = new Promise((accept, reject) => { resolve = accept; workerReject = reject; }); workerReady = promise;
  try {
    worker = new Worker(new URL('./sealed-worker.js', import.meta.url), { type: 'module' });
    workerTimeout = setTimeout(() => workerFailure(new Error('Sealed geometry engine did not initialize. Select Fixed V1 or retry.')), 90000);
    worker.addEventListener('message', ({ data: message }) => {
      if (message.type === 'ready') { clearTimeout(workerTimeout); resolve(worker); return; }
      if (message.type === 'error' && message.sequence === undefined) { workerFailure(new Error(message.error)); return; }
      if (message.sequence !== sequence || design !== 'sealed') return;
      if (message.error) { invalid = true; $('Status').textContent = 'Not generated'; failure(new Error(message.error)); exportControls(); return; }
      if (message.result) {
        try { install(message.result, message.sequence); }
        catch (error) { invalid = true; failure(error); $('Status').textContent = 'Unavailable'; exportControls(); }
      }
    });
    worker.addEventListener('error', event => workerFailure(new Error(event.message || 'Sealed geometry worker failed.')));
    worker.addEventListener('messageerror', () => workerFailure(new Error('Sealed geometry worker returned unreadable data.')));
    getBaseline().then(baseline => worker.postMessage({ type: 'init', baseline })).catch(workerFailure);
  } catch (error) { workerFailure(error); }
  return promise;
}
function workerFailure(error) {
  clearTimeout(workerTimeout); worker?.terminate(); worker = null; workerReject?.(error); workerReady = null;
  if (design === 'sealed') { invalid = true; $('Status').textContent = 'Unavailable'; failure(error); exportControls(); }
}
function requestModel({ immediate = false, fit = false, writeAddress = true } = {}) {
  const seq = invalidate(); invalid = false; clearError(); modeControls();
  if (fit) fitSequence = seq;
  if (design === 'sealed') {
    try {
      settings = validateSettings(settings);
      for (const input of [...fields.values(), ...ranges.values(), $('BleedNumber'), $('BleedRange')]) input.setAttribute('aria-invalid', 'false');
    } catch (error) {
      invalid = true; $('Status').textContent = 'Check settings'; failure(error); exportControls(); return;
    }
  }
  if (writeAddress) history.replaceState(null, '', createModelLink(location.href, design, settings));
  $('Status').textContent = design === 'sealed' ? 'Generating' : 'Loading'; exportControls();
  const run = async () => {
    try {
      const baseline = await getBaseline(); if (seq !== sequence) return;
      if (design === 'legacy') install(baseline, seq);
      else { const engine = await getWorker(); if (seq === sequence) engine.postMessage({ sequence: seq, settings: { ...settings } }); }
    } catch (error) { if (seq === sequence) { invalid = true; failure(error); $('Status').textContent = 'Unavailable'; exportControls(); } }
  };
  if (immediate || design === 'legacy') run(); else timer = setTimeout(run, 180);
}
function readAddress() {
  try {
    const link = readModelLink(location.href); design = link?.design || 'legacy'; settings = { ...(link?.settings || DEFAULTS) };
    populateSettings(); requestModel({ immediate: true, writeAddress: false });
  } catch (error) {
    invalidate(); invalid = true; design = 'sealed'; modeControls(); $('Status').textContent = 'Invalid link'; failure(error); exportControls();
  }
}

function textValue(value) {
  if (Array.isArray(value)) return value.map(textValue).join('; ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${textValue(item)}`).join('; ');
  return value == null ? '' : String(value);
}
function notes(value) { return Array.isArray(value) ? value.map(textValue) : value ? [textValue(value)] : []; }
function technical() {
  const p = data.parameters;
  $('Bom').replaceChildren(); $('AssemblyNotes').replaceChildren();
  if (design === 'legacy') {
    const bore = p.bore_nominal_diameter + p.bore_diameter_compensation, piston = p.piston_nominal_diameter + p.piston_diameter_compensation;
    $('Details').textContent = `CAD bore ${bore.toFixed(2)} mm; piston ${piston.toFixed(2)} mm; CAD radial gap ${((bore - piston) / 2).toFixed(2)} mm. Measured-fit trial: estimated printed diametral gap 0.29 mm if the same print errors repeat; not yet verified. Front cap and rod unchanged. Working stroke ${p.working_stroke} mm; maximum ${data.maximum_stroke_mm} mm. Reed ${p.reed_thickness} mm. Check printed fit and damping.`;
    for (const id of ['PrintSummary', 'Warning', 'ReferenceLabel']) $(id).textContent = legacyText[id]; return;
  }
  $('ReferenceLabel').textContent = 'Spring, seals and hardware references';
  $('Details').textContent = `Sealed prototype; ${settings.piston_rings} piston O-ring${settings.piston_rings === 1 ? '' : 's'}; ${settings.cap_thickness_mm} mm M3-clamped caps. Needle withdrawal ${settings.bleed_opening.toFixed(2)} mm; CAD throat ${settings.bleed_orifice_mm.toFixed(2)} mm. Working stroke ${p.working_stroke} mm; maximum ${data.maximum_stroke_mm} mm. Trial dimensions predict print bias; verify actual ring stock and print fit before assembly.`;
  $('PrintSummary').textContent = `${data.print_manifest.length} print designs, ${data.print_manifest.reduce((sum, item) => sum + item.quantity, 0)} pieces. Print parts separately; spring, seals, flap and hardware are not PLA print parts.`;
  $('Warning').textContent = notes(data.report?.sealed?.warnings).join(' ') || 'Unvalidated prototype. No pressure, strength, fatigue, leakage or damping rating. Inspect the printed thread, clamp and seal fit before a low-force trial.';
  if (data.bom) {
    const title = document.createElement('h3'); title.textContent = 'Bill of materials';
    const table = document.createElement('table'); table.className = 'damper-bom';
    const header = document.createElement('tr');
    for (const label of ['Item', 'Quantity', 'Specification']) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; header.append(cell); }
    const head = document.createElement('thead'); head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const item of data.bom) {
      const row = document.createElement('tr');
      for (const value of [item.name, item.quantity, textValue(item.detail)]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      body.append(row);
    }
    table.append(body); $('Bom').append(title, table);
  }
  const title = document.createElement('h3'); title.textContent = 'Assembly and trial';
  const list = document.createElement('ol');
  for (const note of notes(data.report?.sealed?.instructions)) { const item = document.createElement('li'); item.textContent = note; list.append(item); }
  $('AssemblyNotes').append(title, list);
}
function install(result, seq) {
  if (seq !== sequence) return;
  const selected = $('PrintPart').value, previousVisible = new Map(visible);
  // setParts owns attached full geometry; cutaways and air paths are owned here.
  for (const [name, mesh] of viewer.objects) mesh.geometry = full.get(name) || mesh.geometry;
  paths.removeFromParent();
  for (const line of [...paths.children]) { line.geometry.dispose(); line.material.dispose(); paths.remove(line); }
  for (const shape of sections.values()) shape.dispose();
  sections.clear(); full.clear(); centers.clear(); visible.clear(); rows.clear(); $('Parts').replaceChildren();
  viewer.select(null); viewer.setParts(result.parts); data = result;
  $('PrintPart').replaceChildren();
  for (const item of data.print_manifest) {
    const option = document.createElement('option'); option.value = item.part; option.textContent = item.part.replaceAll('_', ' '); $('PrintPart').append(option);
  }
  if (data.print_manifest.some(item => item.part === selected)) $('PrintPart').value = selected;
  for (const part of data.parts) {
    const mesh = viewer.objects.get(part.name); full.set(part.name, mesh.geometry); visible.set(part.name, previousVisible.get(part.name) ?? true);
    centers.set(part.name, new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
    if (part.section_positions?.length) sections.set(part.name, geometry(part.section_positions, part.section_indices));
    const row = document.createElement('div'); row.className = 'damper-part-row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = visible.get(part.name); check.setAttribute('aria-label', `Show ${part.label}`);
    check.addEventListener('change', () => { visible.set(part.name, check.checked); appearance(); });
    const button = document.createElement('button'); button.type = 'button'; button.className = 'component-item';
    button.textContent = part.label + (part.reference ? ' (reference)' : ''); button.dataset.part = part.name; button.setAttribute('aria-pressed', 'false'); button.onclick = () => viewer.select(part.name);
    row.append(check, button); rows.set(part.name, row); $('Parts').append(row);
  }
  const spring = viewer.objects.get('spring');
  if (spring) { const shape = springGeometry(data.parameters, 0); spring.geometry.dispose(); spring.geometry = geometry(shape.positions, shape.indices); full.set('spring', spring.geometry); }
  for (const [name, points] of Object.entries(data.air_paths || {})) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point))), new THREE.LineBasicMaterial({ color: name === 'reset' ? '#458fd1' : '#c95e4d', depthTest: false }));
    line.name = name; line.renderOrder = 2; paths.add(line);
  }
  viewer.group.add(paths); stroke = Math.max(0, Math.min(stroke, data.maximum_stroke_mm));
  for (const id of ['Stroke', 'StrokeNumber']) $(id).max = String(data.maximum_stroke_mm);
  appearance(); motion(); technical(); quantity(); syncPlay();
  for (const control of root.querySelectorAll('input,select,button')) control.disabled = false;
  invalid = false; readySequence = seq; $('Status').textContent = design === 'legacy' ? 'Fixed V1' : 'Sealed prototype'; exportControls();
  if (fitSequence === seq) { viewer.fit(); fitSequence = -1; }
}

function snapshot() { return { data, sequence, stroke, strokeRevision }; }
function unchanged(token, motionSensitive = false) { return current() && data === token.data && sequence === token.sequence && (!motionSensitive || (stroke === token.stroke && strokeRevision === token.strokeRevision)); }
function reportJSON(model = data) { return { ...model.report, revision: model.revision, parameters: model.parameters, ...(model.sealed_parameters ? { sealed_parameters: model.sealed_parameters } : {}), copyright: 'Santeri Hukari' }; }
function printSTL(part, model = data) {
  const source = model.print_meshes?.[part];
  if (!source) throw new Error('The selected print mesh is unavailable.');
  const shape = geometry(source.positions, source.indices), mesh = new THREE.Mesh(shape);
  try { return new STLExporter().parse(mesh, { binary: true }); }
  finally { shape.dispose(); mesh.material.dispose(); }
}
async function legacyDownload(name) {
  const token = snapshot(), response = await fetch(asset(name));
  if (!response.ok) throw new Error('Print file could not load');
  const bytes = await response.arrayBuffer(); if (unchanged(token)) save(bytes, name);
}
$('STL').addEventListener('click', () => {
  if (!current()) return;
  const item = data.print_manifest.find(item => item.part === $('PrintPart').value);
  if (design === 'legacy') legacyDownload(item.file).catch(failure);
  else { try { save(printSTL(item.part), item.file, 'model/stl'); } catch (error) { failure(error); } }
});
$('ZIP').addEventListener('click', async () => {
  if (!current()) return;
  if (design === 'legacy') { legacyDownload('print-set.zip').catch(failure); return; }
  const token = snapshot();
  try {
    const { zipSync, strToU8 } = await import('three/addons/libs/fflate.module.js'); if (!unchanged(token)) return;
    const files = {};
    for (const item of token.data.print_manifest) { const bytes = printSTL(item.part, token.data); files[item.file] = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
    files['params.json'] = strToU8(JSON.stringify(token.data.sealed_parameters, null, 2) + '\n');
    files['report.json'] = strToU8(JSON.stringify(reportJSON(token.data), null, 2) + '\n');
    files['BOM.json'] = strToU8(JSON.stringify(token.data.bom, null, 2) + '\n');
    files['assembly.txt'] = strToU8(['Original CAD and copyright: Santeri Hukari', token.data.revision, ...notes(token.data.report?.sealed?.warnings), ...notes(token.data.report?.sealed?.instructions)].join('\n\n') + '\n');
    files['reset_template.svg'] = strToU8(token.data.reset_template_svg);
    const bytes = zipSync(files, { level: 6 }); if (unchanged(token)) save(bytes, 'air-damper-sealed-print-set.zip', 'application/zip');
  } catch (error) { if (unchanged(token)) failure(error); }
});
$('Report').addEventListener('click', () => { if (current()) save(JSON.stringify(reportJSON(), null, 2) + '\n', design === 'sealed' ? 'air-damper-sealed-report.json' : 'air-damper-report.json', 'application/json'); });
$('GLB').addEventListener('click', async () => {
  if (!current() || glbBusy) return;
  const token = snapshot(); glbBusy = true; exportControls();
  try {
    const bytes = await viewer.glb({ revision: data.revision, stroke_mm: token.stroke, parameters: data.parameters, ...(data.sealed_parameters ? { sealed_parameters: data.sealed_parameters } : {}), geometry: 'Full assembly; no cutaway or explosion', author: 'Santeri Hukari' }, exportParts(data, token.stroke), part => [part.moving ? token.stroke : 0, 0, 0]);
    if (unchanged(token, true)) save(bytes, design === 'sealed' ? 'air-damper-sealed.glb' : 'air-damper.glb', 'model/gltf-binary');
  } catch (error) { if (unchanged(token, true)) failure(error); }
  finally { glbBusy = false; exportControls(); }
});

for (const id of ['Section', 'Air', 'References']) $(id).addEventListener('change', appearance);
for (const id of ['Stroke', 'StrokeNumber']) $(id).addEventListener('input', () => {
  playing = false; syncPlay(); const value = travel($(id).value, data?.maximum_stroke_mm ?? 20);
  $(id).setAttribute('aria-invalid', String(value === null));
  if (value !== null) { stroke = value; motion(); }
});
$('StrokeNumber').addEventListener('change', () => { if (travel($('StrokeNumber').value, data?.maximum_stroke_mm ?? 20) === null) motion(); $('StrokeNumber').setAttribute('aria-invalid', 'false'); });
$('Explode').addEventListener('input', () => { explosion = Number($('Explode').value); motion(); });
$('Play').addEventListener('click', () => {
  playing = !playing;
  if (playing && data) phase = Math.acos(1 - 2 * Math.min(stroke, data.parameters.working_stroke) / data.parameters.working_stroke);
  syncPlay();
});
function tick(time) {
  const delta = Math.min(.05, (time - lastTime) / 1000); lastTime = time;
  if (playing && data && !document.hidden) { phase += delta * 1.5; stroke = (1 - Math.cos(phase)) * Math.min(data.parameters.working_stroke, data.maximum_stroke_mm) / 2; motion(); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$('Design').addEventListener('change', () => { design = $('Design').value; requestModel({ immediate: true }); });
$('RingCount').addEventListener('change', () => setSetting('piston_rings', $('RingCount')));
for (const id of ['BleedRange', 'BleedNumber']) $(id).addEventListener('input', () => setSetting('bleed_opening', $(id)));
$('PrintPart').addEventListener('change', quantity);
$('Fit').addEventListener('click', () => viewer.fit());
$('Copy').addEventListener('click', async () => {
  if (!current()) return;
  const token = snapshot(), url = createModelLink(location.href, design, settings);
  try { await navigator.clipboard.writeText(url); if (unchanged(token)) $('CopyStatus').textContent = 'Model page link copied'; }
  catch { if (unchanged(token)) { $('LinkValue').value = url; if (!$('LinkDialog').open) $('LinkDialog').showModal(); $('LinkValue').select(); } }
});
document.addEventListener('pointerdown', event => { if (!event.target.closest('#damperDownloads')) $('Downloads').open = false; });
root.addEventListener('keydown', event => { if (event.key === 'Escape') $('Downloads').open = false; });
$('Reset').title = $('Reset').ariaLabel = 'Reset current design';
$('Reset').addEventListener('click', () => {
  playing = false; stroke = explosion = 0; $('Explode').value = 0; syncPlay();
  $('Section').checked = $('Air').checked = false; $('References').checked = true;
  for (const part of data?.parts || []) { visible.set(part.name, true); rows.get(part.name).querySelector('input[type=checkbox]').checked = true; }
  viewer.select(null);
  if (design === 'sealed') { settings = { ...DEFAULTS }; populateSettings(); requestModel({ immediate: true, fit: true }); }
  else { appearance(); motion(); viewer.fit(); }
});
root.querySelectorAll('[data-cad-view]').forEach(button => button.addEventListener('click', () => viewer.fit(button.dataset.cadView)));
const height = () => root.style.setProperty('--coffee-height', `${Math.max(180, (window.visualViewport?.height || innerHeight) - root.getBoundingClientRect().top - 8)}px`);
window.addEventListener('resize', height); height();
window.addEventListener('hashchange', readAddress);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  clearTimeout(timer); clearTimeout(workerTimeout); worker?.terminate();
});
buildControls(); readAddress();
