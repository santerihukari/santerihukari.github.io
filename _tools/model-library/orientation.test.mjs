import test from 'node:test';
import assert from 'node:assert/strict';
import {projectedAxes} from '../../src/cad-orientation.mjs';

test('identity and quarter-turn cameras project world axes correctly',()=>{
  assert.deepEqual(projectedAxes({x:0,y:0,z:0,w:1}),[
    {name:'x',x:1,y:0,z:0},{name:'y',x:0,y:1,z:0},{name:'z',x:0,y:0,z:1}
  ]);
  const axes=projectedAxes({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2});
  assert(Math.abs(axes[0].x)<1e-12);assert(Math.abs(axes[0].y+1)<1e-12);
  assert(Math.abs(axes[1].x-1)<1e-12);assert(Math.abs(axes[1].y)<1e-12);
});
test('orientation projection preserves an orthonormal right-handed frame',()=>{
  for(const values of [[.1,.2,.3,.4],[1,2,-3,4],[-4,2,0,1]]){
    const length=Math.hypot(...values),[x,y,z,w]=values.map(v=>v/length),axes=projectedAxes({x,y,z,w});
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    for(const a of axes)assert(Math.abs(dot(a,a)-1)<1e-12);
    assert(Math.abs(dot(axes[0],axes[1]))<1e-12);assert(Math.abs(dot(axes[1],axes[2]))<1e-12);
    const a=axes[0],b=axes[1],cross={x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};
    assert(Math.abs(dot(cross,axes[2])-1)<1e-12);
  }
});
