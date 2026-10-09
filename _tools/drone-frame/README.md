# Browser-only drone frame integration

Public route: `/parametric-models/drone-frame/`. Coffee-filter holder remains
at `/parametric-models/`; the original library remains at `/stl_param/`.

The new component uses the existing pinned Three.js 0.180.0 and Manifold
3.4.1 dependencies. Geometry runs in a module worker; there is no CAD API,
upload endpoint, external image/model request or backend requirement.

## Modules

- `parameters.mjs`: complete finite configuration validation and shared URLs.
- `geometry.mjs`: V0/V1 printable sections, arm joints, underside retention,
  lower ribs, legacy separate carrier, envelopes and bounded fit reporting.
- `worker.js`: WASM lifetime and transferable preview/export buffers.
- `exports.mjs`: printable-only binary STL, in mm.
- `app.js`: Three.js rendering, controls, local GLB/JSON exports and notices.
- `references.mjs`: approved GLB meshes, immutable hardware dimensions, visual
  materials, explicit optional-part poses and metre/Y-up conversion.
- `assets/cad/drone-frame/config.json`: sanitized dimensions, presets and
  scalar source datums, with generator source hashes.
- `assets/cad/drone-frame/credits.json`: dimensional sources and rights status.

## Source / rights boundary

The integrated snapshot uses the completed `WEBSITE_MODELS_HANDOFF.md` and
`website_model_assets/drone_parameters.json`, not the historical reference kit.
It includes reduced/recessed motor pads with continuous inward blends, eight
lower ribs following the local motor-platform floor, a flat upper deck and
optional roof-through controller ties. Legacy upper extensions remain selectable.
Do not mix upper-ramp prints with the lower-rib revision.

The CAD source continued changing after this handoff (compact pads and motor
cable passages). These later edits are not integrated until their prepared
parameters, fixtures and publication checks have been refreshed. The extractor
rejects a source/default schema mismatch before writing website files. Offline
regression tests use the checked-in verified handoff fixtures.

No unresolved vendor CAD, historical assembly GLB/STEP, private inventories or
local paths are public assets. `references.py` uses an explicit seven-model
allowlist: local motor/battery/prop reconstructions, and CC-BY-SA-4.0-licensed
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
fixed hardware. Complete controller/ESC/IMU/regulator remain generic boxes;
their vendor CAD permissions are unresolved. Optional licensed references have
explicit poses stored in shared parameters. They are initially staged beside
the frame, not silently installed, and are not part of frame fit checks.
Hiding parts never changes checks or exports. GLB contains the assembly preview,
converted once from
mm/Z-up to metres/Y-up, with colors and attribution metadata. STL contains
only the selected print part; upper deck and keepers use print datums.
There is no STEP export. No public design licence has been selected.

This is an experimental, non-flight-ready prototype. Source motor/sweep
overlaps, RF/keeper issues, connector access, restraint and structural limits
remain visible. Lower-rib clearance is model-based; the legacy upper-ramp
negative clearance is not silently cleared. Generic-envelope reports are not
equivalent to the Python detailed-reference qualification or physical tests.

## Verification

Run from the website repository using the configured Python/Node runtimes:

```text
python _tools/drone-frame/reference.py --source F:/param_cad
python _tools/drone-frame/references.py --source F:/param_cad
node _tools/drone-frame/verify.mjs
python _tools/drone-frame/verify_exports.py
node _tools/drone-frame/browser.cjs
bundle exec jekyll build
```

The extractor reads but never updates the CAD source. Fixtures and test tools
are excluded from the Jekyll site. Screenshots and generated test downloads
go into ignored `output/drone-frame/`.
Browser tests require Playwright/pngjs, the Chromium executable and a running
local Jekyll server (default `http://127.0.0.1:4000`). `SITE_URL` can include a
deployment subpath for a base-URL regression check.

Test geometry bounds within 0.025 mm and volumes within 0.001% across 23 cases,
plus connected-solid/genus parity. Independently round-trip STL through
Trimesh. Browser checks cover desktop/mobile, both themes, nonblank pixels,
camera interactions, component visibility, persistent warnings, invalid
parameters, current-parameter downloads, presets, shared links and the
existing coffee viewer. Roof-slot toggles, print footprints, motor engagement,
source Ender/MK4 clearances and lower/upper non-interference are checked.
Public source/version changes require refreshing the
fixtures and repeating these checks. Deployment and Git push require approval.
