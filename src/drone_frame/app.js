import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { validateParameters, modelLink, readLink, referenceChoices } from './parameters.mjs';
import { binarySTL } from './exports.mjs';
import { printProfiles } from './print_profiles.mjs';
import { loadReferences, referenceFor, referenceObject, referencePose, optionalParts } from './references.mjs';
import { registerViewer, resizeCamera } from '../cad-ui.mjs';
import { componentCatalog, inferComponent, applyComponent } from './components.mjs';
import { printerBeds, parameterBed, bedCheck, clearanceCheck, verifiedOrientation, fitCandidates } from './print-bed.mjs';

const root = document.getElementById('droneWorkbench');
const $ = id => document.getElementById(`drone${id}`);
const viewport = root.querySelector('.viewport'), canvas = $('Canvas');
const asset = name => new URL(`../../assets/cad/drone-frame/${name}`, import.meta.url);
let config, credits, references, referenceMeshes, parameters, result, sequence = 0, timer, copyTimer, exporting = false, worker;
let selected = null, hovered = null, selectedAnchor = null, currentView = 'iso', frameNext = true, selectedBed, catalog, bedFit = null, orbiting = false;
const visibility = new Map(), objects = new Map(), layoutObjects = new Map(), componentModes = new Map();
const componentInputs = { controller: 'Controller', esc: 'Esc', motor: 'Motor', prop: 'Prop' };
const actions = ['Copy', 'Fit', 'FitBed', 'Export', 'Stl', 'Glb', 'ReportDownload', 'ParametersDownload'];
const pointKeys = ['motor_mount_points', 'esc_mount_points', 'carrier_support_points', 'controller_mount_points', 'legacy_carrier_holes', 'imu_mount_points'];
const toggleLabels = {
  motor_compact_pad: 'Compact blended motor pads', motor_cable_ports_enabled: 'Open-top motor cable slots',
  motor_recess_enabled: 'Reduced motor pads with recessed bolt heads',
  carrier_enabled: 'Controller retention', upper_arm_extensions: 'Sloping upper arms',
  under_keeper_opposite_end: 'Keepers at both controller ends', lower_arm_braces: 'Base-grown lower arm ribs', small_board_mounts: 'Small-board seats',
  imu_mount_enabled: 'IMU mounting holes', battery_ties_enabled: 'Battery tie slots', under_controller_ties_enabled: 'Controller roof tie slots',
  generic_mounts_enabled: 'Legacy generic tie slots', root_hardware_preview: 'Root bolt visual envelopes',
  prop_seat_on_shaft: 'Seat prop hubs on shaft datum', prop_nuts_enabled: 'Illustrative prop nuts',
  controller_center_support_enabled: 'Center platform and header openings', controller_side_supports_enabled: 'Raised controller side guides', controller_antenna_roof_opening: 'Antenna roof opening', controller_long_tie_slots: 'Long tie slots and L guides', upper_signature_enabled: 'Recessed designer signature'
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
registerViewer(root, { camera, controls });
const assembly = new THREE.Group(), overlays = new THREE.Group(), printLayout = new THREE.Group();
printLayout.visible = false;
scene.add(assembly, overlays, printLayout, new THREE.HemisphereLight(0xffffff, 0x7f8794, 2.5));
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
function text(parent, tag, content, className = '') { const node = document.createElement(tag); node.textContent = content; node.className = className; parent.append(node); return node; }
function sync() {
  for (const field of config.groups.flatMap(group => group.fields)) {
    for (const suffix of ['Range', 'Number']) document.getElementById(`${field.key}${suffix}`).value = parameters[field.key];
  }
  for (const key of Object.keys(toggleLabels)) document.getElementById(key).checked = parameters[key];
  for (const key of pointKeys) document.getElementById(`${key}Points`).value = JSON.stringify(parameters[key]);
  $('Variant').value = parameters.frame_variant;
  $('PrintVersion').value = parameters.print_profile;
  for (const option of $('PrintVersion').options) option.disabled = parameters.frame_variant === 'drone_frame_v0' && option.value !== 'full';
  for (const [kind, id] of Object.entries(componentInputs)) $(id).value = componentModes.get(kind) === 'custom' ? 'custom' : inferComponent(parameters, catalog[kind]);
  $('Mount').value = parameters.controller_mount_style;
  $('Joint').value = parameters.upper_arm_joint_style;
  $('PresetBasis').textContent = Object.entries(componentInputs).map(([kind, id]) => catalog[kind].find(choice => choice.id === $(id).value).basis).join(' ');
  if (!selectedBed) selectedBed = printerBeds(config).find(bed => bed.width === parameters.printer_bed_width && bed.depth === parameters.printer_bed_depth && bed.height === parameters.printer_height) || parameterBed(parameters);
  if (selectedBed.id === 'custom') selectedBed = parameterBed(parameters);
  $('Printer').value = selectedBed.id;
  for (const slot of Object.keys(referenceChoices)) {
    const setting = parameters.component_references[slot];
    document.getElementById(`${slot}Reference`).value = setting?.model_id || '';
    document.getElementById(`${slot}Pose`).hidden = !setting;
    if (setting) for (const key of ['position', 'rotation']) for (let axis = 0; axis < 3; axis++) document.getElementById(`${slot}${key}${axis}`).value = setting[key][axis];
  }
}
function queue() {
  cancelBedFit();
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
    const details = document.createElement('details'); details.className = 'drone-details';
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
  catalog = componentCatalog(config);
  for (const [kind, id] of Object.entries(componentInputs)) {
    for (const choice of catalog[kind]) { const option = document.createElement('option'); option.value = choice.id; option.textContent = choice.label; $(id).append(option); }
    $(id).addEventListener('change', () => {
      const choice = catalog[kind].find(item => item.id === $(id).value);
      if (choice.id === 'custom') {
        componentModes.set(kind, 'custom'); $('Advanced').open = true;
        const group = [...$('Parameters').children].find(details => details.querySelector('summary').textContent === choice.group);
        if (group) { group.open = true; group.scrollIntoView({ block: 'nearest' }); }
        sync(); return;
      }
      try { parameters = applyComponent(parameters, kind, choice.id, config); componentModes.delete(kind); sync(); queue(); }
      catch (reason) { sync(); sequence++; error(reason.message); }
    });
  }
  for (const bed of [...printerBeds(config), { id: 'custom', label: 'Custom usable bed' }]) { const option = document.createElement('option'); option.value = bed.id; option.textContent = bed.label; $('Printer').append(option); }
  $('Printer').addEventListener('change', () => {
    cancelBedFit(); selectedBed = printerBeds(config).find(bed => bed.id === $('Printer').value) || parameterBed(parameters);
    if (result) reportUI(); bedUI(); buildPrintLayout(); availability();
  });
  $('FitBed').addEventListener('click', fitToBed);
  $('Variant').addEventListener('change', () => { parameters = structuredClone($('Variant').value === 'drone_frame_v0' ? config.historical : config.defaults); componentModes.clear(); selected = null; sync(); queue(); });
  for (const [id, profile] of Object.entries(printProfiles)) { const option = document.createElement('option'); option.value = id; option.textContent = profile.label; $('PrintVersion').append(option); }
  $('PrintVersion').addEventListener('change', () => { parameters.print_profile = $('PrintVersion').value; selected = null; sync(); queue(); });
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
      sync(); queue();
    });
    container.append(pose); $('References').append(container);
  }
}

function cancelBedFit() {
  if (!bedFit) return;
  bedFit = null; sequence++;
  if (result) { result.sequence = sequence; root.dataset.state = 'ready'; status('Ready'); availability(); }
}
function bedUI(outcome = '') {
  if (!result || !selectedBed) return;
  const check = bedCheck(result, selectedBed), parent = $('BedStatus'); parent.replaceChildren();
  root.dataset.bedFits = String(check.fits);
  if (outcome) text(parent, 'p', outcome);
  text(parent, 'p', `${selectedBed.label}: ${selectedBed.width} x ${selectedBed.depth} mm usable area, ${selectedBed.height} mm build height.`);
  text(parent, 'p', `Print orientation ${check.rotation}\u00b0 about Z; flat export datum at Z=0. Brim ${result.parameters.brim_width} mm with ${result.parameters.brim_separation} mm separation; ${result.parameters.separate_skirt_loops} separate skirt loops. Parts are checked and printed separately.`);
  for (const part of check.parts) text(parent, 'p', `${part.key}: ${part.required.map(value => value.toFixed(2)).join(' x ')} mm including allowance, ${part.size[2].toFixed(2)} mm high: ${part.fits ? 'fits selected bed' : 'does not fit selected bed'}.`);
  text(parent, 'p', clearanceCheck(result, config).caveat);
  text(parent, 'p', check.scope);
}
function finishBedFit(message) {
  bedFit = null;
  if (result) result.sequence = sequence;
  root.dataset.state = 'ready'; status('Ready'); availability(); bedUI(message); $('Technical').open = true;
}
function nextBedCandidate() {
  const candidate = bedFit.candidates.shift();
  if (!candidate) { finishBedFit('No verified layout was found for this usable bed without changing component choices, mounting requirements or selected clearances. Current geometry is unchanged.'); return; }
  bedFit.attempt++;
  postBedCandidate(candidate);
}
function postBedCandidate(candidate) {
  sequence++; root.dataset.state = 'fitting'; status(`Checking bed ${bedFit.attempt}`); availability();
  worker.postMessage({ sequence, parameters: candidate, config });
}
function fitToBed() {
  if (!available()) return;
  const orientation = verifiedOrientation(result, selectedBed, config);
  const metadata = { printer_bed_width: selectedBed.width, printer_bed_depth: selectedBed.depth, printer_height: selectedBed.height };
  if (orientation && orientation.rotation === parameters.print_rotation_z && Object.entries(metadata).every(([key, value]) => parameters[key] === value)) {
    bedUI('Actual printable export bounds already fit this bed at the documented orientation. Geometry is unchanged.'); $('Technical').open = true; return;
  }
  const candidates = orientation ? [{ ...structuredClone(parameters), ...metadata, print_rotation_z: orientation.rotation }] : fitCandidates(parameters, selectedBed, config);
  bedFit = { bed: structuredClone(selectedBed), candidates, attempt: 0 };
  nextBedCandidate();
}
function bedCandidateResult(event) {
  if (event.data.error) { nextBedCandidate(); return; }
  const candidate = event.data.result, check = verifiedOrientation(candidate, bedFit.bed, config);
  if (!check) { nextBedCandidate(); return; }
  if (Math.abs(candidate.parameters.print_rotation_z - check.rotation) > 0.000001) {
    postBedCandidate({ ...candidate.parameters, print_rotation_z: check.rotation }); return;
  }
  parameters = structuredClone(candidate.parameters); bedFit = null; sync(); acceptResult(candidate);
  bedUI('Verified geometric bed fit using the actual printable export vertices. Use this matching lower/upper pair. Existing fit warnings remain; this is not hardware or flight qualification.'); $('Technical').open = true;
}
function printMode() { return $('Display').value === 'print'; }
function activeObjects() { return printMode() ? layoutObjects : objects; }
function buildPrintLayout() {
  dispose(printLayout); layoutObjects.clear();
  if (!result || !selectedBed) return;
  const check = bedCheck(result, selectedBed), part = check.parts.find(item => item.key === $('BedPart').value) || check.parts[0];
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(selectedBed.width, selectedBed.depth), new THREE.MeshBasicMaterial({ color: 0x7b9b8e, transparent: true, opacity: 0.16, side: THREE.DoubleSide })); bed.position.z = -0.5; printLayout.add(bed);
  function rectangle(width, depth, color, z) {
    const points = [[-width / 2, -depth / 2, z], [width / 2, -depth / 2, z], [width / 2, depth / 2, z], [-width / 2, depth / 2, z], [-width / 2, -depth / 2, z]].map(point => new THREE.Vector3(...point));
    printLayout.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color })));
  }
  rectangle(selectedBed.width, selectedBed.depth, 0x607c70, -0.4);
  if (part) {
    const object = new THREE.Group(); object.name = part.key;
    const geometry = meshGeometry(result.exports[part.key]);
    object.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: part.key === 'lower' ? 0xb6bdc4 : 0xd6dadd, roughness: 0.75 })));
    object.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: 0x4c5660, transparent: true, opacity: 0.5 })));
    object.rotation.z = THREE.MathUtils.degToRad(part.rotation);
    object.position.set(-(part.bounds[0][0] + part.bounds[1][0]) / 2, -(part.bounds[0][1] + part.bounds[1][1]) / 2, -part.bounds[0][2]);
    printLayout.add(object); layoutObjects.set(part.key, object);
    rectangle(part.required[0], part.required[1], part.fits ? 0x087d78 : 0xb9483c, -0.2);
  }
  assembly.visible = !printMode(); overlays.visible = !printMode(); printLayout.visible = printMode(); $('BedPartRow').hidden = !printMode();
  highlight(); positionLabel();
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
function componentTitle(part) {
  if (!part) return '';
  const fixed = { lower: 'Lower frame', upper: 'Upper frame', esp32_s3: 'Controller', esc: 'ESC', imu: 'IMU', bec_placeholder: 'Regulator', battery: 'Battery', radio_module: 'Radio module', power_connector: 'Power connector' };
  if (fixed[part.name]) return fixed[part.name];
  const rotor = part.name.match(/^(motor|propeller|prop_nut)_(front|rear)_(left|right)$/);
  return rotor ? `${rotor[2]}-${rotor[3]} ${rotor[1] === 'motor' ? 'motor' : rotor[1] === 'propeller' ? 'prop' : 'prop nut'}` : part.label;
}
function highlight() {
  for (const [key, object] of [...objects, ...layoutObjects]) object.traverse(child => {
    const color = key === selected ? 0x21463e : key === hovered ? 0x3c321d : 0x000000;
    for (const material of child.material ? Array.isArray(child.material) ? child.material : [child.material] : []) {
      if (child.isMesh) material.emissive?.set(color);
      if (child.isLine) {
        child.userData.baseLineColor ||= material.color.clone();
        material.color.copy(child.userData.baseLineColor);
        if (key === selected || key === hovered) material.color.set(key === selected ? 0x087d78 : 0xab7a2c);
      }
    }
  });
}
function hover(name) {
  if (hovered === name) return;
  hovered = name; root.dataset.hovered = name || ''; canvas.style.cursor = name ? 'pointer' : '';
  highlight();
}
function choose(name, anchor = null) {
  const part = result?.parts.find(part => part.name === name) || (result?.exports[name] ? { name, label: [...$('PrintPart').options].find(option => option.value === name)?.textContent || name, note: 'Printable export at its documented print datum; physical fit remains unverified.' } : null);
  selected = part ? name : null; selectedAnchor = part ? anchor : null; root.dataset.selected = selected || '';
  $('Selection').textContent = part ? `${part.label}: ${objects.get(name)?.userData.note || part.note || 'Printable frame part; prototype fit remains unverified.'}` : '';
  $('Label').textContent = componentTitle(part);
  highlight(); positionLabel();
  for (const button of $('Components').querySelectorAll('[data-component]')) button.setAttribute('aria-pressed', String(button.dataset.component === name));
}
function positionLabel() {
  const label = $('Label'), object = activeObjects().get(selected);
  label.hidden = !object || !object.visible || !label.textContent;
  if (label.hidden) return;
  camera.updateMatrixWorld(true); object.updateWorldMatrix(true, true);
  const anchor = selectedAnchor ? object.localToWorld(selectedAnchor.clone()) : new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  anchor.project(camera);
  if (anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1) { label.hidden = true; return; }
  const x = (anchor.x + 1) * viewport.clientWidth / 2, y = (1 - anchor.y) * viewport.clientHeight / 2;
  const width = label.offsetWidth, height = label.offsetHeight, bounds = viewport.getBoundingClientRect();
  const forbidden = [...viewport.querySelectorAll('.coffee-toolbar, .viewport-bar, .drone-warning, .drone-downloads, .error-banner')].filter(node => !node.hidden).map(node => {
    const rect = node.getBoundingClientRect(); return { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height };
  });
  const positions = [[x + 10, y - height - 8], [x + 10, y + 10], [x - width - 10, y - height - 8], [x - width - 10, y + 10], [x - width / 2, y + 12], [x - width / 2, y - height - 12]];
  for (const [left, top] of positions) {
    const px = Math.max(8, Math.min(viewport.clientWidth - width - 8, left)), py = Math.max(8, Math.min(viewport.clientHeight - height - 8, top));
    if (Math.abs(px - left) > 50 || Math.abs(py - top) > 50) continue;
    if (forbidden.some(rect => px < rect.x + rect.width + 4 && px + width + 4 > rect.x && py < rect.y + rect.height + 4 && py + height + 4 > rect.y)) continue;
    label.style.left = `${px}px`; label.style.top = `${py}px`; return;
  }
  label.hidden = true;
}
function visibilityKey(part) {
  if (/^motor_(front|rear)_(left|right)$/.test(part.name)) return 'motors';
  if (/^(propeller|prop_nut)_/.test(part.name)) return 'props';
  return part.name;
}
function sceneUI() {
  dispose(assembly); objects.clear(); hovered = null; root.dataset.hovered = ''; canvas.style.cursor = ''; $('Components').replaceChildren(); $('Visibility').replaceChildren();
  const groups = new Map();
  for (const part of result.parts) {
    const key = visibilityKey(part);
    const object = componentObject(part); objects.set(part.name, object); assembly.add(object); object.visible = visibility.get(key) !== false;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
    const row = document.createElement('div'); row.className = 'drone-component';
    const button = document.createElement('button'); button.type = 'button'; button.dataset.component = part.name; button.setAttribute('aria-pressed', 'false');
    const swatch = text(button, 'span', '', 'drone-swatch'); swatch.style.setProperty('--part-color', part.color); text(button, 'span', part.name === 'esp32_s3' ? 'Controller' : part.name.startsWith('motor_') ? part.name.replaceAll('_', ' ') : part.name.startsWith('propeller_') ? part.name.replace('propeller_', 'prop ').replaceAll('_', ' ') : part.label);
    button.addEventListener('click', () => choose(part.name)); row.append(button); $('Components').append(row);
  }
  for (const [key, parts] of groups) {
    const label = document.createElement('label'); label.className = 'checkbox-line';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = visibility.get(key) !== false; checkbox.dataset.visibility = key;
    checkbox.addEventListener('change', () => {
      visibility.set(key, checkbox.checked);
      for (const part of parts) objects.get(part.name).visible = checkbox.checked;
      hover(null); positionLabel();
    });
    const title = key === 'motors' ? 'Motors' : key === 'props' ? 'Props and prop nuts' : key === 'esp32_s3' ? 'Controller' : key === 'esc' ? 'ESC' : key === 'imu' ? 'IMU' : key === 'lower' ? 'Lower frame' : key === 'upper' ? 'Upper frame' : parts[0].label;
    label.append(checkbox); text(label, 'span', `Show ${title}`); $('Visibility').append(label);
  }
  const previous = $('PrintPart').value; $('PrintPart').replaceChildren();
  for (const key of Object.keys(result.exports)) { const option = document.createElement('option'); option.value = key; option.textContent = key === 'coupon' ? 'Motor-pad fit coupon' : key === 'keepers' ? 'All controller keepers' : result.parts.find(part => part.name === key)?.label || key; $('PrintPart').append(option); }
  if (Object.hasOwn(result.exports, previous)) $('PrintPart').value = previous;
  const previousBedPart = $('BedPart').value; $('BedPart').replaceChildren();
  for (const option of $('PrintPart').options) $('BedPart').append(option.cloneNode(true));
  if (Object.hasOwn(result.exports, previousBedPart)) $('BedPart').value = previousBedPart;
  transparency(); buildOverlays(); buildPrintLayout(); choose(selected);
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
  if ($('CableGuides').checked && result.report.motor_cables.enabled) for (const route of result.report.motor_cables.routes) {
    const geometry = new THREE.BufferGeometry().setFromPoints(route.guide_points.map(point => new THREE.Vector3(...point)));
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: config.colors[route.motor], dashSize: 2, gapSize: 1 }));
    line.computeLineDistances(); overlays.add(line);
  }
}
function reportUI() {
  const report = result.report, printCheck = bedCheck(result, selectedBed), lowerPrint = printCheck.parts.find(part => part.key === 'lower'), upperPrint = printCheck.parts.find(part => part.key === 'upper');
  $('Warning').textContent = `${report.print_version.label} \u00b7 ${report.print_version.id === 'fit_check' ? 'unpowered fit only' : 'not flight-ready'} \u00b7 ${report.status === 'fail' ? 'fit checks fail' : 'fit unverified'}`;
  $('Warning').title = report.source_configuration_warning;
  $('Dimensions').textContent = `${report.wheelbase_mm.toFixed(1)} mm wheelbase`;
  const parent = $('Report'); parent.replaceChildren();
  text(parent, 'p', report.print_version.purpose);
  text(parent, 'p', `Print geometry ${report.print_version.material_volume_cm3.toFixed(1)} cm3${report.print_version.id !== 'full' ? `; ${report.print_version.material_reduction_percent.toFixed(0)}% less solid volume, ${report.print_version.skin_mm.toFixed(1)} mm base skin / ${report.print_version.web_mm.toFixed(1)} mm webs, motor pads unchanged` : ''}. Print time depends on the slicer.`);
  text(parent, 'p', report.source_configuration_warning);
  if (report.print_version.layout_only) text(parent, 'p', `Root bosses: ${report.print_version.root_boss_height_mm.toFixed(2)} mm tall / ${report.print_version.root_boss_wall_mm.toFixed(1)} mm wall. ${report.print_version.support_scope}`);
  text(parent, 'p', `Generic-envelope checks: ${report.status}. Body tip gap ${report.body_tip_gap_mm.toFixed(2)} mm; adjacent prop gap ${report.adjacent_tip_gap_mm.toFixed(2)} mm.`);
  text(parent, 'p', `Propeller check radius ${report.prop_clearance.radius_mm.toFixed(2)} mm. Body target ${report.prop_clearance.body_target_mm.toFixed(1)} mm (${report.prop_clearance.body_status}); adjacent-prop target ${report.prop_clearance.adjacent_target_mm.toFixed(1)} mm (${report.prop_clearance.adjacent_status}). Deflection allowance ${report.prop_clearance.deflection_allowance_mm.toFixed(1)} mm. This is not flight or hover qualification.`);
  text(parent, 'p', `Default ESC basis: ${config.hardware_defaults.esc.model}, ${config.hardware_defaults.esc.body_dimensions_mm.join(' x ')} mm. The board has measured 4 mm holes at approximately 30.55 mm centres; frame bores use 3.4 mm M3 clearance at the nominal 30.5 mm spacing. Physical mounting and cable clearance remain unverified.`);
  text(parent, 'p', 'The default retains the website header-ledge upper frame for the upward-soldered ESP32 pins. The newer raised bridge and removable L guides are optional.');
  if (Object.keys(result.parameters.component_references).length) text(parent, 'p', 'Optional licensed references are display-only. Their positions, interfaces and collisions are not included in frame fit checks.');
  if (report.upper_arm_vertical_gap_mm !== null) text(parent, 'p', `Upper-arm sweep gap: ${report.upper_arm_vertical_gap_mm.toFixed(3)} mm. Negative means overlap.`);
  if (report.lower_ribs.enabled) text(parent, 'p', `Lower-rib calculated blade gap: ${report.lower_ribs.minimum_calculated_gap_mm.toFixed(2)} mm. This is a geometric allowance, not physical validation.`);
  text(parent, 'p', `Central body lengths: lower ${report.body_lengths_mm.lower.toFixed(1)} mm / upper ${report.body_lengths_mm.upper.toFixed(1)} mm.`);
  text(parent, 'p', `Lower print footprint with brim/skirt: ${lowerPrint.required.map(x => x.toFixed(1)).join(' x ')} mm; selected bed check ${lowerPrint.fits ? 'pass' : 'fail'}, rotation ${printCheck.rotation.toFixed(1)} degrees.`);
  if (upperPrint) text(parent, 'p', `Upper print footprint with brim/skirt: ${upperPrint.required.map(x => x.toFixed(1)).join(' x ')} mm; selected bed check ${upperPrint.fits ? 'pass' : 'fail'}. Check separate parts in the slicer.`);
  if (report.controller_ties.enabled) text(parent, 'p', `Controller retention: ${report.controller_ties.count} roof slots for ${report.controller_ties.loop_count} ties${result.parameters.controller_mount_style === 'integrated_under' ? ', plus removable keepers' : ', with header-safe supports above the deck'}. Physical routing remains unverified.`);
  text(parent, 'p', `Selected bed centered margin: ${lowerPrint.margins.map(x => x.toFixed(2)).join(' / ')} mm. No allowance for bed clips or purge lines.`);
  if (report.motor_screws.enabled) {
    text(parent, 'p', `Motor platform ${report.motor_screws.mount_plane_z_mm.toFixed(1)} mm; screw engagement ${report.motor_screws.calculated_engagement_mm.toFixed(1)} / ${report.motor_screws.motor_thread_depth_mm.toFixed(1)} mm (${report.motor_screws.status}), remaining depth ${report.motor_screws.remaining_thread_depth_mm.toFixed(1)} mm. ${report.motor_screws.head_recess_enabled ? 'Recessed heads' : 'Heads protrude below the base'}; verify actual screws with a fit coupon.`);
    if (report.motor_screws.nominal_pad_hole_edge_web_mm < 2) text(parent, 'p', `Motor-pad hole-edge web is ${report.motor_screws.nominal_pad_hole_edge_web_mm.toFixed(1)} mm, below the conservative 2 mm allowance. Strength remains unverified.`);
  }
  if (report.motor_cables.enabled) text(parent, 'p', `Four drop-in cable slots, ${report.motor_cables.usable_height_mm.toFixed(1)} mm usable height, with ${report.motor_cables.boss_clearance_mm.toFixed(1)} mm clearance from intact bolt bosses. Nominal wire fit: ${report.motor_cables.nominal_wire_fit}. ${report.motor_cables.note}`);
  if (report.antenna_keepout.keeper_overlap) text(parent, 'p', 'Controller keepers enter the provisional antenna allowance. RF performance is unresolved.');
  if (report.overlapping_envelopes.length) text(parent, 'p', `Overlapping generic envelopes: ${report.overlapping_envelopes.map(pair => pair.join(' / ')).join(', ')}.`);
  const list = document.createElement('ul'); for (const warning of report.unresolved) text(list, 'li', warning); parent.append(list);
}
function frame(view = currentView) {
  if (!result) return;
  const group = printMode() ? printLayout : assembly;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group), center = box.getCenter(new THREE.Vector3());
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
$('Fit').addEventListener('click', () => frame());
for (const id of ['Sweeps', 'Keepouts', 'CableGuides']) $(id).addEventListener('change', buildOverlays);
$('Transparent').addEventListener('change', transparency);
$('Display').addEventListener('change', () => { selectedAnchor = null; hover(null); buildPrintLayout(); frame(); });
$('BedPart').addEventListener('change', () => { selectedAnchor = null; hover(null); buildPrintLayout(); });
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down;
function pick(event) {
  const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  camera.updateMatrixWorld(true); raycaster.setFromCamera(pointer, camera);
  const group = printMode() ? printLayout : assembly;
  group.updateMatrixWorld(true);
  for (const hit of raycaster.intersectObjects([...activeObjects().values()], true)) {
    if (!hit.object.isMesh) continue;
    let object = hit.object, visible = true;
    while (object !== group) { if (!object.visible) visible = false; if (object.parent === group) break; object = object.parent; }
    if (visible && group.visible) return { object, point: hit.point };
  }
  return null;
}
controls.addEventListener('start', () => { orbiting = true; hover(null); });
controls.addEventListener('end', () => { orbiting = false; });
canvas.addEventListener('pointermove', event => { if (!orbiting && event.pointerType !== 'touch' && !down) hover(pick(event)?.object.name || null); });
canvas.addEventListener('pointerleave', () => hover(null));
canvas.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
canvas.addEventListener('pointerup', event => {
  const start = down; down = null;
  if (!start || event.button !== 0 || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
  const hit = pick(event);
  choose(hit?.object.name || null, hit ? hit.object.worldToLocal(hit.point.clone()) : null);
});
canvas.addEventListener('pointercancel', () => { down = null; orbiting = false; hover(null); });
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function publicCredits(source, registry, configuration) {
  const models = Object.entries(registry.models).filter(([, model]) => model.file);
  const components = source.components.filter(component =>
    component.public_models?.some(id => registry.models[id]?.file) ||
    component.dimension_keys?.some(key => Object.hasOwn(configuration.defaults, key)));
  for (const [id, model] of models) {
    const credit = components.find(component => component.public_models?.includes(id));
    if (!credit || !model.author || !credit.author?.includes(model.author) || !model.licence || !credit.licence || (model.notice && credit.notice !== model.notice))
      throw new Error(`Missing public asset attribution or licence notice: ${id}`);
  }
  return { ...source, components };
}
function noticeText() { return [credits.copyright, credits.publication, ...credits.components.map(c => `${c.name}\nAuthor: ${c.author}\n${c.basis}\n${c.licence}\n${[c.source, c.additional_source].filter(Boolean).join('\n')}${c.notice ? `\nNotice: ${asset(c.notice).href}` : ''}`), ...credits.software.map(s => `${s.name} ${s.version} - ${s.licence}; notice ${new URL(s.notice, asset('credits.json')).href}`)].join('\n\n'); }
function creditsUI() {
  const parent = $('Credits'); text(parent, 'p', `Copyright ${credits.copyright}. ${credits.publication}`);
  for (const component of credits.components) { text(parent, 'h3', component.name); text(parent, 'p', component.author); text(parent, 'p', component.basis); text(parent, 'p', component.licence); if (component.source) { const link = text(parent, 'a', 'Source'); link.href = component.source; link.target = '_blank'; link.rel = 'noopener'; } if (component.notice) { text(parent, 'span', ' / '); const link = text(parent, 'a', 'Licence notice'); link.href = asset(component.notice).href; link.target = '_blank'; link.rel = 'noopener'; } }
  for (const software of credits.software) { const link = text(parent, 'a', `${software.name} ${software.version}: ${software.licence}`); link.href = new URL(software.notice, asset('credits.json')).href; text(parent, 'br', ''); }
}
$('CreditsDownload').addEventListener('click', () => save(noticeText(), 'drone-frame-source-notices.txt', 'text/plain'));
$('ReportDownload').addEventListener('click', () => { if (available()) save(JSON.stringify({ parameters: result.parameters, report: result.report, print_bed: bedCheck(result, selectedBed), sources: credits }, null, 2), 'drone-frame-fit-report.json', 'application/json'); });
$('ParametersDownload').addEventListener('click', () => { if (available()) save(JSON.stringify(result.parameters, null, 2), 'drone-frame-parameters.json', 'application/json'); });
$('Export').addEventListener('click', () => { const open = $('Downloads').hidden; $('Downloads').hidden = !open; $('Export').setAttribute('aria-expanded', String(open)); });
document.addEventListener('pointerdown', event => { if (!event.target.closest('.coffee-toolbar')) { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
root.addEventListener('keydown', event => { if (event.key === 'Escape') { $('Downloads').hidden = true; $('Export').setAttribute('aria-expanded', 'false'); } });
$('Stl').addEventListener('click', () => {
  if (!available()) return;
  const part = $('PrintPart').value, p = result.parameters;
  const revision = p.frame_variant === 'drone_frame_v0' ? 'historical' : p.motor_compact_pad ? 'compact-layout' : p.lower_arm_braces ? 'lower-ribs' : p.upper_arm_extensions ? `upper-arms-${p.upper_arm_joint_style}` : 'flat-deck';
  const version = p.print_profile === 'full' ? '' : `-${p.print_profile.replaceAll('_', '-')}`;
  save(binarySTL(result.exports[part]), `${p.frame_variant}-${revision}${version}-${part}.stl`, 'model/stl');
});
$('Glb').addEventListener('click', async () => {
  if (!available()) return; exporting = true; availability(); const group = new THREE.Group(), snapshot = result;
  try {
    for (const part of snapshot.parts) group.add(componentObject(part, snapshot.parameters));
    group.userData = { parameters: snapshot.parameters, original_design_copyright: credits.copyright, sources: credits, references: references.models };
    // CAD is mm/Z-up. GLB is metres/Y-up: convert exactly once at the export root.
    group.rotation.x = -Math.PI / 2; group.scale.setScalar(0.001); group.updateMatrixWorld(true);
    const data = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: false });
    save(data, `${snapshot.parameters.frame_variant}${snapshot.parameters.print_profile === 'full' ? '' : `-${snapshot.parameters.print_profile.replaceAll('_', '-')}`}-assembly-preview.glb`, 'model/gltf-binary');
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
$('Reset').addEventListener('click', () => { clearTimeout(timer); const profile = parameters?.print_profile || 'full'; parameters = structuredClone(parameters?.frame_variant === 'drone_frame_v0' ? config.historical : config.defaults); parameters.print_profile = profile; componentModes.clear(); history.replaceState(null, '', location.pathname + location.search); frameNext = true; selected = null; sync(); queue(); });
window.addEventListener('hashchange', () => { try { parameters = readLink(location.href, config); componentModes.clear(); sync(); queue(); } catch (reason) { cancelBedFit(); clearTimeout(timer); sequence++; error(reason.message); } });
function resize() { const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight); renderer.setSize(width, height, false); resizeCamera(camera, width, height); }
function height() { root.style.setProperty('--coffee-height', `${Math.max(180, (window.visualViewport?.height || innerHeight) - root.getBoundingClientRect().top - 8)}px`); }
height(); window.addEventListener('resize', height, { passive: true }); window.visualViewport?.addEventListener('resize', height, { passive: true });
new ResizeObserver(resize).observe(viewport); const header = document.querySelector('.site-header'); if (header) new ResizeObserver(height).observe(header);
renderer.setAnimationLoop(() => { controls.update(); positionLabel(); renderer.render(scene, camera); });
window.addEventListener('pagehide', event => { if (!event.persisted) worker?.terminate(); });
function acceptResult(data) {
  result = data; result.parts.push(...optionalParts(result.parameters, references)); result.sequence = sequence;
  sync(); sceneUI(); reportUI(); bedUI(); status('Ready'); $('Error').hidden = true; root.dataset.state = 'ready'; root.dataset.generation = String(sequence); availability();
  if (frameNext) { frame(); frameNext = false; }
}
try {
  const responses = await Promise.all([fetch(asset('config.json')), fetch(asset('credits.json')), fetch(asset('references/manifest.json'))]);
  if (responses.some(response => !response.ok)) throw new Error('The model configuration could not load.');
  [config, credits, references] = await Promise.all(responses.map(response => response.json()));
  credits = publicCredits(credits, references, config);
  status('Loading references'); referenceMeshes = await loadReferences(references, asset);
  controlsUI(); creditsUI();
  let linkError = '';
  try { parameters = readLink(location.href, config); } catch (reason) { parameters = structuredClone(config.defaults); linkError = reason.message; }
  sync(); worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onerror = () => error('The model worker failed to load. Reload to try again.');
  worker.onmessage = event => {
    if (event.data.sequence !== sequence) return;
    if (bedFit) { try { bedCandidateResult(event); } catch (reason) { finishBedFit(`No checked bed fit could be applied: ${reason.message}. Current geometry is unchanged.`); } return; }
    if (event.data.error) { error(event.data.error); return; }
    try { acceptResult(event.data.result); }
    catch (reason) { error(`Preview failed: ${reason.message}`); }
  };
  if (linkError) error(`Model link could not be opened: ${linkError} Reset to use the default design.`); else queue();
} catch (reason) { error(reason.message); $('Reset').disabled = true; }
