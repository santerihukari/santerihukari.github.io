"""Independent trimesh checks for native fixtures and real browser downloads."""
from pathlib import Path
from hashlib import sha256
import json
import argparse
import numpy as np
import trimesh

here = Path(__file__).resolve().parent
qa = here / 'qa'
source = Path('F:/param_cad/threaded_cylinder_22mm_thread_only/parametric_latch/generated')
model = json.loads((qa / 'fixtures/model.json').read_text(encoding='utf8'))
checks = 0
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixtures-only', action='store_true', help='Check current generated fixtures without treating previous browser downloads as current evidence.')
args = parser.parse_args()


def check_stl(path, parts, expected_bytes=None):
    global checks
    mesh = trimesh.load(path, force='mesh', process=True)
    assert mesh.is_watertight and mesh.is_winding_consistent, path.name
    components = mesh.split()
    assert len(components) == len(parts), f'{path.name}: wrong solid count'
    assert all(component.volume > 0 for component in components), path.name
    points = np.concatenate([part['vertices'] for part in parts])
    expected_bounds = np.array([points.min(axis=0), points.max(axis=0)])
    assert np.allclose(mesh.bounds, expected_bounds, atol=1e-5), path.name
    volume = sum(part['volume_mm3'] for part in parts)
    assert np.isclose(mesh.volume, volume, rtol=1e-6), path.name
    if expected_bytes is not None:
        assert sha256(path.read_bytes()).digest() == sha256(expected_bytes).digest(), path.name
    checks += 1
    print(f'PASS {path.relative_to(here)}: {len(components)} closed solids, mm bounds/volume/bytes')


assert [part['id'] for part in model['parts']] == ['body', 'insert', 'nut_1']
assert model['report']['print_quantity'] == {'body': 1, 'insert': 1, 'nut_1': 1}
for key in ['assembly', 'body', 'insert', 'nut_1']:
    selected = [part for part in model['parts'] if part['id'] in (['body', 'insert'] if key == 'assembly' else [key])]
    fixture = qa / 'fixtures' / f'{key}.stl'
    check_stl(fixture, selected, (source / f'{key}.stl').read_bytes())
    browser = qa / 'downloads' / f'default_{key}.stl'
    if not args.fixtures_only and browser.exists():
        check_stl(browser, selected, fixture.read_bytes())

if not args.fixtures_only and (qa / 'downloads/installed_assembly.stl').exists():
    check_stl(qa / 'downloads/installed_assembly.stl', model['parts'][:2], (qa / 'fixtures/assembly.stl').read_bytes())
if not args.fixtures_only and (qa / 'downloads/changed_model.json').exists():
    changed = json.loads((qa / 'downloads/changed_model.json').read_text())
    assert [part['id'] for part in changed['parts']] == ['body', 'insert', 'nut_1'], 'Stale two-nut browser download; rebuild and rerun browser.cjs'
    check_stl(qa / 'downloads/changed_assembly.stl', changed['parts'][:2])

for record_path in ([] if args.fixtures_only else sorted((qa / 'downloads').glob('*_glb_expected.json'))):
    record = json.loads(record_path.read_text())
    assert 'Threaded nut 2' not in record['nodes'], 'Stale two-nut GLB; rebuild and rerun browser.cjs'
    expected_names = {part['name'] for part in model['parts']}
    if record['file'].startswith('installed_'):
        expected_names.update(['Example door panel', 'Example frame jamb'])
    assert set(record['nodes']) == expected_names, 'Unexpected current public GLB part list'
    path = record_path.with_name(record['file'])
    scene = trimesh.load(path, force='scene', process=True)
    assert len(scene.geometry) == len(record['nodes']), path.name
    found = {}
    for node in scene.graph.nodes_geometry:
        transform, geometry = scene.graph[node]
        geometry = scene.geometry[geometry].copy()
        geometry.apply_transform(transform)
        # Exporter node names are preserved; never infer GLB units from raw accessors.
        found[node] = geometry
    for name, expected in record['nodes'].items():
        mesh = found[name]
        assert np.allclose(mesh.bounds, expected['bounds_m'], atol=1e-7), f'{path.name}: {name} metre/Y-up bounds'
        if expected.get('volume_m3') is not None:
            assert mesh.is_watertight and mesh.is_winding_consistent, f'{path.name}: {name}'
            assert np.isclose(mesh.volume, expected['volume_m3'], rtol=1e-5), f'{path.name}: {name} metre volume'
        assert len(mesh.faces) == expected['faces'], f'{path.name}: {name} triangles'
    assert np.max(scene.extents) < .3, f'{path.name}: mm exported as metres without conversion'
    checks += 1
    print(f'PASS {path.relative_to(here)}: {len(found)} named objects, metre/Y-up transforms, current angle')

print(f'{checks} independent export checks passed')
