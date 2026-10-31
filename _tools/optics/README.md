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
