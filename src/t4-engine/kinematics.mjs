export const firingAngles = [0, 540, 180, 360];
export function cylinderState(p, cylinder, angle) {
  const phase = firingAngles[cylinder - 1];
  const local = ((angle - phase) % 720 + 720) % 720;
  const a = (angle - phase) * Math.PI / 180;
  const r = p.stroke / 2;
  const bigY = -r * Math.sin(a), bigZ = r * Math.cos(a);
  const dz = Math.sqrt(p.rod_length ** 2 - bigY ** 2);
  const lift = start => {
    const t = ((local - start) % 720 + 720) % 720;
    return t < 220 ? p.valve_lift * Math.sin(Math.PI * t / 220) ** 2 : 0;
  };
  return {bigY, bigZ, pinZ:bigZ + dz, rodAngle:Math.atan2(bigY,dz),
    intakeLift:lift(350), exhaustLift:lift(150), local,
    strokeName:['Power','Exhaust','Intake','Compression'][Math.floor(local/180)]};
}
