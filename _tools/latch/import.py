"""Import the approved latch engine and UI into a native Jekyll component."""
from pathlib import Path
from hashlib import sha256
import json
import shutil
from bs4 import BeautifulSoup
from native_app import adapt_app

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
for name in approved:
    original = source / name
    if not original.is_file():
        if name == 'icons/LICENSE':
            continue
        raise FileNotFoundError(original)
    target = destination / Path(name).name if name in approved[:3] else assets / name.replace('latch-assets/vendor/', 'manifold/')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target)
    manifest[name] = sha256(original.read_bytes()).hexdigest()
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
(destination / 'app.js').write_text(app, encoding='utf-8')
soup = BeautifulSoup((source / 'index.html').read_text(encoding='utf-8'), 'html.parser')
component = soup.new_tag('section', id='latchWorkbench', attrs={'class': 'latch-page'})
component.append(soup.body.header.extract())
component.append(soup.body.main.extract())
for img in component.select('img[src]'):
    name = Path(img['src']).name
    img['src'] = "{{ '/assets/cad/latch/icons/" + name + "' | relative_url }}"
component.select_one('#latch-download img')['src'] = "{{ '/assets/icons/download.svg' | relative_url }}"
component.select_one('#latch-glb img')['src'] = "{{ '/assets/icons/download.svg' | relative_url }}"
note=soup.new_tag('div', attrs={'class':'latch-status', 'role':'note'})
note.string='Experimental print fit; release, nut insertion and latch strength require physical testing.'
component.select_one('.workspace').append(note)
(root / '_includes/latch-configurator.html').write_text(str(component) + '\n', encoding='utf-8')
(assets / 'source-manifest.json').write_text(json.dumps({'copyright': 'Santeri Hukari', 'release': 'V3 smooth upper sleeve and integral capture-lip stop', 'source_sha256': manifest}, indent=2) + '\n', encoding='utf-8')
print('Imported approved native latch component, engine, legacy comparison and licences')
