const root=document.getElementById('t4Engine');
try{await import('./app.mjs');}
catch(error){
  root.dataset.state='error';root.querySelector('#loading').hidden=true;
  const message=root.querySelector('#error');message.hidden=false;
  message.textContent=`The 3D viewer is unavailable: ${error.message}. Try a browser with WebGL enabled, or open the project notes.`;
  root.querySelector('#parameter-status').textContent='Assembly unavailable';
  for(const button of root.querySelectorAll('button,input,select'))button.disabled=true;
}
