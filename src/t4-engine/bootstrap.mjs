const root=document.getElementById('t4Engine');
try{
  if(root.dataset.uiSchema!=='2')throw new Error('This viewer page has been updated. Reload it to load the matching controls.');
  const app=new URL('./app.mjs',import.meta.url),version=new URL(import.meta.url).searchParams.get('v');
  if(version)app.searchParams.set('v',version);
  await import(app.href);
}
catch(error){
  root.dataset.state='error';root.querySelector('#loading').hidden=true;
  const message=root.querySelector('#error');message.hidden=false;
  message.textContent=/webgl|graphics context/i.test(error.message)?
    'The 3D viewer requires WebGL. Try a browser with WebGL enabled, or read the project notes.':
    `The 3D viewer could not start. ${error.message}`;
  const actions=document.createElement('div');actions.className='engine-error-actions';
  const reload=document.createElement('a'),url=new URL(location.href);url.searchParams.set('viewer-update',String(Date.now()));
  reload.href=url.href;reload.textContent='Reload viewer';
  const notes=document.createElement('a');notes.href=new URL('../../projects/vw-t4-engine-simulation/',import.meta.url).href;notes.textContent='Project notes';
  actions.append(reload,notes);message.append(actions);
  root.querySelector('#parameter-status').textContent='Assembly unavailable';
  for(const button of root.querySelectorAll('button,input,select'))button.disabled=true;
}
