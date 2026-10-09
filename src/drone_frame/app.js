import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { validateParameters, modelLink, readLink, referenceChoices } from './parameters.mjs';
import { binarySTL } from './exports.mjs';
import { loadReferences, referenceFor, referenceObject, referencePose, optionalParts } from './references.mjs';

const root = document.getElementById('droneWorkbench');
const $ = id => document.getElementById(`drone${id}`);
const viewport = root.querySelector('.viewport'), canvas = $('Canvas');
const asset = name => new URL(`../../assets/cad/drone-frame/${name}`, import.meta.url);
let config, credits, references, referenceMeshes, parameters, result, sequence = 0, timer, copyTimer, exporting = false, worker;
let selected = null, currentView = 'iso', frameNext = true;
const visibility = new Map(), objects = new Map();
const tabButtons = [...root.querySelectorAll('[data-panel]')];
const actions = ['Copy', 'Export', 'Stl', 'Glb', 'ReportDownload', 'ParametersDownload'];
const pointKeys = ['motor_mount_points', 'esc_mount_points', 'carrier_support_points', 'controller_mount_points', 'legacy_carrier_holes', 'imu_mount_points'];
const toggleLabels = {
  motor_recess_enabled: 'Reduced motor pads with recessed bolt heads',
  carrier_enabled: 'Controller retention', upper_arm_extensions: 'Sloping upper arms',
  under_keeper_opposite_end: 'Keepers at both controller ends', lower_arm_braces: 'Base-grown lower arm ribs', small_board_mounts: 'Small-board seats',
  imu_mount_enabled: 'IMU mounting holes', battery_ties_enabled: 'Battery tie slots', under_controller_ties_enabled: 'Controller roof tie slots',
  generic_mounts_enabled: 'Legacy generic tie slots', root_hardware_preview: 'Root bolt visual envelopes',
  prop_seat_on_shaft: 'Seat prop hubs on shaft datum', prop_nuts_enabled: 'Illustrative prop nuts'
};
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch (reason) { error('3D rendering is unavailable on this browser or device. WebGL is required.'); $('Reset').disabled = true; throw reason; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 0.1, 5000);
camera.up.set(0, 0, 1);
camera.position.set(360, -400, 330);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.minZoom = 0.25;
controls.maxZoom = 10;
const assembly = new THREE.Group(), overlays = new THREE.Group();
scene.add(assembly, overlays, new THREE.HemisphereLight(0xffffff, 0x7f8794, 2.5));
for (const [position, intensity] of [[[120, -180, 300], 2.4], [[-200, 120, 160], 1.2]]) {
  const light = new THREE.DirectionalLight(0xffffff, intensity); light.position.set(...position); scene.add(light);
}
function theme() { scene.background = new THREE.Color(getComputedStyle(viewport).backgroundColor); }
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
theme();

function dispose(group) {
  for (const object of [...group.children]) {
    object.traverse(child => { child.geometry?.dispose(); if (child.material) for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); });
    group.remove(object);
  }
}
function available() { return Boolean(result && result.sequence === sequence && $('Error').hidden && !exporting); }
function availability() { for (const name of actions) $(name).disabled = !available(); }
function error(message) { $('Error').textContent = message; $('Error').hidden = false; $('Status').textContent = 'Check parameters'; root.dataset.state = 'error'; availability(); }
function status(message) { $('Status').textContent = message; }
function switchTab(name) {
  for (const button of tabButtons) {
    const active = button.dataset.panel === name;
    button.setAttribute('aria-selected', String(active)); button.setAttribute('aria-pressed', String(active)); button.tabIndex = active ? 0 : -1;
    document.getElementById(`panel${button.dataset.panel}`).hidden = !active;
  }
  root.querySelector('.coffee-controls').scrollTop = 0;
}
for (const [index, button] of tabButtons.entries()) {
  button.addEventListener('click', () => switchTab(button.dataset.panel));
  button.addEventListener('keydown', event => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? tabButtons.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
    switchTab(tabButtons[next].dataset.panel); tabButtons[next].focus();
  });
}
function text(parent, tag, content, className = '') { const node = document.createElement(tag); node.textContent = content; node.className = className; parent.append(node); return node; }
function sync() {
  for (const field of config.groups.flatMap(group => group.fields)) {
    for (const suffix of ['Range', 'Number']) document.getElementById(`${field.key}${suffix}`).value = parameters[field.key];
  }
  for (const key of Object.keys(toggleLabels)) document.getElementById(key).checked = parameters[key];
  for (const key of pointKeys) document.getElementById(`${key}Points`).value = JSON.stringify(parameters[key]);
  $('Variant').value = parameters.frame_variant;
  $('Controller').value = parameters.controller_preset;
  $('Mount').value = parameters.controller_mount_style;
  $('Joint').value = parameters.upper_arm_joint_style;
  $('PresetBasis').textContent = config.controllers[parameters.controller_preset].basis;
  $('Printer').value = config.printer_profiles.find(profile => Object.entries(profile.changes).every(([key, value]) => parameters[key] === value))?.id || 'custom';
  if (parameters.frame_variant === 'drone_frame_v1' && parameters.esp32_size_x === config.defaults.esp32_size_x && parameters.controller_preset === config.defaults.controller_preset) $('PresetBasis').textContent = 'Saved V1 candidate envelope. Selecting a preset explicitly replaces its dimensions; seller-board match unverified.';
  for (const slot of Object.keys(referenceChoices)) {
    const setting = parameters.component_references[slot];
    document.getElementById(`${slot}Reference`).value = setting?.model_id || '';
    document.getElementById(`${slot}Pose`).hidden = !setting;
    if (setting) for (const key of ['position', 'rotation']) for (let axis = 0; axis < 3; axis++) document.getElementById(`${slot}${key}${axis}`).value = setting[key][axis];
  }
}
function queue() {
  clearTimeout(timer); sequence++; root.dataset.state = 'updating'; status('Updating'); availability();
  copyFeedback(false);
  $('Error').hidden = true; $('CopyStatus').textContent = '';
  timer = setTimeout(() => {
    try { const validated = validateParameters(parameters, config); worker.postMessage({ sequence, parameters: validated, config }); }
    catch (reason) { error(reason.message); }
  }, 180);
}
function change(key, value) {
  parameters[key] = value;
  if (value && ['lower_arm_braces', 'upper_arm_extensions'].includes(key)) { const other = key === 'lower_arm_braces' ? 'upper_arm_extensions' : 'lower_arm_braces'; parameters[other] = false; document.getElementById(other).checked = false; }
  queue();
}
function controlsUI() {
  for (const group of [...config.groups].sort((a, b) => (a.title === 'Frame' ? -1 : b.title === 'Frame' ? 1 : 0))) {
    const details = document.createElement('details'); details.className = 'drone-details'; details.open = group.title === 'Frame';
    text(details, 'summary', group.title);
    for (const field of group.fields) {
      const element = document.createElement('div'); element.className = 'parameter';
      const head = document.createElement('div'); head.className = 'parameter-head';
      const label = text(head, 'label', field.label); label.htmlFor = `${field.key}Number`; text(head, 'span', field.unit === 'deg' ? '\u00b0' : field.unit); element.append(head);
      const inputs = document.createElement('div'); inputs.className = 'parameter-inputs';
      for (const [kind, suffix] of [['range', 'Range'], ['number', 'Number']]) {
        const input = document.createElement('input'); input.type = kind; input.id = `${field.key}${suffix}`; input.min = field.min; input.max = field.max; input.step = 'any';
        if (kind === 'range') input.setAttribute('aria-label', field.label);
        else input.inputMode = 'decimal';
        input.addEventListener(kind === 'range' ? 'input' : 'change', () => {
          const value = input.value === '' ? NaN : Number(input.value);
          if (kind === 'range') {
            const quantized = Math.max(field.min, Math.min(field.max, Number((field.min + Math.round((value - field.min) / field.step) * field.step).toFixed(8))));
            document.getElementById(`${field.key}Number`).value = quantized; change(field.key, quantized);
          } else { document.getElementById(`${field.key}Range`).value = value; change(field.key, value); }
        });
        inputs.append(input);
      }
      element.append(inputs); details.append(element);
    }
    $('Parameters').append(details);
  }
  for (const [key, title] of Object.entries(toggleLabels)) {
    const label = document.createElement('label'); label.className = 'checkbox-line';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = key;
    input.addEventListener('change', () => change(key, input.checked)); label.append(input); text(label, 'span', title); $('Toggles').append(label);
  }
  for (const key of pointKeys) {
    const element = document.createElement('div'); element.className = 'drone-points'; const label = text(element, 'label', key.replaceAll('_', ' '));
    label.htmlFor = `${key}Points`; const textarea = document.createElement('textarea'); textarea.id = label.htmlFor; textarea.rows = 2; textarea.spellcheck = false; element.append(textarea); $('Points').append(element);
  }
  // Controller presets apply dimensions explicitly; unresolved board CAD stays a placeholder.
  for (const [key, controller] of Object.entries(config.controllers)) { const option = document.createElement('option'); option.value = key; option.textContent = controller.label; $('Controller').append(option); }
  for (const profile of [...config.printer_profiles, { id: 'custom', label: 'Custom layout' }]) { const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.label; $('Printer').append(option); }
  $('Printer').addEventListener('change', () => { const profile = config.printer_profiles.find(item => item.id === $('Printer').value); if (profile) { Object.assign(parameters, structuredClone(profile.changes)); sync(); queue(); } });
  $('Controller').addEventListener('change', () => { const key = $('Controller').value; Object.assign(parameters, structuredClone(config.controllers[key].changes), { controller_preset: key, component_references: {} }); sync(); queue(); });
  $('Variant').addEventListener('change', () => { parameters = structuredClone($('Variant').value === 'drone_frame_v0' ? config.historical : config.defaults); frameNext = true; selected = null; sync(); queue(); });
  $('Mount').addEventListener('change', () => change('controller_mount_style', $('Mount').value));
  $('Joint').addEventListener('change', () => change('upper_arm_joint_style', $('Joint').value));
  $('ApplyPoints').addEventListener('click', () => { try { const values = Object.fromEntries(pointKeys.map(key => [key, JSON.parse(document.getElementById(`${key}Points`).value)])); parameters = validateParameters({ ...parameters, ...values }, config); queue(); } catch (reason) { sequence++; error(reason.message); } });
  for (const [slot, choices] of Object.entries(referenceChoices)) {
    const container = document.createElement('div'); container.className = 'control-section';
    const label = text(container, 'label', slot === 'radio_module' ? 'Radio module (not a full controller)' : 'Power connector', 'select-label'); label.htmlFor = `${slot}Reference`;
    const select = document.createElement('select'); select.id = label.htmlFor;
    const none = document.createElement('option'); none.value = ''; none.textContent = 'Not shown'; select.append(none);
    for (const id of choices) { const option = document.createElement('option'); option.value = id; option.textContent = references.models[id].label; select.append(option); }
    container.append(select);
    const pose = document.createElement('div'); pose.id = `${slot}Pose`; pose.hidden = true;
    for (const key of ['position', 'rotation']) {
      const row = document.createElement('div'); row.className = 'drone-reference-pose';
      text(row, 'span', key === 'position' ? 'XYZ (mm)' : 'XYZ (deg)');
      for (let axis = 0; axis < 3; axis++) {
        const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.min = key === 'position' ? -500 : -360; input.max = -input.min; input.id = `${slot}${key}${axis}`;
        input.setAttribute('aria-label', `${label.textContent}: ${key} ${'XYZ'[axis]}`);
        input.addEventListener('change', () => { parameters.component_references[slot][key][axis] = input.value === '' ? NaN : Number(input.value); queue(); });
        row.append(input);
      }
      pose.append(row);
    }
    select.addEventListener('change', () => {
      if (select.value) parameters.component_references[slot] = { model_id: select.value, position: [slot === 'radio_module' ? -22 : 22, -parameters.motor_y_offset - parameters.prop_diameter / 2 - 25, 0], rotation: [0, 0, 0] };
      else delete parameters.component_references[slot];
      sync(); frameNext = true; queue();
    });
    container.append(pose); $('References').append(container);
  }
}

function meshGeometry(data) { const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3)); geometry.setIndex(new THREE.BufferAttribute(data.indices, 1)); geometry.computeVertexNormals(); return geometry; }
function componentObject(part, parameters = result.parameters) {
  const reference = part.reference || referenceFor(part, parameters, references);
  if (reference) {
    const object = referenceObject(reference, part, references, referenceMeshes), pose = part.reference ? { position: part.center, rotation: part.rotation } : referencePose(reference, part, parameters);
    object.name = part.name;
    object.position.set(...pose.position); object.rotation.set(...pose.rotation.map(n => THREE.MathUtils.degToRad(n)), 'ZYX');
    if (references.models[reference].notice) object.userData.licence_notice = asset(references.models[reference].notice).href;
    if (part.reference) object.userData.note = part.note;
    return object;
  }
  const object = new THREE.Group(); object.name = part.name; object.userData = { label: part.label, printable: part.printable, note: part.note || 'Original frame design; experimental printable part.' };
  if (!part.printable && (part.name.startsWith('motor_') || part.name === 'battery' || part.shape === 'propeller')) object.userData.note = 'Modified dimensions: illustrative fit envelope shown, not a resized fixed component model.';
  const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, metalness: 0.05 });
  let geometry;
  if (part.shape === 'mesh') geometry = meshGeometry(part.mesh);
  if (part.shape === 'box') geometry = new THREE.BoxGeometry(...part.size);
  if (part.shape === 'cylinder') { geometry = new THREE.CylinderGeometry(part.size[0] / 2, part.size[0] / 2, part.size[2], part.segments || 48); geometry.rotateX(Math.PI / 2); }
  if (part.shape === 'propeller') {
    const radius = part.size[0] / 2, blade = new THREE.Shape();
    blade.moveTo(5, -3); blade.bezierCurveTo(radius * 0.6, -13, radius, -7, radius, -2); blade.bezierCurveTo(radius, 7, radius * 0.5, 11, 5, 3); blade.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: 1.6, bevelEnabled: false, curveSegments: 20 }); bladeGeometry.translate(0, 0, -0.8);
    if (!part.clockwise) bladeGeometry.scale(1, -1, 1);
    for (let i = 0; i < 3; i++) { const mesh = new THREE.Mesh(bladeGeometry.clone(), material.clone()); mesh.rotation.z = i * Math.PI * 2 / 3; object.add(mesh); }
    bladeGeometry.dispose();
    geometry = new THREE.CylinderGeometry(7, 7, 5, 48); geometry.rotateX(Math.PI / 2);
  }
  object.add(new THREE.Mesh(geometry, material));
  if (part.shape !== 'mesh') { object.position.set(...part.center); object.rotation.z = THREE.MathUtils.degToRad(part.rotation_z || 0); }
  if (part.printable) { const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: 0x4c5660, transparent: true, opacity: 0.4 })); object.add(lines); }
  return object;
}
function choose(name) {
  selected = name;
  const part = result?.parts.find(part => part.name === name);
  $('Selection').textContent = part ? `${part.label}: ${objects.get(name)?.userData.note || part.note || 'Printable frame part; prototype fit remains unverified.'}` : '';
  for (const [key, object] of objects) object.traverse(child => { if (child.isMesh) child.material.emissive.set(key === selected ? 0x243c35 : 0x000000); });
  for (const button of $('Components').querySelectorAll('[data-component]')) button.setAttribute('aria-pressed', String(button.dataset.component === name));
}
function sceneUI() {
  dispose(assembly); objects.clear(); $('Components').replaceChildren();
  for (const part of result.parts) {
    const object = componentObject(part); objects.set(part.name, object); assembly.add(object); object.visible = visibility.get(part.name) !== false;
    const row = document.createElement('div'); row.className = 'drone-component';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = object.visible; checkbox.setAttribute('aria-label', `Show ${part.name.replaceAll('_', ' ')}`);
    checkbox.addEventListener('change', () => { visibility.set(part.name, checkbox.checked); object.visible = checkbox.checked; });
    const button = document.createElement('button'); button.type = 'button'; button.dataset.component = part.name; button.setAttribute('aria-pressed', 'false');
    const swatch = text(button, 'span', '', 'drone-swatch'); swatch.style.setProperty('--part-color', part.color); text(button, 'span', part.name === 'esp32_s3' ? 'Controller' : part.name.startsWith('motor_') ? part.name.replaceAll('_', ' ') : part.name.startsWith('propeller_') ? part.name.replace('propeller_', 'prop ').replaceAll('_', ' ') : part.label);
    button.addEventListener('click', () => choose(part.name)); row.append(checkbox, button); $('Components').append(row);
  }
  const previous = $('PrintPart').value; $('PrintPart').replaceChildren();
  for (const key of Object.keys(result.exports)) { const option = document.createElement('option'); option.value = key; option.textContent = key === 'coupon' ? 'Motor-pad fit coupon' : key === 'keepers' ? 'All controller keepers' : result.parts.find(part => part.name === key)?.label || key; $('PrintPart').append(option); }
  if (Object.hasOwn(result.exports, previous)) $('PrintPart').value = previous;
  transparency(); buildOverlays(); choose(selected);
}
function transparency() { const object = objects.get('upper'); object?.traverse(child => { if (!child.isMesh) return; child.material.transparent = $('Transparent').checked; child.material.opacity = $('Transparent').checked ? 0.42 : 1; child.material.depthWrite = !$('Transparent').checked; }); }
function buildOverlays() {
  dispose(overlays); if (!result) return;
  const p = result.parameters;
  if ($('Sweeps').checked) for (const part of result.parts.filter(part => part.shape === 'propeller')) {
    const bounds = result.report.prop_envelope_mm, height = bounds[1] - bounds[0], radius = Math.max(p.prop_diameter / 2, config.datums.prop_reference_radius_mm);
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 96); geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: part.color, transparent: true, opacity: 0.1, depthWrite: false })); mesh.position.set(part.center[0], part.center[1], (bounds[0] + bounds[1]) / 2); overlays.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: part.color, transparent: true, opacity: 0.5 })); edge.position.copy(mesh.position); overlays.add(edge);
  }
  if ($('Keepouts').checked) {
    const shape = new THREE.Shape(), x = p.plate_width / 2, y = p.plate_length / 2, r = p.body_corner_radius;
    shape.moveTo(-x + r, -y); shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r); shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y); shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r); shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: p.prop_blade_thickness + 2 * p.prop_deflection_allowance, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xbe823c, transparent: true, opacity: 0.12, depthWrite: false })); body.position.z = result.propPlane - p.prop_blade_thickness / 2 - p.prop_deflection_allowance; overlays.add(body);
    if (p.controller_antenna_length) {
      const margin = p.controller_antenna_margin, group = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(p.controller_antenna_length + 2 * margin, p.esp32_size_y + 2 * margin, margin * 2 || 1), new THREE.MeshBasicMaterial({ color: 0xce5c82, transparent: true, opacity: 0.14, depthWrite: false }));
      box.position.x = p.esp32_size_x / 2 - p.controller_antenna_length / 2; group.add(box); group.rotation.z = THREE.MathUtils.degToRad(p.esp32_rotation_z);
      group.position.set(p.esp32_center_x, p.esp32_center_y, objects.get('esp32_s3').position.z); overlays.add(group);
    }
  }
}
function reportUI() {
  const report = result.report;
  $('Warning').textContent = `Prototype \u00b7 not flight-ready \u00b7 ${report.status === 'fail' ? 'fit checks fail' : 'fit unverified'}`;
  $('Warning').title = report.source_configuration_warning;
  $('Dimensions').textContent = `${report.wheelbase_mm.toFixed(1)} mm wheelbase`;
  const parent = $('Report'); parent.replaceChildren();
  text(parent, 'p', report.source_configuration_warning);
  text(parent, 'p', `Generic-envelope checks: ${report.status}. Body tip gap ${report.body_tip_gap_mm.toFixed(2)} mm; adjacent prop gap ${report.adjacent_tip_gap_mm.toFixed(2)} mm.`);
  if (Object.keys(result.parameters.component_references).length) text(parent, 'p', 'Optional licensed references are display-only. Their positions, interfaces and collisions are not included in frame fit checks.');
  if (report.upper_arm_vertical_gap_mm !== null) text(parent, 'p', `Upper-arm sweep gap: ${report.upper_arm_vertical_gap_mm.toFixed(3)} mm. Negative means overlap.`);
  if (report.lower_ribs.enabled) text(parent, 'p', `Lower-rib calculated blade gap: ${report.lower_ribs.minimum_calculated_gap_mm.toFixed(2)} mm. This is a geometric allowance, not physical validation.`);
  text(parent, 'p', `Lower print footprint with brim/skirt: ${report.printer.required_xy_mm.map(x => x.toFixed(1)).join(' x ')} mm; bed check ${report.printer.status}. Upper deck and separate parts need their own slicer checks.`);
  if (report.controller_ties.enabled) text(parent, 'p', `Controller retention: ${report.controller_ties.count} roof slots for ${report.controller_ties.loop_count} ties, plus removable keepers. Physical routing remains unverified.`);
  text(parent, 'p', `Centered bed margin: ${report.printer.centered_margins_mm.map(x => x.toFixed(2)).join(' / ')} mm. No allowance for bed clips or purge lines.`);
  if (report.motor_screws.enabled) text(parent, 'p', `Motor platform ${report.motor_screws.mount_plane_z_mm.toFixed(1)} mm; material above head pocket ${report.motor_screws.material_above_pocket_mm.toFixed(1)} mm; calculated screw engagement ${report.motor_screws.calculated_engagement_mm.toFixed(1)} mm (${report.motor_screws.status}). Provisional depth allowance only; test a physical coupon for bottoming.`);
  if (report.antenna_keepout.keeper_overlap) text(parent, 'p', 'Controller keepers enter the provisional antenna allowance. RF performance is unresolved.');
  if (report.overlapping_envelopes.length) text(parent, 'p', `Overlapping generic envelopes: ${report.overlapping_envelopes.map(pair => pair.join(' / ')).join(', ')}.`);
  const list = document.createElement('ul'); for (const warning of report.unresolved) text(list, 'li', warning); parent.append(list);
}
function frame(view = currentView) {
  if (!result) return;
  assembly.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(assembly), center = box.getCenter(new THREE.Vector3());
  const directions = { iso: [0.9, -1.2, 0.95], top: [0, 0, 1], bottom: [0, 0, -1], front: [0, 1, 0], side: [1, 0, 0] };
  camera.up.set(...(['top', 'bottom'].includes(view) ? [0, 1, 0] : [0, 0, 1]));
  camera.position.copy(center).add(new THREE.Vector3(...directions[view]).normalize().multiplyScalar(800)); camera.zoom = 1; controls.target.copy(center); camera.lookAt(center); camera.updateMatrixWorld();
  const inverse = camera.matrixWorldInverse, corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(inverse));
  const width = Math.max(...corners.map(c => c.x)) - Math.min(...corners.map(c => c.x)), height = Math.max(...corners.map(c => c.y)) - Math.min(...corners.map(c => c.y));
  const aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
  const usable = Math.max(0.3, (viewport.clientHeight - 130) / viewport.clientHeight), span = Math.max(height / usable, width / (aspect * 0.85)) * 1.08;
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2; camera.updateProjectionMatrix(); controls.update();
}
for (const button of root.querySelectorAll('[data-view]')) button.addEventListener('click', () => { currentView = button.dataset.view; for (const other of root.querySelectorAll('[data-view]')) other.setAttribute('aria-pressed', String(other === button)); frame(); });
for (const id of ['Sweeps', 'Keepouts']) $(id).addEventListener('change', buildOverlays);
$('Transparent').addEventListener('change', transparency);
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down;
canvas.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
canvas.addEventListener('pointerup', event => {
  if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
  const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(assembly.children, true).find(hit => hit.object.isMesh && hit.object.parent.visible);
  if (hit) { let object = hit.object; while (object.parent !== assembly) object = object.parent; choose(object.name); }
});
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function noticeText() { return [credits.copyright, credits.publication, ...credits.components.map(c => `${c.name}\nAuthor: ${c.author}\n${c.basis}\n${c.licence}\n${[c.source, c.additional_source].filter(Boolean).join('\n')}${c.notice ? `\nNotice: ${asset(c.notice).href}` : ''}`), ...credits.software.map(s => `${s.name} ${s.version} - ${s.licence}; notice ${new URL(s.notice, asset('credits.json')).href}`)].join('\n\n'); }
function creditsUI() {
  const parent = $('Credits'); text(parent, 'p', `Copyright ${credits.copyright}. ${credits.publication}`);
  for (const component of credits.components) { text(parent, 'h3', component.name); text(parent, 'p', component.author); text(parent, 'p', component.basis); text(parent, 'p', component.licence); if (component.source) { const link = text(parent, 'a', 'Source'); link.href = component.source; link.target = '_blank'; link.rel = 'noopener'; } if (component.notice) { text(parent, 'span', ' / '); const link = text(parent, 'a', 'Licence notice'); link.href = asset(component.notice).href; link.target = '_blank'; link.rel = 'noopener'; } }
  for (const software of credits.software) { const link = text(parent, 'a', `${software.name} ${software.version}: ${software.licence}`); link.href = new URL(software.notice, asset('credits.json')).href; text(parent, 'br', ''); }
}
$('CreditsDownload').addEventListener('click', () => save(noticeText(), 'drone-frame-source-notices.txt', 'text/plain'));
$('ReportDownload').addEventListener('click', () => { if (available()) save(JSON.stringify({ parameters: result.parameters, report: result.report, sources: credits }, null, 2), 'drone-frame-fit-report.json', 'application/json'); });
$('ParametersDownload').addEventListener('click', () => { if (available()) save(JSON.stringify(result.parameters, null, 2), 'drone-frame-parameters.json', 'application/json'); });
$('Export').addEventListener('click', () => { const open = $('Downloads').hidden; $('Downloads').hidden = !open; $('Export').setAttribute('aria-expanded', String(open)); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.coffee-toolbar')) { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
root.addEventListener('keydown', event => { if (event.key === 'Escape') { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
$('Stl').addEventListener('click', () => {
  if (!available()) return;
  const part = $('PrintPart').value, p = result.parameters;
  const revision = p.frame_variant === 'drone_frame_v0' ? 'historical' : p.lower_arm_braces ? 'lower-ribs' : p.upper_arm_extensions ? `upper-arms-${p.upper_arm_joint_style}` : 'flat-deck';
  save(binarySTL(result.exports[part]), `${p.frame_variant}-${revision}-${part}.stl`, 'model/stl');
});
$('Glb').addEventListener('click', async () => {
  if (!available()) return; exporting = true; availability(); const group = new THREE.Group(), snapshot = result;
  try {
    for (const part of snapshot.parts) group.add(componentObject(part, snapshot.parameters));
    group.userData = { parameters: snapshot.parameters, original_design_copyright: credits.copyright, sources: credits, references: references.models };
    // CAD is mm/Z-up. GLB is metres/Y-up: convert exactly once at the export root.
    group.rotation.x = -Math.PI / 2; group.scale.setScalar(0.001); group.updateMatrixWorld(true);
    const data = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: false });
    save(data, `${snapshot.parameters.frame_variant}-assembly-preview.glb`, 'model/gltf-binary');
  } catch (reason) { error(`GLB export failed: ${reason.message}`); }
  finally { dispose(group); exporting = false; availability(); }
});
function copyFeedback(copied) {
  clearTimeout(copyTimer);
  $('Copy').querySelector('[data-copy-default]').hidden = copied;
  $('Copy').querySelector('[data-copy-done]').hidden = !copied;
  $('Copy').title = copied ? 'Model link copied' : 'Copy link with current parameters';
  if (copied) copyTimer = setTimeout(() => copyFeedback(false), 2000);
}
$('Copy').addEventListener('click', async () => {
  if (!available()) return; const link = modelLink(location.href, result.parameters, config);
  try { await navigator.clipboard.writeText(link); $('CopyStatus').textContent = 'Model link copied'; copyFeedback(true); }
  catch { $('LinkValue').value = link; $('LinkDialog').showModal(); $('LinkValue').select(); }
});
$('Reset').addEventListener('click', () => { clearTimeout(timer); parameters = structuredClone(parameters?.frame_variant === 'drone_frame_v0' ? config.historical : config.defaults); history.replaceState(null, '', location.pathname + location.search); frameNext = true; selected = null; sync(); queue(); });
window.addEventListener('hashchange', () => { try { parameters = readLink(location.href, config); sync(); frameNext = true; queue(); } catch (reason) { clearTimeout(timer); sequence++; error(reason.message); } });
function resize() { renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false); if (result) frame(); }
function height() { root.style.setProperty('--coffee-height', `${Math.max(180, (window.visualViewport?.height || innerHeight) - root.getBoundingClientRect().top - 8)}px`); }
height(); window.addEventListener('resize', height, { passive: true }); window.visualViewport?.addEventListener('resize', height, { passive: true });
new ResizeObserver(resize).observe(viewport); const header = document.querySelector('.site-header'); if (header) new ResizeObserver(height).observe(header);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.addEventListener('pagehide', event => { if (!event.persisted) worker?.terminate(); });
try {
  const responses = await Promise.all([fetch(asset('config.json')), fetch(asset('credits.json')), fetch(asset('references/manifest.json'))]);
  if (responses.some(response => !response.ok)) throw new Error('The model configuration could not load.');
  [config, credits, references] = await Promise.all(responses.map(response => response.json()));
  status('Loading references'); referenceMeshes = await loadReferences(references, asset);
  controlsUI(); creditsUI();
  let linkError = '';
  try { parameters = readLink(location.href, config); } catch (reason) { parameters = structuredClone(config.defaults); linkError = reason.message; }
  sync(); worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onerror = () => error('The model worker failed to load. Reload to try again.');
  worker.onmessage = event => {
    if (event.data.sequence !== sequence) return;
    if (event.data.error) { error(event.data.error); return; }
    try { result = event.data.result; result.parts.push(...optionalParts(result.parameters, references)); result.sequence = sequence; sceneUI(); reportUI(); status('Ready'); $('Error').hidden = true; root.dataset.state = 'ready'; availability(); if (frameNext) { frame(); frameNext = false; } }
    catch (reason) { error(`Preview failed: ${reason.message}`); }
  };
  if (linkError) error(`Model link could not be opened: ${linkError} Reset to use the default design.`); else queue();
} catch (reason) { error(reason.message); $('Reset').disabled = true; }
