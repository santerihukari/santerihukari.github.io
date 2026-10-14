"""Check reproducible UI adaptation without writing source or caches."""
from pathlib import Path
from native_app import adapt_app

root = Path(__file__).resolve().parents[2]
source = Path('F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/static_site/latch.js')
app = source.read_text(encoding='utf8')
app = app.replace("'./latch-assets/model.mjs'", "'./model.mjs'").replace("'./latch-assets/example.mjs'", "'./example.mjs'").replace("'./latch-assets/worker.mjs'", "'./worker.mjs'")
app = app.replace("`./icons/${root ? 'box' : 'corner-down-right'}.svg`", "new URL(`../../assets/cad/latch/icons/${root ? 'box' : 'corner-down-right'}.svg`, import.meta.url).href")
app = app.replace("document.documentElement.dataset.static ? `./legacy/${key}.stl` : `./api/latch/files/${key}`", "new URL(`../../assets/cad/latch/legacy/${key}.stl`, import.meta.url).href")
app = app.replace("document.documentElement.dataset.static ? './legacy/model.json' : './api/latch'", "new URL('../../assets/cad/latch/legacy/model.json', import.meta.url)")
app = "import {setupLatch} from './adapter.js';\n" + adapt_app(app)
assert app == (root / 'src/latch/app.js').read_text(encoding='utf8'), 'Native app differs from its checked importer'
print('PASS native app is reproducibly adapted; authoritative geometry remains unchanged')
