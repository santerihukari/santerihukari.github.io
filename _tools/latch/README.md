# Latch Verification

Run from `F:/Nettisivut`. The source CAD checkout is read-only. No dependencies
are installed or changed by these checks, and no source caches are required.

```powershell
$node = 'C:/Users/Santeri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PYTHONDONTWRITEBYTECODE = '1'
& $node --test _tools/latch/model.test.mjs
& $node _tools/latch/fixtures.mjs
& F:/anaconda3/python.exe _tools/latch/check_import.py
& F:/anaconda3/python.exe -B _tools/latch/ui.test.py
& F:/anaconda3/python.exe _tools/latch/verify_exports.py --fixtures-only
```

The model suite runs the 11 authoritative assertions against the original
two-nut source baseline, NOT as a full-assembly public parity claim. Separate
public tests verify the intentional one-nut delta, exact retained body/insert/
nut_1 geometry and STL bytes across four parameter sets, report quantities,
and the one-nut panel mounting stack/phase with no body/panel/nut overlaps.
Source and public hashes are recorded separately; Manifold **3.3.2** JavaScript/
WASM stays byte-identical. Retained default STLs match their authoritative
generated files byte-for-byte. Trimesh
independently checks components, watertightness, winding, volume and mm bounds.
Before a fresh browser pass, use `--fixtures-only`; old two-nut browser downloads
are deliberately rejected by the full verifier, never accepted as current proof.

The importer adapts the approved engine, installation fixture and upstream UI
using checked text replacements and a control-preserving HTML rearrangement
in `native_app.py`. `adapt_model` changes the solid output list (not body, insert
or nut construction), removes nut_2 inspection metadata and updates quantities/
validation wording. `adapt_example` keeps nut_1 at panel thickness with its exact
screw phase; the default 4 mm panel plus 4 mm nut makes an 8 mm mounting stack.
The fixture is illustrative and does not reconstruct the user's installed door.
`python -B _tools/latch/import.py --ui-only` regenerates only `src/latch/app.js`
and `_includes/latch-configurator.html`, without writing geometry, workers,
source manifests or assets. The normal full import still copies the approved
engine and reapplies the checked one-nut adaptation. `check_import.py` checks the exact regenerated app; `ui.test.py` checks
the exact regenerated include, preserved control IDs, approved options and
fail-closed source drift. Both modes preserve validity/share/stale-export guards.
The public V3 latch fixes the rounded half-oval (`ergonomic`) handle and swept-arc
(`arc`) stops. Hidden disabled style controls retain the source IDs but contain
only those values; preset-selection wiring is removed. Old full-state links are
normalized to these styles before dimension validation, without resetting their
dimensions. Historical `half_round`/`rectangular` signatures stay in the
CAD engine, not in public preset options. Grip V2 remains a read-only comparison
under Dimensions and sources, explicitly labelled a historical two-nut comparison.
Only that comparison exposes its archived second nut and original thread gauge;
the gauge remains disabled for V3 and is not evidence of current thread fit.
Legacy assets and their source hashes remain unchanged.

The always-visible description explains the compact door/frame closure and the
user-reported installed functional/ergonomic normal-use check. Impacts (such as
a volleyball strike) and repeated heavy use remain untested. The technical note
asks for panel thickness plus ONE nut, reach and rotation checks, and distinguishes
the illustrative installation fixture from the real installation. Parameter
changes and new prints need fit checks; strength has not been qualified.

## Browser Pass

Ask the main coordinator to rebuild Jekyll before testing its no-watch server.
The browser script refuses stale served app/model/adapter/example/CSS files.
It never changes or restarts the server. In the current Windows sandbox,
Chromium needs an approved escalation for this localhost-only headless test.

```powershell
$env:NODE_PATH = 'C:/Users/Santeri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'
& $node _tools/latch/browser.cjs
& F:/anaconda3/python.exe _tools/latch/verify_exports.py
```

Add `--layout` for the isolated desktop/mobile light/dark pass. Set `SITE_URL`
only when the existing server URL differs. QA files stay under `qa/`, which
is excluded from publication by the site's existing `_tools/` exclusion and
from Git by the coordinator's `/_tools/*/qa/` ignore rule.

`--layout --source-css` previews the current CSS with a test-only browser
response when only that served file is stale. It never changes the server;
results are marked separately and do not replace a normally served final pass.

Browser coverage includes all feature selections and capture-lip children;
public one-nut fixture and four STL byte matches; editable dimensions with fixed styles;
installed reference/nut phases and warnings; fixed pose, pan and zoom during
rotation, visibility toggles, parameter/example edits and responsive resize;
normal/installed colored GLBs; legacy restricted exports; current sharing;
old-style links on startup and hash changes, preserving dimensions;
malformed/dimension-invalid links, explicit null and unsupported `genOpts: null`
payload rejection, and initial/pending-worker invalid-link races;
asynchronous stale GLB cancellation; a route-simulated static deployment
subpath; and ten viewport/theme screenshots with canvas pixel, icon,
horizontal-overflow and callout/control/axis-overlap checks, including 844x390
short landscape. Only the selected feature has one object-anchored label;
hovering highlights the hovered feature without changing the clicked name label
or the selection-only technical readout,
and an idle model shows none. Layout checks
cover collapsed Latch dimensions and fit/Preview options/Dimensions and sources,
visible essential controls, hidden fixed-style controls,
STL/GLB format badges, the icon-only downloads menu and shared scroll-rail keyboard use.
The default sidebar shows the fit description, latch reach and body height.
Shaft motion is under Preview options; custom handle dimensions and
thread/capture/stop fit are under Latch dimensions and fit.
The complete tool must stay within the initial viewport; compact
parameter panes scroll independently rather than extending the page.

After browser downloads, the Python verifier checks actual GLB world transforms
and triangle counts via trimesh, including metre volume/bounds, Y-up normal
pose, current angle, installed references and exclusion of exploded offsets.
These are software/CAD checks, separate from the user's reported normal-use
validation, and are not proof of strength or impact/repeated-heavy-use durability.
