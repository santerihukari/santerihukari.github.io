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
hangboard builder has profile/attachment extensions. Historical version-1/2
links retain their original defaults; new hangboards use a perimeter rope
groove, flat contact surfaces and rounded edges.

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

## Input Baseline

`registerViewer` installs `cad-inputs.mjs` for every new-library model, including
controls inserted after initialization. Mouse and keyboard range behavior stays
native. Touch ranges use `touch-action: pan-y pinch-zoom` and wait for a dominant
horizontal gesture before updating; vertical drags scroll without changing a
parameter. Taps still set a range value, and touching a slider blurs a numeric
field before any range update.

On coarse/touch devices, a numeric-field tap opens a small value dialog with a
numeric/decimal keyboard hint, selected text, Done hint, explicit OK and Cancel.
Only OK/Enter commits; empty/nonfinite or out-of-bounds values remain in the
dialog. Decimal commas are accepted. The underlying number input and its
input/change events remain the model's contract. Browsers/operating systems
choose the actual keyboard; desktop emulation cannot confirm a physical phone's
keyboard appearance. Test at least iOS Safari and Android Chrome on devices.

`inputs.test.mjs` checks gesture/numeric/range rules. `inputs-browser.cjs` uses
real Chromium touch-event dispatch for scroll/slider intent and checks numeric
replacement, limits, cancellation, focus, native keyboard access and each model
family's real controls. Guidance: [W3C pointer events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property),
[non-drag alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements/),
[mobile form attributes](https://web.dev/learn/forms/attributes/).

## Viewer Verification

On phones, the normal preview is half the visible browser viewport height;
parameters scroll in the panel below it. Expanding settings does not resize the
preview. Very short landscape screens may scroll the page normally to retain a
usable parameter panel. Fullscreen fills the browser window without switching
the operating system's display mode. Phones show only the interactive canvas
and a 44 px exit control; larger displays retain parameters on the left and
the viewer on the right, without the website header or model-picker row.
Framing uses a reversible reference projection to avoid cropping wide models
or accumulating changes across rotation and repeated toggles. Orbit, pan and
user zoom are preserved, as is page scroll position on exit.

`node --test _tools/model-library/layout.test.mjs` checks sizing and projection
math. `node _tools/model-library/fullscreen-browser.cjs` checks all twelve models
on mobile and desktop, including light/dark screenshots, canvas pixels, touch
orbit/pinch, mouse orbit, rotation, focus, scroll locking and exit restoration.
`MODEL_ID` accepts a comma-separated selection for focused checks.

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
Each model entry point imports the shared UI after its import map. The picker
must not start a module before that map: Firefox rejects late import maps and
otherwise leaves models at their initial loading message. Run
`node _tools/model-library/loading-browser.cjs` for Firefox and Chromium startup,
worker geometry, canvas and picker checks across all thirteen models. `BROWSER`,
`MODEL_ID` (comma-separated) and `SITE_URL` allow focused or nested-path checks.
The square pole head and depth-taper hangboard have a three-minute calculation
budget: exact OpenCascade builds can exceed 90 seconds in Firefox. Other
migrated models retain the 90-second limit. Progress, cancellation and timeout
recovery still apply; no geometry or tessellation is simplified for a browser.
All model pages keep a short object description and essential controls visible;
less-common geometry, display settings and reports are under descriptive collapsed
sections named for their contents. Scrollbar space is always reserved so folds
cannot narrow the controls. The coffee holder's basic controls are orientation,
filter-paper preset, stack depth and mounting system. Its preview density defaults
to 20 papers per 17 mm; increasing depth preserves sheet spacing and seating angle.
Preview materials remain distinct, but have no colour-customization controls.

Share, reset, explicit Fit and the same download icon are over the preview.
Multi-option downloads have a chevron; each actual file action shows a small
format badge below the icon. Fullscreen hides the model selector and locks
page scrolling; its browser-window layout is described above.
Showing parts, changing dimensions, opening
settings and resizing must preserve camera position, target, orientation and
zoom. Normal resizing changes projection aspect; fullscreen also adjusts the
projection span to preserve limiting-axis framing. Only initial load, changing to a
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
On phones, descriptions and parameters scroll below the half-height preview;
larger displays keep the descriptions and basic parameters visible by default.
Fullscreen provides more working area without allowing the underlying page to scroll.
