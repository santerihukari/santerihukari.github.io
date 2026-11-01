# Browser Optics Lab

Public project: `/projects/optics-lab/`. App: `/tools/optics/`.

The Jekyll page uses a focused full-viewport tool layout, a website-home link,
project notes, and the site's `theme` preference. No new main-navigation item
is added. The Portfolio collection discovers its project record normally.

## Browser Numerical Engine

`assets/optics/physics-worker.mjs` loads a pinned, self-hosted Pyodide 314.0.7
runtime and its NumPy/SciPy packages. The renderer and UI remain JavaScript /
Three.js. No calculation endpoint, account, Python server, CDN or third-party
inference request is used at runtime. Only static GET requests leave the page.
The initial runtime payload is about 30.4 MB before normal HTTP compression.
Browser caching can reuse it; there is no permanent offline-cache guarantee.

`physics.zip` contains the unchanged approved numerical model and only the
imported pure-Python dependency closure, with licence texts. Numerical libraries
are RayTracing 1.4.7 and RayOptics 0.9.10. Matplotlib plotting, native networking
and native process-pool APIs are unavailable through an explicit browser
compatibility adapter; none are used by `calculate`. Vendor numerical files are
not rewritten. The retained local prototype remains in ignored `output/`.

Requests are typed settings, not Python source. The worker validates them through
the existing bounded model, queues only the newest pending calculation, and
returns structured results. The UI ignores superseded results and retains
camera position. Runtime initialization has visible progress and error/reload
states. The model archive is checked against its SHA-256 manifest before use.

Sensor format changes field of view and sampling, not lens power, sensor
extension or best-focus distance. The default diagonal-based acceptable-blur
criterion changes with sensor format; a fixed custom criterion does not.
Display rays include a circular/polygonal marginal outline in addition to
interior samples. These extra display rays do not reweight spot statistics.
Bokeh demo is reversible: Exit bokeh demo restores the previous settings,
view, camera and inspection crop. Reset restores defaults and System view.
System view labels its default compressed object space as a schematic, not
to scale. True scale uses one millimeter scale for the full optical geometry;
Lens bench keeps a close true-scale view of the glass/sensor section. Readouts
distinguish front vertex, rear vertex and rear principal-plane sensor distances.

## Workspace Controls

Geometric options keeps preview brightness normalized. Exposure opens the
large sensor view and starts in Manual exposure; Auto brightness normalizes
brightness without claiming to simulate a camera's automatic meter. Manual
gain follows shutter time, ISO, finite-distance f-number and pupil open area.
ISO is a gain proxy, not collected photons. Exposure mode adds deterministic,
display-referred signal-dependent shot/read grain, with an on/off comparison.
The variance follows a generic Poisson/Gaussian-style model; coefficients are
illustrative, not measurements of the selected Canon camera. Auto brightness
is an equal-brightness ISO comparison, not a physical auto-exposure solver.
Preview downsampling averages noise; a native-pixel crop shows the larger
per-pixel grain. Noise is applied after temporal/aperture accumulation, so it
does not disappear as rendering samples accumulate. Geometry stays noise-free.
The mode and exposure choice are included in shared settings links.

The shutter slider steps through common fractions, seconds and minute values.
Its adjacent seconds field accepts any positive finite duration, including
values beyond the slider's standard range; these are marked custom. No
camera-specific bulb-time limit is imposed. Exposure EV is calculated in log
space so extreme values remain finite; the display saturates safely. Motion
blur still uses 48/96 time samples and warns about long moving-subject
exposures. Dark current, hot pixels and temperature-dependent noise are not
modeled. This is not a calibrated long-exposure or sensor-performance model.

Auto ISO keeps shutter and aperture fixed and selects a third-stop ISO from
100 to 51200 to match the model's reference exposure. It includes finite-distance
f-number and pupil-mask area. The selected ISO drives the noise model, and the
UI disables manual ISO inputs and reports lower/upper limits. This is
reference-based metering, not a calibrated scene-luminance meter, and remains
separate from Auto brightness's display normalization.

The ISO ceiling follows the EOS R5's normal still-photo maximum of 51200;
expanded H (102400) is not enabled. Manual ISO retains the existing ISO 50
low setting, corresponding to the R5's expanded L. Auto ISO uses the documented
100-51200 range. These limits apply to the teaching demo, not a complete
emulation of each camera preset or its shooting modes.
[Canon EOS R5 specifications](https://downloads.canon.com/nw/camera/products/eos/product-1/pdfs/EOSR5_specifications_FINAL_JULY14.pdf).

Noise-model background: [Foi et al., 2008](https://webpages.tuni.fi/foi/papers/Foi-PoissonianGaussianClippedRaw-2007-IEEE_TIP.pdf)
and [EMVA 1288](https://www.emva.org/wp-content/uploads/EMVA1288Linear_4.0Release.pdf).
The shutter/Bulb distinction follows [Canon's guidance](https://cam.start.canon/en/C003/manual/html/UG-02_ShootingMode_0090.html).

One camera/sensor selector sets sensor width, height and pixel pitch together.
R5, R6 and R6 Mark II use 36 x 24 mm; R7 uses 22.3 x 14.8 mm. Approximate
published square-pixel pitches are respectively 4.40, 6.56, 6.00 and 3.20 um.
All three editable fields appear only under Custom sensor format and pixel
pitch. Saved settings must match the complete triple to receive a camera name;
legacy mixed settings stay unchanged and are presented as Custom.
Sources live alongside the presets in `assets/optics/camera-presets.mjs`.

Circular/polygonal pupils now also support star, heart, cross and narrow-slit
masks. The numerical model supplies the same boundary and preview samples to
the 3D iris, ray diagram, scene renderer and point-source PSF. Manual exposure
accounts for their relative open area. Diffraction still uses the documented
circular-Airy approximation, not the diffraction pattern of each special mask.

Mobile Geometry keeps the single sensor canvas visible while controls or
analysis are selected. Sensor view uses the larger central image instead of a
duplicate preview. Short landscape screens place controls beside the views.

Focused browser verification:

```powershell
node _tools/optics/workspace.cjs
node _tools/optics/workspace.cjs --sensor-presets-only
node _tools/optics/exposure.cjs
$env:OPTICS_BROWSER = 'firefox'
node _tools/optics/workspace.cjs
```

## Reproduction

```powershell
F:/anaconda3/python.exe _tools/optics/prepare.py --snapshot --runtime
F:/anaconda3/python.exe _tools/optics/fixtures.py
F:/anaconda3/python.exe _tools/optics/test_optics.py
bundle exec jekyll build
node --test _tools/optics/*.test.mjs
node _tools/optics/browser.cjs
```

`--snapshot` requires the retained prototype. It imports UI sources only when
their public targets do not yet exist, so subsequent imports cannot overwrite
the site adaptations. It rebuilds the frozen numerical archive, defaults and
file manifest. Review model changes before doing that. `--runtime` downloads
only the four runtime core files and the selected dependency closure, checks
package hashes against the pinned official lock, and records sizes and hashes.
It does not alter Cloudflare, DNS, Python environments, Git or deployment.

The tracked Python tests and `field-of-view.test.mjs` cover the model's
independent equations and field geometry. Browser verification compares a
matrix of actual WebAssembly results to native Python fixtures, checks that
there are no API/POST/external requests, and exercises the inherited controls,
rendered pixels, fullscreen, themes and narrow layouts. Jekyll builds with a
nonempty `baseurl` check nested-path deployment separately.

Generated fixtures, reports and screenshots belong under `output/optics-site/`,
not the public app. No photo originals, engine recordings, local credentials,
private CAD or local-server code is included. Preserve unrelated pending work.

Initial local headless checks measured approximately 9.2 seconds for Chromium
and 55.1 seconds for Firefox startup. These are observations on this machine,
not a device benchmark or a performance guarantee. The reload checks allow
120 seconds for the interpreter and numerical packages to initialize. The
main thread remains separate from calculations; the progress/error state must
remain visible while the worker initializes.

## Publication Limits

This is an educational prototype, not an instrument or a measured-lens model.
The public project page and in-app model notes retain first-order projection,
flat-field, geometric-bokeh, diffraction-grid, brightness, occlusion and
calibration caveats. Software parity is not validation against actual optics.

Pyodide is MPL-2.0; its original licence and the unmodified compiled runtime are
redistributed together. NumPy/SciPy licences are inside their wheels. The
numerical ZIP and `licenses/` retain RayTracing MIT, RayOptics BSD-3-Clause,
AnyTree Apache-2.0, transforms3d BSD, CPython, Three.js MIT and icon notices.
Original demo copyright: Santeri Hukari.
