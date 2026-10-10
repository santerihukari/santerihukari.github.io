"""Independent STL round-trip checks, separate from the WASM generator."""
import json
from pathlib import Path
import trimesh

root = Path(__file__).resolve().parents[2]
fixture = next(case for case in json.loads((root / '_tools/drone-frame/fixtures.json').read_text()) if case['name'] == 'current')
for name, expected in fixture['expected'].items():
    path = root / f'output/drone-frame/verified-{name}.stl'
    mesh = trimesh.load(path, force='mesh', process=True)
    assert mesh.is_watertight, f'{path.name}: not watertight'
    assert mesh.is_winding_consistent, f'{path.name}: inconsistent winding'
    assert abs(mesh.bounds[0, 2]) < 0.025, f'{path.name}: not at print Z0'
    assert len(mesh.split()) == expected['components'], path.name
    assert abs(mesh.volume - expected['volume']) / expected['volume'] < 0.00001, path.name
    assert abs(mesh.bounds - expected['bounds']).max() < 0.025, path.name
    print(f'PASS {path.name}: watertight, consistent winding, print Z0, correct solids')
for name in ('lower', 'upper'):
    path = root / f'output/drone-frame/drone_frame_v1-compact-layout-{name}.stl'
    mesh = trimesh.load(path, force='mesh', process=True)
    expected = fixture['expected'][name]
    assert mesh.is_watertight and mesh.is_winding_consistent, path.name
    assert abs(mesh.bounds - expected['bounds']).max() < 0.025, path.name
    assert abs(mesh.volume - expected['volume']) / expected['volume'] < 0.00001, path.name
    print(f'PASS browser download {path.name}: source bounds and volume match')
