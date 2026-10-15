"""Read-only regression checks for the reproducible native latch layout."""
from pathlib import Path
from hashlib import sha256
import json
import unittest

from bs4 import BeautifulSoup
from native_app import adapt_app, adapt_component, adapt_model, adapt_example

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/static_site')


class NativeLayoutTests(unittest.TestCase):
    def test_reproduced_include(self):
        soup = BeautifulSoup((SOURCE / 'index.html').read_text(encoding='utf8'), 'html.parser')
        self.assertEqual(adapt_component(soup), (ROOT / '_includes/latch-configurator.html').read_text(encoding='utf8'))

    def test_controls_preserved_with_fixed_public_styles(self):
        source = BeautifulSoup((SOURCE / 'index.html').read_text(encoding='utf8'), 'html.parser')
        native = BeautifulSoup((ROOT / '_includes/latch-configurator.html').read_text(encoding='utf8'), 'html.parser')
        for select in source.select('select[id]'):
            fixed = {'handle-style': 'ergonomic', 'stop-style': 'arc'}.get(select['id'])
            imported = native.select_one('#' + select['id'])
            expected = [fixed] if fixed else [option['value'] for option in select.select('option') if select['id'] != 'latch-export' or option['value'] != 'nut_2']
            self.assertEqual(expected, [option['value'] for option in imported.select('option')])
            if fixed:
                self.assertTrue(imported.has_attr('disabled'))
                self.assertTrue(imported.parent.has_attr('hidden'))
        for node in source.select('input[id]'):
            self.assertIsNotNone(native.select_one('#' + node['id']))
        self.assertIsNone(native.select_one('option[value="half_round"], option[value="rectangular"]'))
        source_ids = {node['id'] for node in source.select('body [id]')}
        native_ids = [node['id'] for node in native.select('[id]')]
        self.assertTrue(source_ids.issubset(native_ids))
        self.assertEqual(len(native_ids), len(set(native_ids)))
        self.assertEqual([folder.summary.text for folder in native.select('aside .cad-options')], ['Latch dimensions and fit', 'Preview options', 'Dimensions and sources'])
        self.assertTrue(all(not folder.has_attr('open') for folder in native.select('aside .cad-options')))
        for id, format in [('latch-download', 'STL'), ('latch-glb', 'GLB')]:
            self.assertEqual(native.select_one('#' + id).text.strip(), format)

    def test_description_distinguishes_normal_use_from_strength_testing(self):
        native = BeautifulSoup((ROOT / '_includes/latch-configurator.html').read_text(encoding='utf8'), 'html.parser')
        description = native.select_one('.cad-description').text
        self.assertIn('one-nut', description)
        self.assertIn('functional and ergonomic in normal use', description)
        self.assertIn('volleyball strike', description)
        self.assertIn('repeated heavy use have not been tested', description)
        self.assertFalse(native.select_one('.cad-description').find_parent('details'))
        self.assertNotIn('combined door/frame mounting thickness', description)
        self.assertNotRegex(description, r'\d|maximum|up to')
        self.assertIn('illustrative', native.select_one('.latch-safety').text)
        self.assertIsNone(native.select_one('#latch-export option[value="nut_2"]'))
        self.assertIn('historical two-nut comparison', native.select_one('option[value="grip_v2"]').text)
        gauge = native.select_one('option[value="fit_gauge"]')
        self.assertTrue(gauge.has_attr('disabled'))
        self.assertIn('Historical Grip V2', gauge.text)
        for id in ['latch-visibility', 'latch-motion-options']:
            self.assertFalse(native.select_one('#' + id).has_attr('open'))
            self.assertEqual(native.select_one('#' + id).find_parent('details')['id'], 'latch-preview')

    def test_public_styles_normalize_before_dimension_validation(self):
        app = (ROOT / 'src/latch/app.js').read_text(encoding='utf8')
        self.assertIn("parameters({...p, handle_style: 'ergonomic', stop_style: 'arc'})", app)
        self.assertNotIn('HANDLE_PRESETS', app)
        self.assertNotIn("$('handle-style').addEventListener", app)
        self.assertNotIn("$('stop-style').addEventListener", app)
        sync = app.split('function syncInputs() {', 1)[1].split('const essential', 1)[0]
        self.assertNotIn('half_round', sync)
        self.assertNotIn('params.handle_depth =', sync)
        self.assertIn("slider.disabled = number.disabled = key === 'stop_y'", sync)

    def test_public_delta_is_reproducible_and_source_hashes_are_preserved(self):
        manifest = json.loads((ROOT / 'assets/cad/latch/source-manifest.json').read_text(encoding='utf8'))
        for native, original, adapt in [('src/latch/model.mjs', 'latch-assets/model.mjs', adapt_model), ('src/latch/example.mjs', 'latch-assets/example.mjs', adapt_example)]:
            expected = manifest['source_sha256'][original]
            self.assertEqual(sha256((SOURCE / original).read_bytes()).hexdigest(), expected)
            self.assertEqual(sha256((ROOT / native).read_bytes()).hexdigest(), manifest['public_sha256'][native])
            self.assertEqual((ROOT / native).read_text(encoding='utf8'), adapt((SOURCE / original).read_text(encoding='utf8')))
        for name in ['model.json', 'assembly.stl', 'nut_1.stl', 'nut_2.stl', 'fit_gauge.stl']:
            self.assertEqual(sha256((ROOT / 'assets/cad/latch/legacy' / name).read_bytes()).hexdigest(), manifest['source_sha256']['legacy/' + name])

    def test_source_drift_fails_closed(self):
        source = (SOURCE / 'latch.js').read_text(encoding='utf8')
        with self.assertRaisesRegex(ValueError, 'Latch source changed'):
            adapt_app(source.replace('function activeFeature()', 'function renamedFeature()'))

    def test_visibility_never_frames(self):
        app = (ROOT / 'src/latch/app.js').read_text(encoding='utf8')
        self.assertNotIn("if(id==='latch-isolate')fitView", app)
        example = app.split('function editExample() {', 1)[1].split("$('latch-installed')", 1)[0]
        self.assertNotIn('fitView', example)
        self.assertIn('if (frameNextModel) { fitView(view); frameNextModel = false; }', app)
        self.assertIn('registerViewer(root, {camera, controls: orbit})', app)
        self.assertIn('resizeCamera(camera, width, height)', app)
        self.assertIn('sequence === exportSequence && glbState() === exportState', app)
        self.assertIn('function activeFeature() { return features.get(hoverId || selectedId); }', app)
        self.assertIn("$('hover-name').textContent = features.get(selectedId)?.name", app)
        self.assertNotIn("$('hover-name').textContent = active?.name", app)
        labels = app.split('function makeLabels() {', 1)[1].split('function updateLabels()', 1)[0]
        self.assertEqual(labels.count('makeLabel('), 1)
        self.assertNotIn('allParts()', labels)
        self.assertIn('features.get(selectedId)', labels)
        self.assertNotIn('activeFeature()', labels)


if __name__ == '__main__':
    unittest.main()
