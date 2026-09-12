const $=id=>document.getElementById(id);
let worker='',admin='';
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function endpoint(value){
  const url=new URL(value.trim());
  if(url.username||url.password||url.search||url.hash)throw Error('Use the Worker address without credentials, query strings or fragments.');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Use an HTTPS Worker address.');
  return url.origin;
}
async function api(path,method='GET',body){
  const response=await fetch(worker+path,{method,headers:{Authorization:'Bearer '+admin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'The Worker request failed.');return result;
}
async function refresh(){
  const {runners}=await api('/api/admin/runners');$('runners').replaceChildren();$('session-runner').replaceChildren();
  for(const runner of runners){
    const tr=document.createElement('tr');
    const state={invalid_link:'Incomplete or invalid LiveTrack link',live:'Live',stale:'Last known location',ended:'Activity ended',waiting_for_position:'Fetching location',session_unavailable:'Sharing unavailable',connection_unavailable:'Connection unavailable',waiting_for_link:'Waiting for link'}[runner.status]||'Link received';
    for(const value of [runner.name,runner.course==='unknown'?'Not specified':runner.course,state]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    const td=document.createElement('td'),button=document.createElement('button');button.textContent='Remove';
    button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/admin/runners/'+runner.id,'DELETE');await refresh();status('Runner and private session removed.');}catch(e){status(e.message,true);button.disabled=false;}});td.append(button);tr.append(td);$('runners').append(tr);
    $('session-runner').add(new Option(runner.name,runner.id));
  }
  $('session').hidden=!runners.length;
}
$('connect').addEventListener('submit',async e=>{
  e.preventDefault();$('manage').hidden=true;
  try{
    const nextWorker=endpoint($('worker-url').value);
    admin=$('admin-token').value||(nextWorker===worker?admin:'');worker=nextWorker;
    await refresh();$('admin-token').value='';$('admin-token').required=false;$('manage').hidden=false;$('revoke-worker').value=worker;
    status('Worker connected. Emailed sessions appear automatically. Manual registration is optional.');
  }catch(error){admin='';$('admin-token').required=true;status(error.message+' Check the Worker URL, ADMIN_TOKEN, and ALLOWED_ORIGINS.',true);}
});
$('register').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{
    const result=await api('/api/admin/runners','POST',{name:$('name').value,course:$('course').value,publicConsent:$('consent').checked});
    $('participant-result').textContent=result.name+' registered until '+new Date(result.expiresAt).toLocaleString()+'.\n'+(result.receivingAddress?'Add this recipient in Garmin LiveTrack: '+result.receivingAddress:'Email is not configured yet. Paste a test LiveTrack link below.')+'\nSave this private sharing code to revoke access: '+result.sharingCode;
    $('register').reset();await refresh();$('session-runner').value=result.id;status('Runner registered.');
  }catch(error){status(error.message,true);}finally{button.disabled=false;}
});
$('import-session').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{await api('/api/admin/sessions','POST',{url:$('import-url').value});$('import-url').value='';await refresh();status('Session added. Open the map to follow the latest GPS position.');}
  catch(error){status(error.message,true);}finally{button.disabled=false;}
});
$('session').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{const result=await api('/api/admin/runners/'+$('session-runner').value+'/session','POST',{url:$('session-url').value});$('session-url').value='';await refresh();status(result.message);}
  catch(error){status(error.message,true);}finally{button.disabled=false;}
});
$('revoke').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const target=endpoint($('revoke-worker').value);
    const response=await fetch(target+'/api/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sharingCode:$('sharing-code').value}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Removal failed.');$('sharing-code').value='';status('Sharing revoked. The runner and their session have been removed.');if(admin)await refresh();
  }catch(error){status(error.message,true);}
});
$('worker-url').value=window.TAMPERE_CONFIG?.workerUrl||'';
$('revoke-worker').value=$('worker-url').value;
