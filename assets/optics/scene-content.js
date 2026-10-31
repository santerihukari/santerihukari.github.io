import * as THREE from 'three';

export function targetTexture(letter,color){
  const c=document.createElement('canvas');c.width=768;c.height=768;const x=c.getContext('2d');
  x.fillStyle='#e8e6e0';x.fillRect(0,0,768,768);x.fillStyle=color;x.fillRect(18,18,732,732);
  x.fillStyle='#f9faf6';x.font='bold 310px Arial';x.textAlign='center';x.fillText(letter,384,380);
  x.fillStyle='#1c2326';x.fillRect(110,440,548,180);
  for(let i=0;i<100;i++){x.fillStyle=i%2?'#f5f7f7':'#1c2326';x.fillRect(115+i*5.4,445,2.7,170);}
  x.strokeStyle='#eef1ed';x.lineWidth=7;x.strokeRect(52,52,664,664);
  x.fillStyle='#eef1ed';x.font='24px Arial';x.fillText('FOCUS / DETAIL',384,700);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export class TeachingScene{
  constructor(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#afbec8');
    this.scene.add(new THREE.HemisphereLight('#e6f3ff','#a5967d',2.3));
    const light=new THREE.DirectionalLight('#fff0d8',3.4);light.position.set(-4,8,4);this.scene.add(light);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#818e8e',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.7,-25);this.scene.add(floor);this.floor=floor;
    const grid=new THREE.GridHelper(60,60,'#b6c5c5','#919e9e');grid.position.set(0,-.699,-20);this.scene.add(grid);this.grid=grid;
    this.targets=[];
    for(const [i,color] of ['#2e739b','#ba6649','#698449'].entries()){
      const root=new THREE.Group();const texture=targetTexture('ABC'[i],color);
      const panel=new THREE.Mesh(new THREE.BoxGeometry(1,1,.065),[
        ...Array.from({length:4},()=>new THREE.MeshStandardMaterial({color:'#3b4141',roughness:.7})),
        new THREE.MeshStandardMaterial({map:texture,roughness:.8}),new THREE.MeshStandardMaterial({color})]);
      if(i===2){panel.material[4].map=null;panel.material[4].color.set('#030607');texture.dispose();}
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.022,.028,1,12),new THREE.MeshStandardMaterial({color:'#333b40',metalness:.45,roughness:.45}));
      root.add(panel,post);root.userData={target:i};panel.userData={target:i};this.scene.add(root);this.targets.push({root,panel,post});
    }
    this.pointMarker=new THREE.Mesh(new THREE.SphereGeometry(.01,12,8),new THREE.MeshBasicMaterial({color:'#fff5d9'}));this.pointMarker.position.z=.003;this.targets[2].root.add(this.pointMarker);
    this.ball=new THREE.Mesh(new THREE.SphereGeometry(.15,32,24),new THREE.MeshStandardMaterial({color:'#d7b85e',roughness:.24,metalness:.45}));this.scene.add(this.ball);
    this.ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,12,48),new THREE.MeshStandardMaterial({color:'#a8ced7',metalness:.35,roughness:.3}));this.scene.add(this.ring);
    this.wall=new THREE.Mesh(new THREE.PlaneGeometry(30,10),new THREE.MeshStandardMaterial({color:'#c8cdca',roughness:1}));this.wall.position.set(0,4,-15);this.scene.add(this.wall);
    this.cameraBody=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(.16,.105,.075),new THREE.MeshStandardMaterial({color:'#292e33',roughness:.5}));body.position.z=.045;
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.07,32),new THREE.MeshStandardMaterial({color:'#353c40',metalness:.5,roughness:.3}));lens.rotation.x=Math.PI/2;lens.position.z=-.02;this.cameraBody.add(body,lens);this.scene.add(this.cameraBody);
  }
  update(d){
    this.data=d;const s=3;
    const brightness=Math.min(8,d.settings.lightBrightness);this.pointMarker.material.color.setRGB(brightness,.96*brightness,.85*brightness);
    const sizes=[.39,.57,.05];
    const floorY=Math.min(-.7,...d.targets.map((t,i)=>t.y/1000-sizes[i]/2-.2));this.floor.position.y=floorY;this.grid.position.y=floorY+.001;
    for(const [i,t] of d.targets.entries()){
      const item=this.targets[i],size=sizes[i],thickness=i===2?.2:1;
      item.root.position.set(t.x/1000,t.y/1000,-t.distance/1000);
      item.panel.scale.set(size,size,thickness);
      item.panel.position.z=-.0325*thickness;
      item.post.scale.x=item.post.scale.z=i===2?.18:1;
      const postH=Math.max(.1,t.y/1000-floorY-size/2);item.post.scale.y=postH;item.post.position.y=-size/2-postH/2;
    }
    this.ballBase=new THREE.Vector3(.17*s,-.40*s,-.87*s);this.ballBase.y=Math.max(-.5,this.ballBase.y);
    this.ball.position.copy(this.ballBase);this.ball.scale.setScalar(Math.max(.5,s/3));
    this.ring.position.set(-.28*s,.08*s,-1.6*s);this.ring.scale.setScalar(s/3);
    this.wall.position.z=-Math.max(12,...d.targets.map(t=>t.distance/1000*1.1));
  }
  setSampleTime(t){if(this.data)this.ball.position.x=this.ballBase.x+this.data.settings.motion*t;}
}
