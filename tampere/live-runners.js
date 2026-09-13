const status=document.getElementById('runners-status');
const rows=document.getElementById('registered-runners');
const refreshButton=document.getElementById('refresh-runners');
const refreshIntervalMs=5000;
const courseNames={'10k':'10 km',half:'Half marathon',full:'Marathon',unknown:'Not specified'};
const statusNames={invalid_link:'Incomplete or invalid LiveTrack link',waiting_for_link:'Waiting for a LiveTrack link',link_received_reader_pending:'Link received · GPS connection pending',waiting_for_position:'Fetching first location…',live:'Live',stale:'Last known location',ended:'Activity ended',session_unavailable:'Session ended or sharing unavailable',connection_unavailable:'Garmin connection unavailable'};
let endpoint,timer,request,hasLoaded=false,latest=[];
const hasPosition=r=>r.position&&Number.isFinite(r.position.lat)&&Number.isFinite(r.position.lng)&&Math.abs(r.position.lat)<=90&&Math.abs(r.position.lng)<=180;
function publish(){document.dispatchEvent(new CustomEvent('tampere:runners',{detail:latest}));}
document.addEventListener('tampere:map-ready',publish);

function render(data){
  if(!Array.isArray(data.runners))throw Error('Invalid runner response.');
  const content=document.createDocumentFragment();
  for(const runner of data.runners){
    const row=document.createElement('tr');
    const time=hasPosition(runner)?new Date(runner.position.timestamp):null;
    const label=(statusNames[runner.status]||'Location unavailable')+(time&&Number.isFinite(time.getTime())?' · '+time.toLocaleTimeString(): '');
    for(const text of [runner.name,courseNames[runner.course]||'Not specified',label]){
      const cell=document.createElement('td');cell.textContent=text;row.append(cell);
    }
    const action=document.createElement('td');
    if(hasPosition(runner)){
      const button=document.createElement('button');button.type='button';button.textContent='Follow';button.setAttribute('aria-label','Follow '+runner.name);
      button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('tampere:follow-runner',{detail:runner.id})));
      action.append(button);
    }
    row.append(action);
    content.append(row);
  }
  rows.replaceChildren(content);
  document.getElementById('runner-table').hidden=!data.runners.length;
  document.getElementById('position-reader-note').hidden=data.positionReaderReady===true;
  const count=data.runners.length;
  status.textContent=count?`${count} shared runner session${count===1?'':'s'} · Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})} · Checks for new GPS every 5 seconds.`:'No sessions received yet. Email your LiveTrack session to live@track.santerihukari.com to appear here automatically.';
  status.dataset.error='false';hasLoaded=true;latest=data.runners;publish();
}

async function refresh(){
  clearTimeout(timer);
  if(!endpoint||request||document.hidden)return;
  const current=new AbortController();request=current;refreshButton.disabled=true;
  const timeout=setTimeout(()=>current.abort(),12000);
  try{
    const response=await fetch(endpoint,{cache:'no-store',credentials:'omit',signal:current.signal});
    if(!response.ok)throw Error('Runner request failed.');
    const data=await response.json();
    if(!current.signal.aborted)render(data);
  }catch{
    if(!document.hidden){
      status.textContent=hasLoaded?'Runner updates are temporarily unavailable. The list below may be out of date; retrying automatically.':'Could not load registered runners. Retrying automatically.';
      status.dataset.error='true';
    }
  }finally{
    clearTimeout(timeout);request=null;refreshButton.disabled=false;
    if(!document.hidden)timer=setTimeout(refresh,refreshIntervalMs);
  }
}

try{
  const value=window.TAMPERE_CONFIG?.workerUrl;
  if(typeof value!=='string'||!value.trim())throw Error('Missing Worker URL.');
  const url=new URL(value);
  const local=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!local)||url.username||url.password||url.search||url.hash)throw Error('Invalid Worker URL.');
  endpoint=url.origin+'/api/runners';
  refreshButton.addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearTimeout(timer);request?.abort();}
    else refresh();
  });
  refresh();
}catch{
  refreshButton.disabled=true;status.textContent='Runner sharing has not been configured by the site owner yet.';
}
