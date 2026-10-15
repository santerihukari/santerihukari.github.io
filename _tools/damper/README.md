# Cabinet air damper import and fit trial

The website is a fixed revision generated from read-only native CAD at
`F:/param_cad/cabinet_air_damper_v1`. It does not scale finished meshes.
`tolerances.json` pins the native generator, baseline parameters and front-cap
STL, and permits only bore/piston diameter compensation. The importer refuses
unreviewed source changes and requires all seven other printable designs to
remain byte-identical. Cap seats, rod, retention, reed and spring geometry stay
unchanged. Generated trial files are isolated under `output/damper/clearance-trial`.

The reported prints measured approximately 19.67 mm bore, 20.00 mm piston and
5.65 mm rod. Trial 1 uses CAD bore 20.40 mm and piston 19.70 mm. Repeating the
same surface-specific errors would give about 0.29 mm diametral clearance.
This is not uniform shrinkage compensation or a verified result; remeasure the
new prints for roundness, taper and free travel. Looser fit can reduce damping.

Run from the website root:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
python _tools/damper/import.py
bundle exec jekyll build
node _tools/damper/verify_browser.cjs
python _tools/damper/test_native.py
```

The importer regenerates CAD, print STLs, sections and assembly; its output
must agree with the viewer, ZIP and metadata. Tests independently check closed
solids, print poses, compensation, unchanged cap/rod geometry, motion and
downloaded exports. Byte-preservation assertions are not replaced by a volume
or approximate bounding-box comparison. No upload or printer job is triggered.

## Optional Sealed Prototype

The Design selector retains Fixed V1 as the default comparison. Sealed prototype
regenerates locally with Manifold in a worker. It preserves the housing full
mesh and the ungrooved piston, then analytically adds optional piston grooves,
split front-cap halves, thicker M3-clamped caps, a rear face seal, a matched
printed needle bleed and a cut-silicone reset flap. Zero, one or two piston
O-rings are available; optional front face and rod rings are not required to
seal the deliberately vented front side.

The ring dimensions are editable trial sizes, not confirmed local stock or
validated fits. The gland calculations use the earlier print measurements and
assumed surface-specific errors. Printed roughness, roundness, seal friction,
cap flatness, thread fit, flap closure and damping must be tested physically.
Never connect external compressed air; this is not a pressure-rated device.

Matching print-oriented STLs, a colored assembly GLB and the complete report
are generated in the browser. ZIP creation is on request and includes the
seven printable designs, parameters, report, hardware list, instructions and
the 1:1 silicone flap SVG. Hardware and elastomer references are excluded from
the print set. A complete versioned link restores the sealed settings.

```powershell
node --test _tools/damper/sealed.test.mjs _tools/damper/sealed-ui.test.mjs
node _tools/damper/verify_sealed_browser.cjs
```

The engine tests check closed one-body solids, capped sections, exact baseline
preservation, motion and hardware clearance, needle poses, connected exhaust
with nominal seal contact and nominal closed-seat blocking. Independent Python
checks in `verify_sealed.py` read generated JSON and recheck meshes and the SVG.
Browser tests check real STL/GLB/ZIP bytes, camera stability, ring counts,
parameter links, stale-result/export cancellation and desktop/mobile themes.
Geometric flow connectivity is not a fluid or force simulation.
