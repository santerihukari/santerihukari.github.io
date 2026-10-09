import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { validateParameters, migrateSettings, readLink, modelLink, storageKey } from './parameters.mjs';
import { panelSTL, panelSVG, panelBundle } from './exports.mjs';

const root = document.getElementById('volumeWorkbench'), $ = id => document.getElementById(`volume${id}`);
const viewport = root.querySelector('.viewport'), canvas = $('Canvas');
const fields = { surface_count: ['Primary panels', ''], opening_angle: ['Corner profile opening', 'deg'], corner_segments: ['Side bands', ''], corner_mid_height_ratio: ['Middle height ratio', ''], corner_bulge_ratio: ['Front bulge ratio', ''], flat_slope_angle: ['Default tilt', 'deg'], plywood_thickness: ['Plywood thickness', 'mm'], brace_reach: ['Reach', 'mm'], footprint_rotation: ['Footprint rotation', 'deg'], cap_depth_ratio: ['Flat face depth ratio', ''] };
let config, parameters, result, worker, sequence = 0, timer, exporting = false, currentPanel = 'A', currentView = 'iso', frameNext = true;
const objects = new Map(), labels = new Map();
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch (error) { showError('3D rendering is unavailable. WebGL is required on this device.'); throw error; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), assembly = new THREE.Group(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20000);
camera.up.set(0, 0, 1);
scene.add(assembly, new THREE.HemisphereLight(0xffffff, 0x7b8797, 2.5));
for (const [position, intensity] of [[[-400, 600, 900], 2.6], [[500, -200, 500], 1.2]]) { const light = new THREE.DirectionalLight(0xffffff, intensity); light.position.set(...position); scene.add(light); }
const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true; orbit.dampingFactor = 0.09;
function theme() { scene.background = new THREE.Color(getComputedStyle(viewport).backgroundColor); }
theme(); new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const text = (parent, tag, value, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; parent.append(node); return node; };
const number = value => Number(value).toFixed(2);
function available() { return Boolean(result && result.sequence === sequence && $('Error').hidden && !exporting); }
function availability() { for (const id of ['Copy', 'Export', 'Download']) $(id).disabled = !available(); }
function showError(message) { $('Error').textContent = message; $('Error').hidden = false; $('Status').textContent = 'Check parameters'; root.dataset.state = 'error'; availability(); }
function change(key, value) {
  parameters[key] = value;
  if (key === 'surface_count') { parameters.panel_tilts = []; parameters.panel_wall_lengths = []; }
  if (key === 'corner_segments' && value === 0) parameters.corner_flat_faces = false;
  syncMode(); if (key === 'surface_count') { syncTilts(); syncWallLengths(); } queue();
}
function numeric(parent, key, title, limits, value, callback) {
  const row = document.createElement('div'); row.className = 'parameter'; row.id = `${key}Control`;
  const head = document.createElement('div'); head.className = 'parameter-head'; const label = text(head, 'label', title[0]); label.htmlFor = `${key}Number`; text(head, 'span', title[1] === 'deg' ? '\u00b0' : title[1]); row.append(head);
  const inputs = document.createElement('div'); inputs.className = 'parameter-inputs';
  for (const [type, suffix] of [['range', 'Range'], ['number', 'Number']]) {
    const input = document.createElement('input'); input.type = type; input.id = `${key}${suffix}`; input.min = limits[0]; input.max = limits[1]; input.step = type === 'range' ? limits[2] : 'any'; input.value = value;
    if (type === 'range') input.setAttribute('aria-label', title[0]); else input.inputMode = 'decimal';
    input.addEventListener('input', () => { const value = input.value === '' ? NaN : Number(input.value); document.getElementById(`${key}${suffix === 'Range' ? 'Number' : 'Range'}`).value = value; callback(value); }); inputs.append(input);
  }
  row.append(inputs); parent.append(row);
}
function controlsUI() {
  for (const [key, title] of Object.entries(fields)) numeric($('Parameters'), key, title, config.limits[key], parameters[key], value => change(key, value));
  for (const button of root.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
    const mode = button.dataset.mode === 'flat' ? 1 : 2; if (parameters.mounting_faces === mode) return;
    parameters.mounting_faces = mode; parameters.surface_count = mode === 2 ? 2 : 3; parameters.panel_tilts = []; parameters.panel_wall_lengths = []; currentPanel = 'A'; frameNext = true; sync(); queue();
  });
  $('Independent').addEventListener('change', () => { const tilts = result?.report.panels.slice(0, parameters.surface_count).map(p => p.nominal_tilt_deg); parameters.panel_tilts = $('Independent').checked ? (tilts?.length === parameters.surface_count ? tilts : Array(parameters.surface_count).fill(parameters.flat_slope_angle)) : []; syncTilts(); syncMode(); queue(); });
  $('FlatFaces').addEventListener('change', () => { parameters.corner_flat_faces = $('FlatFaces').checked; if (parameters.corner_flat_faces) { parameters.corner_segments = Math.max(2, parameters.corner_segments); if (!parameters.corner_bulge_ratio) parameters.corner_bulge_ratio = Math.min(0.05, parameters.corner_mid_height_ratio / 4); } sync(); queue(); });
  $('WallEnabled').addEventListener('change', () => { parameters.panel_wall_lengths = $('WallEnabled').checked ? Array.from({ length: parameters.surface_count }, (_, i) => result?.report.panels[i]?.wall_edge_lengths_mm[0] ?? 2 * parameters.brace_reach * Math.sin(Math.PI / parameters.surface_count)) : []; syncWallLengths(); syncMode(); queue(); });
}
function syncMode() {
  const flat = parameters.mounting_faces === 1;
  for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String((button.dataset.mode === 'flat') === flat));
  for (const key of Object.keys(fields)) {
    let visible = true;
    if (['surface_count', 'flat_slope_angle', 'footprint_rotation'].includes(key)) visible = flat;
    if (['opening_angle', 'corner_segments'].includes(key)) visible = !flat;
    if (['corner_mid_height_ratio', 'corner_bulge_ratio'].includes(key)) visible = !flat && parameters.corner_segments > 0;
    if (key === 'cap_depth_ratio') visible = flat ? parameters.panel_tilts.includes(0) : parameters.corner_flat_faces;
    if (key === 'brace_reach' && flat && parameters.panel_wall_lengths.length && parameters.panel_wall_lengths.every(length => length !== null)) visible = false;
    document.getElementById(`${key}Control`).hidden = !visible;
  }
  document.querySelector('label[for="brace_reachNumber"]').textContent = flat ? (parameters.panel_tilts.length ? 'Nominal base radius' : 'Base radius') : 'Reach';
  $('TiltSection').hidden = !flat; $('CornerOptions').hidden = flat; $('FlatFaces').checked = parameters.corner_flat_faces;
  $('WallSection').hidden = !flat;
  for (const suffix of ['Number', 'Range']) document.getElementById(`surface_count${suffix}`).min = flat ? 3 : 2;
}
function syncTilts() {
  const enabled = parameters.panel_tilts.length > 0; $('Independent').checked = enabled; $('Tilts').hidden = !enabled;
  if (!enabled) { $('Tilts').replaceChildren(); return; }
  if ($('Tilts').children.length !== parameters.surface_count) {
    $('Tilts').replaceChildren();
    for (let i = 0; i < parameters.surface_count; i++) numeric($('Tilts'), `tilt${i}`, [`Primary ${String.fromCharCode(65 + i)} tilt`, 'deg'], [0.1, 90, 0.1], parameters.panel_tilts[i] ?? parameters.flat_slope_angle, value => { parameters.panel_tilts[i] = value; syncMode(); queue(); });
  }
  for (let i = 0; i < parameters.surface_count; i++) for (const suffix of ['Number', 'Range']) document.getElementById(`tilt${i}${suffix}`).value = parameters.panel_tilts[i] ?? result?.report.panels[i]?.nominal_tilt_deg ?? parameters.flat_slope_angle;
}
function syncWallLengths() {
  const enabled = parameters.panel_wall_lengths.length > 0; $('WallEnabled').checked = enabled; $('WallLengths').hidden = !enabled;
  if (!enabled) { $('WallLengths').replaceChildren(); return; }
  if ($('WallLengths').children.length !== parameters.surface_count) {
    $('WallLengths').replaceChildren();
    for (let i = 0; i < parameters.surface_count; i++) numeric($('WallLengths'), `wall${i}`, [`Panel ${String.fromCharCode(65 + i)} wall edge`, 'mm'], [1, 5000, 0.1], parameters.panel_wall_lengths[i] ?? 2 * parameters.brace_reach * Math.sin(Math.PI / parameters.surface_count), value => { parameters.panel_wall_lengths[i] = value; syncMode(); queue(); });
  }
  for (let i = 0; i < parameters.surface_count; i++) for (const suffix of ['Number', 'Range']) document.getElementById(`wall${i}${suffix}`).value = parameters.panel_wall_lengths[i] ?? 2 * parameters.brace_reach * Math.sin(Math.PI / parameters.surface_count);
}
function sync() { for (const key of Object.keys(fields)) for (const suffix of ['Number', 'Range']) document.getElementById(`${key}${suffix}`).value = parameters[key]; syncMode(); syncTilts(); syncWallLengths(); }
function queue() {
  clearTimeout(timer); sequence++; root.dataset.state = 'updating'; $('Status').textContent = 'Updating'; $('Error').hidden = true; availability();
  timer = setTimeout(() => { try { const p = validateParameters(parameters, config); if (p.panel_tilts.some(angle => angle !== null && angle < 0.1)) throw new Error('Primary tilts must be from 0.1 to 90 degrees.'); worker.postMessage({ sequence, parameters: p, config }); } catch (error) { showError(error.message); } }, 140);
}
function dispose(group) { for (const object of [...group.children]) { object.traverse(child => { child.geometry?.dispose(); if (child.material) for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); }); group.remove(object); } }
function meshObject(part) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.vertices.flat(), 3)); geometry.setIndex(part.indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.8, flatShading: true, side: part.reference ? THREE.DoubleSide : THREE.FrontSide, transparent: Boolean(part.reference), opacity: part.reference ? 0.18 : 1, depthWrite: !part.reference }));
  mesh.name = part.name; mesh.userData = { panel_id: part.panel_id, reference: Boolean(part.reference), explode_direction: part.explode_direction }; return mesh;
}
function geometryUI() {
  dispose(assembly); objects.clear(); labels.clear(); $('Labels').replaceChildren();
  for (const part of result.parts) {
    const mesh = meshObject(part), edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color: 0x475363, transparent: true, opacity: 0.7 })); mesh.add(edges); assembly.add(mesh); objects.set(part.name, mesh);
    if (!part.reference) { const element = text($('Labels'), 'span', part.panel_id); mesh.geometry.computeBoundingBox(); labels.set(part.name, { element, anchor: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()) }); }
  }
  const radius = result.report.base_radius_reference.radius_mm, points = Array.from({ length: 161 }, (_, i) => new THREE.Vector3(radius * Math.cos(i * 2 * Math.PI / 160), 0, radius * Math.sin(i * 2 * Math.PI / 160)));
  const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x7c8a9a, transparent: true, opacity: 0.65 }));
  guide.name = 'base_radius_reference'; guide.userData.reference = true; assembly.add(guide);
  appearance();
}
function appearance() {
  if (!result) return;
  assembly.getObjectByName('base_radius_reference').visible = $('Radius').checked;
  for (const part of result.parts) {
    const mesh = objects.get(part.name); mesh.visible = !part.reference || $('Planes').checked; mesh.children[0].visible = $('Edges').checked; mesh.position.set(0, 0, 0);
    if (!part.reference) { mesh.children[0].material.color.set(part.panel_id === currentPanel ? 0x202933 : 0x56616c); mesh.children[0].material.opacity = part.panel_id === currentPanel ? 1 : 0.6; if ($('Explode').checked) mesh.position.fromArray(part.explode_direction).multiplyScalar(result.parameters.plywood_thickness * 3); }
  }
}
function reportUI() {
  const r = result.report; $('Dimensions').textContent = `${r.total_panels} panels / ${number(r.projection_mm)} mm projection`;
  $('RadiusReadout').textContent = `Enclosing radius ${number(r.base_radius_reference.radius_mm)} mm / diameter ${number(r.base_radius_reference.diameter_mm)} mm / nominal size ${number(r.base_radius_reference.nominal_radius_mm)} mm`;
  if (!r.panels.some(p => p.id === currentPanel)) currentPanel = 'A';
  $('Panel').replaceChildren(...r.panels.map(panel => new Option(`Panel ${panel.id} / ${panel.role.replaceAll('_', ' ')}`, panel.id))); $('Panel').value = currentPanel;
  panelUI();
}
function panelUI() {
  const r = result.report, p = r.panels.find(panel => panel.id === currentPanel), fmt = value => `${number(value)}\u00b0`;
  $('SelectedTilt').textContent = `${p.shape} / tilt to Plane ${p.tilt_reference_plane}: ${fmt(p.tilt_to_reference_deg)}`;
  $('Cuts').replaceChildren(); p.edges.forEach(edge => { const row = document.createElement('tr'); text(row, 'td', edge.name); text(row, 'td', number(edge.long_edge_mm)); text(row, 'td', number(edge.bevel_from_square_deg)); $('Cuts').append(row); });
  $('Corners').replaceChildren(); p.corner_angles_deg.forEach((angle, i) => { const entry = document.createElement('div'); text(entry, 'dt', `${String.fromCharCode(80 + i)}:`); text(entry, 'dd', fmt(angle)); $('Corners').append(entry); });
  $('ExtraCuts').replaceChildren(); $('ExtraCuts').className = p.extra_cuts.length ? 'volume-extra' : '';
  if (p.extra_cuts.length) { text($('ExtraCuts'), 'strong', 'Additional trims'); p.extra_cuts.forEach(cut => text($('ExtraCuts'), 'div', `${cut.name}: ${fmt(cut.bevel_from_square_deg)}`)); }
  $('Joints').replaceChildren(); r.joint_angles.filter(joint => joint.panels.includes(currentPanel)).forEach(joint => { const row = document.createElement('div'); row.className = 'volume-joint'; text(row, 'span', `${joint.panels.join(' / ')} included angle`); text(row, 'span', fmt(joint.included_angle_deg)); $('Joints').append(row); });
  const points = p.outer_outline_xy_mm, lo = [0, 1].map(a => Math.min(...points.map(v => v[a]))), hi = [0, 1].map(a => Math.max(...points.map(v => v[a]))), margin = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 0.14, ns = 'http://www.w3.org/2000/svg';
  $('Outline').replaceChildren(); $('Outline').setAttribute('viewBox', `${lo[0] - margin} ${lo[1] - margin} ${hi[0] - lo[0] + 2 * margin} ${hi[1] - lo[1] + 2 * margin}`);
  const polygon = document.createElementNS(ns, 'polygon'); polygon.setAttribute('points', points.map(v => v.join(',')).join(' ')); polygon.setAttribute('stroke-width', margin / 25); $('Outline').append(polygon);
  const center = [0, 1].map(a => points.reduce((s, p) => s + p[a], 0) / points.length);
  points.forEach((point, i) => { const next = points[(i + 1) % points.length], mid = point.map((v, axis) => (v + next[axis]) / 2), offset = new THREE.Vector2(mid[0] - center[0], mid[1] - center[1]).normalize().multiplyScalar(margin * 0.48), label = document.createElementNS(ns, 'text'); label.setAttribute('x', mid[0] + offset.x); label.setAttribute('y', mid[1] + offset.y); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle'); label.setAttribute('font-size', margin * 0.36); label.textContent = number(p.edges[i].long_edge_mm); $('Outline').append(label); });
  $('Legend').replaceChildren(); const swatch = document.createElement('i'); swatch.style.background = p.color; $('Legend').append(swatch, document.createTextNode(`Panel ${p.id} / ${r.reference_surface_count} mounting ${r.reference_surface_count === 1 ? 'plane' : 'planes'}`));
  $('DownloadLabel').textContent = ['stl', 'svg'].includes($('ExportKind').value) ? `Panel ${p.id}` : 'Current geometry'; appearance();
}
function frame() {
  if (!result) return;
  assembly.updateMatrixWorld(true); const box = new THREE.Box3(); for (const mesh of assembly.children) if (!mesh.userData.reference) box.expandByObject(mesh);
  const center = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() / 2, aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
  camera.aspect = aspect; camera.up.set(...(currentView === 'top' ? [0, 1, 0] : [0, 0, 1]));
  const fov = Math.min(THREE.MathUtils.degToRad(camera.fov), 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect)), distance = radius / Math.sin(fov / 2) * 1.42;
  const direction = { iso: [-1.1, 2, 1.3], front: [0, 1, 0], top: [0, 0, 1], side: [-1, 0, 0] }[currentView]; camera.position.copy(center).addScaledVector(new THREE.Vector3(...direction).normalize(), distance); camera.near = 0.1; camera.far = Math.max(20000, distance * 20); camera.updateProjectionMatrix(); orbit.target.copy(center); orbit.minDistance = 10; orbit.maxDistance = distance * 8; orbit.update();
}
for (const button of root.querySelectorAll('[data-view]')) button.addEventListener('click', () => { currentView = button.dataset.view; for (const other of root.querySelectorAll('[data-view]')) other.setAttribute('aria-pressed', String(other === button)); frame(); });
for (const id of ['Explode', 'Planes', 'Edges', 'Radius']) $(id).addEventListener('change', () => { appearance(); if (id === 'Explode') frame(); });
$('Panel').addEventListener('change', () => { currentPanel = $('Panel').value; panelUI(); }); $('ExportKind').addEventListener('change', () => { if (result) panelUI(); });
let down; const raycaster = new THREE.Raycaster(); canvas.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; }); canvas.addEventListener('pointerup', event => { if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return; const rect = canvas.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera); const hit = raycaster.intersectObjects(assembly.children).find(hit => hit.object.userData.panel_id); if (hit) { currentPanel = hit.object.userData.panel_id; $('Panel').value = currentPanel; panelUI(); } });
function save(bytes, name, type) { const url = URL.createObjectURL(new Blob([bytes], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
async function glb(snapshot) {
  const group = new THREE.Group();
  try { for (const part of snapshot.parts) group.add(meshObject(part)); group.rotation.x = -Math.PI / 2; group.scale.setScalar(0.001); group.userData = { parameters_mm: snapshot.parameters, copyright: 'Santeri Hukari', structural_status: snapshot.report.structural_status }; group.updateMatrixWorld(true); return await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: false }); }
  finally { dispose(group); }
}
$('Export').addEventListener('click', () => { const open = $('Downloads').hidden; $('Downloads').hidden = !open; $('Export').setAttribute('aria-expanded', String(open)); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.coffee-toolbar')) { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
root.addEventListener('keydown', event => { if (event.key === 'Escape') { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
$('Download').addEventListener('click', async () => {
  if (!available()) return; const snapshot = result, index = snapshot.report.panels.findIndex(panel => panel.id === currentPanel), kind = $('ExportKind').value; exporting = true; availability();
  try {
    if (kind === 'stl') save(panelSTL(snapshot.meshes[index]), `panel_${currentPanel}.stl`, 'model/stl');
    else if (kind === 'svg') save(panelSVG(snapshot, index), `panel_${currentPanel}_template.svg`, 'image/svg+xml');
    else if (kind === 'report' || kind === 'params') save(JSON.stringify(kind === 'report' ? snapshot.report : snapshot.parameters, null, 2), kind === 'report' ? 'cutting_report.json' : 'params.json', 'application/json');
    else if (kind === 'glb') save(await glb(snapshot), 'climbing_volume_assembly.glb', 'model/gltf-binary');
    else if (kind === 'zip') save(panelBundle(snapshot, await glb(snapshot)), `${snapshot.report.surface_mode}_panels.zip`, 'application/zip');
  } catch (error) { showError(`Export failed: ${error.message}`); }
  finally { exporting = false; availability(); }
});
$('Copy').addEventListener('click', async () => { if (!available()) return; const link = modelLink(location.href, result.parameters, config); try { await navigator.clipboard.writeText(link); $('CopyStatus').textContent = 'Model link copied'; $('Copy').title = 'Model link copied'; setTimeout(() => { $('Copy').title = 'Copy link with current parameters'; }, 2000); } catch { $('LinkValue').value = link; $('LinkDialog').showModal(); $('LinkValue').select(); } });
$('Reset').addEventListener('click', () => { parameters = structuredClone(config.defaults); history.replaceState(null, '', location.pathname + location.search); currentPanel = 'A'; frameNext = true; sync(); queue(); });
function height() { root.style.setProperty('--coffee-height', `${Math.max(180, (window.visualViewport?.height || innerHeight) - root.getBoundingClientRect().top - 8)}px`); }
height(); window.addEventListener('resize', height, { passive: true }); window.visualViewport?.addEventListener('resize', height, { passive: true });
new ResizeObserver(() => { renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false); if (result) frame(); }).observe(viewport);
const header = document.querySelector('.site-header'); if (header) new ResizeObserver(height).observe(header);
renderer.setAnimationLoop(() => {
  orbit.update(); renderer.render(scene, camera);
  for (const [name, { anchor, element }] of labels) { const point = anchor.clone().add(objects.get(name).position).project(camera); element.hidden = point.z > 1 || point.z < -1; element.style.left = `${(point.x + 1) * viewport.clientWidth / 2}px`; element.style.top = `${(1 - point.y) * viewport.clientHeight / 2}px`; }
});
window.addEventListener('pagehide', event => { if (!event.persisted) worker?.terminate(); });
window.addEventListener('hashchange', () => { try { parameters = migrateSettings(readLink(location.href, config) || config.defaults, config, false); sync(); frameNext = true; queue(); } catch (error) { clearTimeout(timer); sequence++; showError(error.message); } });
try {
  const response = await fetch(new URL('../../assets/cad/climbing-volumes/config.json', import.meta.url)); if (!response.ok) throw new Error('The volume configuration could not load.'); config = await response.json();
  let linkError = '';
  try { const linked = readLink(location.href, config); if (linked) parameters = migrateSettings(linked, config, false); } catch (error) { linkError = error.message; }
  if (!parameters) { try { const saved = localStorage.getItem(storageKey) || localStorage.getItem('climbing-crack-brace-v1'); if (saved) parameters = migrateSettings(JSON.parse(saved), config); } catch {} }
  parameters ||= structuredClone(config.defaults); controlsUI(); sync(); worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); worker.onerror = () => showError('The geometry worker failed to load. Reload to try again.');
  worker.onmessage = event => {
    if (event.data.sequence !== sequence) return;
    if (event.data.error) { showError(event.data.error); return; }
    try { result = event.data.result; result.sequence = sequence; geometryUI(); reportUI(); $('Error').hidden = true; root.dataset.state = 'ready'; $('Status').textContent = 'Ready'; availability(); if (frameNext) { frame(); frameNext = false; } try { localStorage.setItem(storageKey, JSON.stringify(result.parameters)); } catch {} }
    catch (error) { showError(`Preview failed: ${error.message}`); }
  };
  if (linkError) showError(`Model link could not be opened: ${linkError} Reset to use the default.`); else queue();
} catch (error) { showError(error.message); $('Reset').disabled = true; }
