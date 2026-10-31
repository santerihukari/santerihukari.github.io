import {TeachingScene} from './scene-content.js';
import {OpticalViewer} from './optical-scene.js';
import {SensorRenderer} from './sensor.js';
import {PhysicsClient} from './physics-client.mjs';

const $=s=>document.querySelector(s),fmt=(n,d=2)=>Number(n).toFixed(d);
let settings,data,defaults,viewer,sensor,world,engine,timer,controller,requestId=0,hasFit=false,viewMode='system';
const asset=path=>new URL(path,import.meta.url).href;
const fields=new Map();
const specs=[
 ['primary-controls','focal','Focal length',18,135,.1,'mm',false],
 ['primary-controls','fnumber','Aperture',1.4,22,.1,'f /',true],
 ['primary-controls','focus','Focus distance',.3,1000000,.01,'m, along axis',true],
 ['target-controls','targetA','Target A distance',.2,200,.001,'m, radial',true],
 ['target-controls','subject','Target B distance',.2,200,.001,'m, radial',true],
 ['target-controls','targetC','Point C distance',.2,200,.001,'m, radial',true],
 ['light-controls','lightBrightness','Light C brightness',.01,1000,.01,'relative',true],
 ...['A','B','C'].flatMap(letter=>['X','Y'].map(axis=>['position-controls',`target${letter}${axis}`,`${letter} ${axis==='X'?'horizontal X':'vertical Y'}`,-80,80,.01,'\u00b0',false])),
 ['sensor-controls','pitch','Pixel pitch',1,30,.1,'\u00b5m',false],
 ['sensor-controls','sensorW','Sensor width',8,44,.1,'mm',false],
 ['sensor-controls','sensorH','Sensor height',6,33,.1,'mm',false],
 ['glass-controls','thickness','Singlet thickness / EFL',.12,.4,.01,'ratio',false],
 ['glass-controls','bending','Singlet bending factor',-.7,.7,.01,'shape',false],
 ['shift-controls','shiftX','Sensor shift X',-8,8,.1,'mm',false],
 ['shift-controls','shiftY','Sensor shift Y',-8,8,.1,'mm',false],
 ['shift-controls','sensorOffset','Sensor extension offset',-3,3,.01,'mm',false],
 ['exposure-controls','shutter','Exposure time',1/4000,1/15,.00001,'s',true],
 ['exposure-controls','iso','ISO gain proxy',50,6400,50,'ISO',true],
 ['exposure-controls','motion','Moving sphere speed',0,2,.05,'m/s',false],
 ['criterion-controls','wavelength','Wavelength',420,680,1,'nm',false],
 ['criterion-controls','coc','Custom blur diameter',2,100,.5,'\u00b5m',false]];

function buildControls(){
  for(const id of ['primary-controls','target-controls','position-controls','light-controls'])$('#'+id).className='control-group';
  for(const [parent,key,label,min,max,step,unit,log] of specs){
    const root=document.createElement('div');root.className='parameter';root.dataset.key=key;
    root.innerHTML=`<label class="parameter-label" for="n-${key}"><span>${label}</span><span class="unit">${unit}</span></label><div class="parameter-inputs"><input type="range" id="s-${key}" min="0" max="1000" step="1" aria-label="${label}"><input type="number" id="n-${key}" min="${min}" max="${max}" step="${step}" inputmode="decimal" aria-label="${label} value"></div>`;
    $('#'+parent).append(root);
    const range=root.querySelector('[type=range]'),number=root.querySelector('[type=number]');
    // Logarithmic near range, then linear inverse distance to the exact infinity endpoint.
    const fromSlider=v=>key==='focus'?(v===1000?'infinity':v<=750?min*Math.pow(100/min,v/750):25000/(1000-v)):log?min*Math.pow(max/min,v/1000):min+(max-min)*v/1000;
    const toSlider=v=>key==='focus'?(v==='infinity'?1000:v<=100?Math.log(v/min)/Math.log(100/min)*750:1000-25000/v):log?Math.log(v/min)/Math.log(max/min)*1000:(v-min)/(max-min)*1000;
    fields.set(key,{root,range,number,toSlider});
    const commit=value=>{
      if(value!=='infinity'){
        if(!Number.isFinite(value))return;
        value=Math.max(min,Math.min(max,value));if(key==='iso')value=Math.round(value/50)*50;
      }
      settings[key]=value;syncControls();
      if(key==='sensorW'||key==='sensorH')$('#sensor-preset').value='custom';
      queue();
    };
    if(key==='focus'){
      range.step='any';
      const scale=document.createElement('div');scale.className='focus-scale';scale.setAttribute('aria-hidden','true');scale.innerHTML='<span>0.3 m</span><span>100 m</span><span>\u221e</span>';root.querySelector('.parameter-inputs').append(scale);
    }
    range.addEventListener('input',()=>commit(fromSlider(Number(range.value))));
    range.addEventListener('pointerdown',()=>document.activeElement?.blur());
    number.addEventListener('change',()=>commit(Number(number.value)));
    number.addEventListener('focus',()=>number.select());number.addEventListener('keydown',e=>{if(e.key==='Enter')number.blur();});
    let touch=null;
    range.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch')return;e.preventDefault();touch={x:e.clientX,y:e.clientY,horizontal:false};range.setPointerCapture(e.pointerId);
    },{passive:false});
    range.addEventListener('pointermove',e=>{
      if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;
      if(!touch.horizontal){if(Math.abs(dy)>7&&Math.abs(dy)>Math.abs(dx))return;if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.3)return;touch.horizontal=true;}
      e.preventDefault();const rect=range.getBoundingClientRect();range.value=Math.max(0,Math.min(1000,(e.clientX-rect.left)/rect.width*1000));commit(fromSlider(Number(range.value)));
    },{passive:false});
    for(const event of ['pointerup','pointercancel'])range.addEventListener(event,()=>touch=null);
  }
}

function syncControls(){
  for(const [key,f] of fields){
    const infinity=key==='focus'&&settings[key]==='infinity';
    const position=/^target[ABC][XY]$/.test(key),distance=['targetA','subject','targetC'].includes(key);
    f.number.value=infinity?'':distance?Number(settings[key].toFixed(3)):position?Number(settings[key].toFixed(2)):settings[key];f.number.placeholder=infinity?'\u221e':'';f.range.value=f.toSlider(settings[key]);
    if(key==='focus'){
      f.range.setAttribute('aria-valuetext',infinity?'Infinity':`${fmt(settings.focus)} meters`);
      f.number.setAttribute('aria-label',infinity?'Focus distance value in meters, currently infinity':'Focus distance value in meters');
    }
  }
  for(const key of ['model','cocMode','blades'])$('#'+key).value=settings[key];
  for(const key of ['exposureLock','rgb','upright','diffraction'])$('#'+key).checked=settings[key];
  fields.get('thickness').root.style.opacity=settings.model==='singlet'?1:.45;fields.get('bending').root.style.opacity=settings.model==='singlet'?1:.45;
  for(const key of ['thickness','bending'])for(const el of [fields.get(key).range,fields.get(key).number])el.disabled=settings.model!=='singlet';
  fields.get('coc').root.hidden=settings.cocMode!=='custom';
  $('#rays').classList.toggle('active',settings.rays);
}

function queue(){clearTimeout(timer);$('#status').textContent='Updating optics...';timer=setTimeout(simulate,65);}
async function simulate(){
  const id=++requestId;controller?.abort();controller=new AbortController();
  try{
    const result=await engine.calculate(settings,controller.signal);if(id!==requestId)return;
    data=result;settings={...result.settings};syncControls();world.update(data);viewer.update(data);sensor.update(data);updateReadouts();drawAnalysis();
    if(!hasFit){viewer.fit();hasFit=true;}
    $('#status').textContent='Ready';document.body.dataset.ready='true';$('#viewer-error').hidden=true;$('#engine-loading').hidden=true;setEnabled(true);
  }catch(error){if(error.name==='AbortError')return;showError(error);}
}

function setEnabled(enabled){for(const selector of ['#controls','.viewer-toolbar','#sensor-panel'])$(selector).inert=!enabled;}
function showError(error){
  $('#status').textContent='Optics engine unavailable';document.body.dataset.ready='error';$('#engine-loading').hidden=true;
  const box=$('#viewer-error');box.textContent=error.message;const retry=document.createElement('button');retry.textContent='Reload demo';retry.onclick=()=>location.reload();box.append(document.createElement('br'),retry);box.hidden=false;
}

function updateReadouts(){
  const d=data,p=settings;const subject=d.targets[1];
  const range=d.dof.near_m?`${fmt(d.dof.near_m)}\u2013${d.dof.far_m?fmt(d.dof.far_m):'\u221e'} m`:'No real DOF';
  const metrics=[['Geometric DOF',range,`${fmt(d.dof.criterion_um,1)} \u00b5m criterion`],['Pupil diameter',`${fmt(d.aperture,1)} mm`,`Effective f/${fmt(d.effective_fnumber,2)}`],
    ['Target B blur',`${fmt(subject.blur_um,1)} \u00b5m`,`${fmt(subject.blur_um/p.pitch,1)} pixels, geometric`],['Airy diameter',`${fmt(d.diffraction.airy_um,1)} \u00b5m`,`${fmt(d.diffraction.airy_pixels,1)} pixels, ideal circular pupil`],
    ['Image distance',`${fmt(d.back_distance)} mm`,'From last vertex'],['Working f-number',`f/${fmt(d.working_fnumber,2)}`,'Finite-distance image cone'],
    ['Horizontal FOV',`${fmt(2*Math.atan(p.sensorW/(2*d.projection.K))*180/Math.PI,1)}\u00b0`,'Equivalent first-order projection'],['Sampling Nyquist',`${fmt(d.sensor.nyquist_lp_mm,1)}`,'line pairs / mm, sensor'],
    ['Image magnification',`${fmt(-d.projection.K/subject.distance,3)}\u00d7`,'Target B, inverted image'],['Actual focus',d.focus_state==='infinity'?'\u221e':d.effective_focus_m?`${fmt(d.effective_focus_m)} m`:'No real focus','Axial distance from front pupil']];
  $('#metrics').innerHTML=metrics.map(([name,value,note])=>`<div class="metric"><span>${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  $('#resolution').textContent=`${d.sensor.width_px} \u00d7 ${d.sensor.height_px} \u00b7 ${fmt(d.sensor.megapixels,1)} MP`;
  $('#pixel-scale').textContent=`${fmt(p.pitch,1)} \u00b5m / pixel`;
  $('#warnings').innerHTML='';for(const warning of d.warnings){const line=document.createElement('p');line.textContent=warning;$('#warnings').append(line);}
  $('#intrinsics').textContent=`K (raw sensor pixels)\n[ ${fmt(d.sensor.fx,1)}      0      ${fmt(d.sensor.cx,1)} ]\n[      0    ${fmt(d.sensor.fy,1)}   ${fmt(d.sensor.cy,1)} ]\n[      0         0         1 ]\n\nH  = ${fmt(d.principal_planes.front,2)} mm\nH\u2032 = ${fmt(d.principal_planes.back,2)} mm\nEFL at 550 nm = ${fmt(d.efl,2)} mm`;
  $('#prescription').innerHTML=d.surfaces.length?`<p>EFL is held at the selected focal length at 550 nm. Bending and thickness adjust the radii, so aberrations can change without changing that first-order focal length.</p><table><thead><tr><th>Surface</th><th>R / mm</th><th>z / mm</th><th>After</th></tr></thead><tbody>${d.surfaces.map((s,i)=>`<tr><td>${i+1}</td><td>${fmt(s.radius,2)}</td><td>${fmt(s.z,2)}</td><td>${s.after}</td></tr>`).join('')}</tbody></table><table><thead><tr><th>Wavelength</th><th>EFL / mm</th><th>Image z / mm</th></tr></thead><tbody>${d.chromatic.map(c=>`<tr><td>${fmt(c.wavelength,0)} nm</td><td>${fmt(c.efl,3)}</td><td>${fmt(c.image_z,3)}</td></tr>`).join('')}</tbody></table>`:'<p>No physical glass surfaces in the ideal model. Focal power is applied at one plane.</p>';
  $('#spot-note').textContent=p.model==='ideal'?'Ideal lens, no spherical or chromatic aberration. Defocus still spreads a point.':`RayOptics real-ray intersections; RMS spot radius ${d.spot_rms_um===null?'unavailable':fmt(d.spot_rms_um,1)+' \u00b5m'}. The scene preview does not include these glass aberrations.`;
  $('#footer-engine').textContent=`RayTracing ${d.versions.raytracing} \u00b7 RayOptics ${d.versions.rayoptics} \u00b7 browser worker`;
  $('#footer-values').textContent=`${fmt(d.efl,1)} mm \u00b7 f/${fmt(d.effective_fnumber,1)} \u00b7 ${fmt(d.sensor.megapixels,1)} MP \u00b7 educational prototype`;
  if(sensor.crop)$('#preview-note').textContent=`${sensor.width} \u00d7 ${sensor.height} native-pixel crop around target ${'ABC'[sensor.cropTarget]}, constrained to the physical sensor. Enlarging it reveals sampling, not extra optical detail.`;
  else $('#preview-note').textContent=`${sensor.width} \u00d7 ${sensor.height} display-resolution preview of ${d.sensor.width_px} \u00d7 ${d.sensor.height_px} sensor pixels. Use Native-pixel crop to inspect sampling.`;
  updateBlurReadouts();
  for(const [i,selector] of ['.near','.subject','.far'].entries()){
    const span=document.querySelector('.viewer-legend '+selector);const rgb=p.rgb&&d.surfaces.length;
    span.textContent=rgb?['486 nm','550 nm','656 nm'][i]:['Target A','Target B','Point C'][i];
    if(rgb){span.dataset.wavelength='true';span.style.setProperty('--ray-color',['#70aaff','#a7d693','#f29b83'][i]);}else{delete span.dataset.wavelength;span.style.removeProperty('--ray-color');}
  }
}

function updateBlurReadouts(){
  if(!data)return;const image=$('#sensor-image');
  const displayWidth=image.clientWidth?Math.min(image.clientWidth,image.clientHeight*image.width/image.height):301;
  $('#target-blur').innerHTML=`<table><thead><tr><th>Target</th><th title="Straight-line distance from the entrance-pupil centre">Range / m</th><th title="Depth along the optical axis, used for focus and blur">Axial / m</th><th>Blur / \u00b5m</th><th>Preview / px</th></tr></thead><tbody>${data.targets.map(t=>`<tr><td>${'ABC'[t.id]}</td><td>${fmt(t.radial_distance/1000)}</td><td>${fmt(t.distance/1000)}</td><td>${fmt(t.blur_um,1)}</td><td>${fmt(t.blur_um/1000/sensor.sensorW*displayWidth,1)}</td></tr>`).join('')}</tbody></table>`;
  for(const button of document.querySelectorAll('[data-focus]'))button.classList.toggle('selected',Math.abs(settings.focus-data.targets[Number(button.dataset.focus)].distance/1000)<.01);
  $('#point-note').textContent=`C is an emitting point light on a dark backing. Its defocused bokeh follows the selected ${settings.blades?settings.blades+'-sided':'circular'} aperture. The sensor image and pixel inset use geometric pupil blur ${settings.diffraction?'convolved with ideal circular Airy intensity':'without diffraction'}, not a coherent wavefront PSF. Brightness is illustrative.${sensor.pointVisibility===0?' Light C is hidden behind another object.':''}`;
}
function setView(mode){
  viewMode=mode;$('#viewer').dataset.mode=mode;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===mode));
  if(mode!=='sensor')viewer.setMode(mode);viewer.controls.enabled=mode!=='sensor';
  const info={system:['Complete optical path','Object-space distance and size compressed; glass and sensor in true mm.'],bench:['Lens bench','True millimeter scale; incoming rays clipped only for display.'],scene:['Scene in front of the camera','Scene dimensions in meters; camera body marks the entrance pupil.'],sensor:['Sensor image','Equivalent first-order projection. Geometric defocus is shown at this display scale.']};
  [$('#view-title').textContent,$('#scale-note').textContent]=info[mode];$('#selection-info').hidden=true;
  if(mode==='sensor')copyStage();
}
function copyStage(){const dest=$('#stage-image'),source=$('#sensor-image');if(dest.width!==source.width)dest.width=source.width;if(dest.height!==source.height)dest.height=source.height;dest.getContext('2d').drawImage(source,0,0);}

function baseChart(id){
  const canvas=$('#'+id),x=canvas.getContext('2d');x.clearRect(0,0,canvas.width,canvas.height);
  const color=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  x.fillStyle=color('--panel');x.fillRect(0,0,canvas.width,canvas.height);x.font='19px Arial';x.fillStyle=color('--muted');x.strokeStyle=color('--line');x.lineWidth=1;
  const box={l:64,r:canvas.width-20,t:15,b:canvas.height-46};x.beginPath();x.moveTo(box.l,box.t);x.lineTo(box.l,box.b);x.lineTo(box.r,box.b);x.stroke();return{canvas,x,box,color};
}
function drawCurve(chart,xx,yy,color,limits,logX=false,logY=false){
  const {x,box}=chart;const fx=v=>logX?Math.log10(Math.max(1e-9,v)):v,fy=v=>logY?Math.log10(Math.max(1,v)):v;
  const [xmin,xmax,ymin,ymax]=limits.map((v,i)=>i<2?fx(v):fy(v));
  const px=v=>box.l+(fx(v)-xmin)/(xmax-xmin)*(box.r-box.l),py=v=>box.b-(fy(v)-ymin)/(ymax-ymin)*(box.b-box.t);
  x.save();x.beginPath();x.rect(box.l,box.t,box.r-box.l,box.b-box.t);x.clip();x.strokeStyle=color;x.lineWidth=2.5;x.beginPath();xx.forEach((v,i)=>{if(i===0)x.moveTo(px(v),py(yy[i]));else x.lineTo(px(v),py(yy[i]));});x.stroke();x.restore();return{px,py};
}
function drawAnalysis(){
  const d=data,p=settings;
  const chart=baseChart('dof-chart'),{x,box}=chart;const dx=d.blur_curve.distance_m,dy=d.blur_curve.blur_um;
  const limits=[dx[0],dx.at(-1),1,Math.max(100,Math.max(...dy))];
  const coords=drawCurve(chart,dx,dy,chart.color('--accent'),limits,true,true);
  x.strokeStyle='#a9bd9e';x.setLineDash([7,6]);x.beginPath();x.moveTo(box.l,coords.py(d.dof.criterion_um));x.lineTo(box.r,coords.py(d.dof.criterion_um));x.stroke();x.setLineDash([]);
  for(const t of d.targets){x.fillStyle=['#78b6f2','#e2a375','#a8c581'][t.id];x.beginPath();x.arc(coords.px(t.distance/1000),coords.py(Math.max(1,t.blur_um)),5,0,Math.PI*2);x.fill();}
  x.fillStyle=chart.color('--muted');x.textAlign='center';x.fillText('Axial object depth (m, log)',(box.l+box.r)/2,chart.canvas.height-7);
  for(const v of [.5,1,2,3,5,10,20,50])if(v>=dx[0]&&v<=dx.at(-1))x.fillText(v,coords.px(v),box.b+23);
  x.textAlign='right';for(const v of [1,10,100,1000,10000])if(v<=limits[3])x.fillText(v,box.l-8,coords.py(v)+6);
  x.save();x.translate(18,(box.t+box.b)/2);x.rotate(-Math.PI/2);x.textAlign='center';x.fillText('Blur diameter (\u00b5m)',0,0);x.restore();
  const spot=baseChart('spot-chart'),sx=spot.x,b=spot.box;const [cx,cy]=d.spot_center;
  const extent=Math.max(3*p.pitch,d.diffraction.airy_um, ...d.spots.map(s=>Math.hypot(s.x-cx,s.y-cy)*1100));
  const scale=Math.min(b.r-b.l,b.b-b.t)/(2*extent),midX=(b.l+b.r)/2,midY=(b.t+b.b)/2;
  sx.strokeStyle=spot.color('--line');sx.beginPath();sx.moveTo(b.l,midY);sx.lineTo(b.r,midY);sx.moveTo(midX,b.t);sx.lineTo(midX,b.b);sx.stroke();
  sx.strokeStyle='#d1bd8d';sx.setLineDash([6,5]);sx.beginPath();sx.arc(midX,midY,d.diffraction.airy_um/2*scale,0,2*Math.PI);sx.stroke();sx.setLineDash([]);
  for(const s of d.spots){sx.fillStyle=p.rgb&&d.surfaces.length?(s.wavelength<500?'#70aaff':s.wavelength>600?'#f29b83':'#a7d693'):'#e5ac75';sx.beginPath();sx.arc(midX+(s.x-cx)*1000*scale,midY-(s.y-cy)*1000*scale,3,0,2*Math.PI);sx.fill();}
  sx.textAlign='center';sx.fillStyle=spot.color('--muted');sx.fillText(`Centered spot \u00b7 half-width ${fmt(extent,1)} \u00b5m`,(b.l+b.r)/2,spot.canvas.height-10);
  const airy=baseChart('airy-chart');const profile=d.diffraction;
  const acoords=drawCurve(airy,profile.axis_um,profile.psf,airy.color('--accent'),[profile.axis_um[0],profile.axis_um.at(-1),0,1.05]);
  airy.x.textAlign='center';airy.x.fillStyle=airy.color('--muted');airy.x.fillText('Image-space radius (\u00b5m)',(airy.box.l+airy.box.r)/2,airy.canvas.height-8);
  for(const v of [profile.axis_um[0],0,profile.axis_um.at(-1)])airy.x.fillText(fmt(v,0),acoords.px(v),airy.box.b+23);
  airy.x.textAlign='right';for(const v of [0,.5,1])airy.x.fillText(v,airy.box.l-8,acoords.py(v)+6);
  drawPixel();
}
function drawPixel(){
  const canvas=$('#pixel-image'),x=canvas.getContext('2d'),cells=data.diffraction.micro,cell=canvas.height/41,pad=(canvas.width-canvas.height)/2;
  x.fillStyle='#111619';x.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<41;y++)for(let z=0;z<41;z++){const value=Math.pow(cells[y][z],.38);x.fillStyle=`rgb(${Math.round(30+225*value)},${Math.round(39+188*value)},${Math.round(47+101*value)})`;x.fillRect(pad+z*cell,y*cell,cell+.5,cell+.5);}
  x.strokeStyle='#74838b44';x.lineWidth=.45;x.beginPath();for(let i=0;i<=41;i++){x.moveTo(pad+i*cell,0);x.lineTo(pad+i*cell,canvas.height);x.moveTo(pad,i*cell);x.lineTo(pad+canvas.height,i*cell);}x.stroke();
}

function setupEvents(){
  for(const key of ['model','cocMode','blades'])$('#'+key).onchange=e=>{settings[key]=key==='blades'?Number(e.target.value):e.target.value;syncControls();queue();};
  for(const key of ['exposureLock','rgb','upright','diffraction'])$('#'+key).onchange=e=>{settings[key]=e.target.checked;queue();};
  const presets={full:[36,24],aps:[23.5,15.7],mft:[17.3,13],small:[13.2,8.8]};
  $('#sensor-preset').onchange=e=>{if(presets[e.target.value]){[settings.sensorW,settings.sensorH]=presets[e.target.value];syncControls();queue();}};
  $('#pixel-crop').onchange=e=>{sensor.setCrop(e.target.checked);updateReadouts();};
  $('#crop-target').onchange=e=>{sensor.cropTarget=Number(e.target.value);$('#pixel-crop').checked=true;sensor.setCrop(true);updateReadouts();};
  $('#inspect-point').onclick=()=>{sensor.cropTarget=2;$('#crop-target').value='2';$('#pixel-crop').checked=true;sensor.setCrop(true);updateReadouts();setView('sensor');};
  $('#bokeh-demo').onclick=()=>{
    settings={...settings,model:'ideal',focal:85,fnumber:2,focus:.52,lightBrightness:300,sensorW:36,sensorH:24,pitch:6,shiftX:0,shiftY:0,sensorOffset:0,exposureLock:true,upright:true};
    for(const key of ['targetA','subject','targetC',...['A','B','C'].flatMap(letter=>['X','Y'].map(axis=>`target${letter}${axis}`))])settings[key]=defaults[key];
    sensor.crop=true;sensor.cropTarget=2;$('#pixel-crop').checked=true;$('#crop-target').value='2';$('#sensor-preset').value='full';syncControls();queue();setView('sensor');
  };
  for(const button of document.querySelectorAll('[data-focus]'))button.onclick=()=>{settings.focus=Math.max(.3,data.targets[Number(button.dataset.focus)].distance/1000);syncControls();queue();};
  $('#blur-demo').onclick=()=>{settings.focal=50;settings.fnumber=1.4;settings.focus=Math.max(.3,data.targets[0].distance/1000);sensor.crop=false;$('#pixel-crop').checked=false;syncControls();queue();setView('sensor');};
  $('#rays').onclick=()=>{settings.rays=!settings.rays;syncControls();queue();};
  $('#animate').onclick=()=>{viewer.animated=!viewer.animated;$('#animate').classList.toggle('active',viewer.animated);$('#animate img').src=asset(viewer.animated?'icons/pause.svg':'icons/play.svg');};
  $('#fit').onclick=()=>viewer.fit();
  for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>setView(button.dataset.view);
  $('#sensor-image').title='Open large sensor view';$('#sensor-image').onclick=()=>setView('sensor');
  $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#viewer').requestFullscreen();}catch(e){$('#status').textContent='Fullscreen is unavailable in this browser.';}};
  document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;$('#fullscreen img').src=asset(active?'icons/x.svg':'icons/maximize.svg');$('#fullscreen').title=active?'Exit fullscreen':'Fullscreen viewer';$('#fullscreen').setAttribute('aria-label',$('#fullscreen').title);});
  $('#reset').onclick=()=>{settings={...defaults};sensor.crop=false;sensor.cropTarget=2;$('#pixel-crop').checked=false;$('#crop-target').value='2';syncControls();$('#sensor-preset').value='full';history.replaceState(null,'',location.pathname);queue();};
  $('#theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('theme',document.documentElement.dataset.theme);}catch{}if(data){viewer.update(data);drawAnalysis();}};
  $('#copy').onclick=async()=>{const url=new URL(location.href);url.hash='s='+encodeURIComponent(JSON.stringify(settings));await navigator.clipboard.writeText(url.href);$('#status').textContent='Settings link copied';};
  for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{document.body.dataset.mobilePanel=button.dataset.panel;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('selected',b===button));};
  $('#enlarge-image').onclick=()=>{$('#image-dialog').showModal();copyLarge();};$('#close-image').onclick=()=>$('#image-dialog').close();
  $('#image-dialog').onclick=e=>{if(e.target===$('#image-dialog'))$('#image-dialog').close();};
  window.addEventListener('keydown',e=>{if(e.key==='Escape')$('#selection-info').hidden=true;});
  new ResizeObserver(()=>updateBlurReadouts()).observe($('#sensor-image'));
}
function copyLarge(){const image=$('#large-image'),source=$('#sensor-image');image.width=source.width;image.height=source.height;image.getContext('2d').drawImage(source,0,0);}

async function start(){
  try{
    setEnabled(false);defaults=await(await fetch(asset('defaults.json'))).json();settings={...defaults};
    if(location.hash.startsWith('#s=')){try{
      const saved=JSON.parse(decodeURIComponent(location.hash.slice(3)));
      if(saved.sceneVersion===undefined){
        // Old links stored axial depths with fixed lateral coordinates.
        const b=saved.subject??3,old=[saved.targetA??b*.6,b,saved.targetC??b*2.4];
        for(const [i,[letter,key,x,y]] of [['A','targetA',-.54,-.09],['B','subject',0,.165],['C','targetC',.84,.06]].entries()){
          const z=old[i];saved[key]=Math.hypot(x,y,z);saved[`target${letter}X`]=Math.atan2(x,z)*180/Math.PI;saved[`target${letter}Y`]=Math.atan2(y,z)*180/Math.PI;
        }
        saved.sceneVersion=2;
      }
      settings={...settings,...saved};
    }catch{history.replaceState(null,'',location.pathname);}}
    buildControls();syncControls();world=new TeachingScene();
    viewer=new OpticalViewer($('#optical-canvas'),$('#labels'),world,$('#sensor-image'),(info,target)=>{
      const box=$('#selection-info');box.innerHTML='';const h=document.createElement('strong');h.textContent=info[0];const p=document.createElement('p');p.textContent=info[1];box.append(h,p);box.hidden=false;
      if(target!==undefined){const button=document.createElement('button');button.textContent='Focus here';button.style.marginTop='8px';button.onclick=()=>{settings.focus=Math.max(.3,data.targets[target].distance/1000);syncControls();queue();};box.append(button);}
    });
    sensor=new SensorRenderer($('#sensor-image'),world,(count,total)=>{
      $('#samples').textContent=`${count} / ${total} samples`;viewer.texture.needsUpdate=true;
      if($('#image-dialog').open)copyLarge();if(viewMode==='sensor')copyStage();document.body.dataset.samples=String(count);
    });
    engine=new PhysicsClient(message=>{$('#status').textContent=message;if(!data)$('#engine-loading').textContent=message;});
    setupEvents();await simulate();
    const frame=time=>{if(viewMode!=='sensor')viewer.frame(time);sensor.step();requestAnimationFrame(frame);};requestAnimationFrame(frame);
    window.opticsLab={get data(){return data;},get settings(){return{...settings};},get camera(){return viewer.camera.position.toArray();},get renderer(){return viewer.renderer;},get sensor(){return sensor;},set:async(values)=>{settings={...settings,...values};syncControls();await simulate();},viewer};
  }catch(error){showError(new Error(`Optics Lab could not start: ${error.message}`));}
}
start();
