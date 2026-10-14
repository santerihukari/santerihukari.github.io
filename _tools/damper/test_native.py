"""Independent checks against the read-only native CAD and downloaded artifacts."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from hashlib import sha256
from io import BytesIO
from zipfile import ZipFile
import json
import os
import re
import subprocess
import unittest

import numpy as np
import trimesh
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('F:/param_cad')
ASSETS = ROOT / 'assets/cad/air-damper'
QA = ROOT / 'output/damper'
NODE = 'C:/Users/Santeri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
sys.path.insert(0, str(SOURCE))
from cabinet_air_damper_v1 import model


def read(name):
    return json.loads((ASSETS / name).read_text(encoding='utf-8'))


def glb_json(path):
    contents = path.read_bytes()
    size = int.from_bytes(contents[12:16], 'little')
    return json.loads(contents[20:20+size])


class NativeParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = read('model.json')
        cls.manifest = read('print_manifest.json')
        cls.params = model.load_params()
        cls.native = SOURCE / 'cabinet_air_damper_v1/generated'

    def test_all_copied_source_hashes(self):
        source = read('source-manifest.json')
        for name, digest in source['source_sha256'].items():
            with self.subTest(name=name):
                self.assertEqual(sha256((ASSETS/name).read_bytes()).hexdigest(), digest)
                self.assertEqual((ASSETS/name).read_bytes(), (self.native/name).read_bytes())
        self.assertEqual(source['generator_sha256'], sha256((SOURCE/'cabinet_air_damper_v1/model.py').read_bytes()).hexdigest())
        self.assertEqual(self.data['parameters'], read('params.json'))

    def test_print_quantities_poses_volumes_and_meshes(self):
        self.assertEqual(len(self.manifest), 9)
        self.assertEqual(sum(item['quantity'] for item in self.manifest), 14)
        shapes = model.printed_shapes(self.params)
        for item in self.manifest:
            with self.subTest(part=item['part']):
                mesh = trimesh.load(ASSETS/item['file'], force='mesh')
                native = model.to_mesh(model.print_shape(shapes[item['part']], item['part']))
                self.assertTrue(mesh.is_volume and mesh.is_watertight and mesh.is_winding_consistent)
                self.assertEqual(len(mesh.split()), 1)
                np.testing.assert_allclose(mesh.bounds, native.bounds, atol=.00002)
                np.testing.assert_allclose(mesh.extents, item['dimensions_mm'], atol=.00002)
                self.assertAlmostEqual(mesh.bounds[0, 2], 0, places=5)
                self.assertAlmostEqual(mesh.volume/item['volume_mm3'], 1, places=5)

    def test_full_native_geometry_and_capped_positive_y_sections(self):
        shapes = model.assembly_shapes(self.params)
        self.assertEqual(len(self.data['parts']), 16)
        half = model.box(-500, 500, 0, 500, -500, 500)
        for part in self.data['parts']:
            if part['reference']:
                continue
            with self.subTest(part=part['name']):
                mesh = trimesh.Trimesh(np.array(part['positions']).reshape(-1,3), np.array(part['indices']).reshape(-1,3))
                native = model.to_mesh(shapes[part['name']])
                np.testing.assert_allclose(mesh.bounds, native.bounds, atol=.00002)
                self.assertAlmostEqual(mesh.volume/native.volume, 1, delta=.00001)
                half_shape = shapes[part['name']].intersect(half)
                if half_shape.Volume() < 1e-8:
                    self.assertEqual(part['section_positions'], [])
                    continue
                cut = trimesh.Trimesh(np.array(part['section_positions']).reshape(-1,3), np.array(part['section_indices']).reshape(-1,3))
                self.assertTrue(cut.is_watertight and cut.is_volume)
                self.assertGreaterEqual(cut.bounds[0,1], -.00002)
                self.assertAlmostEqual(cut.volume/half_shape.Volume(), 1, places=3)
                caps = np.all(np.abs(cut.vertices[cut.faces][:,:,1])<.00002, axis=1)
                if half_shape.Volume() < shapes[part['name']].Volume()-.01:
                    self.assertTrue(caps.any())

    def test_browser_spring_matches_native_at_zero_working_and_maximum(self):
        script = "import {springGeometry} from './src/damper/geometry.mjs';const p="+json.dumps(self.data['parameters'])+";console.log(JSON.stringify([0,17,20].map(s=>springGeometry(p,s))));"
        output = subprocess.check_output([NODE,'--input-type=module','-e',script],cwd=ROOT,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
        for stroke, result in zip([0,17,20], json.loads(output)):
            with self.subTest(stroke=stroke):
                native = model.spring_mesh(self.params,stroke)
                mesh = trimesh.Trimesh(np.array(result['positions']).reshape(-1,3),np.array(result['indices']).reshape(-1,3))
                self.assertTrue(mesh.is_watertight and mesh.is_volume)
                self.assertLess(cKDTree(native.vertices).query(mesh.vertices)[0].max(), 1e-9)
                np.testing.assert_allclose(mesh.bounds,native.bounds,atol=1e-9)
                self.assertAlmostEqual(mesh.volume/native.volume,1,places=9)

    def test_zip_separate_prints_quantities_instructions_and_no_private_paths(self):
        with ZipFile(ASSETS/'print-set.zip') as package:
            stls = [name for name in package.namelist() if name.endswith('.stl')]
            self.assertEqual(set(stls), {item['file'] for item in self.manifest})
            self.assertFalse(any('spring' in name or 'assembly' in name for name in stls))
            self.assertEqual(json.loads(package.read('print_manifest.json')),self.manifest)
            for name in package.namelist():
                if not name.endswith('.stl'):
                    self.assertIsNone(re.search(rb'(?i)(?<![a-z])[a-z]:[\\/]',package.read(name)))
            notes=package.read('README.md').decode()
            self.assertIn('Santeri Hukari',notes)
            self.assertIn('unverified',notes.lower())
            self.assertEqual(notes,(ASSETS/'README.md').read_text(encoding='utf-8'))

    def test_saved_glb_metres_y_up_colored_named_and_authored(self):
        scene = trimesh.load(ASSETS/'assembly.glb',force='scene')
        native = trimesh.load(self.native/'assembly.glb',force='scene')
        transform = trimesh.transformations.rotation_matrix(-np.pi/2,[1,0,0]);transform[:3,:3]*=.001
        native.apply_transform(transform)
        np.testing.assert_allclose(scene.bounds,native.bounds,atol=1e-8)
        self.assertEqual(len(scene.geometry),16)
        self.assertLess(scene.extents.max(),.2)
        metadata = glb_json(ASSETS/'assembly.glb')
        self.assertIn('Santeri Hukari',json.dumps(metadata['scenes']))
        self.assertTrue(all('COLOR_0' in primitive['attributes'] for mesh in metadata['meshes'] for primitive in mesh['primitives']))

    def test_physical_validation_remains_explicitly_unresolved(self):
        report = read('fit_report.json')
        self.assertEqual(report['geometry_status'],'pass')
        self.assertFalse(report['performance_simulated'])
        self.assertGreaterEqual(len(report['unresolved']),6)
        self.assertEqual([row['spring_seat_spacing_mm'] for row in report['states']],[28,11,8])


class BrowserDownloads(unittest.TestCase):
    def setUp(self):
        if not (QA/'stroke-20.glb').exists():
            self.skipTest('Run verify_browser.cjs after the main Jekyll rebuild')

    def test_downloaded_stls_and_zip_match_published_bytes(self):
        for item in read('print_manifest.json'):
            self.assertEqual((QA/item['file']).read_bytes(),(ASSETS/item['file']).read_bytes())
        self.assertEqual((QA/'print-set.zip').read_bytes(),(ASSETS/'print-set.zip').read_bytes())

    def test_current_stroke_glb_is_full_native_not_cutaway_explosion_or_airpaths(self):
        data=read('model.json')
        for stroke in [0,17,20]:
            with self.subTest(stroke=stroke):
                path=QA/f'stroke-{stroke}.glb'
                scene=trimesh.load(path,force='scene')
                document=glb_json(path)
                self.assertEqual(len(scene.geometry),16)
                self.assertIn('Santeri Hukari',json.dumps(document['nodes']))
                self.assertFalse(any(node.get('name','').startswith('reference_air') for node in document['nodes']))
                for part in data['parts']:
                    nodes=[name for name in scene.graph.nodes_geometry if name==part['name']]
                    self.assertEqual(len(nodes),1)
                    matrix,geometry=scene.graph[nodes[0]]
                    exported=scene.geometry[geometry].copy();exported.apply_transform(matrix)
                    if part['name']=='spring':
                        expected=model.spring_mesh(model.load_params(),stroke)
                    else:
                        expected=trimesh.Trimesh(np.array(part['positions']).reshape(-1,3),np.array(part['indices']).reshape(-1,3))
                        if part['moving']:expected.apply_translation([stroke,0,0])
                    transform=trimesh.transformations.rotation_matrix(-np.pi/2,[1,0,0]);transform[:3,:3]*=.001
                    expected.apply_transform(transform)
                    np.testing.assert_allclose(exported.bounds,expected.bounds,atol=1e-8)
                    self.assertAlmostEqual(abs(exported.volume)/expected.volume,1,places=4)
                    self.assertEqual(len(exported.faces),len(expected.faces))


if __name__=='__main__':
    unittest.main(verbosity=2)
