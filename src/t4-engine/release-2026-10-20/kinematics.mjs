export const firingAngles = [0, 540, 180, 360];
// Cycle progress increases normally; spatial rotation is clockwise from +X.
export const crankRotationSign = -1;
export const crankRadians = progress => crankRotationSign * progress * Math.PI / 180;
export function cylinderState(p, cylinder, angle) {
  const phase = firingAngles[cylinder - 1];
  const local = ((angle - phase) % 720 + 720) % 720;
  const a = crankRadians(angle - phase);
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
