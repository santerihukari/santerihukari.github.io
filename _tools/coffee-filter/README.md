# Browser Coffee Filter Holder

The new Jekyll-native library lives at `/parametric-models/` alongside the
original library at `/stl_param/`. Both are linked equally from the portfolio
project. The new library opens the coffee-filter configurator directly; its
earlier `/stl_param/coffee-filter-holder/` URL remains supported. The earlier
private coffee-holder model is unchanged. The local Python reference app remains unchanged in
`F:\param_cad\coffee_filter_paper_holder_profiles\app`.

## Modules

- `_includes/coffee-filter-configurator.html`: page component and fixed controls.
- `_includes/coffee-filter-assets.html`: shared browser imports for both URLs.
- `_includes/parametric-library-navigation.html`: independent library switch.
- `src/coffee_filter/parameters.mjs`: numeric labels, bounds, steps and defaults.
- `src/coffee_filter/model-link.mjs`: versioned URL snapshots, complete parameter
  validation, and preview restoration without applying current preset defaults.
- `src/coffee_filter/geometry.mjs`: faithful port of the Python symmetric and
  curved side-rest shells, exterior rounding, validation and mounting passages.
- `src/coffee_filter/worker.js`: one reusable Manifold instance, sequence-tagged
  builds, transferable buffers and explicit WASM solid disposal.
- `src/coffee_filter/app.js`: paired inputs, Three.js preview, color/paper-only
  updates, camera views, stale-result protection and local STL/GLB exports.
- `assets/css/modules/coffee-filter.css`: scoped layout, scrolling controls and
  light/dark themes. The canvas spans the full workbench height, with action
  and camera controls overlaid. Paired numeric/slider rows are compact, with
  larger hit areas and numeric text for coarse-pointer devices. Holder and
  paper colors are independent of the site theme.
- `assets/cad/coffee-filter/`: locally served dependencies and licences.

STL contains only the holder in millimetres and CAD z-up. GLB rotates z-up to
y-up and scales millimetres to metres; it includes the chosen holder material
and, if enabled, named non-printing sheets. Paper outlines are approximate;
browser/Python geometry parity is not a physical print-fit claim.

Side-rest defaults to a 17 mm paper seating drop for both the measured 76.94
degree and ideal 90 degree profiles. Symmetric defaults remain at 0 mm.
Changing layouts or selecting a named profile applies its seating default;
the seating drop remains editable, and selecting Custom preserves the edit.

## Model links

The link icon beside reset copies a snapshot of the current valid model. A
version-1 link records the model ID, layout and all geometry parameters in
millimetres/degrees, plus preview color, paper visibility and sheet count.
Opening it regenerates the geometry locally and restores those values exactly,
including custom seating drops. Camera position is not part of the snapshot.

Links use the current page's origin and path, so the production page never
hardcodes localhost. The earlier coffee-configurator URL and GitHub Pages path
prefixes also work. Incomplete, ambiguous, out-of-range or unsupported links
show an error and disable sharing/exports until parameters are adjusted or
reset. Geometry-specific validation still runs in the worker. A plain visit
keeps the existing defaults. Clipboard denial falls back to legacy copying,
then a selected link in a dialog if automatic copying is unavailable.

The URL version identifies the current parameter contract. Future incompatible
geometry changes must retain that version's implementation or reject it
explicitly, rather than silently interpreting old links with changed semantics.

## Dependencies

Three.js `0.180.0`, matching the reference viewer, and Manifold `3.4.1` are
pinned in `package.json` and `pnpm-lock.yaml`. Version 3.4.0 was rejected because
the package registry marks its published content as outdated. No dependency
install is required at runtime or during a normal Jekyll deployment.

To refresh the vendored files from the pinned packages:

```powershell
pnpm install --ignore-scripts
node vendor.mjs
```

Run these commands from this directory; the vendor script copies only the
required distribution files, not the development dependency tree.

## Verification

From the website root:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
python _tools/coffee-filter/reference.py --source F:\param_cad
node --test _tools/coffee-filter/geometry.test.mjs _tools/coffee-filter/model-link.test.mjs
node _tools/coffee-filter/verify-ui.cjs
node _tools/coffee-filter/verify-touch.cjs
node _tools/coffee-filter/verify-links.cjs
python _tools/coffee-filter/verify-exports.py
```

The reference generator needs the reference app's existing Python packages
(Manifold, NumPy, trimesh, matplotlib, Flask). It does not run the Flask server
or modify its source. Fixtures include source hashes for later drift checks.

Browser checks need Playwright and pngjs through `NODE_PATH`, plus
`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` if using the bundled runtime. Start
Jekyll on port 4000 first, or set `CAD_TEST_URL`. Screenshots/downloads go into
the ignored `output/coffee-filter/` directory.

Tests cover 48 Python reference cases, layout-specific defaults, invalid input, mesh topology, viewport
fit, nonblank colored canvases, input synchronization, presets, reset, orbit,
preview-only changes without geometry rebuilds, invalid-build recovery,
local-only requests, stale-export blocking, STL re-import, and colored GLB
re-import with/without paper and correct orientation/scale, equal library links,
and the retained coffee-configurator URL.
Model-link checks cover URL round trips, all numeric values, preset/custom
restoration, preview settings, reloads, identical STL exports, both supported
paths, invalid payloads, clipboard fallbacks, and 320 px layouts.
Layout checks assert top-aligned canvases, bounded floating controls, reduced
sidebar content/scroll height and pixel-visible models outside overlays. Touch
checks also cover narrow, breakpoint and short landscape displays, accessible
input sizing, bottom-option scrolling and synchronized numerical edits.

Technical references:
[Manifold WASM](https://github.com/elalish/manifold/blob/master/bindings/wasm/README.md),
[Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html),
[glTF coordinates and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).
