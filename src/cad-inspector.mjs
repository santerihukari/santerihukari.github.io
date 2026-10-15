import * as THREE from 'three';

// Inspection overlays are separate from the model, so they never enter exports.
export function createInspector({scene,camera,canvas,root,objects,labelFor,onSelect=()=>{}}) {
  const viewport = canvas.parentElement, overlay = new THREE.Group(), ray = new THREE.Raycaster();
  scene.add(overlay);
  const label = document.createElement('span'); label.className = 'cad-component-label'; label.hidden = true; viewport.append(label);
  let selected = null, hovered = null, start, activeObject = null, sources = [];
  const entries = () => typeof objects === 'function' ? objects() : objects;
  const visible = object => { for(let node=object;node;node=node.parent) if(!node.visible)return false; return true; };
  function meshes(object) { const list=[]; object?.traverse(node=>{if(node.isMesh&&visible(node))list.push(node);}); return list; }
  function clearOverlay() { for(const mesh of [...overlay.children]){mesh.material.dispose();overlay.remove(mesh);} sources=[]; activeObject=null; }
  function highlight(force=false) {
    const object = entries().get(hovered || selected), children = meshes(object);
    root.dataset.hoveredComponent = hovered || ''; root.dataset.selectedComponent = selected || '';
    if(!force && object===activeObject && sources.length===children.length && children.every((mesh,i)=>mesh===sources[i]?.source&&mesh.geometry===sources[i]?.overlay.geometry))return;
    clearOverlay(); activeObject=object;
    for(const source of children){
      const material = new THREE.MeshBasicMaterial({color:0xd6a33b,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const mesh = new THREE.Mesh(source.geometry,material);mesh.matrixAutoUpdate=false;mesh.renderOrder=30;
      overlay.add(mesh);sources.push({source,overlay:mesh});
    }
  }
  function select(id) {
    selected = id && entries().has(id) ? id : null; hovered=null; highlight(true);
    label.textContent = selected ? labelFor(selected) : ''; onSelect(selected); update();
  }
  function hit(event) {
    const rect=canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    const owners=new Map();
    for(const [id,object] of entries())for(const mesh of meshes(object))owners.set(mesh,id);
    return ray.intersectObjects([...owners.keys()],false).find(item=>visible(item.object)&&!(item.object.material.clippingPlanes||[]).some(plane=>plane.distanceToPoint(item.point)<0))?.object;
  }
  function idAt(event) {const mesh=hit(event);if(!mesh)return null;for(const [id,object] of entries()){for(let node=mesh;node;node=node.parent)if(node===object)return id;}return null;}
  canvas.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY,button:event.button};hovered=null;highlight();});
  canvas.addEventListener('pointerup',event=>{
    const click=start&&start.button===0&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<6;start=null;
    if(click)select(idAt(event));
  });
  canvas.addEventListener('pointermove',event=>{if(start||event.pointerType==='touch')return;const id=idAt(event);if(id!==hovered){hovered=id;highlight();}canvas.style.cursor=id?'pointer':'grab';});
  const leave=()=>{start=null;hovered=null;highlight();};
  canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',leave);
  function update() {
    highlight();
    for(const pair of sources){
      pair.source.updateWorldMatrix(true,false);pair.overlay.matrix.copy(pair.source.matrixWorld);
      pair.overlay.visible=visible(pair.source);pair.overlay.material.clippingPlanes=pair.source.material.clippingPlanes||[];
    }
    const object=entries().get(selected), parts=meshes(object);
    label.hidden=!selected||!parts.length;
    if(label.hidden)return;
    const box=new THREE.Box3();parts.forEach(mesh=>box.expandByObject(mesh));
    const point=box.getCenter(new THREE.Vector3()).project(camera), width=viewport.clientWidth,height=viewport.clientHeight;
    if(Math.abs(point.x)>1||Math.abs(point.y)>1||point.z<-1||point.z>1){label.hidden=true;return;}
    const x=(point.x+1)*width/2,y=(1-point.y)*height/2,w=label.offsetWidth,h=label.offsetHeight,rect=viewport.getBoundingClientRect();
    const obstacles=[...viewport.querySelectorAll('.coffee-toolbar,.coffee-floating-actions,.viewport-bar,.volume-warning,.volume-legend,.coffee-view-controls,.cad-download-panel,.volume-downloads,.cad-coordinate-indicator,.error-banner:not([hidden])')]
      .filter(node=>!node.hidden&&node.getClientRects().length).map(node=>{const r=node.getBoundingClientRect();return [r.left-rect.left-4,r.top-rect.top-4,r.right-rect.left+4,r.bottom-rect.top+4];});
    const candidates=[[x+12,y-h/2],[x-w-12,y-h/2],[x-w/2,y-h-12],[x-w/2,y+12]]
      .map(([left,top])=>[Math.max(8,Math.min(width-w-8,left)),Math.max(8,Math.min(height-h-8,top))]);
    const place=candidates.find(([left,top])=>left+w<=width-8&&top+h<=height-8&&!obstacles.some(o=>left<o[2]&&left+w>o[0]&&top<o[3]&&top+h>o[1]));
    if(!place){label.hidden=true;return;}label.style.left=`${place[0]}px`;label.style.top=`${place[1]}px`;
  }
  function refresh(){if(selected&&!entries().has(selected))selected=null;hovered=null;highlight(true);label.textContent=selected?labelFor(selected):'';update();}
  return {select,refresh,update,get selected(){return selected;},get hovered(){return hovered;}};
}
