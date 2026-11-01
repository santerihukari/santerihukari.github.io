export const CAMERA_PRESETS={
  r5:{label:'Canon R5',format:'Full frame',sensorW:36,sensorH:24,pitch:4.4,source:'https://www.usa.canon.com/support/p/eos-r5'},
  r6:{label:'Canon R6',format:'Full frame',sensorW:36,sensorH:24,pitch:6.56,source:'https://www.usa.canon.com/support/p/eos-r6'},
  r6ii:{label:'Canon R6 II',format:'Full frame',sensorW:36,sensorH:24,pitch:6,source:'https://www.usa.canon.com/support/p/eos-r6-mark-ii'},
  r7:{label:'Canon R7',format:'APS-C',sensorW:22.3,sensorH:14.8,pitch:3.2,source:'https://www.usa.canon.com/support/p/eos-r7'}
};
export function cameraPreset(settings){
  return Object.entries(CAMERA_PRESETS).find(([,preset])=>['sensorW','sensorH','pitch'].every(key=>Math.abs(preset[key]-settings[key])<1e-6))?.[0]??'custom';
}
