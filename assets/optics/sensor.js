import * as THREE from 'three';

function radicalInverse(i){let v=0,f=.5;while(i){v+=f*(i&1);i>>=1;f*=.5;}return v;}
function pupil(i,n,blades){
  if(i===0)return[0,0];let r=Math.sqrt((i-.5)/(n-1)),a=i*2.399963229728653;
  if(blades){const side=i%blades,A=2*Math.PI*side/blades,B=2*Math.PI*(side+1)/blades,v=(i*.6180339887498949)%1;return[r*((1-v)*Math.cos(A)+v*Math.cos(B)),r*((1-v)*Math.sin(A)+v*Math.sin(B))];}
  return[r*Math.cos(a),r*Math.sin(a)];
}

export class SensorRenderer{
  constructor(canvas,world,onProgress){
    this.canvas=canvas;this.world=world;this.onProgress=onProgress;
    this.context=canvas.getContext('2d',{alpha:false});
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.camera=new THREE.PerspectiveCamera(30,1.5,.01,300);
    this.quadScene=new THREE.Scene();this.quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());this.quadScene.add(this.quad);
    const vertex='varying vec2 uv0; void main(){uv0=uv; gl_Position=vec4(position.xy,0.,1.);}';
    this.average=new THREE.ShaderMaterial({uniforms:{previous:{value:null},current:{value:null},count:{value:0}},vertexShader:vertex,
      fragmentShader:'uniform sampler2D previous,current;uniform float count;varying vec2 uv0;void main(){vec3 a=texture2D(previous,uv0).rgb;vec3 b=texture2D(current,uv0).rgb;gl_FragColor=vec4((a*count+b)/(count+1.),1.);}'});
    this.present=new THREE.ShaderMaterial({uniforms:{image:{value:null},sigma:{value:new THREE.Vector2()},gain:{value:1},upright:{value:1},pointImage:{value:null},pointCenter:{value:new THREE.Vector2()},pointExtent:{value:1},pointSize:{value:130},sensorSize:{value:new THREE.Vector2()},sensorShift:{value:new THREE.Vector2()},pixelSize:{value:new THREE.Vector2()},pointFlux:{value:.008}},vertexShader:vertex,
      fragmentShader:`uniform sampler2D image,pointImage;uniform vec2 sigma,pointCenter,sensorSize,sensorShift,pixelSize;uniform float gain,upright,pointExtent,pointSize,pointFlux;varying vec2 uv0;
      float integral(vec2 p){vec2 uv=clamp((p-pointCenter)/(2.*pointExtent)+.5,0.,1.);return texture2D(pointImage,uv*(pointSize-1.)/pointSize+.5/pointSize).r;}
      void main(){vec2 uv=upright>.5?uv0:vec2(1.)-uv0;vec3 c=texture2D(image,uv).rgb*.25;
      c+=(texture2D(image,uv+vec2(sigma.x,0.)).rgb+texture2D(image,uv-vec2(sigma.x,0.)).rgb+texture2D(image,uv+vec2(0.,sigma.y)).rgb+texture2D(image,uv-vec2(0.,sigma.y)).rgb)*.125;
      c+=(texture2D(image,uv+sigma).rgb+texture2D(image,uv-sigma).rgb+texture2D(image,uv+vec2(sigma.x,-sigma.y)).rgb+texture2D(image,uv+vec2(-sigma.x,sigma.y)).rgb)*.0625;
      vec2 p=sensorShift-(uv-.5)*sensorSize,h=pixelSize*.5;
      float mass=max(0.,integral(p+h)-integral(p+vec2(-h.x,h.y))-integral(p+vec2(h.x,-h.y))+integral(p-h));
      c+=vec3(1.,.96,.85)*mass/(pixelSize.x*pixelSize.y)*pointFlux;
      c=vec3(1.)-exp(-max(c,vec3(0.))*gain);gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}`});
    this.crop=false;this.cropTarget=2;this.count=0;this.total=48;this.data=null;
  }
  resize(width,height){
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;this.canvas.width=width;this.canvas.height=height;this.renderer.setSize(width,height,false);
    for(const t of [this.sample,this.a,this.b])t?.dispose();
    const settings={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true};
    this.sample=new THREE.WebGLRenderTarget(width,height,settings);this.a=new THREE.WebGLRenderTarget(width,height,{...settings,depthBuffer:false});this.b=this.a.clone();
  }
  update(data){
    this.data=data;const p=data.settings;
    this.world.update(data);
    this.sensorW=this.crop?Math.min(p.sensorW,p.pitch*.512):p.sensorW;
    this.sensorH=this.crop?Math.min(p.sensorH,p.pitch*.342):p.sensorH;
    const clamp=(value,center,span)=>Math.max(center-span/2,Math.min(center+span/2,value));
    this.shiftX=this.crop?clamp(data.targets[this.cropTarget].sensor_x,p.shiftX,p.sensorW-this.sensorW):p.shiftX;
    this.shiftY=this.crop?clamp(data.targets[this.cropTarget].sensor_y,p.shiftY,p.sensorH-this.sensorH):p.shiftY;
    const width=this.crop?512:Math.min(768,data.sensor.width_px);
    const height=Math.round(width*this.sensorH/this.sensorW);this.resize(width,height);
    const point=data.point_spread;
    this.pointTexture?.dispose();this.pointTexture=new THREE.DataTexture(new Float32Array(point.cdf),point.size,point.size,THREE.RedFormat,THREE.FloatType);this.pointTexture.minFilter=THREE.LinearFilter;this.pointTexture.magFilter=THREE.LinearFilter;this.pointTexture.needsUpdate=true;
    const u=this.present.uniforms;u.pointImage.value=this.pointTexture;u.pointExtent.value=point.extent_mm;u.pointSize.value=point.size;u.pointCenter.value.set(data.targets[2].sensor_x,data.targets[2].sensor_y);
    u.sensorSize.value.set(this.sensorW,this.sensorH);u.sensorShift.value.set(this.shiftX,this.shiftY);u.pixelSize.value.set(this.sensorW/width,this.sensorH/height);
    // Block the point when another object hides it. Partial visibility is an
    // intensity estimate, not a diffraction solution for an obstructed pupil.
    this.world.scene.updateMatrixWorld(true);const target=this.world.targets[2].root.position;
    const blockers=[...this.world.targets.slice(0,2).flatMap(t=>[t.panel,t.post]),this.world.ball,this.world.ring];const ray=new THREE.Raycaster();let passed=0;
    for(let i=0;i<13;i++){const [x,y]=pupil(i,13,p.blades),origin=new THREE.Vector3(x*data.aperture/2000,y*data.aperture/2000,0),direction=target.clone().sub(origin);ray.set(origin,direction.clone().normalize());ray.far=direction.length()-.001;if(!ray.intersectObjects(blockers).length)passed++;}
    this.pointVisibility=passed/13;u.pointFlux.value=.008*p.lightBrightness*this.pointVisibility;
    this.count=0;this.total=this.crop?96:48;
    this.onProgress?.(0,this.total);
    this.renderer.setRenderTarget(this.a);this.renderer.setClearColor('#000');this.renderer.clear();this.renderer.setRenderTarget(this.b);this.renderer.clear();this.renderer.setRenderTarget(null);
  }
  step(){
    if(!this.data||this.count>=this.total)return false;
    const d=this.data,p=d.settings;
    const sample=pupil(this.count,this.total,p.blades),px=sample[0]*d.aperture/2000,py=sample[1]*d.aperture/2000;
    this.camera.position.set(px,py,0);this.camera.quaternion.identity();
    const near=.01,focusInverse=d.projection.focus_inverse_m,K=d.projection.K;
    const hw=near*this.sensorW/(2*K),hh=near*this.sensorH/(2*K);
    const cx=-px*near*focusInverse-this.shiftX*near/K,cy=-py*near*focusInverse-this.shiftY*near/K;
    this.camera.projectionMatrix.makePerspective(cx-hw,cx+hw,cy+hh,cy-hh,near,300,THREE.WebGLCoordinateSystem);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.world.cameraBody.visible=false;this.world.pointMarker.visible=false;this.world.setSampleTime((radicalInverse(this.count+1)-.5)*p.shutter);
    this.renderer.setRenderTarget(this.sample);this.renderer.render(this.world.scene,this.camera);
    this.world.cameraBody.visible=true;this.world.pointMarker.visible=true;this.world.setSampleTime(0);
    this.quad.material=this.average;this.average.uniforms.previous.value=this.a.texture;this.average.uniforms.current.value=this.sample.texture;this.average.uniforms.count.value=this.count;
    this.renderer.setRenderTarget(this.b);this.renderer.render(this.quadScene,this.quadCamera);
    [this.a,this.b]=[this.b,this.a];this.count++;
    this.quad.material=this.present;this.present.uniforms.image.value=this.a.texture;
    const sigmaMm=p.diffraction?.437*(p.wavelength/1e6)*d.working_fnumber*Math.SQRT2:0;
    this.present.uniforms.sigma.value.set(sigmaMm/this.sensorW,sigmaMm/this.sensorH);
    this.present.uniforms.gain.value=p.exposureLock?1:Math.max(.0001,Math.min(64,d.relative_exposure));
    this.present.uniforms.upright.value=p.upright?1:0;
    this.renderer.setRenderTarget(null);this.renderer.render(this.quadScene,this.quadCamera);
    this.context.drawImage(this.renderer.domElement,0,0);
    this.onProgress?.(this.count,this.total);return true;
  }
  setCrop(value){this.crop=value;if(this.data)this.update(this.data);}
}
