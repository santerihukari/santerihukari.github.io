import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sensorFootprint,sensorDofRegion} from '../../assets/optics/field-of-view.mjs';

const fixture=()=>({settings:{sensorW:36,sensorH:24,shiftX:0,shiftY:0},
  projection:{K:50},dof:{near_m:2,far_m:4},targets:[{distance:3000}]});
const center=points=>[0,1].map(axis=>points.reduce((n,p)=>n+p[axis],0)/4);

test('sensor edges back-project to the exact object-space rectangle',()=>{
  assert.deepEqual(sensorFootprint(fixture(),2000),[[720,480,-2000],[-720,480,-2000],[-720,-480,-2000],[720,-480,-2000]]);
});
test('footprint expands along chief rays, not as a constant-width box',()=>{
  const d=fixture(),a=sensorFootprint(d,2000),b=sensorFootprint(d,4000);
  for(let i=0;i<4;i++)for(let j=0;j<3;j++)assert.equal(b[i][j],2*a[i][j]);
});
test('sensor size changes each field dimension independently',()=>{
  const d=fixture();d.settings.sensorW=18;d.settings.sensorH=8;
  assert.deepEqual(sensorFootprint(d,2000)[0],[360,160,-2000]);
});
test('sensor shift offsets the field with the correct inversion',()=>{
  const d=fixture();d.settings.shiftX=4;d.settings.shiftY=-2;
  assert.deepEqual(center(sensorFootprint(d,2000)),[-160,80]);
});
test('finite DOF clips the frustum at its axial near and far limits',()=>{
  const region=sensorDofRegion(fixture());assert.equal(region.nearMm,2000);assert.equal(region.farMm,4000);assert.equal(region.unbounded,false);
  assert(region.near.every(c=>c[2]===-2000));assert(region.far.every(c=>c[2]===-4000));
});
test('infinite far DOF has an explicit display cutoff, not a physical far plane',()=>{
  const d=fixture();d.dof.far_m=null;const before=JSON.stringify(d),region=sensorDofRegion(d);
  assert.equal(region.unbounded,true);assert.equal(region.farMm,18000);assert.equal(JSON.stringify(d),before);
  d.dof.near_m=null;assert.equal(sensorDofRegion(d),null);
});
test('invalid projection inputs fail rather than emit non-finite geometry',()=>{
  for(const depth of [0,-1,Infinity,NaN])assert.throws(()=>sensorFootprint(fixture(),depth),RangeError);
  const d=fixture();d.projection.K=0;assert.throws(()=>sensorFootprint(d,1000),RangeError);
});
