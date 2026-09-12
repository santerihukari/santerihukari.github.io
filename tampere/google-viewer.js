import {nominal,prepareRoute,pointAt,bearing} from './route-math.js';
const $=id=>document.getElementById(id);
let routes,route,map,line,marker,lib,position=0,playing=false,lastTime=0,lastDraw=0,heading=null;
let loading=false,failed=false,ready=false,timeout;
let liveRunners=[],followedRunner=null,autoFollowed=false;
const liveMarkers=new Map();
const hasLivePosition=r=>r.position&&Number.isFinite(r.position.lat)&&Number.isFinite(r.position.lng)&&Math.abs(r.position.lat)<=90&&Math.abs(r.position.lng)<=180;
function syncRunners(){
  if(!map||!lib)return;
  const current=new Set();
  for(const runner of liveRunners.filter(hasLivePosition)){
    current.add(runner.id);
    let pin=liveMarkers.get(runner.id);
    if(!pin){pin=new lib.Marker3DElement({position:{lat:runner.position.lat,lng:runner.position.lng,altitude:3},altitudeMode:lib.AltitudeMode.RELATIVE_TO_GROUND,drawsWhenOccluded:true});map.append(pin);liveMarkers.set(runner.id,pin);}
    pin.position={lat:runner.position.lat,lng:runner.position.lng,altitude:3};
    pin.label=runner.name+(runner.status==='live'?' · Live':' · Last known');
  }
  for(const [id,pin] of liveMarkers)if(!current.has(id)){pin.remove();liveMarkers.delete(id);}
  if(followedRunner&&!current.has(followedRunner))returnToRoute();
  if(!autoFollowed&&!playing&&ready&&current.size){autoFollowed=true;followRunner(liveRunners.find(hasLivePosition).id);}
  else if(followedRunner){drawCamera(0);updateHUD();}
}
function followRunner(id){
  if(!liveRunners.some(r=>r.id===id&&hasLivePosition(r)))return;
  followedRunner=id;autoFollowed=true;playing=false;heading=null;$('play').textContent='Play route';
  $('live-focus').hidden=false;drawCamera(0);updateHUD();
}
function returnToRoute(){followedRunner=null;$('live-focus').hidden=true;updateHUD();drawCamera(0);}
document.addEventListener('tampere:runners',event=>{liveRunners=Array.isArray(event.detail)?event.detail:[];syncRunners();});
document.addEventListener('tampere:follow-runner',event=>followRunner(event.detail));
$('return-to-route').addEventListener('click',returnToRoute);
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
const configuredKey=typeof window.TAMPERE_CONFIG?.googleMapsApiKey==='string'?window.TAMPERE_CONFIG.googleMapsApiKey.trim():'';
const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
$('key-form').hidden=Boolean(configuredKey)||!localPreview;
if(!configuredKey)status(localPreview?'Paste your key above to test the map locally.':'The Google map has not been configured by the site owner yet.',!localPreview);
$('allowed-origin').textContent=location.origin+'/*';
if(location.protocol==='file:')status('Open this page through http://localhost:8767/ so Google can verify the key’s website restriction.',true);
const routeData=fetch('routes.json').then(r=>{if(!r.ok)throw Error('Route data could not load.');return r.json();});
routeData.catch(e=>status(e.message,true));

function fail(message){failed=true;ready=false;playing=false;loading=false;clearTimeout(timeout);$('play').disabled=true;$('progress').disabled=true;$('load-map').disabled=false;status(message,true);}
window.gm_authFailure=()=>fail('Google rejected the key. Check billing, enable Maps JavaScript API, and allow '+location.origin+'/*. After changing the key or its settings, reload this page.');
async function loadGoogle(key){
  if(map||loading)return;
  if(!key.trim()){status('Paste your Google Maps API key first.',true);return;}
  if(location.protocol==='file:'){status('Use http://localhost:8767/ for this page; opening the file directly may block a restricted key.',true);return;}
  if(document.getElementById('google-maps-script')){status('Reload this page before trying a different key.',true);return;}
  loading=true;failed=false;$('load-map').disabled=true;status('Loading Google 3D and the official courses…');
  timeout=setTimeout(()=>fail('Google 3D is taking too long to load. Check the key’s restrictions, billing, and browser network access, then reload.'),45000);
  try{
    routes=await routeData;
    await new Promise((resolve,reject)=>{
      window.initTampereMaps=resolve;
      const script=document.createElement('script');script.id='google-maps-script';script.async=true;
      const params=new URLSearchParams({key:key.trim(),loading:'async',libraries:'maps3d',v:'weekly',callback:'initTampereMaps',auth_referrer_policy:'origin'});
      script.src='https://maps.googleapis.com/maps/api/js?'+params;
      script.onerror=()=>reject(Error('Google Maps could not be reached. Check your internet connection and content blockers.'));
      document.head.append(script);
    });
    if(failed)return;
    lib=await google.maps.importLibrary('maps3d');
    route=prepareRoute(routes[$('course').value]);
    map=new lib.Map3DElement({center:{...pointAt(route,0),altitude:120},range:300,tilt:65,mode:lib.MapMode.SATELLITE,description:'Tampere Maraton course fly-through'});
    map.addEventListener('gmp-error',()=>fail('Google 3D failed to initialize. Check the API key, billing and WebGL support, then reload.'));
    map.addEventListener('gmp-steadychange',event=>{
      if(!event.isSteady||failed||ready)return;
      ready=true;loading=false;clearTimeout(timeout);
      $('key-form').hidden=true;$('google-key').value='';$('play').disabled=false;$('progress').disabled=false;
      status('Google 3D ready. Select a course and press Play route.');drawCamera(0);document.body.dataset.mapReady='true';syncRunners();document.dispatchEvent(new Event('tampere:map-ready'));
    });
    $('map').append(map);
    line=new lib.Polyline3DElement({altitudeMode:lib.AltitudeMode.CLAMP_TO_GROUND,strokeColor:'#ffcf44',strokeWidth:6,outerColor:'#26382d',outerWidth:.25,drawsOccludedSegments:true,geodesic:true});
    marker=new lib.Marker3DElement({position:{...pointAt(route,0),altitude:2},altitudeMode:lib.AltitudeMode.RELATIVE_TO_GROUND,label:'Route position'});
    map.append(line,marker);setRoute();requestAnimationFrame(frame);
  }catch(e){fail(e.message||'The Google map could not load.');}
}
function setRoute(){
  if(!routes)return;
  followedRunner=null;$('live-focus').hidden=true;
  playing=false;position=0;heading=null;route=prepareRoute(routes[$('course').value]);
  if(line)line.path=route.points.map(([lng,lat])=>({lng,lat}));
  $('progress').max=String(nominal[$('course').value]);$('play').textContent='Play route';updateHUD();drawCamera(0);
}
function updateHUD(){
  if(!route)return;
  const live=liveRunners.find(r=>r.id===followedRunner);
  if(live){
    $('distance').textContent=Number.isFinite(live.distanceMeters)?(live.distanceMeters/1000).toFixed(2)+' km tracked':'Live location';
    $('stage').textContent=live.status==='live'?'Following live GPS':'Showing last known GPS position';
    $('live-focus-label').textContent='Following '+live.name+' · GPS '+new Date(live.position.timestamp).toLocaleTimeString();
    return;
  }
  const key=$('course').value,total=nominal[key],distance=position/route.total*total;
  $('progress').value=String(distance);$('progress').setAttribute('aria-valuetext',(distance/1000).toFixed(2)+' kilometres');
  $('distance').textContent=(distance/1000).toFixed(2)+' / '+(total/1000).toFixed(2)+' km';
  $('stage').textContent=position>=route.total?'Finish · Ratina stadium':position<1?(key==='10k'?'Start · Aleksandra Siltasen puisto':'Start · Ratina stadium'):playing?'Following the course':'Paused';
}
function drawCamera(dt){
  if(!map||!route||!ready)return;
  const live=liveRunners.find(r=>r.id===followedRunner&&hasLivePosition(r));
  if(live){
    const eye=$('camera').value==='eye';
    map.flyCameraTo({endCamera:{center:{lat:live.position.lat,lng:live.position.lng,altitude:1.7},heading:live.position.heading??0,tilt:eye?88:60,range:eye?0:Math.max(60,Number($('height').value)*2),altitudeMode:lib.AltitudeMode.RELATIVE_TO_GROUND},durationMillis:500});
    marker.hidden=true;return;
  }
  const p=pointAt(route,position),before=pointAt(route,position-8),ahead=pointAt(route,position+20);
  const target=bearing(before,ahead);
  if(heading===null||!playing)heading=target;
  else heading+=Math.atan2(Math.sin((target-heading)*Math.PI/180),Math.cos((target-heading)*Math.PI/180))*180/Math.PI*Math.min(1,dt*6);
  const view=$('camera').value,h=Number($('height').value);
  let camera={center:{...p,altitude:1.7},heading:(heading%360+360)%360,tilt:view==='eye'?88:60,range:view==='eye'?0:h/Math.cos(Math.PI/3),altitudeMode:lib.AltitudeMode.RELATIVE_TO_GROUND};
  if(view==='overview'){
    const xs=route.points.map(p=>p[0]),ys=route.points.map(p=>p[1]);
    const west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);
    const aspect=$('map').clientWidth/$('map').clientHeight;
    const span=Math.max((east-west)*111195*Math.cos(61.5*Math.PI/180)/aspect,(north-south)*111195);
    camera={center:{lat:(south+north)/2,lng:(west+east)/2,altitude:0},heading:0,tilt:0,range:span/2/Math.tan(35*Math.PI/360)*1.18,altitudeMode:lib.AltitudeMode.RELATIVE_TO_GROUND};
  }
  map.flyCameraTo({endCamera:camera,durationMillis:0});
  marker.position={...p,altitude:2};marker.hidden=view==='eye';
}
function frame(time){
  const dt=lastTime?Math.min((time-lastTime)/1000,.1):0;lastTime=time;
  if(playing&&ready){
    position=Math.min(route.total,position+dt*(1000/360)*Number($('speed').value)*route.total/nominal[$('course').value]);
    if(time-lastDraw>=50||position>=route.total){drawCamera((time-lastDraw)/1000);updateHUD();lastDraw=time;}
    if(position>=route.total){playing=false;$('play').textContent='Replay route';updateHUD();}
  }
  requestAnimationFrame(frame);
}
$('key-form').addEventListener('submit',e=>{e.preventDefault();loadGoogle($('google-key').value);});
$('play').addEventListener('click',()=>{if(followedRunner)returnToRoute();autoFollowed=true;if(position>=route.total){position=0;heading=null;}playing=!playing;$('play').textContent=playing?'Pause':'Play route';lastDraw=performance.now();drawCamera(0);updateHUD();});
$('course').addEventListener('change',setRoute);
$('progress').addEventListener('input',()=>{if(!route)return;const selectedPosition=Number($('progress').value);if(followedRunner)returnToRoute();autoFollowed=true;position=selectedPosition/nominal[$('course').value]*route.total;heading=null;if(position>=route.total){playing=false;$('play').textContent='Replay route';}else if(!playing)$('play').textContent='Play route';drawCamera(0);updateHUD();});
$('camera').addEventListener('change',()=>drawCamera(0));
$('height').addEventListener('input',()=>{$('height-value').textContent=$('height').value+' m';$('camera').value='follow';drawCamera(0);});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden&&playing){playing=false;$('play').textContent='Play route';updateHUD();}});
new ResizeObserver(()=>drawCamera(0)).observe($('map'));
if(configuredKey)loadGoogle(configuredKey);
