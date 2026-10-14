import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

export function createViewer(canvas,onSelect=()=>{}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.localClippingEnabled=true;
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group,new THREE.HemisphereLight(0xffffff,0x77818e,2.5));
  for(const [at,intensity] of [[[120,-180,250],2.4],[[-140,100,180],1.2]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...at);scene.add(light);}
  const camera=new THREE.PerspectiveCamera(40,1,.01,10000);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
  const objects=new Map(),ray=new THREE.Raycaster();let current=[],pointerStart,section=false;
  const theme=()=>scene.background=new THREE.Color(getComputedStyle(canvas.parentElement).backgroundColor);
  new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
  const resize=()=>{const box=canvas.parentElement;renderer.setSize(Math.max(1,box.clientWidth),Math.max(1,box.clientHeight),false);camera.aspect=box.clientWidth/Math.max(1,box.clientHeight);camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(canvas.parentElement);
  function fit(view='iso'){
    const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length()/2;
    const angle=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));
    const vector={iso:[1,-1.5,1],top:[.001,0,1],front:[0,-1,.001],side:[1,0,.001]}[view]||[1,-1.5,1];
    camera.position.copy(center).add(new THREE.Vector3(...vector).normalize().multiplyScalar(Math.max(1,radius/Math.sin(angle)*1.1)));controls.target.copy(center);controls.update();
  }
  function setParts(parts){
    group.traverse(node=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach(material=>material.dispose());else node.material?.dispose();});group.clear();objects.clear();current=parts;
    for(const part of parts){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.mesh?.positions??part.positions??part.vertices.flat(),3));geometry.setIndex(Array.from(part.mesh?.indices??part.indices));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.color,roughness:.65,side:THREE.DoubleSide}));mesh.name=part.name;mesh.userData={original_design_copyright:'Santeri Hukari',reference_only:Boolean(part.reference)};group.add(mesh);objects.set(part.name,mesh);
    }
    setSection(section);resize();fit();
  }
  function select(name){for(const [id,mesh] of objects)mesh.material.emissive.set(id===name?'#51420f':'#000000');onSelect(name);}
  function setSection(value){section=value;for(const mesh of objects.values())mesh.material.clippingPlanes=value?[new THREE.Plane(new THREE.Vector3(0,-1,0),0)]:[];}
  canvas.addEventListener('pointerdown',e=>pointerStart=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6)return;const b=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const hit=ray.intersectObjects(group.children).find(h=>h.object.visible);select(hit?.object.name??null);});
  function frame(){requestAnimationFrame(frame);controls.update();renderer.render(scene,camera);}frame();
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
