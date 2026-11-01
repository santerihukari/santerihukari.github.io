import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHUTTER_PRESETS,shutterPreset,shutterSliderIndex,shutterLabel,noiseParameters} from '../../assets/optics/exposure.mjs';

test('shutter presets include common fractions, seconds and minute exposures',()=>{
  for(const value of [1/8000,1/1000,1/125,1/60,.5,1,15,30,60,600,3600])assert.equal(shutterPreset(value),String(value));
  assert.equal(shutterPreset(900),'custom');assert.equal(shutterPreset(1e10),'custom');
  assert.equal(new Set(SHUTTER_PRESETS.map(p=>p.value)).size,SHUTTER_PRESETS.length);
  assert(SHUTTER_PRESETS.every(p=>Number.isFinite(p.value)&&p.value>0));
});

test('shutter slider snaps to common speeds without clipping typed durations',()=>{
  for(const [i,preset]of SHUTTER_PRESETS.entries()){assert.equal(shutterSliderIndex(preset.value),i);assert.equal(shutterLabel(preset.value),preset.label);}
  assert(shutterLabel(900).includes('custom'));assert(shutterLabel(1e308).includes('custom'));
  assert.equal(shutterSliderIndex(1e308),SHUTTER_PRESETS.length-1);
  assert.equal(shutterSliderIndex(1e-300),0);
});

test('ISO increases generic signal-dependent and read-noise variance',()=>{
  const p={workMode:'exposure',sensorNoise:true,iso:100,pitch:6};
  const low=noiseParameters(p,36,24,768,512),high=noiseParameters({...p,iso:6400},36,24,768,512);
  assert(Math.abs(high.shot/low.shot-64)<1e-9);assert(Math.abs(high.read/low.read-4096)<1e-9);
  assert.deepEqual(noiseParameters({...p,sensorNoise:false},36,24,768,512),{shot:0,read:0});
  assert.deepEqual(noiseParameters({...p,workMode:'geometry'},36,24,768,512),{shot:0,read:0});
});

test('noise averages in downsampled previews rather than across render samples',()=>{
  const p={workMode:'exposure',sensorNoise:true,iso:1600,pitch:6};
  const preview=noiseParameters(p,36,24,768,512),native=noiseParameters(p,3.072,2.052,512,342);
  assert(native.shot>preview.shot*60);assert(native.read>preview.read*60);
  assert.deepEqual(native,noiseParameters(p,3.072,2.052,512,342));
});
