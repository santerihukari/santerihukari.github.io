export class PhysicsClient{
  constructor(onProgress){
    const url=new URL('./physics-worker.mjs',import.meta.url);
    url.searchParams.set('v',document.documentElement.dataset.assetVersion||'1');
    this.worker=new Worker(url,{type:'module'});this.pending=new Map();this.nextId=0;
    this.worker.onmessage=({data})=>{
      if(data.type==='progress'){onProgress?.(data.message);return;}
      const job=this.pending.get(data.id);if(!job)return;this.pending.delete(data.id);job.cleanup();
      if(data.type==='result')job.resolve(data.result);
      else if(data.type==='superseded')job.reject(new DOMException('Superseded','AbortError'));
      else job.reject(new Error(data.message||'Optics calculation failed'));
    };
    this.worker.onerror=event=>{event.preventDefault();this.fail(new Error(event.message||'Browser optics worker failed'));};
    this.worker.onmessageerror=()=>this.fail(new Error('Browser optics message could not be decoded'));
  }
  fail(error){for(const job of this.pending.values()){job.cleanup();job.reject(error);}this.pending.clear();}
  calculate(settings,signal){
    if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{
      const abort=()=>{const job=this.pending.get(id);if(job){this.pending.delete(id);job.cleanup();reject(new DOMException('Aborted','AbortError'));}};
      const timer=setTimeout(()=>{if(this.pending.has(id)){this.pending.delete(id);cleanup();reject(new Error('Loading the browser optics engine timed out. Check the connection and retry.'));}},120000);
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      this.pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});
      this.worker.postMessage({type:'simulate',id,settings});
    });
  }
  dispose(){this.worker.terminate();this.fail(new DOMException('Closed','AbortError'));}
}
