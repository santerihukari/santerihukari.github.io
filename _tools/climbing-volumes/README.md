# Browser climbing volumes

Jekyll page: `/parametric-models/climbing-volumes/`. The original CAD/Flask project
is a development reference only; no API or Python service is used by the site.

## Implementation

- `src/climbing_volumes/parameters.mjs`: bounded inputs, obsolete-field migration,
  local settings and share URLs.
- `geometry.mjs`: exact three-plane halfspace intersections, Three.js ConvexHull
  triangulation, nearest-face miter partitions, fixed-base perpendicular panels,
  historical zero caps and matching cuts.
- `worker.js`: browser-only computation, sequence-tagged results.
- `app.js`: compact controls, themes, Z-up camera, selection, display-only explosion,
  local settings and downloads. Invalid input retains the last preview and disables
  current exports. Only successful settings are saved.
  Primary tilts are 0.1..90 degrees and nominal reach is 30..2500 mm. Legacy
  saved zero tilts migrate to the default tilt. The actual-footprint base-circle
  guide is preview-only; actual radius, diameter and nominal size are distinct.
  Flat-mode wall edges can be set independently (1..5000 mm). A bounded cyclic
  polygon solve preserves exact chords, including obtuse bases. Fully overridden
  sides hide the inactive nominal-radius control.
- `exports.mjs`: millimetre STL, 1:1 SVG with 100 mm calibration and fflate ZIP.
  GLB converts mm/Z-up to metres/Y-up exactly once and never exports explosion
  offsets or display-visibility changes.
- `assets/cad/climbing-volumes/fixed/`: original handoff reference files, labelled
  separately from current browser exports and the website's simpler defaults.

Website defaults are a flat three-panel volume with identical triangular faces
tilted at 45 degrees.
Switching to a 90-degree mounting corner starts with two equilateral faces and
no side bands. Corner profile opening is
2*atan(sqrt(2)). The original CAD fixtures are unchanged. Untouched saved former
defaults migrate; independently edited models and shared links remain available.

Reference sources: `F:/param_cad/climbing_crack_brace/{model,volumes,shells}.py`.
Defaults and golden cases were copied from `website_model_assets`. Fixtures are
excluded from Jekyll publishing with the existing `_tools/` exclusion.

The source Python reports may start polygon loops at different vertices. Tests
compare full coordinate sets, physical edge names/lengths, normals, cut polygons
and volume rather than requiring identical mesh triangulations or loop origins.

## Verification

```powershell
node _tools/climbing-volumes/verify.mjs
node _tools/climbing-volumes/browser.cjs
python _tools/climbing-volumes/verify_exports.py
```

Browser QA uses the existing `playwright` and `pngjs` dependencies; set `NODE_PATH`
and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the local installed runtime when necessary.
Default site URL is `http://127.0.0.1:4000`; override with `SITE_URL`.

For the base-path check, build Jekyll with
`--baseurl /test-site --destination output/model-basepath` and set
`MODEL_BASEPATH_DIR=output/model-basepath` when running browser QA. The script
temporarily serves that build under `/test-site`, verifies both model workers
and their local assets, then closes its server.

Tests cover fourteen supplied cases, up to 24 historical parts, exact normal thickness, reciprocal
contacts, cuts and bevels, connected watertight exports, both themes, desktop and
mobile canvas pixels, orbit/cameras, changes, saved-settings migration, invalid
states, perpendicular panels, large sizes, share links, STL/SVG/GLB/ZIP/report
downloads and no external requests. Large dimensions do not imply plywood-sheet fit.

This is geometry only. No structural, climbing-load, material, fastening, mounting
or tool-setup certification is provided. Trial cuts and qualified review remain
necessary. Original model copyright: Santeri Hukari. Three.js and fflate retain
their MIT notices in the vendored asset directory.
