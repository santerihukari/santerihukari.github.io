# Model library integration

The original library remains at `/stl_param/`. The new library comprises:

| Model | Route | Geometry |
| --- | --- | --- |
| Coffee filter holder | `/parametric-models/` | Browser worker; source-compatible screw mount, mirrored side-rest and experimental standing base |
| Drone frame | `/parametric-models/drone-frame/` | Current source port, with the preferred published upper retained |
| Door/frame latch | `/parametric-models/door-frame-latch/` | Source-derived browser engine; one nut and installed example |
| Climbing volumes | `/parametric-models/climbing-volumes/` | Browser panels, incuts, scaling and inner supports |
| Cabinet air damper | `/parametric-models/cabinet-air-damper/` | Fixed seal-free comparison plus optional browser-generated sealed prototype |
| Grid organizer | `/parametric-models/grid-organizer/` | Original OpenCascade builder |
| Round badminton pole head | `/parametric-models/round-badminton-pole-head/` | Original OpenCascade builder |
| Square badminton pole head | `/parametric-models/square-badminton-pole-head/` | Original OpenCascade builder |
| Twisted vase | `/parametric-models/twisted-vase/` | Original OpenCascade builder |
| Spline vase | `/parametric-models/spline-vase/` | Original OpenCascade builder and draggable profile |
| Bolt generator | `/parametric-models/bolt-generator/` | Original OpenCascade builder and presets |
| Depth-taper hangboard | `/parametric-models/depth-taper-hangboard/` | Original OpenCascade builder |

The text keychain and private old-library experiments remain excluded. Migrated
public models reuse their original builders and defaults, not remeshed or
simplified substitutes. The original library remains available; the shared
hangboard builder has optional profile/attachment extensions while retaining
its original default geometry.

## Boundaries

`F:/param_cad` is an authoritative, read-only source. Importers use explicit
asset allowlists and never regenerate its layout, caches or private CAD. Run
Python with `PYTHONDONTWRITEBYTECODE=1`. Public assets exclude unlicensed reference
models, photo originals, private paths and credentials. Third-party software and
CAD notices remain attached to their assets. Original local geometry is credited
to Santeri Hukari; that does not override third-party licences.

The drone exception is reproducible in `_tools/drone-frame/website-defaults.json`.
Current-source bridge geometry remains available without replacing the preferred
upper by default. All three website print purposes remain. A fit jig is unpowered
only. The user has fitted drone components and bent the frame by hand to assess
stiffness; this is not a measured strength test or flight qualification.

## Verification

Each family has tools under `_tools/<family>/` for source fixtures, geometry,
independent STL/GLB inspection and browser interactions. Runtime exports must
correspond to the last valid generated parameters; invalid input must disable
downloads. Display transforms, references, explosion and cutaway must not alter
printable STL geometry.

Build with `bundle exec jekyll build`, serve at `127.0.0.1:4000`, then run focused
browser checks at desktop/mobile sizes in both themes. Repeat asset/worker checks
with a nonempty Jekyll `baseurl`. Verify coloured canvas pixels, interaction,
share-link restoration, download content, private-path exclusion and viewport fit.
Keep screenshots, test meshes, slicer outputs and generated `_site` out of Git.

Before pushing, review the staged diff and run `git diff --check`. A successful
SSH push is distinct from a successful GitHub Pages deployment.

## Shared viewer interface

`_includes/parametric-model-navigation.html` provides the model selector.
`src/cad-ui.mjs` and `assets/css/modules/cad-ui.css` provide the common control
panel, a dedicated right-hand touch/keyboard scroll strip and camera resizing.
All model pages keep a short object description and essential controls visible;
less-common geometry, display settings and reports are under descriptive collapsed
sections named for their contents. Scrollbar space is always reserved so folds
cannot narrow the controls. The coffee holder's basic controls are orientation,
filter-paper preset, stack depth and mounting system. Its preview density defaults
to 20 papers per 17 mm; increasing depth preserves sheet spacing and seating angle.
Preview materials remain distinct, but have no colour-customization controls.

Share, reset, explicit Fit and the same download icon are over the preview.
Multi-option downloads have a chevron; each actual file action shows a small
format badge below the icon. Fullscreen includes the model selector and locks
page scrolling, with a full-window fallback where the native API is unavailable.
Showing parts, changing dimensions, opening
settings and resizing must preserve camera position, target, orientation and
zoom. Resizing may change projection aspect. Only initial load, changing to a
different model/revision, explicit camera views, Fit and reset may frame the
model. Hover highlights components; only clicking shows an object-anchored name.
`src/cad-inspector.mjs` uses separate overlays, never mutating export materials.

`src/cad-orientation.mjs` supplies one common, event-driven XYZ orientation
indicator via `registerViewer`. It shows red X, green Y and blue Z, with CSS
theme colors for the panel and no model/export geometry. The latch retains its
existing indicator and axes checkbox rather than receiving a duplicate. Shared
inspection labels avoid the widget. Compact portrait views place it above the
view toolbar; short landscape views use the free upper-left corner. The seven
migrated models request the shared renderer's orthographic projection, keeping
the same orbit/pan/zoom, explicit Fit and no-reframe-on-rebuild behavior.

Run `node --test _tools/model-library/orientation.test.mjs` for projection math
and `node _tools/model-library/orientation-browser.cjs` for single-indicator,
live camera rotation, nonblank model, overlap, theme and fullscreen checks at
desktop/390/320/landscape sizes across the five established viewers and hangboard.

Coffee screw-mounted geometry still matches the original source fixtures.
Side-rest right mirrors the complete solid and paper outline. The self-standing
option adds a base and rear supports, with a flat bed-facing surface. This new
geometry is an untested physical prototype, not a fit/stability guarantee.
Version-two model links include mounting; original version-one links remain
readable and keep their screw-mounted geometry.

Overall size factor and footprint rotation are no longer climbing-volume
controls. Shape controls are visible, while base radius/reach and material
thickness are under Size and material. The engine still accepts these fields in older saved/shareable
configurations, preserving their exact geometry and exports.

`node --test _tools/model-library/camera.test.mjs` checks the shared resize
contract. After building, run `node _tools/model-library/ui.cjs` for compact
default controls, camera preservation, selector navigation and actual touch
scrolling without parameter edits. `smoke.cjs` verifies the five original canvases,
viewport fit, local assets and both themes. `MODEL_BASEPATH_DIR` enables its
non-root deployment checks. The seven migrated models have additional geometry,
link, form and browser checks under `_tools/legacy-library/`.
`refinements.cjs` verifies constant panel/content width when folds open, named
folds, hover-versus-click behavior, download controls and fullscreen/page locking.
Each family's browser suite also exercises exports
and its own model-specific controls; tests open collapsed settings explicitly.

## Visible Descriptions and Validation

Descriptions stay outside collapsed settings and state the purpose and known
validation, without extending one physical prototype's evidence to every edited
configuration. Coffee: screw-mounted print used for over a week; standing base
untested. Latch: installed, functional and ergonomic in normal use, with no impact
or repeated-heavy-use test. Volumes: intended to plan panel geometry and cuts,
but no volume has been built with this tool. New migrated variants have no
documented physical validation. The damper's original print leaked; the optional
sealed revision is a test concept, not demonstrated damping performance.

The migrated models' basic-versus-folded parameter choices are listed in
`_tools/legacy-library/README.md` for review. Nested settings use indentation and
a vertical guide, so inner groups remain distinct from top-level sections.
On the smallest phones optional section headings may need a short panel scroll;
descriptions and each model's basic controls stay visible.
Fullscreen provides more working area without allowing the underlying page to scroll.
