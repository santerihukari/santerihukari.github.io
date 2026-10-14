export const printProfiles = {
  fit_check: { label: 'Fit check', skin: 0.84, roof: 0.84, web: 1.2, bridge: 2.4, bossHeight: 1.68, layoutJig: true, open: true, omitRibs: true, purpose: 'Unpowered layout jig: thin flat decks and short, thin-walled bolt bosses; motor pads and coupon retain normal thickness. Bay height, joints and controller retention are not reproduced. No powered motors, hovering or flight.' },
  bench_test: { label: 'Bench-test draft', skin: 3, roof: 2.4, web: 2.4, bridge: 3.2, open: false, purpose: 'Intermediate closed-panel prototype. Powered testing requires independent strength, restraint and clearance checks; no flight qualification.' },
  full: { label: 'Full frame (robust draft)', purpose: 'Full-thickness source geometry. Robust is a design intent, not a verified load rating or flight qualification.' }
};
