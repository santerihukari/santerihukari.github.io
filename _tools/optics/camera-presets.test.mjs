import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_PRESETS,cameraPreset} from '../../assets/optics/camera-presets.mjs';

test('camera presets combine the published sensor dimensions and pixel pitch',()=>{
  const actual=Object.fromEntries(Object.entries(CAMERA_PRESETS).map(([key,p])=>[key,[p.sensorW,p.sensorH,p.pitch]]));
  assert.deepEqual(actual,{r5:[36,24,4.4],r6:[36,24,6.56],r6ii:[36,24,6],r7:[22.3,14.8,3.2]});
  for(const [name,preset]of Object.entries(CAMERA_PRESETS)){assert.equal(cameraPreset(preset),name);assert.equal(new URL(preset.source).hostname,'www.usa.canon.com');}
});

test('matching pitch alone never mislabels a different sensor as a camera',()=>{
  assert.equal(cameraPreset({sensorW:36,sensorH:24,pitch:3.2}),'custom');
  assert.equal(cameraPreset({sensorW:22.3,sensorH:14.8,pitch:4.4}),'custom');
  assert.equal(cameraPreset({sensorW:36,sensorH:19,pitch:4.4}),'custom');
  assert.equal(cameraPreset({sensorW:29,sensorH:19,pitch:5.25}),'custom');
});

test('unknown and incomplete saved sensor settings resolve to custom',()=>{
  assert.equal(cameraPreset({}),'custom');assert.equal(cameraPreset({sensorW:36,sensorH:24}),'custom');
});
