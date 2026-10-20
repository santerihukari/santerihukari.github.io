import {setupLatch} from './adapter.js';
import { publicAssetUrl } from '../public-assets.mjs';
import * as THREE from 'three';
import {registerViewer, resizeCamera, cameraState} from '../cad-ui.mjs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DEFAULTS, CONTROLS, parameters, stlBuffer } from './model.mjs';
import { EXAMPLE_DEFAULTS, EXAMPLE_CONTROLS, exampleLayout, exampleLatchState } from './example.mjs';

const $ = (id) => document.getElementById(id);
const viewport = $('latch-viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#edf1ef'); viewport.append(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x586657, 2.5));
for (const [position, intensity] of [[[40, -70, 100], 3], [[-70, 55, 40], 1.5]]) {
  const light = new THREE.DirectionalLight(0xffffff, intensity); light.position.set(...position); scene.add(light);
}
const camera = new THREE.PerspectiveCamera(37, 1, .1, 2000); camera.up.set(0, 0, 1);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true;
const root = $('latchWorkbench');
registerViewer(root, {camera, controls: orbit});
const group = new THREE.Group(); scene.add(group);
const referenceGroup = new THREE.Group(); scene.add(referenceGroup);
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
const selectedColor = new THREE.Color('#edb441');
let data, selectedId = null, hoverId = null, highlight = null, labels = [], view = 'iso', explode = 0;
const parts = new Map(), features = new Map(), rows = new Map();
const references = new Map();
let exampleSettings={...EXAMPLE_DEFAULTS},installation=null;
function allParts(){return [...parts.values(),...references.values()];}
function getPart(id){return parts.get(id)||references.get(id);}
let pointerStart = null, lastHover = 0, lastLabels = 0;
let params = { ...DEFAULTS }, revision = 'v3', sequence = 0, timer, valid = false;
let latchAdapter, frameNextModel = true;
const inputs = new Map();
const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
const axes = new THREE.Group(); scene.add(axes);
axes.add(new THREE.AxesHelper(28));
function axisLabel(text, color, at) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const context = canvas.getContext('2d'); context.fillStyle = color; context.font = 'bold 34px Arial'; context.textAlign = 'center'; context.fillText(text, 64, 44);
  const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false });
  const sprite = new THREE.Sprite(material); sprite.position.set(...at); sprite.scale.set(8,4,1); sprite.renderOrder = 20; axes.add(sprite);
}
axisLabel('+X', '#c34d44', [31,0,0]); axisLabel('+Y', '#389066', [0,31,0]); axisLabel('+Z', '#4778cb', [0,0,31]);
axisLabel('0', '#54655e', [0,0,0]);
function coordinateIndicator() {
  axes.visible = $('latch-axes').checked; $('coordinate-indicator').hidden = !axes.visible;
  if (!axes.visible) return;
  const inverse = camera.quaternion.clone().invert();
  for (const [name, direction] of [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]]) {
    const v = new THREE.Vector3(...direction).applyQuaternion(axes.quaternion).applyQuaternion(inverse), x = 60+v.x*36, y = 53-v.y*36;
    const node = $(`axis-${name}`), line = node.querySelector('line'), text = node.querySelector('text');
    for (const [key,value] of Object.entries({x1:60,y1:53,x2:x,y2:y})) line.setAttribute(key,value);
    text.setAttribute('x',60+v.x*47); text.setAttribute('y',53-v.y*47);
  }
}

function meshGeometry(vertices, faces) {
  const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  result.setIndex(faces.flat()); result.computeVertexNormals(); result.computeBoundingBox(); return result;
}
function activeFeature() { return features.get(hoverId || selectedId); }
function partBox(selectedOnly = false) {
  const box = new THREE.Box3(); group.updateMatrixWorld(true);referenceGroup.updateMatrixWorld(true);
  const owner = features.get(selectedId)?.part;
  for (const part of allParts()) if (part.mesh.visible && (!selectedOnly || part.id === owner)) box.union(new THREE.Box3().setFromObject(part.mesh));
  if (box.isEmpty()) for (const part of allParts()) box.union(new THREE.Box3().setFromObject(part.mesh));
  return box;
}
function fitView(next = view, selectedOnly = false) {
  view = next;
  const box = partBox(selectedOnly), center = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length()/2;
  const angle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * Math.min(1, camera.aspect));
  const distance = radius / Math.sin(angle) * 1.12;
  const direction = next === 'top' ? new THREE.Vector3(.001, -.001, 1) : next === 'front' ? new THREE.Vector3(0, installation?1:-1, .04) : installation?new THREE.Vector3(1,1.65,.7):new THREE.Vector3(1, -1.45, 1.1);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(distance)); orbit.target.copy(center); orbit.update();
  document.querySelectorAll('[data-view]').forEach((button) => { button.classList.toggle('active', button.dataset.view === next); button.setAttribute('aria-pressed', String(button.dataset.view === next)); });
}
function resize() {
  const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height); resizeCamera(camera, width, height);
}
new ResizeObserver(resize).observe(viewport);

function select(id) {
  if (id && !features.has(id)) return;
  selectedId = id; hoverId = null; updateAppearance();
  if (!id) {
    $('selection-kind').textContent = revision === 'v3' ? 'Parametric V3' : 'Grip V2'; $('selection-name').textContent = 'Threaded latch assembly';
    $('selection-detail').textContent = revision === 'v3' ? 'Two print-in-place bodies and one separate nut.' : 'Historical comparison: two print-in-place bodies and two separate nuts.';
    return;
  }
  const feature = features.get(id), parent = getPart(feature.part);
  $('selection-kind').textContent = parent.reference?'Example reference':feature.whole_part ? 'Printed part' : `Joined feature / ${features.get(feature.parent_feature)?.name || parent.name}`;
  $('selection-name').textContent = feature.name;
  const p = data.parameters;
  let info = feature.part === 'body' ? `${p.major_d} mm thread, ${p.pitch} mm pitch. ${p.inner_d} mm through-bore.` : feature.part === 'insert' ? `${p.latch_reach ?? p.upper_stop_x} mm latch reach. ${p.latch_thickness ?? p.upper_stop_height} mm arm thickness. ${p.insert_radial_clearance} mm nominal shaft clearance.` : `${p.nut_across_flats} mm across flats, ${p.nut_thickness} mm thick. ${installation?'Installed against the example panel.':'Shown alongside the assembly.'}`;
  if(parent.reference)info=feature.id==='door'?`${installation.door.thickness} mm example panel with a ${installation.door.hole_diameter} mm mounting hole. Not a printed part.`:`Catching edge X=${installation.settings.frame_edge_x} mm; ${installation.settings.frame_clearance} mm arm clearance. Example dimensions, not a measured frame.`;
  if(revision==='v3') {
    if(feature.id==='body')info+=` ${data.report.threaded_length_mm} mm threaded, ${p.smooth_upper_length} mm smooth above.`;
    if(feature.id==='smooth_upper')info=`${p.smooth_upper_length} mm high, nominal ${p.root_d} mm diameter before square cuts. ${data.report.smooth_to_nut_nominal_radial_clearance_mm} mm nominal radial nut clearance.`;
    if(feature.id==='capture_lip')info=`Base lip: ${p.upper_lip_d} mm diameter x ${p.upper_lip_height} mm. The stop sector extends to ${p.max_xy} mm diameter and ${Number(data.report.insert_stop_local_height_mm.toFixed(3))} mm height, solid back to the shaft.`;
    if(feature.id==='shaft_top')info=`R${p.shaft_top_radius} quarter-circle relief on the upper -X side. Latch underside stays at Z=${p.thread_height+p.latch_gap} mm.`;
    if(feature.id==='handle')info=`${p.handle_width} mm Y width, ${p.handle_thickness} mm X thickness. ${p.handle_style==='ergonomic'?`${p.lever_gap} mm gap below the body foot.`:'Original half-round profile.'}`;
    if(['body_tab','insert_tab'].includes(feature.id)&&p.stop_style==='arc')info=`${p.stop_arc_degrees} deg sweep per stop, ${p.max_xy} mm outside diameter. ${data.report.available_rotation_degrees} deg geometric travel including clearance.${feature.id==='insert_tab'?' Integral with capture lip and shaft; no radial gap.':''}`;
  }
  $('selection-detail').textContent = info;
}
function addRow(parent, feature, root = false) {
  const button = document.createElement('button'); button.className = `part-row ${root ? 'root' : 'child'}`; button.dataset.feature = feature.id;
  button.setAttribute('aria-pressed', 'false'); button.title = feature.whole_part ? feature.name : `${feature.name} / joined to ${features.get(feature.parent_feature)?.name || getPart(feature.part).name}`;
  if(feature.parent_feature)button.classList.add('subchild');
  const icon = document.createElement('img'); icon.src = new URL(`../../assets/cad/latch/icons/${root ? 'box' : 'corner-down-right'}.svg`, import.meta.url).href; icon.alt = '';
  const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = getPart(feature.part).color;
  const text = document.createElement('span'); text.className = 'part-name'; text.textContent = feature.name;
  button.append(icon, swatch, text); parent.append(button); rows.set(feature.id, button);
  button.addEventListener('click', () => select(feature.id));
  button.addEventListener('pointerenter', () => { hoverId = feature.id; updateAppearance(); });
  button.addEventListener('pointerleave', () => { hoverId = null; updateAppearance(); });
  button.addEventListener('focus', () => { hoverId = feature.id; updateAppearance(); });
  button.addEventListener('blur', () => { hoverId = null; updateAppearance(); });
}
function tree() {
  rows.clear();$('part-tree').replaceChildren();
  for (const part of allParts()) {
    const element = document.createElement('div'); element.className = 'part-group';
    const entries=part.reference?[features.get(part.id)]:data.features.filter((feature) => feature.part === part.id);
    for (const feature of entries.filter((f)=>!f.parent_feature)) {
      addRow(element, feature, feature.whole_part);
      for(const child of entries.filter((f)=>f.parent_feature===feature.id))addRow(element,child);
    }
    $('part-tree').append(element);
  }
}
function clearHighlight() {
  if (highlight) { highlight.removeFromParent(); highlight.geometry.dispose(); highlight.material.dispose(); highlight = null; }
}
function updateAppearance() {
  if (!data) return;
  const active = activeFeature(), owner = features.get(selectedId)?.part;
  clearHighlight();
  for (const part of allParts()) {
    part.mesh.visible = (!part.id.startsWith('nut') || $('latch-nuts').checked) && (!$('latch-isolate').checked || !owner || owner === part.id);
    const focused = active?.part === part.id;
    part.mesh.material.opacity = $('latch-ghost').checked && part.id === 'body' ? .22 : active && !focused ? Math.min(part.baseOpacity??1,.36) : part.baseOpacity??1;
    part.mesh.material.emissive.set(active?.whole_part && focused ? part.color : '#000000');
    part.mesh.material.emissiveIntensity = active?.whole_part && focused ? .28 : 0;
    part.mesh.material.depthWrite = part.mesh.material.opacity === 1;
  }
  for (const [id, row] of rows) {
    row.classList.toggle('active', id === selectedId); row.classList.toggle('hovered', id === hoverId); row.setAttribute('aria-pressed', String(id === selectedId));
  }
  if (active && !active.whole_part) {
    const part = parts.get(active.part), index = data.features.indexOf(active);
    const children = new Set(data.features.flatMap((f,i)=>f.parent_feature===active.id?[i]:[]));
    const faces = part.faces.filter((_, i) => part.face_features[i] === index || children.has(part.face_features[i]));
    highlight = new THREE.Mesh(meshGeometry(part.vertices, faces), new THREE.MeshStandardMaterial({ color: selectedColor, roughness: .58, metalness: .05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    highlight.name = 'feature-highlight'; part.mesh.add(highlight);
  }
  $('hover-name').textContent = features.get(selectedId)?.name || (revision === 'v3' ? 'Parametric V3' : 'Grip V2'); makeLabels();
}
function makeLabel(feature, part) {
  const node = document.createElement('button'); node.className = 'model-name'; node.dataset.label = feature.id; node.title = feature.name;
  const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = part.color;
  const name = document.createElement('span'); name.textContent = feature.name; node.append(swatch, name);
  node.addEventListener('click', () => select(feature.id));
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('stroke', part.color);
  $('names').append(node); $('leaders').append(line);
  labels.push({ feature, part, node, line, anchor: new THREE.Vector3(...feature.anchor) });
}
function makeLabels() {
  $('names').replaceChildren(); $('leaders').replaceChildren(); labels = [];
  const active = features.get(selectedId), part = active && getPart(active.part);
  if (part) makeLabel(active, part);
  updateLabels();
}
function updateLabels() {
  if (!data) return;
  $('annotations').hidden = !$('latch-labels').checked;
  if (!$('latch-labels').checked) return;
  const width = viewport.clientWidth, height = viewport.clientHeight, margin = 8, gap = 12;
  group.updateMatrixWorld(true); referenceGroup.updateMatrixWorld(true); camera.updateMatrixWorld();
  const bounds = viewport.getBoundingClientRect();
  const obstacles = [...viewport.querySelectorAll('.cad-toolbar, .latch-view-toolbar, #coordinate-indicator, #latch-loading, #latch-error')]
    .filter(node => !node.hidden && node.getClientRects().length)
    .map(node => { const r = node.getBoundingClientRect(); return {left:r.left-bounds.left-4, top:r.top-bounds.top-4, right:r.right-bounds.left+4, bottom:r.bottom-bounds.top+4}; });
  const panel = $('latch-download-panel');
  if ($('latch-downloads').open) {
    const r = panel.getBoundingClientRect();
    obstacles.push({left:r.left-bounds.left-4, top:r.top-bounds.top-4, right:r.right-bounds.left+4, bottom:r.bottom-bounds.top+4});
  }
  for (const label of labels) {
    const v = label.anchor.clone().applyMatrix4(label.part.mesh.matrixWorld).project(camera);
    const visible = label.part.mesh.visible && v.z < 1 && v.z > -1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
    label.node.hidden = !visible; label.line.style.display = visible ? '' : 'none';
    if (!visible) continue;
    const x = (v.x+1)*width/2, y = (1-v.y)*height/2, w = label.node.offsetWidth, h = label.node.offsetHeight;
    const candidates = [[x+gap,y-h/2], [x-w-gap,y-h/2], [x-w/2,y-h-gap], [x-w/2,y+gap]];
    for (const r of obstacles) candidates.push([x-w/2,r.top-h-gap], [x-w/2,r.bottom+gap], [r.left-w-gap,y-h/2], [r.right+gap,y-h/2]);
    const placements = candidates.map(([left,top]) => ({left:Math.max(margin,Math.min(width-w-margin,left)), top:Math.max(margin,Math.min(height-h-margin,top))}))
      .filter(r => r.left+w <= width-margin && r.top+h <= height-margin && !obstacles.some(o => r.left < o.right && r.left+w > o.left && r.top < o.bottom && r.top+h > o.top));
    placements.sort((a,b) => Math.hypot(a.left+w/2-x,a.top+h/2-y)-Math.hypot(b.left+w/2-x,b.top+h/2-y));
    const placement = placements[0];
    if (!placement) { label.node.hidden = true; label.line.style.display = 'none'; continue; }
    label.node.classList.toggle('active', label.feature.id === selectedId);
    label.node.style.left = `${placement.left}px`; label.node.style.top = `${placement.top}px`;
    const endX = Math.max(placement.left,Math.min(placement.left+w,x)), endY = Math.max(placement.top,Math.min(placement.top+h,y));
    for (const [name,value] of Object.entries({x1:x,y1:y,x2:endX,y2:endY})) label.line.setAttribute(name,value);
  }
}
function updateExplode() {
  explode = Number($('explode').value); $('explode-value').textContent = `${explode} mm`;
  for (const part of parts.values()) {
    const mounted=installation?.nuts.find((n)=>n.id===part.id);
    part.mesh.position.set(...(mounted?.position||part.display_position)).addScaledVector(new THREE.Vector3(...part.explode_direction), explode);
    if(part.id.startsWith('nut'))part.mesh.rotation.z=THREE.MathUtils.degToRad(mounted?.angle_deg||0);
  }
  const angle = Number($('shaft-angle').value); $('shaft-angle-value').textContent = `${angle} deg`;
  if(parts.has('insert'))parts.get('insert').mesh.rotation.z=THREE.MathUtils.degToRad(angle);
  if(installation){
    const state=exampleLatchState(data.parameters,installation,angle);
    $('installation-state').textContent=state.latched?`Latched / ${state.overlap_mm.toFixed(1)} mm overlap`:'Unlatched';
  }
  updateLabels();
}
function hit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer, camera);
  const visible = allParts().filter((part) => part.mesh.visible && part.id!=='door' && !($('latch-ghost').checked && part.id === 'body'));
  const hits = raycaster.intersectObjects(visible.map((part) => part.mesh), false);
  if (!hits.length) return null;
  const part = getPart(hits[0].object.name);
  if(part.reference)return part.id;
  return data.features[part.face_features[hits[0].faceIndex]].id;
}
renderer.domElement.addEventListener('pointerdown', (event) => { pointerStart = [event.clientX, event.clientY]; });
renderer.domElement.addEventListener('pointerup', (event) => {
  if (data && pointerStart && Math.hypot(event.clientX-pointerStart[0], event.clientY-pointerStart[1]) < 4) select(hit(event)); pointerStart = null;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!data || pointerStart || performance.now()-lastHover < 60) return;
  lastHover = performance.now(); const id = hit(event);
  if (id !== hoverId) { hoverId = id; updateAppearance(); }
  renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerleave', () => { hoverId = null; pointerStart = null; updateAppearance(); });
$('model-nav').addEventListener('change', () => { location.href = $('model-nav').value; });
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('latch-download').addEventListener('click', () => {
  if (!valid || $('latch-export').selectedOptions[0]?.disabled) return;
  const key = $('latch-export').value;
  if (revision === 'grip_v2') { const link = document.createElement('a'); link.href = publicAssetUrl(new URL(`../../assets/cad/latch/legacy/${key}.stl`, import.meta.url).href); link.download = `grip_v2_${key}.stl`; link.click(); return; }
  const selected = data.parts.filter((p) => key === 'assembly' ? ['body','insert'].includes(p.id) : p.id === key);
  download(stlBuffer(selected), `door_frame_latch_v3_${key}.stl`, 'model/stl');
});
$('latch-glb').addEventListener('click', async () => {
  if (!valid || ($('latch-installed').checked&&!installation)) return;
  const exportSequence = sequence, exportState = glbState();
  const output = new THREE.Group(); output.name = 'Door-frame latch (metres)';
  for (const part of data.parts) {
    const mesh = new THREE.Mesh(meshGeometry(part.vertices, part.faces), new THREE.MeshStandardMaterial({ color: part.color, roughness: .7 }));
    const mounted=installation?.nuts.find((n)=>n.id===part.id);
    mesh.name = part.name; mesh.position.set(...(mounted?.position||part.display_position));
    if(part.id==='insert')mesh.rotation.z=THREE.MathUtils.degToRad(Number($('shaft-angle').value));
    if(mounted)mesh.rotation.z=THREE.MathUtils.degToRad(mounted.angle_deg);
    output.add(mesh);
  }
  for(const part of references.values()){const mesh=new THREE.Mesh(part.mesh.geometry.clone(),new THREE.MeshStandardMaterial({color:part.color,opacity:part.baseOpacity,transparent:true,side:THREE.DoubleSide}));mesh.name=part.name;mesh.position.copy(part.mesh.position);output.add(mesh);}
  output.scale.setScalar(.001); output.rotation.x = installation?0:-Math.PI/2;
  try {
    const bytes = await new GLTFExporter().parseAsync(output, { binary: true });
    if (valid && sequence === exportSequence && glbState() === exportState)
      download(bytes, `door_frame_latch_${revision}${installation?'_installed':''}.glb`, 'model/gltf-binary');
  }
  catch (error) { if (sequence === exportSequence) { $('latch-error').textContent = error.message; $('latch-error').hidden = false; } }
  finally { output.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); }); }
});
$('clear-selection').addEventListener('click', () => select(null));
$('latch-axes').addEventListener('change', coordinateIndicator);
$('explode').addEventListener('input', updateExplode);
$('shaft-angle').addEventListener('input', updateExplode);
for (const id of ['latch-nuts', 'latch-ghost', 'latch-isolate', 'latch-labels']) $(id).addEventListener('change', () => {
  updateAppearance();
});
$('fit-view').addEventListener('click', () => fitView()); $('focus-selection').addEventListener('click', () => fitView(view, Boolean(selectedId)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => fitView(button.dataset.view)));
renderer.setAnimationLoop((time) => { orbit.update(); if (time-lastLabels > 40) { updateLabels(); coordinateIndicator(); lastLabels = time; } renderer.render(scene, camera); });

function applyModel(result) {
  const previous = selectedId;
  clearHighlight(); for (const part of parts.values()) { part.mesh.removeFromParent(); part.mesh.geometry.dispose(); part.mesh.material.dispose(); }
  parts.clear(); features.clear(); rows.clear(); $('part-tree').replaceChildren();
  data = result;
  data.features.forEach((feature) => features.set(feature.id, feature));
  for (const part of data.parts) {
    const mesh = new THREE.Mesh(meshGeometry(part.vertices, part.faces), new THREE.MeshStandardMaterial({ color: part.color, roughness: .7, metalness: .03, transparent: true, side: THREE.DoubleSide }));
    mesh.name = part.id; mesh.position.set(...part.display_position); group.add(mesh); parts.set(part.id, { ...part, mesh });
  }
  const limits=data.report?.rotation_limits_degrees;
  $('shaft-angle').min=limits?Math.ceil(limits[0]):0; $('shaft-angle').max=limits?Math.floor(limits[1]):180;
  refreshExample();tree(); resize(); updateExplode();
  if (frameNextModel) { fitView(view); frameNextModel = false; }
  select(features.has(previous) ? previous : null);
  const p=data.parameters;
  $('thread-diameter').textContent = `${p.major_d} mm`; $('thread-pitch').textContent = `${p.pitch} mm`; $('arm-reach').textContent = `${p.latch_reach ?? p.upper_stop_x} mm`;
  $('axial-play').textContent = `${Number((p.upper_lip_gap+p.lever_gap).toFixed(3))} mm`;
  $('geometry-status').textContent = revision === 'v3' ? 'Generated in browser / mm' : 'Original STL geometry';
  $('revision-subtitle').textContent = revision === 'v3' ? 'V3 / one-nut installed configuration' : 'Grip V2 / historical two-nut comparison';
  const requested = new URL(location.href).searchParams.get('part'); if (!previous && features.has(requested)) select(requested);
  $('latch-loading').hidden = true;
  $('latch-error').hidden = true; valid = true; updateDownloads();
  $('parameter-status').textContent = 'Current model'; $('parameter-status').classList.remove('failed');
}
function glbState() { return JSON.stringify([revision, $('shaft-angle').value, $('latch-installed').checked, exampleSettings]); }
function updateDownloads() {
  $('latch-download').disabled = !valid || Boolean($('latch-export').selectedOptions[0]?.disabled);
  $('latch-glb').disabled = !valid||($('latch-installed').checked&&!installation);
  latchAdapter?.update();
}
$('latch-export').addEventListener('change', updateDownloads);

function refreshExample() {
  for(const part of references.values()){part.mesh.removeFromParent();part.mesh.geometry.dispose();part.mesh.material.dispose();features.delete(part.id);}
  references.clear();installation=null;
  $('installation-controls').hidden=!$('latch-installed').checked;$('installation-status').hidden=!$('latch-installed').checked;
  group.rotation.x=referenceGroup.rotation.x=axes.rotation.x=0;
  if(!$('latch-installed').checked||!data)return;
  try {
    installation=exampleLayout(data.parameters,exampleSettings,revision==='grip_v2'?2:1);
    const d=installation.door,f=installation.frame;
    const shape=new THREE.Shape();shape.moveTo(d.left,d.bottom);shape.lineTo(d.right,d.bottom);shape.lineTo(d.right,d.top);shape.lineTo(d.left,d.top);shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,0,d.hole_diameter/2,0,Math.PI*2,true);shape.holes.push(hole);
    const doorGeometry=new THREE.ExtrudeGeometry(shape,{depth:d.thickness,bevelEnabled:false,curveSegments:96});
    const frameSize=f.max.map((v,i)=>v-f.min[i]),frameCenter=f.max.map((v,i)=>(v+f.min[i])/2);
    for(const [spec,geometry,position,opacity] of [[d,doorGeometry,[0,0,0],.42],[f,new THREE.BoxGeometry(...frameSize),frameCenter,.8]]) {
      geometry.computeBoundingBox();const material=new THREE.MeshStandardMaterial({color:spec.color,roughness:.9,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(geometry,material);mesh.name=spec.id;mesh.position.set(...position);referenceGroup.add(mesh);
      references.set(spec.id,{id:spec.id,name:spec.name,color:spec.color,mesh,reference:true,baseOpacity:opacity});
      features.set(spec.id,{id:spec.id,name:spec.name,part:spec.id,anchor:spec.anchor.map((v,i)=>v-position[i]),whole_part:true,reference:true});
    }
    // Stand the example upright without changing any source CAD coordinates.
    group.rotation.x=referenceGroup.rotation.x=axes.rotation.x=Math.PI/2;
    $('installation-fit').textContent=installation.issues.length?installation.issues.join(' '):`Example fit / ${installation.mount_stack_height_mm} mm mounting stack`;
    $('installation-fit').classList.toggle('failed',installation.issues.length>0);
  }catch(error){installation=null;$('installation-fit').textContent=error.message;$('installation-fit').classList.add('failed');}
}
function editExample() {
  if(!data)return;
  const selected=selectedId;refreshExample();tree();updateExplode();select(features.has(selected)?selected:null);updateDownloads();
}
$('latch-installed').addEventListener('change',editExample);
for(const [key,label,min,max,step] of EXAMPLE_CONTROLS){
  const div=document.createElement('div');div.className='param';
  const caption=document.createElement('label');caption.htmlFor=`example-${key}`;caption.textContent=label;
  const unit=document.createElement('span');unit.className='unit';unit.textContent='mm';caption.append(unit);
  const row=document.createElement('div');row.className='param-row';
  const slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step=step;slider.value=exampleSettings[key];slider.setAttribute('aria-label',label);
  const number=document.createElement('input');number.type='number';number.step=step;number.value=exampleSettings[key];number.id=`example-${key}`;
  function edit(value){exampleSettings[key]=value===''?NaN:Number(value);if(Number.isFinite(exampleSettings[key]))slider.value=exampleSettings[key];number.value=Number.isFinite(exampleSettings[key])?exampleSettings[key]:'';editExample();}
  slider.addEventListener('input',()=>edit(slider.value));number.addEventListener('input',()=>edit(number.value));
  row.append(slider,number);div.append(caption,row);$('example-controls').append(div);
}
function fail(message) {
  valid = false; updateDownloads(); $('latch-loading').hidden = true;
  $('latch-error').textContent = message; $('latch-error').hidden = false;
  $('parameter-status').textContent = 'Invalid parameters / previous geometry'; $('parameter-status').classList.add('failed');
}
function regenerate() {
  const id = ++sequence;
  clearTimeout(timer); valid = false; updateDownloads(); $('latch-loading').hidden = false;
  $('parameter-status').textContent = 'Generating...';
  worker.postMessage({ id, parameters: params });
}
worker.onmessage = ({ data: message }) => {
  if (message.id !== sequence || revision !== 'v3') return;
  if (message.error) fail(message.error); else applyModel(message.result);
};
worker.onerror = (event) => fail(event.message || 'Geometry worker failed.');
function queueRegenerate() {
  sequence++; valid = false; updateDownloads(); clearTimeout(timer);
  $('parameter-status').textContent = 'Pending changes...'; timer = setTimeout(regenerate, 180);
}
function syncInputs() {
  $('handle-style').value = params.handle_style;
  $('stop-style').value = params.stop_style;
  for (const [key,{slider,number}] of inputs) {
    if (Number.isFinite(params[key])) slider.value = params[key];
    number.value = Number.isFinite(params[key]) ? params[key] : '';
    slider.disabled = number.disabled = key === 'stop_y';
  }
}
const essential = new Set(['latch_reach', 'thread_height']);
for (const [name, controls] of CONTROLS) {
  const details = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = name; details.append(summary);
  for (const [key,label,min,max,step] of controls) {
    const div = document.createElement('div'); div.className = 'param';
    const caption = document.createElement('label'); caption.htmlFor = `param-${key}`; caption.textContent = label;
    const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = key==='stop_arc_degrees'?'deg':'mm'; caption.append(unit);
    const row = document.createElement('div'); row.className = 'param-row';
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step; slider.setAttribute('aria-label', label); slider.dataset.slider = key;
    const number = document.createElement('input'); number.type = 'number'; number.step = step; number.id = `param-${key}`; number.setAttribute('aria-label', `${label} value`);
    const edit = (value) => { params[key] = value === '' ? NaN : Number(value); syncInputs(); queueRegenerate(); };
    slider.addEventListener('input', () => edit(slider.value)); number.addEventListener('input', () => edit(number.value));
    row.append(slider,number); div.append(caption,row); (essential.has(key) ? $('parameter-controls') : details).append(div); inputs.set(key,{slider,number});
  }
  $('advanced-parameter-controls').append(details);
}
$('reset-params').addEventListener('click', () => {
  frameNextModel = true; params = {...DEFAULTS}; exampleSettings = {...EXAMPLE_DEFAULTS};
  $('explode').value = '0'; $('shaft-angle').value = '0'; select(null); syncInputs();
  for (const [key] of EXAMPLE_CONTROLS) {
    const input = $(`example-${key}`); input.value = exampleSettings[key];
    input.parentElement.querySelector('input[type=range]').value = exampleSettings[key];
  }
  if (revision === 'v3') regenerate();
  else { $('latch-revision').value = 'v3'; $('latch-revision').dispatchEvent(new Event('change')); }
});
$('latch-revision').addEventListener('change', async () => {
  frameNextModel = true; revision = $('latch-revision').value; const id = ++sequence; clearTimeout(timer); valid = false; updateDownloads();
  $('latch-parameters').hidden = $('latch-advanced').hidden = revision !== 'v3';
  $('latch-export').querySelector('option[value="nut_2"]')?.remove();
  if (revision === 'grip_v2') {
    const option = document.createElement('option'); option.value = 'nut_2';
    option.textContent = 'Historical second nut'; $('latch-export').append(option);
  }
  for (const option of $('latch-export').options) option.disabled = (revision === 'grip_v2' && ['body','insert'].includes(option.value)) || (revision === 'v3' && option.value === 'fit_gauge');
  if ($('latch-export').selectedOptions[0].disabled) $('latch-export').value='assembly';
  if (revision==='v3') regenerate();
  else try {const response=await fetch(publicAssetUrl(new URL('../../assets/cad/latch/legacy/model.json', import.meta.url).href));if(!response.ok)throw new Error('Could not load original Grip V2.');const result=await response.json();if(id===sequence)applyModel(result);}
  catch(error){if(id===sequence)fail(error.message);}
});
window.latchViewer = { scene, renderer, camera, orbit, group, parts, features, select, fitView, regenerate,
  cameraState: () => cameraState(root), references,referenceGroup,get installation(){return installation;},
  get data() { return data; }, get parameters() { return {...params}; }, get valid() { return valid; },
  get selectedId() { return selectedId; }, get highlight() { return highlight; } };
if(new URL(location.href).searchParams.get('example')==='door')$('latch-installed').checked=true;
syncInputs(); regenerate();

latchAdapter = setupLatch({
  renderer, viewport, read:()=>({...params}), available:()=>valid&&revision==='v3',
  restore:p=>{
    const restored = parameters({...p, handle_style: 'ergonomic', stop_style: 'arc'});
    frameNextModel = true; params=restored;syncInputs();
    if(revision!=='v3') {
      $('latch-revision').value='v3';
      $('latch-revision').dispatchEvent(new Event('change'));
    } else regenerate();
  },
  invalidate:message=>{++sequence;clearTimeout(timer);fail(message);},
});
latchAdapter.update();
