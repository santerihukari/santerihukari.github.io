import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileViewerLayout,resizeViewerProjection} from '../../src/cad-ui.mjs';

test('mobile preview always takes half the visible viewport, independently of the header',()=>{
  for(const height of [390,700,844,1000])for(const top of [0,100,175,250]){
    const layout=mobileViewerLayout(height,top);
    assert.equal(layout.preview,Math.round(height/2));
    assert(layout.controls>=160);
    if(height-top-layout.preview-8>=160)assert.equal(top+layout.preview+layout.controls+8,height);
  }
});

test('short landscape screens keep usable scrollable controls rather than shrinking the preview',()=>{
  assert.deepEqual(mobileViewerLayout(390,175),{preview:195,controls:160});
  assert.deepEqual(mobileViewerLayout(844,175),{preview:422,controls:239});
});

test('fullscreen preserves the limiting-axis framing, camera pose and zoom',()=>{
  const camera={fov:40,zoom:2,position:[1,2,3],updateProjectionMatrix(){}};
  const perspective={fov:40};
  resizeViewerProjection(camera,390,422,390,844,perspective);
  assert(Math.abs(Math.tan(camera.fov*Math.PI/360)-2*Math.tan(20*Math.PI/180))<1e-12);
  resizeViewerProjection(camera,390,422,390,422,perspective);
  assert(Math.abs(camera.fov-40)<1e-12);assert.equal(camera.zoom,2);assert.deepEqual(camera.position,[1,2,3]);
  const parallel={isOrthographicCamera:true,left:-60*390/422,right:60*390/422,top:80,bottom:-40,zoom:1.5,updateProjectionMatrix(){}};
  const orthographic={top:80,bottom:-40};
  resizeViewerProjection(parallel,390,422,390,844,orthographic);
  assert.deepEqual([parallel.top,parallel.bottom,parallel.zoom],[140,-100,1.5]);
  assert(Math.abs(parallel.right-parallel.left-120*390/422)<1e-12);
  resizeViewerProjection(parallel,390,422,390,422,orthographic);
  assert.deepEqual([parallel.top,parallel.bottom,parallel.zoom],[80,-40,1.5]);
  assert(Math.abs(parallel.right-parallel.left-120*390/422)<1e-12);
});
