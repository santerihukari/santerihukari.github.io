# Public legacy models in the new library

## Integration Contract

Owner scope: `src/legacy_library/*`, `assets/css/modules/legacy-cad.css`,
`_includes/legacy-model-configurator.html`, seven `legacy_*.markdown` pages,
and `_tools/legacy-library/*`. The OCCT engine bytes are unchanged. The shared
depth-taper hangboard builder has the geometry-preserving optimizations and
optional profile/attachment extensions below;
the other original builders are unchanged.
Main owns shared CSS, navigation, build, and server.

All pages set `legacy_model` and `model_key` to the original public key.
The central picker should use these keys and `/parametric-models/<slug>/`:

| Picker key | Slug |
| --- | --- |
| organizer | grid-organizer |
| badminton_pole_head | round-badminton-pole-head |
| badminton_pole_head_square | square-badminton-pole-head |
| vase | twisted-vase |
| vase_spline | spline-vase |
| bolt | bolt-generator |
| unlevel_hangboard_depth_taper | depth-taper-hangboard |

Controller: `src/legacy_library/app.mjs`, root `#legacyWorkbench`,
canvas `#legacyCanvas`. Root `data-state` is `loading`, `building`, `ready`,
`invalid`, or `error`. Downloads are disabled unless the displayed build matches
the current validated parameters. `root.legacyController` exposes diagnostics.

## Control Hierarchy

- Organizer: footprint and rows/columns visible; compartments/wall masks plus height/walls/corners collapsed. Keeping height in the descriptive fold avoids the observed 17 px essential-control overflow at 320x700.
- Round pole head: fitting diameter/height visible; cap and groove collapsed.
- Square pole head: fitting width/depth/height visible; body/cap and groove collapsed.
- Twisted vase: height/profile/twist visible; radius profile and wall collapsed.
- Spline vase: height/profile/twist visible; radius profile open on roomy desktop screens, collapsed on short/mobile screens. Edge curve/wall and resolution collapsed.
- Bolt: standards/diameter preset, length override, diameter offset visible; drive, thread and tolerance groups collapsed.
- Hangboard: integer slot count (1–6), separate upper/lower grip depths and minimum finger gap are visible. Finger widths/risers use numeric-only fields with up to three decimals. Width/depth profiles, body, rope attachment and rounding/tolerances have descriptive folds.

Original parameter values remain authoritative for the unchanged builders.
The hangboard adds width-profile/attachment parameters and intentionally uses
a 4 mm back-wall default. Its perimeter mode has independent 8 mm side walls.
Curves retain exact editable text in addition
to draggable points. No color customization; the single OCCT output is one
named teal object. Physical validation remains explicitly unverified.

## Verification

### Rebuild Behavior

The depth-taper hangboard loads its initial model automatically, then uses
manual updates. Parameter and curve edits are batched until Update is selected.
Other migrated models retain their 500 ms automatic-update debounce.

Editing cancels an active obsolete CAD worker instead of waiting for its exact
Boolean/fillet operation to finish. A fresh worker handles the next requested
build. Unchanged completed kernels remain available for ordinary builds and STL
export. Loading, geometry and preview stages show elapsed time; calculations
have a recoverable 90-second limit. Reset works even during initial loading.
Tessellation settings are unchanged; intentional hangboard defaults are documented below.
The historical version-1 rolling-ball blends can still be computationally expensive.

Copy model link is available for valid parameters while a build is pending or
running. It shares the current settings, not the last preview. STL/GLB downloads
remain disabled until the current parameter revision has generated successfully.
Rebuilds do not reframe the camera.

Run from the checkout with the bundled Node runtime and an installed Chrome:

```powershell
node --test _tools/legacy-library/tests/catalogue.test.mjs
node --test _tools/legacy-library/tests/geometry.test.mjs
node --test _tools/legacy-library/tests/worker-client.test.mjs
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
node _tools/legacy-library/tests/browser.cjs
node _tools/legacy-library/tests/compact.cjs
node _tools/legacy-library/tests/rebuild-browser.cjs
python _tools/legacy-library/tests/inspect_exports.py
node --test _tools/legacy-library/tests/hangboard-optimization.test.mjs
node _tools/legacy-library/tests/hangboard-browser.cjs
python _tools/legacy-library/tests/inspect_hangboard.py
node --test _tools/legacy-library/tests/hangboard-features.test.mjs
node _tools/legacy-library/tests/hangboard-features-browser.cjs
node _tools/legacy-library/tests/hangboard-depth-editor-browser.cjs
node --test _tools/legacy-library/tests/riser-continuity.test.mjs
node --test _tools/legacy-library/tests/perimeter-rounding.test.mjs
node --test _tools/legacy-library/tests/profile-editor-tangents.test.mjs
node _tools/legacy-library/tests/hangboard-reported-browser.cjs
python _tools/legacy-library/tests/inspect_hangboard_features.py
```

`SITE_URL` defaults to `http://127.0.0.1:4000`. Main must build and serve the
site. Browser suites compare served runtime/CSS SHA-256 hashes against current
source before testing; an outdated `_site` fails explicitly. Generated exports,
screenshots and the timestamped runtime hash manifest are in
`output/legacy-library/`, not the public source.

### Hangboard Builder Optimization

The historical version-1 hangboard builder retains its 17-section varying-profile loft,
analytic rounded profiles, Boolean fuzzy tolerance, edge-selection predicates,
fillet radii and retry order, and 0.06/0.08 tessellation settings. It now:

- Configures empty cut/fuse operations before building once. The old two-shape
  constructors performed an initial build before the explicit rebuild.
- Classifies edges once per unchanged fillet input, retaining their traversal
  order and duplicates, rather than repeating mass/bounds measurements at each
  fallback radius.
- Releases temporary Boolean, fillet, edge-property and bounding-box wrappers.

This affects the same hangboard in both library interfaces, not other models.
There is no coarse-preview path or new CAD engine. This optimization comparison
describes version 1; the default version-2 depth geometry is described below.

The focused optimization suite uses the checked-in OCCT kernel and the frozen
pre-optimization source from Git commit
`ff1bb183e55759ab167e8a7d55427cdb0cd1ef77`. That object must be available locally
(a shallow clone may need to fetch its history). Tests check original source
hash, original default parameter values and tessellation, exact analytic volume, mesh vertex/connectivity
hashes, native STL bytes, remaining warnings, and fillet selections/retry radii across flat,
curved, sloped, unrounded, one-sided, zero-fuzzy and six-slot cases. Benchmarks
are observations, not CI timing thresholds. Historical parity cases explicitly
use the original 20 mm back wall and `depth_profile_version=1`; they do not
describe the new 4 mm default or integrated depth profile.
The obsolete warning triggered by an intentionally zero-height platform is
excluded from the historical warning comparison; geometry checks are unchanged.
Set `PROFILE_CASE` to run one case,
or `PROFILE_VERBOSE=1` for per-operation tracing. For example:

```powershell
node _tools/legacy-library/tests/hangboard-profile.mjs reference arch
node _tools/legacy-library/tests/hangboard-profile.mjs current arch
```

The browser comparison serves the frozen reference only in its isolated test
context. It checks the real curved build with all default rounding enabled,
manual updates, parameter links, unchanged camera, STL/GLB exports, and visible
geometry at desktop/390/320 widths in both themes. Results and exports stay in
`output/legacy-library/hangboard-profile/`.

Observed on the local machine with the checked-in kernel (single comparison
per case; not universal speed guarantees):

| Configuration | Original solid build | Optimized solid build |
| --- | ---: | ---: |
| Default | 3.31 s | 2.22 s |
| Five-point curved profile | 9.61 s | 6.94 s |
| Three-point curved profile | 9.69 s | 7.14 s |
| Sloped profile | 8.59 s | 6.25 s |

All eight tested configurations retain byte-identical native STL files and
identical preview vertices/triangles. A real Chromium warm-kernel curved build
measured 9.55 s to 6.85 s for solid construction; preview preparation was 3.24 s
and 3.33 s respectively. Thus the total warm rebuild dropped from about 12.79 s
to 10.18 s, not by the full solid-only percentage. Kernel startup, triangulation
cost and difficult general-purpose fillet calculations remain.

- Catalogue tests cover exactly seven public entries, all original fields and hangboard additions,
  original function/default identity, typed options, every visibility operator,
  full canonical/prefix links, invalid finite/range/curve gates, both
  tessellation fallback contracts, and immutable OCCT binary hashes.
- Geometry tests call each original builder in one real checked-in OCCT kernel,
  compare exact analytic solid volume and bounds, then run the actual old
  `tessellateToMesh` source (only its Three import is resolved to the local file).
  Vertex arrays and triangle connectivity match; winding may differ only by the
  documented orientation-binding correction. Native STL writing is exercised.
- Browser tests build all seven defaults in real module workers, parse download
  headers/GLB materials, check nonblank teal pixels at desktop/mobile in both
  themes, preserve camera state during edits/folds/exports, edit/drag curves,
  gate invalid/stale builds, exercise fullscreen and share restoration, and
  serve the actual built bytes under a prefix to exercise module-relative assets.
- Compact tests use fresh 320x700 touch pages, then 390x844 and 844x390 landscape,
  both themes and fullscreen. They check essential controls, text containment,
  page fit and usable canvas dimensions; detailed folds use the shared rail.
- Independent Trimesh parsing loads every actual browser STL and GLB, applies
  the documented metre/Y-up to millimetre/Z-up inverse, and compares dimensions,
  face counts, winding and volume. Mesh/analytic volume tolerance is 0.5%; paired
  STL/GLB volume tolerance is 0.001%. Analytic reference volumes are measured
  from these original defaults, not certified design or physical measurements.

## Preserved Limitations

Earlier seven-model checks established original-tessellator parity and paired
STL/GLB unit/bounds/winding/volume agreement. The square pole head and historical
version-1 hangboard meshes were not watertight after 1e-5 mm vertex welding in
Trimesh. That result must not be read as validation of the revised hangboard.
Current geometry checks test BRep validity, connectivity and point classifications;
independent export checks do not certify printing or strength.
Current version-2 native perimeter-route exports (flat, reported combined profile
and offset route) pass that welded-watertight check. Default diamond, eyelet and
several other variants still do not, despite valid closed CAD boundaries. The
existing export caution is retained; no automatic mesh healing is applied.

The historical hangboard geometry warns that a riser reaches zero height and
that a longitudinal slot fillet falls back. The current worker forwards build
warnings to a visible fold; no physical load/fit validation is implied.

## Hangboard Profiles and Attachments

The default remains a flat width profile and two diamond holes.
The back wall now defaults to 4 mm. Rear/internal and exterior rounding are
limited for this thinner wall, and accepted fillets must retain valid CAD boundaries.
Existing parameter links retain their saved wall values; `make_holes=0` disables
attachment features but retains the perimeter mode's oval body. Changing an attachment or a profile requires Update and
does not reset the camera. All settings are included in model links.

- **Integrated depth profile (version 2, default):** the selected depth-end
  radius defines exact rational circular arcs at the front and back of each
  grip. A bounded cubic-Bezier middle joins both arcs with horizontal tangents.
  The editor uses the builder's physical millimetre coordinates and shows locked
  endpoints, tangent points and radius centres, plus editable middle handles.
  Lower/upper views account for separate grip depths. The free middle supports
  editing on the lower grip and on a mirrored upper grip; the deliberately flat
  upper grip is view-only when opposing risers are disabled.
  At most eight middle points are supported, with changing spans at least
  0.5 mm long. Radius/depth
  and nominal 3 mm shell guards run before CAD construction. Invalid partial
  input keeps the last useful diagram but cannot build or export.
  The cavity uses exact rational tensor-product surfaces combining the XZ
  finger profile with the YZ depth curve; this is not a sampled-circle loft or
  a post-build rolling-ball fillet. The selected radius is exact in a constant-X
  depth section; it is not claimed to be a constant normal-distance rolling-ball
  radius over a varying width profile. The opening grows to preserve the finger
  gap at the back arcs. `depth_profile_version=1` retains historical rolling
  fillets and its generic editor for explicit compatibility links/tests.
  Internal riser side walls now blend into both the front face and the rear
  cavity plane as part of the same exact tensor-product construction. Vertical
  side blends taper through their adjacent XZ quarter arcs into the unchanged
  finger-surface depth arcs. Their transverse width is at most the depth-end
  radius and 90% of either adjacent step-corner radius, avoiding folded corner
  surfaces. This produces a tangent elliptical side blend, not a claim of a
  constant-radius rolling-ball fillet. Zero step rounding deliberately leaves
  those step edges unblended. Outer cavity-side closures are outside this
  internal-riser feature.
  A shared per-node bounded tangent is used by the width/depth builders and
  corresponding width editors: independent segment-local slope clamps no
  longer create a crease at an otherwise shared control point. Unrelated
  curve editors and the version-1 depth interpolation retain their old behavior.
  `riser-continuity.test.mjs` checks coincident patch boundaries and matching
  tangent-plane normals across slot counts, unequal depths, short steps,
  narrow corners and uneven spline nodes. Native point classifications check
  both sides of the actual front/rear side blends at three section angles.

- **Per-finger width profile:** the same bounded cubic Hermite profile repeats
  on each horizontal finger surface, between the existing rounded step
  transitions. It is constructed as analytic Bezier edges, not sampled width
  polylines. Both ends stay at normalized height 1 with zero slope, retaining
  those transitions. Width amount controls millimetre offsets; depth shaping
  remains independent. The upper surface mirrors it only when mirrored risers
  are enabled. Required slot height includes the maximum inward width offset.
  Each platform is raised by the minimum amount needed when its combined
  width/depth offsets would cross the base surface. The entire platform shifts;
  the drawn curve is not clipped flat. Unaffected riser heights remain unchanged.
  Mirrored grips, finger gap, body allowances and central attachments all use
  these effective heights. The requested heights remain in the controls/links.
  Nominal shell margins are geometry guards, not a strength assessment.
  Width-shaped cavities use a small Boolean tolerance so the front overrun is
  not merged into the rounding boundary. Version 2 combines width and depth
  analytically and does not retry smaller depth radii. Historical version 1
  retains validated rolling-fillet retries, including the old 1.5 mm fallback
  for the reported 0.87-width/1.070472-depth combination.
- **Perimeter rope groove:** a circular section sweeps one continuous rounded
  XZ outline, rather than two YZ end loops. Broad circular crowns on the top and
  bottom join smaller tangent corner arcs. The full body is intersected with
  this curved prism across its entire Y depth before the groove is cut: sections
  away from the rope channel are curved too, with no flat top/bottom shoulders.
  Top/bottom curvature defaults to 12 mm. The grip opening is shifted and the
  body height extended as needed to preserve the requested shell beneath the
  curved seats. It does not trim through the finger surfaces to obtain the outline.
  Perimeter-only side walls default to 8 mm; the other attachments retain 18 mm.
  Separate conditional wall controls preserve each mode's chosen value. Older
  links with an explicit `side_wall_x` migrate that value into the perimeter field.
  Continuous side-wall extensions enclose the circular rope channel above and
  below a middle inspection window, rather than adding four isolated ears.
  The outer boundary blends across the full Y depth with exact rational
  circular base corners, polynomial bulges and tangent Z transitions. The central 40% of each straight side run
  exposes the outer half of the channel while retaining its inward seat.
  The side extensions locate the rope; they are not rated load-bearing anchors.
  The groove's swept section uses tangent circular arcs at both mouth edges,
  up to 1 mm lip radius, while retaining the original circular seating radius
  and depth. This rounding is part of the CAD boundary, not preview shading.
  The clean oval blank receives its complete front/back perimeter fillets before
  the grip cavity is cut. This preserves rounding along the curved outer top,
  bottom, and the side/front edges between the covered sections. The outer
  radius remains limited by the thin back wall (1.8 mm with the default 4 mm
  wall). Rail roots follow that same circular boundary rather than filling
  it back to a square corner. All eight covered-channel mouths receive a
  separate 0.5 mm fillet selected by the bore cylinder and adjacent curved
  rail skin, not edge indices. The larger 1 mm trial failed in the checked-in
  kernel. Tests require actual new fillet faces on every mouth contour.
  A localized limitation remains at the two endpoints where each covered
  mouth meets the open groove's existing lip: close-ups show small blend
  termination marks. The bore fillets do not establish tangent continuity
  through those adjacent lip/window junctions. Separate 0.5 mm and 0.25 mm
  lip/window fillet trials both failed with `ChFiDS_StartsolFailure`; those
  experimental results are not used by the public builder. Valid BRep and
  watertight exports are not a claim that these junctions are fully smooth.
  The routing is based on the published
  `portable-hangboard-12mm-20mm-wood-inserts.stl`, whose bytes are hash-guarded.
  Rope diameter defaults to 6 mm, with 0.8 mm trial diametral clearance. Corner
  radius and crown rise are editable. A Y offset of 0 follows the average of
  the upper/lower grip midpoints (12 mm by default), not half the entire block.
  Nominal wall and side-channel margins are checked before CAD work. Diamond holes are omitted in this mode. This adapts the
  reference routing to the parametric body; it does not claim to reproduce
  the reference board's outer shape or its physical training history.
- **Central rounded eyelet:** top, bottom or both, centred across the finger
  platforms. Its Z position follows the last/high-X platform's nominal height
  at the selected Y position. It stays
  inside the block's outer envelope in the default layout. A lofted arch widens
  into the body. The grip opening is kept free: where the last platform's height
  leaves no room, the eyelet moves outward and gets a local reinforcing crown,
  including single-platform layouts. Open flared recesses on the front/back sides allow
  the rope to turn around the retained Y-centred bridge rather than contacting
  the original outer edges. The bore's 1 mm rim rounds are exact revolved arcs,
  not a fragile post-Boolean fillet selection.
  At depth offset 0 the bridge follows half the selected upper/lower grip depth
  (12 mm for a default 24 mm grip). Negative moves toward the front; positive
  toward the back. The bridge length along Y defaults to 10 mm and is editable.
  Offset limits preserve 1 mm at both ends; the reinforced crown has 6 mm nominal
  material beyond the bore. These are geometry guards, not load ratings.
- **Opening dimensions:** minimum finger gap preserves free Z space between
  opposing risers. Minimum opening envelope is a separate lower bound before
  subtracting those risers; it lives with body options because the gap normally
  determines the actual height. Different upper/lower depths produce a stepped
  rear wall in the common opening. Old links with only `slot_depth_y` retain
  equal depths; current links save both explicitly. Version 2 constructs the
  two rounded half-cavities independently and joins them at the opening centre.
  Historical version 1 retains its validated unequal-depth fillet retry policy.

Feature tests exercise all attachment positions, raised/hollow/combined
width-depth profiles, rope plus width shaping, and independent point-in-solid
checks on each finger surface, covered side bores, central half-channel windows,
requested-radius front/back sections, curved rope seats,
inner-side-wall front/back blends, complete outer crown perimeter rounds,
and the rounded exterior edges of the central windows,
recess access, Y-centred bridges, single-platform supports and independent rear
walls. They check valid CAD boundaries, one joined solid and STL writing.
Browser tests cover field visibility, anchored curve dragging, manual updates,
stable camera, numeric fields, depth-offset validation and parameter-link restoration, seven STL/GLB pairs, and 1440/390/320
widths in both themes. Independent Trimesh checks compare browser STL/GLB units,
bounds, triangles and volume. Generated analysis and previews stay under
`output/legacy-library/`, outside the public build.

No new attachment has been printed, rope-fit checked or load/fatigue tested.
CAD connectivity does not establish climbing safety.

`hangboard-reported-browser.cjs` defaults to the shared curved-profile case with
version-2 rounding. Set `HANGBOARD_CASE=roundedRope` or `roundedDefault` for the
other focused cases. Native/browser bounds and mesh volume are compared, with
STL/GLB triangles checked independently as a pair. The sewn rational faces may
triangulate differently between Node and Chromium; no cross-runtime triangle
identity is claimed. The editor suite checks actual radius-arc pixels, fixed
markers, constrained handles, numeric redraw, validation, share restoration and
desktop/mobile light/dark rendering.
`liftProbe` and `depthBelowBase` add independent point-in-solid checks for the
raised lower and upper surfaces without edge fillets obscuring the measurement.

The migrated models now use the shared viewer's orthographic option, matching
the parallel projection of the newer coffee/drone CAD viewers. Share, reset,
Fit, manual Update when needed, exports, fullscreen, hover selection and named
camera views retain their contracts. Camera views are 3D, Top, Front, Side and
Bottom. The shared XYZ indicator follows camera rotation without entering STL
or GLB exports; camera/zoom stay unchanged during parameter rebuilds.

The old tessellator checks an unavailable `Orientation()` method in this kernel.
The new pure adapter supports its actual `Orientation_1()` binding, fixing
triangle winding without changing vertices, surfaces, settings or builders.
The old app explicitly uses 0.15/0.2 deflection when metadata is absent; this is
retained. The standalone tessellator's 0.25/0.25 fallback is retained separately.

## Engine Provenance

The JS/WASM came from local commit
`550e6b4e70a48ac6185b7af4a67ba95d22101169`, which records no upstream version,
source revision or build recipe. Both bytes are unchanged and hash-guarded.
The public Engine and source notices fold links OpenCascade.js, Open CASCADE,
their upstream licences, and the verified local Three.js 0.180.0 MIT notice.
`src/legacy_library/NOTICE.txt` documents hashes and the unresolved provenance
gap. Current upstream links are not claimed to be the exact corresponding
source for the pre-existing binary.
