"""Independent STL round-trip checks, separate from the WASM generator."""
import json
from pathlib import Path
import trimesh

root = Path(__file__).resolve().parents[2]
fixture = next(case for case in json.loads((root / '_tools/drone-frame/fixtures.json').read_text()) if case['name'] == 'current')
for path in sorted((root / 'output/drone-frame').glob('verified-*.stl')):
    mesh = trimesh.load(path, force='mesh', process=True)
    assert mesh.is_watertight, f'{path.name}: not watertight'
    assert mesh.is_winding_consistent, f'{path.name}: inconsistent winding'
    assert abs(mesh.bounds[0, 2]) < 0.025, f'{path.name}: not at print Z0'
    name = path.stem.removeprefix('verified-')
    assert len(mesh.split()) == (4 if name == 'keepers' else 1), path.name
    if name in fixture['expected']:
        expected = fixture['expected'][name]
        assert abs(mesh.volume - expected['volume']) / expected['volume'] < 0.002, path.name
    print(f'PASS {path.name}: watertight, consistent winding, print Z0, correct solids')
