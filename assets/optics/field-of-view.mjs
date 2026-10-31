// Invert the same first-order sensor projection used by the scene renderer.
export function sensorFootprint(data, depthMm) {
  const {sensorW, sensorH, shiftX, shiftY} = data.settings;
  const k = data.projection.K;
  if (![depthMm, k, sensorW, sensorH].every(v => Number.isFinite(v) && v > 0) ||
      ![shiftX, shiftY].every(Number.isFinite)) throw new RangeError('Invalid sensor field');
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => [
    -(shiftX+x*sensorW/2)*depthMm/k,
    -(shiftY+y*sensorH/2)*depthMm/k,
    -depthMm
  ]);
}

export function sensorDofRegion(data) {
  const near = data.dof.near_m;
  if (!near) return null;
  const unbounded = data.dof.far_m === null;
  const far = unbounded ? Math.max(...data.targets.map(t => t.distance/1000*6), near*2) : data.dof.far_m;
  return {nearMm:near*1000, farMm:far*1000, unbounded,
    near:sensorFootprint(data, near*1000), far:sensorFootprint(data, far*1000)};
}
