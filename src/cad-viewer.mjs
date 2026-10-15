import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {resizeCamera} from './cad-ui.mjs';
import {createInspector} from './cad-inspector.mjs';

export function createViewer(canvas,onSelect=()=>{},{projection='perspective'}={}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.localClippingEnabled=true;
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group,new THREE.HemisphereLight(0xffffff,0x77818e,2.5));
  for(const [at,intensity] of [[[120,-180,250],2.4],[[-140,100,180],1.2]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...at);scene.add(light);}
  const camera=projection==='orthographic' ? new THREE.OrthographicCamera(-100,100,100,-100,.01,10000) : new THREE.PerspectiveCamera(40,1,.01,10000);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
  if(camera.isOrthographicCamera){controls.dampingFactor=.08;controls.minZoom=.35;controls.maxZoom=8;}
  const objects=new Map();let current=[],section=false;
  const inspector=createInspector({scene,camera,canvas,root:canvas.closest('.cad-workbench, .coffee-tool')||canvas.parentElement,objects,labelFor:name=>current.find(part=>part.name===name)?.label||name.replaceAll('_',' '),onSelect});
  const theme=()=>scene.background=new THREE.Color(getComputedStyle(canvas.parentElement).backgroundColor);
  new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
  const resize=()=>{const box=canvas.parentElement;renderer.setSize(Math.max(1,box.clientWidth),Math.max(1,box.clientHeight),false);resizeCamera(camera,box.clientWidth,box.clientHeight);};
  new ResizeObserver(resize).observe(canvas.parentElement);
  function fit(view='iso'){
    const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length()/2;
    const vector={iso:[1,-1.5,1],top:[.001,0,1],front:[0,-1,.001],side:[1,0,.001],bottom:[0,-.001,-1]}[view]||[1,-1.5,1];
    let distance;
    if(camera.isOrthographicCamera){
      const aspect=Math.max(1,canvas.parentElement.clientWidth)/Math.max(1,canvas.parentElement.clientHeight),halfHeight=Math.max(1,radius)*1.1/Math.min(1,aspect);
      camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.zoom=1;
      distance=Math.max(10,radius*3);camera.far=Math.max(2000,distance+radius*4);camera.updateProjectionMatrix();
    }else{
      const angle=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));distance=Math.max(1,radius/Math.sin(angle)*1.1);
    }
    camera.position.copy(center).add(new THREE.Vector3(...vector).normalize().multiplyScalar(distance));controls.target.copy(center);controls.update();
  }
  function setParts(parts){
    const initial=current.length===0;
    group.traverse(node=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach(material=>material.dispose());else node.material?.dispose();});group.clear();objects.clear();current=parts;
    for(const part of parts){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.mesh?.positions??part.positions??part.vertices.flat(),3));geometry.setIndex(Array.from(part.mesh?.indices??part.indices));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.color,roughness:.65,side:THREE.DoubleSide}));mesh.name=part.name;mesh.userData={original_design_copyright:'Santeri Hukari',reference_only:Boolean(part.reference)};group.add(mesh);objects.set(part.name,mesh);
    }
    setSection(section);inspector.refresh();resize();if(initial)fit();
  }
  function select(name){inspector.select(name);}
  function setSection(value){section=value;for(const mesh of objects.values())mesh.material.clippingPlanes=value?[new THREE.Plane(new THREE.Vector3(0,-1,0),0)]:[];}
  function frame(){requestAnimationFrame(frame);controls.update();inspector.update();renderer.render(scene,camera);}frame();
  async function glb(extras={},sourceParts=current,position=null){
    const copy=new THREE.Group();copy.userData={...extras,original_design_copyright:'Santeri Hukari'};
    for(const part of sourceParts){
      const original=objects.get(part.name);let geometry;
      if(sourceParts===current)geometry=original.geometry.clone();
      else{geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.mesh?.positions??part.positions??part.vertices.flat(),3));geometry.setIndex(Array.from(part.mesh?.indices??part.indices));geometry.computeVertexNormals();}
      const mesh=new THREE.Mesh(geometry,original.material.clone());mesh.name=part.name;
      if(position)mesh.position.set(...position(part));else mesh.position.copy(original.position);
      mesh.scale.copy(original.scale);mesh.quaternion.copy(original.quaternion);
      mesh.userData={...original.userData};mesh.material.emissive.set('#000000');mesh.material.clippingPlanes=[];copy.add(mesh);
    }
    copy.rotation.x=-Math.PI/2;copy.scale.setScalar(.001);copy.updateMatrixWorld(true);
    try{return await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:false});}
    finally{copy.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});}
  }
  return{setParts,fit,select,setSection,objects,group,camera,controls,renderer,glb};
}
export function save(bytes,name,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
