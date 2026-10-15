"""Import the approved latch engine and UI into a native Jekyll component."""
from pathlib import Path
from hashlib import sha256
import json
import shutil
import argparse
from bs4 import BeautifulSoup
from native_app import adapt_app, adapt_component, adapt_model, adapt_example

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ui-only', action='store_true', help='Update only the native app/include; leave all geometry and assets untouched.')
args = parser.parse_args()

root = Path(__file__).resolve().parents[2]
source = Path('F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/static_site')
destination = root / 'src/latch'
destination.mkdir(parents=True, exist_ok=True)
assets = root / 'assets/cad/latch'
approved = ['latch-assets/model.mjs', 'latch-assets/worker.mjs', 'latch-assets/example.mjs', 'latch-assets/vendor/manifold.js', 'latch-assets/vendor/manifold.wasm', 'latch-assets/vendor/LICENSE']
approved += ['legacy/model.json', *[f'legacy/{name}.stl' for name in ('assembly', 'nut_1', 'nut_2', 'fit_gauge')]]
approved += [f'icons/{name}.svg' for name in ('box', 'corner-down-right', 'rotate-ccw', 'panel-left', 'arrow-down', 'maximize', 'scan')]
approved += ['icons/LICENSE']
manifest = {}
for name in ([] if args.ui_only else approved):
    original = source / name
    if not original.is_file():
        if name == 'icons/LICENSE':
            continue
        raise FileNotFoundError(original)
    target = destination / Path(name).name if name in approved[:3] else assets / name.replace('latch-assets/vendor/', 'manifold/')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target)
    manifest[name] = sha256(original.read_bytes()).hexdigest()
if not args.ui_only:
    for name, adapt in [('model.mjs', adapt_model), ('example.mjs', adapt_example)]:
        original = source / 'latch-assets' / name
        (destination / name).write_text(adapt(original.read_text(encoding='utf-8')), encoding='utf-8', newline='\n')
    worker = (destination / 'worker.mjs').read_text(encoding='utf-8').replace("'./vendor/manifold.js'", "'../../assets/cad/latch/manifold/manifold.js'").replace("'./vendor/manifold.wasm'", "'../../assets/cad/latch/manifold/manifold.wasm'")
    (destination / 'worker.mjs').write_text(worker, encoding='utf-8')
app = (source / 'latch.js').read_text(encoding='utf-8')
app = app.replace("'./latch-assets/model.mjs'", "'./model.mjs'").replace("'./latch-assets/example.mjs'", "'./example.mjs'").replace("'./latch-assets/worker.mjs'", "'./worker.mjs'")
app = app.replace("`./icons/${root ? 'box' : 'corner-down-right'}.svg`", "new URL(`../../assets/cad/latch/icons/${root ? 'box' : 'corner-down-right'}.svg`, import.meta.url).href")
app = app.replace("document.documentElement.dataset.static ? `./legacy/${key}.stl` : `./api/latch/files/${key}`", "new URL(`../../assets/cad/latch/legacy/${key}.stl`, import.meta.url).href")
app = app.replace("document.documentElement.dataset.static ? './legacy/model.json' : './api/latch'", "new URL('../../assets/cad/latch/legacy/model.json', import.meta.url)")
app = adapt_app(app)
app = "import {setupLatch} from './adapter.js';\n" + app
assert './api/' not in app and './latch-assets/' not in app
soup = BeautifulSoup((source / 'index.html').read_text(encoding='utf-8'), 'html.parser')
component = adapt_component(soup)
(destination / 'app.js').write_text(app, encoding='utf-8')
(root / '_includes/latch-configurator.html').write_text(component, encoding='utf-8')
if not args.ui_only:
    (assets / 'source-manifest.json').write_text(json.dumps({
        'copyright': 'Santeri Hukari',
        'release': 'V3 one-nut public configuration; smooth sleeve and integral capture-lip stop',
        'public_delta': 'nut_2 omitted; body, insert and nut_1 geometry unchanged. Installation stack uses one nut. Grip V2 is an archived two-nut comparison only.',
        'print_quantity': {'body': 1, 'insert': 1, 'nut_1': 1},
        'adaptation': '_tools/latch/native_app.py',
        'public_sha256': {f'src/latch/{name}': sha256((destination / name).read_bytes()).hexdigest() for name in ['model.mjs', 'example.mjs']},
        'source_sha256': manifest,
    }, indent=2) + '\n', encoding='utf-8')
print('Imported native latch UI only; geometry/assets untouched' if args.ui_only else 'Imported approved native latch component, engine, legacy comparison and licences')
