import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cylinderState} from './kinematics.mjs';
import {angleAfter,effectiveRpm,wrap} from './cycle.mjs';
import {EngineFlow} from './flow.mjs';
import {EngineAudio} from './audio.mjs';
import {sourceDefinitions,profileMix,normalizeMix} from './audio_profiles.mjs';
import {issueDefinitions,normalizeIssue,issueCycleSettings} from './audio_issues.mjs';
import {rpmControl,rpmGuides,rpmSource,parseRpm,rpmBand} from './rpm_reference.mjs';

const root=document.getElementById('t4Engine');
const $ = id => root.querySelector(`#${id}`);
root.querySelector('.parameters').append($('sound-panel'));
const asset=name=>new URL(`../../assets/models/vw-t4-engine/r6/${name}`,import.meta.url).href;
const icon=name=>new URL(`../../assets/cad/t4-engine/icons/${name}.svg`,import.meta.url).href;
const geometryFields = [
  ['bore','Bore',70,90,.1,true], ['stroke','Stroke',80,110,.1,true],
  ['compression_ratio','Compression ratio',16,26,.1,true],
  ['cylinder_pitch','Cylinder pitch',85,110,.5,false],
  ['rod_length','Rod centres',130,170,.5,false],
  ['piston_compression_height','Piston compression height',38,52,.5,false],
  ['block_length','Block length',380,540,1,false],
  ['block_width','Block width',170,240,1,false],
  ['head_height','Head height',80,115,1,false],
  ['sump_depth','Sump depth',90,180,1,false],
  ['valve_lift','Valve lift',5,10,.1,false],
  ['flywheel_diameter','Flywheel diameter',260,330,1,false],
  ['alternator_y','Alternator Y',175,300,1,false],
  ['alternator_z','Alternator Z',-120,80,1,false],
  ['steering_pump_y','Steering pump Y',-240,-110,1,false],
  ['steering_pump_z','Steering pump Z',-100,0,1,false],
  ['timing_crank_diameter','Crank timing diameter',40,80,.5,false],
  ['timing_intermediate_diameter','Intermediate diameter',50,110,.5,false],
  ['timing_tensioner_diameter','Tensioner diameter',35,90,.5,false],
  ['timing_belt_width','Timing belt width',18,32,.5,false],
  ['timing_belt_thickness','Timing belt thickness',2,6,.1,false]
];
let params, manifest, buildId='reference-r6', selected=null, playing=false;
let angle=0, absoluteAngle=0, turboAngle=0, dirty=false;
let clockStart=performance.now(),clockAngle=0,clockTurbo=0,clockRpm=17,clockTurboRate=1200;
const hidden = new Set(), meshes = new Map(), metadata = new Map();
const viewport=$('viewport'), scene=new THREE.Scene();
scene.background=new THREE.Color(getComputedStyle(viewport).backgroundColor);
const camera=new THREE.PerspectiveCamera(40,1,1,15000);
camera.up.set(0,0,1); camera.position.set(880,1080,740);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.localClippingEnabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=120;controls.maxDistance=4500;
scene.add(new THREE.HemisphereLight(0xffffff,0x899c92,2.3));
const light=new THREE.DirectionalLight(0xfff5e8,3.2);light.position.set(-450,600,1100);
light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-750;light.shadow.camera.right=750;
light.shadow.camera.top=750;light.shadow.camera.bottom=-750;light.shadow.camera.far=2500;
light.shadow.bias=-.0004;scene.add(light);
const rim=new THREE.DirectionalLight(0xd8edf2,2);rim.position.set(500,-700,450);scene.add(rim);
const engineRoot=new THREE.Group(), interfaceRoot=new THREE.Group();scene.add(engineRoot,interfaceRoot);
const flow=new EngineFlow(scene), audio=new EngineAudio();
let audioMix=profileMix();
let audioIssue=normalizeIssue();
let nominalRpm=rpmControl.default;
const bulkAudioSources=sourceDefinitions.filter(source=>source.id!=='turbo').map(source=>source.id);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.ShadowMaterial({opacity:.13}));
ground.receiveShadow=true;ground.position.z=-195;scene.add(ground);
const grid=new THREE.GridHelper(1800,18,0xb7c5be,0xd4ded8);grid.rotation.x=Math.PI/2;grid.position.z=-196;
grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);
function theme(){
  scene.background.set(getComputedStyle(viewport).backgroundColor);
  grid.material.color.set(document.documentElement.dataset.theme==='dark'?'#697078':'#a6adb4');
}
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
const cutPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const highlight=new THREE.Box3Helper(new THREE.Box3(),0x327b64);highlight.visible=false;scene.add(highlight);
const conversion=new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeScale(1000,1000,1000));
const rotationAxis=new THREE.Vector3(), matrix=new THREE.Matrix4();

function resize(){const r=viewport.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);
function layout(){root.style.setProperty('--engine-height',`${Math.max(500,(window.visualViewport?.height||innerHeight)-root.getBoundingClientRect().top-8)}px`);}
layout();window.addEventListener('resize',layout,{passive:true});window.visualViewport?.addEventListener('resize',layout,{passive:true});

function populateFields(p){
  $('geometry-fields').replaceChildren();
  for(const [key,label,,,,sourced] of geometryFields){
    const term=document.createElement('dt'),value=document.createElement('dd');
    term.textContent=label;value.textContent=`${p[key]}${key==='compression_ratio'?':1':' mm'} · ${sourced?'source reference':'estimated'}`;
    $('geometry-fields').append(term,value);
  }
}
function setDownloads(enabled){
  const files={glb:'engine_assembly.glb',step:'engine_assembly.step',zip:'engine_parts.zip'};
  for(const kind of ['glb','step','zip']){
    const link=$(`download-${kind}`);link.removeAttribute('href');link.setAttribute('aria-disabled',String(!enabled));
    if(enabled)link.href=asset(files[kind]);
  }
  $('download-part').hidden=!enabled||!selected||!metadata.has(selected);
  $('download-part').removeAttribute('href');
  if(enabled&&metadata.has(selected)&&/^[a-z0-9_-]+$/.test(selected))$('download-part').href=asset(`parts/${selected}.stl`);
}

function disposeRoot(root){
  root.traverse(node=>{if(node.isMesh){node.geometry.dispose();for(const m of Array.isArray(node.material)?node.material:[node.material])m.dispose();}});
  root.clear();
}
async function loadAssembly(key,fit){
  $('loading').hidden=false;$('error').hidden=true;setDownloads(false);
  $('audio-enabled').checked=false;await audio.enable(false);
  try{
    const response=await fetch(asset('manifest.json'));if(!response.ok)throw new Error('Assembly metadata could not be loaded');
    const data=await response.json();
    if(data.model_revision!==6||data.part_count!==271||data.model!=='vw_t4_abl_engine_v0')throw new Error('Unexpected reference snapshot.');
    const reference=await fetch(asset('params.json'));if(!reference.ok)throw new Error('Frozen settings could not be loaded');
    const settings=await reference.json();
    if(Object.keys(settings).some(key=>JSON.stringify(settings[key])!==JSON.stringify(data.parameters[key])))throw new Error('Frozen geometry and parameter records differ.');
    const gltf=await new GLTFLoader().loadAsync(asset('engine_assembly.glb'));
    disposeRoot(engineRoot);disposeRoot(interfaceRoot);meshes.clear();metadata.clear();
    manifest=data;params={...data.parameters};buildId=key;dirty=false;
    for(const p of data.parts)metadata.set(p.id,p);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node=>{
      if(!node.isMesh)return;
      const id=metadata.has(node.name)?node.name:node.geometry.name;
      const info=metadata.get(id);if(!info)return;
      const geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);geometry.applyMatrix4(conversion);
      geometry.computeVertexNormals();
      const material=new THREE.MeshStandardMaterial({color:info.color,metalness:info.material_family==='elastomer'?.03:.32,roughness:.68,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(geometry,material);mesh.name=id;mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.matrixAutoUpdate=false;mesh.userData={partId:id};engineRoot.add(mesh);meshes.set(id,mesh);
    });
    if(meshes.size!==data.parts.length)throw new Error(`GLB component mapping mismatch: ${meshes.size}/${data.parts.length}`);
    for(const connection of data.interfaces){
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(4,12,8),new THREE.MeshBasicMaterial({color:'#bd6045',depthTest:false}));
      mesh.position.fromArray(connection.position_mm);mesh.userData={connection};mesh.renderOrder=10;interfaceRoot.add(mesh);
    }
    const bounds=data.derived.bounds_mm;ground.position.z=bounds[0][2]-3;grid.position.z=bounds[0][2]-3.2;
    $('assembly-count').textContent=`${data.part_count} components`;
    $('displacement').textContent=`${data.derived.displacement_cc.toFixed(1)} cm³`;
    $('configuration').textContent=`${params.model_year} · ${params.power_steering?'Power steering':'No power steering'} · ${params.air_conditioning?'A/C':'No A/C'}`;
    angle=params.crank_angle;absoluteAngle=angle;setRpmControls(params.rpm);$('crank-angle').value=angle;
    flow.build(params,data.flow_reference);audio.settings=data.flow_reference.cycle_settings;anchorMotion();syncAudio();
    buildTree();selectPart(metadata.has(selected)?selected:null);updateMotion();updateVisibility();updateOrders();
    if(fit)fitCamera('iso');
    populateFields(params);root.dataset.state='ready';
    $('parameter-status').textContent='Revision 6 · 271 components · fixed crank-zero reference geometry';setDownloads(true);
    gltf.scene.traverse(node=>{if(node.isMesh){node.geometry.dispose();for(const m of Array.isArray(node.material)?node.material:[node.material])m.dispose();}});
  }catch(error){$('error').textContent=error.message;$('error').hidden=false;throw error;}
  finally{$('loading').hidden=true;}
}

function buildTree(){
  const search=$('part-search').value.trim().toLowerCase();$('part-tree').replaceChildren();
  for(const group of manifest.groups){
    const parts=manifest.parts.filter(p=>p.group===group.id&&(!search||`${p.name} ${p.id}`.toLowerCase().includes(search)));
    if(!parts.length)continue;
    const details=document.createElement('details');details.className='group';details.open=Boolean(search)||group.id==='structure'||group.id===metadata.get(selected)?.group;
    const summary=document.createElement('summary');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=parts.every(p=>!hidden.has(p.id));checkbox.indeterminate=parts.some(p=>hidden.has(p.id))&&!parts.every(p=>hidden.has(p.id));checkbox.setAttribute('aria-label',`Show ${group.name}`);
    checkbox.addEventListener('click',event=>event.stopPropagation());
    checkbox.addEventListener('change',()=>{for(const p of parts)checkbox.checked?hidden.delete(p.id):hidden.add(p.id);updateVisibility();buildTree();});
    const label=document.createElement('span');label.textContent=group.name;const count=document.createElement('small');count.textContent=parts.length;summary.append(checkbox,label,count);details.append(summary);
    for(const p of parts){
      const row=document.createElement('div');row.className=`part-row ${selected===p.id?'selected':''}`;row.dataset.part=p.id;
      const visible=document.createElement('input');visible.type='checkbox';visible.checked=!hidden.has(p.id);visible.setAttribute('aria-label',`Show ${p.name}`);
      visible.addEventListener('change',()=>{visible.checked?hidden.delete(p.id):hidden.add(p.id);updateVisibility();});
      const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=p.color;
      const button=document.createElement('button');button.textContent=p.name;button.title=p.note||p.geometry_status;
      button.addEventListener('click',()=>selectPart(p.id));row.append(visible,swatch,button);details.append(row);
    }
    $('part-tree').append(details);
  }
}
$('part-search').addEventListener('input',buildTree);
$('show-all').addEventListener('click',()=>{hidden.clear();$('isolate').checked=false;updateVisibility();buildTree();});

function selectPart(id){
  selected=id;
  for(const [key,mesh] of meshes)mesh.material.emissive.set(key===id?'#426e51':'#000000');
  const info=metadata.get(id);
  $('selection-system').textContent=info?manifest.groups.find(g=>g.id===info.group).name:'Assembly';
  $('selection-name').textContent=info?.name||'2001 ABL reference';
  $('selection-note').textContent=info?info.note||'Estimated dimensions and placement.':'Estimated geometry. Not a manufacturing or calibrated NVH model.';
  $('selection-data').textContent=info?`${info.material_family} · ${info.geometry_status}`:'';
  for(const row of document.querySelectorAll('.part-row'))row.classList.toggle('selected',row.dataset.part===id);
  setDownloads(!dirty);updateVisibility();
}
function updateVisibility(){
  for(const [id,mesh] of meshes){
    mesh.visible=!hidden.has(id)&&(!$('isolate').checked||!selected||id===selected);
    mesh.material.clippingPlanes=$('cutaway').checked&&metadata.get(id).housing?[cutPlane]:[];
    mesh.material.needsUpdate=true;
  }
  interfaceRoot.visible=$('interfaces').checked&&!$('isolate').checked;
}
for(const key of ['cutaway','interfaces','isolate'])$(key).addEventListener('change',()=>{updateVisibility();updateFlow();});

function rotationMatrix(pivot,axis,radians){
  return new THREE.Matrix4().makeTranslation(...pivot)
    .multiply(new THREE.Matrix4().makeRotationAxis(rotationAxis.fromArray(axis).normalize(),radians))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot[0],-pivot[1],-pivot[2]));
}
function updateMotion(){
  if(!manifest)return;
  const states=[1,2,3,4].map(c=>cylinderState(params,c,angle));
  const explode=Number($('explode').value), groups=new Map(manifest.groups.map(g=>[g.id,g]));
  for(const [id,mesh] of meshes){
    const info=metadata.get(id),m=info.motion;matrix.identity();
    if(m.type==='rotate')matrix.copy(rotationMatrix(m.pivot,m.axis,angle*Math.PI/180*m.ratio));
    else if(m.type==='turbo')matrix.copy(rotationMatrix(m.pivot,m.axis,turboAngle*Math.PI/180));
    else if(m.type==='piston')matrix.makeTranslation(0,0,states[m.cylinder-1].pinZ-m.reference_pin_z);
    else if(m.type==='rod'){
      const s=states[m.cylinder-1];matrix.makeTranslation(m.reference_big[0],s.bigY,s.bigZ)
        .multiply(new THREE.Matrix4().makeRotationX(s.rodAngle))
        .multiply(new THREE.Matrix4().makeTranslation(...m.reference_big.map(v=>-v)));
    }else if(m.type==='valve')matrix.makeTranslation(0,0,-states[m.cylinder-1][m.valve==='intake'?'intakeLift':'exhaustLift']);
    else if(m.type==='spring'){
      const lift=states[m.cylinder-1][m.valve==='intake'?'intakeLift':'exhaustLift'];
      matrix.makeTranslation(0,0,m.base_z).multiply(new THREE.Matrix4().makeScale(1,1,(m.height-lift)/m.height)).multiply(new THREE.Matrix4().makeTranslation(0,0,-m.base_z));
    }
    const offset=groups.get(info.group).explode_vector_mm.map(v=>v*explode);
    mesh.matrix.copy(new THREE.Matrix4().makeTranslation(...offset).multiply(matrix));mesh.matrixWorldNeedsUpdate=true;
  }
  $('angle-value').textContent=`${Math.round(angle)}°`;
  if(document.activeElement!==$('crank-angle'))$('crank-angle').value=angle;
  if(!$('cycles').children.length)for(let i=0;i<4;i++){const node=document.createElement('div');node.className='cycle';node.innerHTML=`<span>Cylinder ${i+1}</span><strong></strong>`;$('cycles').append(node);}
  [...$('cycles').children].forEach((node,i)=>{node.dataset.stroke=states[i].strokeName;node.querySelector('strong').textContent=states[i].strokeName;});
  updateFlow();
}
function updateFlow(){
  const enabled=$('flow').checked,exploded=Number($('explode').value)>.001,isolated=$('isolate').checked;
  $('flow-controls').hidden=!enabled;
  $('flow-status').textContent=!enabled?'':exploded||isolated?'Flow hidden in exploded / isolated view':'Illustrative flow · no CFD';
  flow.update(angle,{enabled,cylinder:Number($('flow-cylinder').value),exploded,isolated,cutaway:$('cutaway').checked,
    settings:issueCycleSettings(manifest?.flow_reference.cycle_settings,audioIssue),
    layers:Object.fromEntries(['air','fuel','exhaust','burn','chamber'].map(k=>[k,$(`flow-${k}`).checked]))});
}
let cutawayBeforeFlow=false;
$('flow').addEventListener('change',()=>{
  if($('flow').checked){cutawayBeforeFlow=$('cutaway').checked;$('cutaway').checked=true;}
  else $('cutaway').checked=cutawayBeforeFlow;
  updateVisibility();updateFlow();
});
for(const id of ['flow-cylinder','flow-air','flow-fuel','flow-exhaust','flow-burn','flow-chamber'])$(id).addEventListener('change',updateFlow);
function updateOrders(){
  const rpm=nominalRpm;
  $('orders').replaceChildren();
  for(const [label,order] of [['Cam / injection shaft',.5],['Crankshaft',1],['Combined firing rate',2],['Firing second harmonic',4]]){
    const row=document.createElement('div');row.className='order-row';const name=document.createElement('span');name.textContent=label;
    const value=document.createElement('span');value.textContent=`${(rpm/60*order).toFixed(2)} Hz`;row.append(name,value);$('orders').append(row);
  }
}
function sampleMotion(time=performance.now()){
  if(!playing)return;
  const seconds=Math.max(0,(time-clockStart)/1000);
  absoluteAngle=angleAfter(clockAngle,seconds,clockRpm);angle=wrap(absoluteAngle);
  turboAngle=wrap(clockTurbo+seconds*clockTurboRate*6,360);
}
function anchorMotion(){
  clockStart=performance.now();clockAngle=absoluteAngle;clockTurbo=turboAngle;
  const speed=Number($('speed').value);
  clockRpm=effectiveRpm(nominalRpm,speed);
  clockTurboRate=(params?.turbo_rpm||60000)*speed;
  $('visual-rpm').textContent=`View ${Number(clockRpm.toFixed(2))} RPM`;
}
function syncAudio(){
  const rpm=nominalRpm,speed=Number($('speed').value),mode=$('audio-rate').value;
  $('audio-rpm').textContent=`${Number(effectiveRpm(rpm,mode==='playback'?speed:1).toFixed(2))} RPM`;
  audio.setTransport({playing,rpm,speed,mode,angle:absoluteAngle,turboRpm:params?.turbo_rpm||60000});
  $('audio-status').textContent=!audio.enabled?'Muted':!audio.sources.length?'No sources':playing?'Playing':'Armed';
}
for(const guide of rpmGuides){
  const node=document.createElement(guide.approximate?'span':'a');node.textContent=guide.label;node.dataset.rpmGuide=guide.id;
  if(guide.approximate)node.title='Approximate viewer guide, not an ABL service setting or a load-specific driving recommendation';
  else{node.href=rpmSource;node.target='_blank';node.rel='noopener';node.title='ABL workshop-manual reference; not a redline or safe operating limit';}
  $('rpm-guides').append(node);
}
function setRpmControls(value){
  nominalRpm=parseRpm(value)??rpmControl.default;
  for(const id of ['rpm','rpm-slider']){$(id).value=nominalRpm;$(id).setCustomValidity('');}
  $('rpm-band').textContent=rpmBand(nominalRpm);
  for(const guide of rpmGuides)root.querySelector(`[data-rpm-guide="${guide.id}"]`).classList.toggle('active',nominalRpm>=guide.min&&nominalRpm<=guide.max);
}
for(const id of ['rpm','rpm-slider'])$(id).addEventListener('input',()=>{
  const input=$(id),rpm=parseRpm(input.value);
  if(rpm===null){input.setCustomValidity('Enter a whole RPM from 300 to 5000');return;}
  sampleMotion();setRpmControls(rpm);anchorMotion();updateOrders();syncAudio();
});
$('rpm').addEventListener('change',()=>{if(parseRpm($('rpm').value)===null)setRpmControls(nominalRpm);});
$('speed').addEventListener('input',()=>{sampleMotion();anchorMotion();updateOrders();syncAudio();});
$('crank-angle').addEventListener('input',()=>{playing=false;setPlayIcon();angle=Number($('crank-angle').value);absoluteAngle=angle;anchorMotion();syncAudio();updateMotion();});
$('explode').addEventListener('input',()=>{$('explode-value').textContent=`${Math.round(Number($('explode').value)*100)}%`;updateMotion();});
function setPlayIcon(){$('play').querySelector('img').src=icon(playing?'pause':'play');$('play').setAttribute('aria-label',playing?'Pause':'Play');}
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();playing=false;audio.enable(false);$('audio-enabled').checked=false;setPlayIcon();
  root.dataset.state='error';$('error').hidden=false;$('error').textContent='The graphics context was lost. Reload the page to restore the viewer.';
});
$('play').addEventListener('click',()=>{sampleMotion();playing=!playing;anchorMotion();setPlayIcon();syncAudio();updateMotion();});
function configureAudioSources(){
  const selected=[...document.querySelectorAll('.audio-source input:checked')].map(el=>el.dataset.source);
  const count=selected.filter(id=>bulkAudioSources.includes(id)).length;
  audio.configure(selected);$('audio-all').checked=count===bulkAudioSources.length;
  $('audio-all').indeterminate=count>0&&count<bulkAudioSources.length;
  sampleMotion();syncAudio();
}
function renderAudioMix(){
  for(const {id} of sourceDefinitions){
    const level=Math.round(audioMix[id].level*100);
    $(`audio-level-${id}`).value=level;$(`audio-level-number-${id}`).value=level;
    $(`audio-character-${id}`).value=audioMix[id].character;
  }
  const definition=issueDefinitions.find(issue=>issue.id===audioIssue.type),pump=audioIssue.type==='pump_timing';
  $('audio-issue-row').hidden=$('audio-profile').value!=='issue'&&!definition;
  $('audio-cylinder-row').hidden=!definition;$('audio-timing-row').hidden=!pump;
  const all=$('audio-issue-cylinder').querySelector('[value="0"]');all.hidden=all.disabled=!pump;
  $('audio-issue-cylinder').value=audioIssue.cylinder;
  $('audio-strength').disabled=$('audio-strength-number').disabled=pump;
  $('audio-issue-status').hidden=!definition;
  $('audio-issue-limit').hidden=!definition;
  if(definition){
    const scope=audioIssue.cylinder?`Cylinder ${audioIssue.cylinder}`:'All cylinders';
    $('audio-issue-status').textContent=`${scope} · ${definition.label}`+(pump?
      ` · ${audioIssue.timingOffset>0?'+':''}${audioIssue.timingOffset}° crank (${audioIssue.timingOffset<0?'advanced':audioIssue.timingOffset>0?'retarded':'baseline'})`:'');
    $('audio-issue-status').title=definition.note;
    $('audio-issue-limit').textContent=pump?'Injection phase only · combustion unchanged':
      audioIssue.type==='weak_cylinder'?'Cue attenuation only · torque / RPM unchanged':'Scripted cue · no contact / damage solver';
  }
  audio.setMix(audioMix,Number($('audio-strength').value)/100);
  audio.setIssue(audioIssue);if(manifest)updateFlow();
}
function applyAudioProfile(){
  const profile=$('audio-profile').value,target=$('audio-issue-source').value,strength=Number($('audio-strength').value)/100;
  if(profile!=='custom'){
    const type=profile==='issue'&&issueDefinitions.some(issue=>issue.id===target)?target:'none';
    const cylinder=type==='pump_timing'&&audioIssue.type!==type?0:Number($('audio-issue-cylinder').value);
    audioIssue=normalizeIssue({type,cylinder,strength,timingOffset:Number($('audio-timing-offset').value)});
    audioMix=type==='none'?profileMix(profile,target,strength):profileMix();
  }else audioIssue=normalizeIssue({...audioIssue,strength});
  renderAudioMix();
}
const sourceGroup=document.createElement('optgroup');sourceGroup.label='Source emphasis';$('audio-issue-source').append(sourceGroup);
for(const {id,label,issue} of sourceDefinitions){
  const channel=document.createElement('div');channel.className='audio-channel';
  const header=document.createElement('div');header.className='audio-channel-head';
  const labelNode=document.createElement('label');labelNode.className='audio-source';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.source=id;
  checkbox.addEventListener('change',configureAudioSources);labelNode.append(checkbox,document.createTextNode(label));
  const character=document.createElement('select');character.id=`audio-character-${id}`;character.setAttribute('aria-label',label+' character');character.title=issue+'; illustrative cue, not a diagnosis';
  for(const [value,text] of [['normal','Normal'],['issue','Issue cue']]){const option=document.createElement('option');option.value=value;option.textContent=text;character.append(option);}
  character.addEventListener('change',()=>{audioMix[id].character=character.value;$('audio-profile').value='custom';renderAudioMix();});
  header.append(labelNode,character);channel.append(header);
  const inputs=document.createElement('div');inputs.className='audio-channel-level';
  const slider=document.createElement('input');Object.assign(slider,{type:'range',min:0,max:200,step:1,id:`audio-level-${id}`});slider.setAttribute('aria-label',label+' level');
  const number=document.createElement('input');Object.assign(number,{type:'number',min:0,max:200,step:1,id:`audio-level-number-${id}`});number.setAttribute('aria-label',label+' level percent');
  for(const input of [slider,number])input.addEventListener('input',()=>{
    if(!input.value||!Number.isFinite(input.valueAsNumber))return;
    audioMix[id].level=input.valueAsNumber/100;audioMix=normalizeMix(audioMix);$('audio-profile').value='custom';renderAudioMix();
  });
  const unit=document.createElement('span');unit.textContent='%';inputs.append(slider,number,unit);channel.append(inputs);$('audio-sources').append(channel);
  const option=document.createElement('option');option.value=id;option.textContent=label;sourceGroup.append(option);
}
const issueGroup=document.createElement('optgroup');issueGroup.label='Cylinder / timing scenarios';$('audio-issue-source').append(issueGroup);
for(const {id,label} of issueDefinitions){const option=document.createElement('option');option.value=id;option.textContent=label;issueGroup.append(option);}
$('audio-issue-source').value='valves';renderAudioMix();
$('audio-all').addEventListener('change',()=>{for(const checkbox of root.querySelectorAll('.audio-source input'))if(bulkAudioSources.includes(checkbox.dataset.source))checkbox.checked=$('audio-all').checked;configureAudioSources();});
for(const id of ['audio-profile','audio-issue-source'])$(id).addEventListener('change',applyAudioProfile);
$('audio-issue-source').addEventListener('change',()=>{
  if($('audio-profile').value==='custom'){$('audio-profile').value='issue';applyAudioProfile();}
});
$('audio-issue-cylinder').addEventListener('change',()=>{audioIssue=normalizeIssue({...audioIssue,cylinder:Number($('audio-issue-cylinder').value)});renderAudioMix();});
for(const [id,other] of [['audio-timing-offset','audio-timing-number'],['audio-timing-number','audio-timing-offset']])$(id).addEventListener('input',()=>{
  const input=$(id);if(!input.value||!Number.isFinite(input.valueAsNumber))return;
  const value=Math.max(-30,Math.min(30,input.valueAsNumber));input.value=value;$(other).value=value;
  audioIssue=normalizeIssue({...audioIssue,timingOffset:value});renderAudioMix();
});
for(const [id,other] of [['audio-strength','audio-strength-number'],['audio-strength-number','audio-strength']])$(id).addEventListener('input',()=>{
  const input=$(id);if(!input.value||!Number.isFinite(input.valueAsNumber))return;
  const value=Math.max(0,Math.min(100,input.valueAsNumber));input.value=value;$(other).value=value;applyAudioProfile();
});
$('audio-enabled').addEventListener('change',async()=>{
  try{await audio.enable($('audio-enabled').checked);audio.volume(Number($('audio-volume').value));sampleMotion();syncAudio();}
  catch(error){$('audio-enabled').checked=false;await audio.enable(false);$('audio-status').textContent=error.message;}
});
$('audio-rate').addEventListener('change',()=>{sampleMotion();syncAudio();});
$('audio-volume').addEventListener('input',()=>audio.volume(Number($('audio-volume').value)));
document.addEventListener('visibilitychange',()=>{if(document.hidden){$('audio-enabled').checked=false;audio.enable(false);$('audio-status').textContent='Muted';}});
window.addEventListener('pagehide',()=>audio.enable(false));
function fitCamera(view){
  if(!manifest)return;
  const bounds=new THREE.Box3(new THREE.Vector3(...manifest.derived.bounds_mm[0]),new THREE.Vector3(...manifest.derived.bounds_mm[1]));
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const distance=size.length()/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.1/Math.min(camera.aspect,1);
  const directions={iso:[1.05,1.45,.8],timing:[1,0,0],fuel:[0,1,0],top:[.001,0,1]};
  camera.position.copy(center).add(new THREE.Vector3(...directions[view]).normalize().multiplyScalar(distance));controls.target.copy(center);controls.update();
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>fitCamera(button.dataset.view)));
$('fit').addEventListener('click',()=>fitCamera('iso'));

function hit(event){
  const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  const targets=[...meshes.values()].filter(m=>m.visible);if(interfaceRoot.visible)targets.push(...interfaceRoot.children);
  return raycaster.intersectObjects(targets,false).find(item=>!(metadata.get(item.object.name)?.housing&&$('cutaway').checked&&item.point.y>0));
}
let pointerDown;
renderer.domElement.addEventListener('pointerdown',e=>{pointerDown=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointermove',e=>{const result=hit(e);$('hover-name').textContent=result?.object.userData.connection?.name||metadata.get(result?.object.name)?.name||'Estimated CAD · kinematics only';renderer.domElement.style.cursor=result?'pointer':'grab';});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!pointerDown||Math.hypot(e.clientX-pointerDown[0],e.clientY-pointerDown[1])>5)return;
  const result=hit(e);if(result?.object.userData.connection){
    const c=result.object.userData.connection;selectPart(c.part_id);$('selection-name').textContent=c.name;$('selection-note').textContent=c.connects_to;$('selection-data').textContent=c.position_status;
  }else selectPart(result?.object.name||null);
});

function drawLabels(){
  const overlay=$('labels-overlay');overlay.replaceChildren();if(!manifest)return;
  const keys=$('labels').checked?['block','head','valve_cover','injection_pump','turbo_compressor_housing','alternator','flywheel','sump']:[];
  if(selected)keys.unshift(selected);
  const occupied=[];
  for(const id of [...new Set(keys)]){
    const mesh=meshes.get(id);if(!mesh?.visible)continue;
    const bounds=new THREE.Box3().setFromObject(mesh),v=bounds.getCenter(new THREE.Vector3()).project(camera);
    if(v.z>1||v.z<-1)continue;
    const x=(v.x+1)/2*viewport.clientWidth,y=(-v.y+1)/2*viewport.clientHeight;
    if(x<45||x>viewport.clientWidth-45||y<15||y>viewport.clientHeight-15)continue;
    if(occupied.some(([a,b])=>Math.abs(x-a)<155&&Math.abs(y-b)<40))continue;
    occupied.push([x,y]);const label=document.createElement('span');label.className='part-label';label.textContent=metadata.get(id).name;label.style.left=`${x}px`;label.style.top=`${y}px`;overlay.append(label);
  }
}
function drawAxes(){
  const canvas=$('axis-indicator'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,110,100);
  ctx.font='12px Segoe UI';ctx.lineWidth=2;const inverse=camera.quaternion.clone().invert();
  for(const [axis,name,color] of [[[1,0,0],'X','#a44c43'],[[0,1,0],'Y','#4b8e62'],[[0,0,1],'Z','#4b7fa3']]){
    const v=new THREE.Vector3(...axis).applyQuaternion(inverse),x=53+v.x*31,y=48-v.y*31;
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(53,48);ctx.lineTo(x,y);ctx.stroke();ctx.fillText(name,x+3,y-3);
  }
  ctx.fillStyle=getComputedStyle(root).getPropertyValue('--muted').trim();ctx.font='10px Segoe UI';ctx.fillText('mm / engine axes',15,93);
}
function tick(time){
  requestAnimationFrame(tick);
  if(playing&&manifest){
    sampleMotion(time);updateMotion();
  }
  controls.update();engineRoot.updateMatrixWorld(true);
  highlight.visible=Boolean(selected&&meshes.get(selected)?.visible);
  if(highlight.visible)highlight.box.setFromObject(meshes.get(selected));
  renderer.render(scene,camera);drawAxes();drawLabels();
}
requestAnimationFrame(tick);
window.engineInspection={snapshot:()=>({partCount:meshes.size,angle,playing,selected,buildId,
  partIds:[...meshes.keys()],snapshotRevision:manifest?.model_revision,referencePoseExports:true,
  absoluteAngle,nominalRpm,visualRpm:clockRpm,flow:flow.snapshot,audio:audio.snapshot(),
  timingCover:meshes.has('timing_cover'),
  camera:camera.position.toArray(),target:controls.target.toArray(),
  pistonMatrices:[...meshes].filter(([key])=>/^piston_[0-3]$/.test(key)).map(([key,m])=>({id:key,matrix:m.matrix.toArray()}))})};
try{
  await loadAssembly('reference-r6',true);resize();
  if(new URLSearchParams(location.search).get('flow')==='1'){$('flow').checked=true;$('flow').dispatchEvent(new Event('change'));}
  if(new URLSearchParams(location.search).get('mixer')==='1')$('sound-panel').open=true;
}catch(error){root.dataset.state='error';setDownloads(false);$('loading').hidden=true;$('error').hidden=false;$('error').textContent=error.message;$('parameter-status').textContent='Assembly unavailable';
  for(const input of root.querySelectorAll('button,input,select'))input.disabled=true;
}
