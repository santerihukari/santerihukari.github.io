import * as THREE from 'three';
import {createViewer,save} from '../cad-viewer.mjs';
import {exportParts,printPartFor,springGeometry,travel} from './geometry.mjs';

const root=document.getElementById('damperWorkbench'),$=id=>document.getElementById(`damper${id}`);
const asset=name=>new URL(`../../assets/cad/air-damper/${name}`,import.meta.url);
let data,stroke=0,explosion=0,playing=false,phase=0,lastTime=0;
const rows=new Map(),full=new Map(),sections=new Map(),visible=new Map(),centers=new Map();
const viewer=createViewer($('Canvas'),name=>{
  for(const [key,row] of rows)row.querySelector('button').setAttribute('aria-pressed',String(key===name));
  const file=printPartFor(name||'');
  if(data?.print_manifest.some(item=>item.part===file)){$('PrintPart').value=file;quantity();}
});
const paths=new THREE.Group(),cutPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

function geometry(positions,indices){
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setIndex(indices);result.computeVertexNormals();return result;
}
function syncPlay(){
  $('Play').setAttribute('aria-pressed',String(playing));$('Play').setAttribute('aria-label',playing?'Pause motion':'Play motion');
  $('Play').title=playing?'Pause motion':'Play motion';$('PlayIcon').src=asset(`icons/${playing?'pause':'play'}.svg`).href;
}
function quantity(){
  const item=data.print_manifest.find(item=>item.part===$('PrintPart').value);
  $('Quantity').textContent=`Print ${item.quantity} | ${item.dimensions_mm.map(v=>v.toFixed(2)).join(' x ')} mm`;
}
function motion(){
  if(!data)return;
  const spring=viewer.objects.get('spring'),shape=springGeometry(data.parameters,stroke);
  spring.geometry.getAttribute('position').array.set(shape.positions);spring.geometry.getAttribute('position').needsUpdate=true;
  spring.geometry.computeVertexNormals();spring.geometry.computeBoundingSphere();
  for(const part of data.parts){
    const mesh=viewer.objects.get(part.name),center=centers.get(part.name);
    mesh.position.set(part.moving?stroke:0,0,0);mesh.scale.set(1,1,1);
    if(explosion){
      const sign=part.name.includes('rear')?1:part.name.includes('front')?-1:0;
      mesh.position.x+=sign*explosion;mesh.position.y+=(center.y>1?1:center.y<-1?-1:0)*explosion;
    }
  }
  paths.children.find(line=>line.name==='gap').position.x=stroke;
  $('Stroke').value=$('StrokeNumber').value=stroke.toFixed(1);
  const p=data.parameters;
  $('Metrics').textContent=`Spring seats ${(p.chamber_length-p.piston_length-stroke).toFixed(1)} mm | Stop reserve ${(data.maximum_stroke_mm-stroke).toFixed(1)} mm`;
}
function appearance(){
  if(!data)return;
  const cut=$('Section').checked,refs=$('References').checked;
  for(const part of data.parts){
    const mesh=viewer.objects.get(part.name);
    mesh.geometry=cut&&!part.reference&&sections.has(part.name)?sections.get(part.name):full.get(part.name);
    mesh.visible=visible.get(part.name)&&(part.reference?refs:!cut||sections.has(part.name));
    mesh.material.clippingPlanes=cut&&part.reference?[cutPlane]:[];
  }
  paths.visible=$('Air').checked;
}
for(const id of ['Section','Air','References'])$(id).addEventListener('change',appearance);
for(const id of ['Stroke','StrokeNumber'])$(id).addEventListener('input',()=>{
  playing=false;syncPlay();const value=travel($(id).value,data?.maximum_stroke_mm||20);
  $(id).setAttribute('aria-invalid',String(value===null));
  if(value!==null){stroke=value;motion();}
});
$('StrokeNumber').addEventListener('change',()=>{if(travel($('StrokeNumber').value,data?.maximum_stroke_mm||20)===null)motion();$('StrokeNumber').setAttribute('aria-invalid','false');});
$('Explode').addEventListener('input',()=>{explosion=Number($('Explode').value);motion();});
$('Play').addEventListener('click',()=>{
  playing=!playing;
  if(playing&&data)phase=Math.acos(1-2*Math.min(stroke,data.parameters.working_stroke)/data.parameters.working_stroke);
  syncPlay();
});
function tick(time){
  const delta=Math.min(.05,(time-lastTime)/1000);lastTime=time;
  if(playing&&data&&!document.hidden){phase+=delta*1.5;stroke=(1-Math.cos(phase))*data.parameters.working_stroke/2;motion();}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$('PrintPart').addEventListener('change',quantity);
$('Reset').addEventListener('click',()=>{
  playing=false;stroke=explosion=0;$('Explode').value=0;syncPlay();
  $('Section').checked=$('Air').checked=false;$('References').checked=true;
  for(const part of data.parts){visible.set(part.name,true);rows.get(part.name).querySelector('input[type=checkbox]').checked=true;}
  appearance();motion();viewer.select(null);viewer.fit();
});
function failure(error){$('Error').textContent=error.message;$('Error').hidden=false;}
async function download(name){
  const response=await fetch(asset(name));if(!response.ok)throw new Error('Print file could not load');save(await response.arrayBuffer(),name);
}
$('STL').addEventListener('click',()=>data&&download(data.print_manifest.find(item=>item.part===$('PrintPart').value).file).catch(failure));
$('ZIP').addEventListener('click',()=>data&&download('print-set.zip').catch(failure));
$('GLB').addEventListener('click',async()=>{
  if(!data)return;$('GLB').disabled=true;
  const currentStroke=stroke;
  try{
    const bytes=await viewer.glb({revision:data.revision,stroke_mm:currentStroke,parameters:data.parameters,geometry:'Full native assembly; no cutaway or explosion',author:'Santeri Hukari'},exportParts(data,currentStroke),part=>[part.moving?currentStroke:0,0,0]);
    save(bytes,'air-damper.glb','model/gltf-binary');
  }catch(error){failure(error);}finally{$('GLB').disabled=false;}
});
root.querySelectorAll('[data-cad-view]').forEach(button=>button.addEventListener('click',()=>viewer.fit(button.dataset.cadView)));
const height=()=>root.style.setProperty('--coffee-height',`${Math.max(180,(window.visualViewport?.height||innerHeight)-root.getBoundingClientRect().top-8)}px`);
window.addEventListener('resize',height);height();

try{
  const response=await fetch(asset('model.json'));if(!response.ok)throw new Error('Model could not load');data=await response.json();viewer.setParts(data.parts);
  for(const item of data.print_manifest){const option=document.createElement('option');option.value=item.part;option.textContent=item.part.replaceAll('_',' ');$('PrintPart').append(option);}
  for(const part of data.parts){
    const mesh=viewer.objects.get(part.name);full.set(part.name,mesh.geometry);visible.set(part.name,true);
    centers.set(part.name,new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
    if(part.section_positions.length)sections.set(part.name,geometry(part.section_positions,part.section_indices));
    const row=document.createElement('div');row.className='damper-part-row';
    const check=document.createElement('input');check.type='checkbox';check.checked=true;check.setAttribute('aria-label',`Show ${part.label}`);
    check.addEventListener('change',()=>{visible.set(part.name,check.checked);appearance();});
    const button=document.createElement('button');button.type='button';button.className='component-item';button.textContent=part.label+(part.reference?' (reference)':'');button.dataset.part=part.name;button.setAttribute('aria-pressed','false');button.onclick=()=>viewer.select(part.name);
    const color=document.createElement('input');color.type='color';color.value=part.color;color.setAttribute('aria-label',`${part.label} color`);color.title=`${part.label} color`;color.addEventListener('input',()=>mesh.material.color.set(color.value));
    row.append(check,button,color);rows.set(part.name,row);$('Parts').append(row);
  }
  const spring=viewer.objects.get('spring'),shape=springGeometry(data.parameters,0);spring.geometry.dispose();spring.geometry=geometry(shape.positions,shape.indices);full.set('spring',spring.geometry);
  for(const [name,points] of Object.entries(data.air_paths)){
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(point=>new THREE.Vector3(...point))),new THREE.LineBasicMaterial({color:name==='reset'?'#458fd1':'#c95e4d',depthTest:false}));line.name=name;line.renderOrder=2;paths.add(line);
  }
  viewer.group.add(paths);appearance();motion();
  for(const control of root.querySelectorAll('input,select,button'))control.disabled=false;
  $('Status').textContent='Fixed V1';quantity();syncPlay();
  const p=data.parameters;
  $('Details').textContent=`Bore ${p.finished_bore_diameter} mm; piston ${p.piston_nominal_diameter} mm; nominal radial gap ${((p.finished_bore_diameter-p.piston_nominal_diameter)/2).toFixed(2)} mm. Working stroke ${p.working_stroke} mm; maximum ${data.maximum_stroke_mm} mm. Reed ${p.reed_thickness} mm. Small fits require measurement and finishing.`;
}catch(error){failure(error);$('Status').textContent='Unavailable';}
