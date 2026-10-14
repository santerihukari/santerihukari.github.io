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
  Primary tilts are 0.1..179.9 degrees, including real incuts above 90, and nominal reach is 30..2500 mm. Legacy
  saved zero tilts migrate to the default tilt. The actual-footprint base-circle
  guide is preview-only; actual radius, diameter and nominal size are distinct.
  Overall scale and individual length factors accept any positive finite input
  within the native 1e9 mm geometry range; their sliders remain at 0.5..2. Stock
  thickness and bore diameter never scale. Saved absolute wall edges migrate to
  factors without resizing. A bounded cyclic polygon solve preserves exact chords,
  including obtuse bases. Main scale and radius stay available for factors.
- `supports.mjs`: native cavity-fitted timber/plywood spacers and two-face joint
  cleats. Manifold/WASM cuts physical 96-sided bores in the spacer and selected
  panel. Stock, contacts, machining axes, bore paths and symmetry are reported.
  See-through and visibility controls affect only the preview.
- `exports.mjs`: millimetre STL, 1:1 SVG with true elliptical bore outlines and
  100 mm calibration, and fflate ZIP including support STLs and a support cut list.
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

Reference sources: `F:/param_cad/climbing_crack_brace/{model,volumes,shells,inner_supports}.py`.
Defaults and golden cases were copied from `website_model_assets`. Fixtures are
excluded from Jekyll publishing with the existing `_tools/` exclusion.

The source Python reports may start polygon loops at different vertices. Tests
compare full coordinate sets, physical edge names/lengths, normals, cut polygons
and volume rather than requiring identical mesh triangulations or loop origins.

## Verification

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
F:/anaconda3/python.exe -B _tools/climbing-volumes/native_fixtures.py
node _tools/climbing-volumes/verify.mjs
node _tools/climbing-volumes/verify_native.mjs
node _tools/climbing-volumes/browser.cjs
F:/anaconda3/python.exe -B _tools/climbing-volumes/verify_exports.py
```

Browser QA uses the existing `playwright` and `pngjs` dependencies; set `NODE_PATH`
and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the local installed runtime when necessary.
Default site URL is `http://127.0.0.1:4000`; override with `SITE_URL`.

Browser QA touches only climbing volumes and reads the existing no-watch server.
Ask its owner to rebuild after changing site source. This script never starts a
server or tests another model family. Main integration owns the prefix smoke.
Generated STLs, ZIPs, downloads and screenshots remain in the explicitly ignored
`_tools/climbing-volumes/artifacts/`; source fixture JSON stays separate.

Tests cover fourteen supplied legacy cases plus 21 native valid cases and 11
native rejection cases, up to 24 historical parts, exact normal thickness, reciprocal
contacts, cuts and bevels, connected watertight exports, both themes, desktop and
mobile canvas pixels, orbit/cameras, changes, saved-settings migration, invalid
states, perpendicular panels, large sizes, share links, STL/SVG/GLB/ZIP/report
downloads, asynchronous stale-export cancellation and no external requests. The
Python validator independently reloads every bundle with trimesh/Manifold,
checks contact containment and actual triangle areas, probes both through-bores,
parses template coordinates, verifies complete ZIP inventory and GLB metre units.
Large dimensions do not imply plywood-sheet fit.

### Native Contact-Area Defect

The native report orders outer vertices and bore vertices as one polygon. This
does not represent a pierced face and depends on Boolean triangulation. For the
two-cap corner plywood fixture, native loop reports say 147.271095 mm2 at the
face and 85.027007 mm2 at the wall; the native mesh's actual coplanar triangles
measure 612.308098 mm2 and 353.516245 mm2. The browser reports actual triangle
areas, an unpierced outer contact boundary and explicit contact triangles.
Fixtures compare these values against independently computed native mesh areas,
not the defective loop areas. Geometry/stock/bores remain native-equivalent.
The source checkout is read-only, with bytecode caching disabled for every import.

This is geometry only. No structural, climbing-load, material, fastening, mounting
or tool-setup certification is provided. Trial cuts and qualified review remain
necessary. Original model copyright: Santeri Hukari. Three.js and fflate retain
their MIT notices in the vendored asset directory.
