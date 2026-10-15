import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerClient, cancelled} from '../../../src/legacy_library/worker-client.mjs';

class FakeWorker {
  listeners=new Map(); requests=[]; terminated=false;
  addEventListener(type,handler){this.listeners.set(type,handler);}
  postMessage(payload){this.requests.push(payload);}
  terminate(){this.terminated=true;}
  message(data){this.listeners.get('message')({data});}
}
function setup(options={}){
  const workers=[],progress=[];
  const client=createWorkerClient(()=>{const worker=new FakeWorker();workers.push(worker);return worker;},{onProgress:message=>progress.push(message),...options});
  return{client,workers,progress};
}
test('progress does not finish a build and an idle kernel is reused',async()=>{
  const {client,workers,progress}=setup(),pending=client.request({type:'build',revision:0}),id=workers[0].requests[0].id;
  workers[0].message({id,type:'progress',stage:'geometry'});
  assert(client.active);assert.equal(progress[0].stage,'geometry');
  workers[0].message({id,mesh:'first'});assert.equal((await pending).mesh,'first');assert(!client.active);
  const next=client.request({type:'stl',revision:0});assert.equal(workers.length,1);
  workers[0].message({id:workers[0].requests[1].id,bytes:'stl'});assert.equal((await next).bytes,'stl');client.cancel();
});
test('superseding parameters terminates obsolete calculation and ignores late replies',async()=>{
  const {client,workers}=setup(),old=client.request({type:'build',revision:0});
  const rejected=assert.rejects(old,error=>cancelled(error));client.cancel();await rejected;
  assert(workers[0].terminated);assert(!client.active);
  const next=client.request({type:'build',revision:1});assert.equal(workers.length,2);
  workers[0].message({id:workers[0].requests[0].id,mesh:'stale'});assert(client.active);
  workers[1].message({id:workers[1].requests[0].id,mesh:'latest'});assert.equal((await next).mesh,'latest');client.cancel();
});
test('timeout is recoverable and cancels the worker rather than leaving unresolved work',async()=>{
  const {client,workers}=setup({timeoutMs:15});
  await assert.rejects(client.request({type:'build'}),error=>error.code==='BUILD_TIMEOUT');
  assert(workers[0].terminated);assert(!client.active);
  const retry=client.request({type:'build'});workers[1].message({id:workers[1].requests[0].id,mesh:'retry'});
  assert.equal((await retry).mesh,'retry');client.cancel();
});
test('worker errors reject outstanding requests and allow a fresh kernel',async()=>{
  const {client,workers}=setup(),pending=client.request({type:'build'}),rejected=assert.rejects(pending,/kernel stopped/);
  workers[0].listeners.get('error')({message:'kernel stopped',preventDefault(){}});await rejected;assert(!client.active);
  const next=client.request({type:'build'});workers[1].message({id:workers[1].requests[0].id,error:'bad geometry'});
  await assert.rejects(next,/bad geometry/);assert(!client.active);client.cancel();
});
