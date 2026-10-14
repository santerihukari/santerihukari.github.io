# Latch Verification

Run from `F:/Nettisivut`. The source CAD checkout is read-only. No dependencies
are installed or changed by these checks, and no source caches are required.

```powershell
$node = 'C:/Users/Santeri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PYTHONDONTWRITEBYTECODE = '1'
& $node --test _tools/latch/model.test.mjs
& $node _tools/latch/fixtures.mjs
& F:/anaconda3/python.exe _tools/latch/check_import.py
& F:/anaconda3/python.exe _tools/latch/verify_exports.py
```

The model suite reuses the 11 authoritative source assertions against the
website's native copies. An additional check verifies exact engine/example
hashes and byte-identical Manifold **3.3.2** JavaScript/WASM. Native default
STLs must match the authoritative generated files byte-for-byte. Trimesh
independently checks components, watertightness, winding, volume and mm bounds.

The importer copies the approved engine and adapts the upstream UI using checked
text replacements in `native_app.py`. Running `import.py` preserves native
validity/share/stale-export guards and responsive callout placement.

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
default fixture and five STL byte matches; changed geometry and both presets;
installed reference/nut phases and warnings; fixed cameras during rotation;
normal/installed colored GLBs; legacy restricted exports; current sharing;
malformed/dimension-invalid links and initial/pending-worker invalid-link races;
asynchronous stale GLB cancellation; a route-simulated static deployment
subpath; and ten viewport/theme screenshots with canvas pixel, icon,
horizontal-overflow and callout/axis-overlap checks, including 844x390 short
landscape. The complete tool must stay within the initial viewport; compact
parameter panes scroll independently rather than extending the page.

After browser downloads, the Python verifier checks actual GLB world transforms
and triangle counts via trimesh, including metre volume/bounds, Y-up normal
pose, current angle, installed references and exclusion of exploded offsets.
These are software/CAD checks, not proof of physical print release, nut
insertion, hardware fit or latch strength.
