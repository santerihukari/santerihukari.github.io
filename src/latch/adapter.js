export function setupLatch({renderer, viewport, read, restore, available, invalidate}) {
  const root = document.getElementById('latchWorkbench');
  const size = () => root.style.setProperty('--tool-height', `${Math.max(0, (visualViewport?.height || innerHeight) - Math.max(0, root.getBoundingClientRect().top) - 8)}px`);
  const theme = () => renderer.setClearColor(getComputedStyle(viewport).backgroundColor);
  new MutationObserver(theme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  window.addEventListener('resize', size); visualViewport?.addEventListener('resize', size);
  document.fonts?.ready.then(size);
  theme(); size();
  const button = document.createElement('button'); button.type='button'; button.id='latch-share'; button.disabled=true; button.title='Copy model link'; button.setAttribute('aria-label','Copy model link');
  const icon=document.createElement('img');icon.src=new URL('../../assets/icons/link.svg',import.meta.url).href;icon.alt='';button.append(icon);
  root.querySelector('.exports').append(button);
  button.addEventListener('click', async()=>{
    if(!available())return;
    const url=new URL(location.href);url.hash=`latch-v3=${encodeURIComponent(JSON.stringify(read()))}`;
    try {await navigator.clipboard.writeText(url.href);button.title='Model link copied';}
    catch {const dialog=document.createElement('dialog'),input=document.createElement('input'),close=document.createElement('button');input.value=url.href;input.readOnly=true;close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(input,close);root.append(dialog);dialog.showModal();input.select();dialog.addEventListener('close',()=>dialog.remove());}
  });
  const hydrate=(event)=>{
    if(!location.hash){if(event)try{restore(read());}catch(e){invalidate(e.message);}return;}
    try {
      if(!location.hash.startsWith('#latch-v3=')||location.hash.length>12000)throw new Error('Unsupported model link');
      const p=JSON.parse(decodeURIComponent(location.hash.slice(10))), keys=Object.keys(read());
      if(!p||Array.isArray(p)||Object.keys(p).length!==keys.length||keys.some(key=>!Object.hasOwn(p,key)))throw new Error('Incomplete model link');
      restore(p);
    }catch(e){invalidate(e.message);}
  };
  window.addEventListener('hashchange',hydrate);hydrate();
  const update=()=>{button.disabled=!available();};
  update();
  return {update};
}
