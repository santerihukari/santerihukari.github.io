# Browser-only drone frame integration

Public route: `/parametric-models/drone-frame/`. Coffee-filter holder remains
at `/parametric-models/`; the original library remains at `/stl_param/`.

The new component uses the existing pinned Three.js 0.180.0 and Manifold
3.4.1 dependencies. Geometry runs in a module worker; there is no CAD API,
upload endpoint, external image/model request or backend requirement.

## Modules

- `parameters.mjs`: complete finite configuration validation and shared URLs.
- `print_profiles.mjs`: fit-check, intermediate bench-test and full-frame purposes.
- `geometry.mjs`: V0/V1 printable sections, arm joints, upper/underside retention,
  lower ribs, open-top cable slots, separate body lengths, legacy carrier,
  envelopes and bounded fit reporting.
- `worker.js`: WASM lifetime and transferable preview/export buffers.
- `exports.mjs`: printable-only binary STL, in mm.
- `app.js`: Three.js rendering, controls, local GLB/JSON exports and notices.
- `references.mjs`: approved GLB meshes, immutable hardware dimensions, visual
  materials, explicit optional-part poses and metre/Y-up conversion.
- `assets/cad/drone-frame/config.json`: sanitized dimensions, presets and
  scalar source datums, with generator source hashes.
- `assets/cad/drone-frame/credits.json`: dimensional sources and rights status.

## Source / rights boundary

The integration reads the current handoff and live CAD source. Prepared website
JSON predates the new controller bridge and is not authoritative. The explicit
`website-defaults.json` exception preserves the published header-ledge upper
frame at the user's request: 13 mm bay, four tie slots, roof relief and original
ledges. The newer bridge, header slots, signature and removable L guides remain
optional. A regression locks the published upper bounds, volume and topology.
The finished Ender-3 V2 layout has independent 112 mm lower and 120 mm upper
body lengths, 22 mm compact motor pads without head recesses, eight lower ribs,
four open-top motor cable slots and a top-mounted controller with roof-through
tie slots. ESC stays centered, IMU/regulator move front/rear. Hardware visuals
retain their true dimensions. Legacy mounts and upper extensions remain
selectable, and older shared links preserve their original geometry.

The lower print is 203 x 206 x 19.3 mm; with the documented 5 mm brim, zero
skirt and 0-degree rotation its footprint is 213 x 216 mm on a 220 x 220 mm
usable Ender-3 V2 bed. The upper print is about 92.847 x 120 x 13.71 mm,
also checked with the same brim. Both parts are required: root-bolt XY positions
changed. Bed clips and purge lines are not included in these allowances.

The extractor rejects either a schema mismatch or prepared defaults differing
from current CAD source parameters. Refresh the handoff before future imports;
offline regression tests use the checked-in verified snapshot.

The website then applies the audited `hardware-defaults.json` correction:
T-Motor Velox V50A 6S 4IN1 32BIT, 45.4 x 43.8 x 8 mm, not V50A SE.
The manufacturer lists a 30.5 mm M3 pattern; the user's 34.55 mm outer-edge
measurement minus 4 mm hole diameter gives 30.55 mm centres. The frame uses
3.4 mm M3 clearance bores on the nominal 30.5 mm pattern, distinct from the
board's 4 mm holes. Bolts, grommets, solder joints, cables and
cooling need physical verification. Raw Ender/MK4 source fixtures are retained
separately, so this correction cannot silently rewrite the handoff baseline.
Older complete shared links retain their original hardware dimensions.

Prop checks retain a conservative 64.77 mm radius, above the reported
slightly-over-63 mm measurement, with 3 mm vertical deflection allowance.
The default body gap is about 10.28 mm and adjacent prop gap 51.46 mm.
The same conservative radius is used for body, rib and adjacent-prop checks.
Geometric clearance does not qualify the frame for flight or slow hovering.

No unresolved vendor CAD, historical assembly GLB/STEP, private inventories or
local paths are public assets. `references.py` uses an explicit eight-model
allowlist: local motor/ESC/battery/prop reconstructions, and CC-BY-SA-4.0-licensed
Espressif module/KiCad XT60 references. It hash-checks source STEP files,
tessellates without writing to the source, and round-trips converted GLB
bounds/units/axes. Third-party licence notices, attribution, conversion changes
and per-asset hashes are public. Do not add models without a rights review.
The geometry fixture extractor
reads existing local propeller caches to retain scalar full-sweep radius and
Z bounds; it refuses to create caches in the read-only source. Those scalar
bounds also constrain the public rib profiles, avoiding a less conservative
shape caused by removing detailed visuals. The default lower print is checked
against the actual original source configuration before fixtures are written.

The default motor, battery and opposite-handed props use detailed source
geometry. They remain reconstructions, not confirmed hardware matches or flight
models. Changed dimensions revert to illustrative envelopes, never scaled
fixed hardware. Complete controller/IMU/regulator remain generic boxes;
their vendor CAD permissions are unresolved. Optional licensed references have
explicit poses stored in shared parameters. They are initially staged beside
the frame, not silently installed, and are not part of frame fit checks.
Hiding parts never changes checks or exports. GLB contains the assembly preview,
converted once from
mm/Z-up to metres/Y-up, with colors and attribution metadata. STL contains
only the selected print part; upper deck and legacy keepers use print datums.
There is no STEP export. No public design licence has been selected.

This is an experimental, non-flight-ready prototype. Source motor/sweep
overlaps, RF/keeper issues, connector access, restraint and structural limits
remain visible. The 1.3 mm motor-pad hole-edge web is below the conservative
2 mm allowance. Motor engagement is 2.7 mm of the reported 3 mm thread depth;
bolt heads protrude below the base. Cable packing and full-boss preservation
are geometric checks, not physical wiring or root-strength qualification.
Lower-rib clearance is model-based; the legacy upper-ramp
negative clearance is not silently cleared. Generic-envelope reports are not
equivalent to the Python detailed-reference qualification or physical tests.

## Verification

Run from the website repository using the configured Python/Node runtimes:

```text
python _tools/drone-frame/reference.py --source F:/param_cad --current-source
python _tools/drone-frame/references.py --source F:/param_cad
node _tools/drone-frame/verify.mjs
node _tools/drone-frame/verify_variants.mjs
node _tools/drone-frame/browser.cjs
python _tools/drone-frame/verify_exports.py
python _tools/drone-frame/slice_variants.py
python _tools/drone-frame/fit_print.py
bundle exec jekyll build
```

The extractor reads but never updates the CAD source. Fixtures and test tools
are excluded from the Jekyll site. Screenshots and generated test downloads
go into ignored `output/drone-frame/`.
Browser tests require Playwright/pngjs, the Chromium executable and a running
local Jekyll server (default `http://127.0.0.1:4000`). `SITE_URL` can include a
deployment subpath for a base-URL regression check.

Test geometry bounds within 0.025 mm and volumes within 0.001% across 31 cases,
plus connected-solid/genus parity. Independently round-trip STL through
Trimesh, including the actual browser-downloaded lower and upper files.
STL serialization omits only exactly zero-area facets collapsed by float32
conversion; no positive-area geometry is discarded or resized.
Browser checks cover desktop/mobile, both themes, nonblank pixels,
camera interactions, component visibility, persistent warnings, invalid
parameters, current-parameter downloads, presets, shared links and the
existing coffee viewer. Roof-slot toggles, print footprints, motor engagement,
source Ender/MK4 clearances and lower/upper non-interference are checked.
Independent solid intersections confirm all four bolt-boss annuli remain intact
and the motor leads have an open insertion path from above. Display-only cable
guides never enter printable or GLB exports. Old links and licensed references
remain covered.
Solid intersections also check both printable parts against all four complete
prop sweeps, expanded by the rib gap and including deflection allowance.
Three explicit print versions share hole XY positions, normal motor-pad grip
and the normal-height motor coupon. Fit-check is a planar layout jig: 0.84 mm
skins, 1.2 mm ribs and open panels. Its root-bolt bosses are only 1.68 mm tall
with 1.2 mm walls. Tall roots, locating lips/grooves, arm reinforcement and
controller retention are omitted. It does NOT validate bay height, joint fit,
controller retention or full cable-port routing. The full-height hardware in
the viewer is a reference, not a promise that the jig supports it. It is
unpowered only and can miss interference from omitted full panels.
Bench-test keeps closed 3 mm base /
2.4 mm roof skins, 2.4 mm webs and arm ribs. Full frame is the unchanged
5.3 mm base / 4 mm roof / 3 mm source webs. Neither is a certified load-bearing
frame; powered testing and flight require independent physical validation.

`verify_variants.mjs` checks connected solids, thinning as a subset of source,
hardware reference poses, motor pads, coupons, purpose-specific root bosses, print datums and
swept prop clearance. Local float32 clipping tolerance at motor-pad volumes
is 0.1 mm3; nominal dimensions and grip height remain unchanged.
Thin-rib root overlaps are regenerated from the same analytical profile to
avoid zero-thickness boolean seams. Thin meshes are round-tripped through
float32 in the kernel before exports. Independent STL tests remain required.
`slice_variants.py` runs the installed PrusaSlicer CLI offline in an isolated
data directory: Ender-3 V2 / 0.4 mm nozzle / 0.28 mm SUPERDRAFT / 10% infill /
Prusament PLA, 5 mm brim, no skirt. It never sends a print job or changes
the user's slicer settings. Automatic supports are explicitly enabled for the
fit jig and G-code must contain zero support paths. The default raised XY
sections also must sit fully on lower sections. Recheck edited settings,
especially motor-head recesses, in the slicer. Estimates are not real print
durations or load tests. Estimate records include exact input STL hashes.
`fit_print.py` independently checks and packages all three versions, plus
parameters, reports and hashes, in ignored `output/drone-frame/`.
The previous `drone-bench-fit-check.zip` path is refreshed with the genuinely
thin version rather than leaving the old full-geometry fit package accessible.

Current-source extraction is read-only and deliberately does not run the old
source fixture generator, which would overwrite its layout file. Native fixtures
cover the preserved website default, current source bridge/L guides and legacy
settings. Future imports must retain the documented website-upper exception
unless the user requests its replacement. Refresh source hashes and fixtures
and repeat independent export/browser checks before publishing a new revision.
