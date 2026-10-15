"""Independent checks of actual browser exports for the self-standing prototype."""
from pathlib import Path
import json
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2] / 'output/coffee-filter/variants'
for item in json.loads((ROOT / 'expected.json').read_text(encoding='utf8')):
    mesh = trimesh.load(ROOT / (item['name'] + '.stl'), force='mesh')
    assert mesh.is_volume and mesh.is_watertight and mesh.is_winding_consistent
    assert len(mesh.split()) == 1
    np.testing.assert_allclose(mesh.bounds.reshape(-1), item['bounds'], atol=2e-5)
    assert abs(mesh.volume / item['volume'] - 1) < 2e-5
    assert abs(mesh.bounds[0, 2]) < 2e-5
    scene = trimesh.load(ROOT / (item['name'] + '.glb'))
    assert isinstance(scene, trimesh.Scene) and len(scene.geometry) == 21
    node = next(name for name in scene.graph.nodes_geometry if name.replace(' ', '_').startswith('Coffee_filter_holder'))
    holder = scene.geometry[scene.graph[node][1]]
    assert holder.is_volume
    transformed = holder.copy()
    transformed.apply_transform(scene.graph[node][0])
    x0, y0, z0, x1, y1, z1 = item['bounds']
    np.testing.assert_allclose(transformed.bounds, np.array([[x0, z0, -y1], [x1, z1, -y0]]) * .001, atol=2e-7)
    assert abs(transformed.volume / (item['volume'] * 1e-9) - 1) < 2e-5
    assert 'cad-component-label' not in scene.geometry
    print(f"PASS {item['name']}: one closed solid, mm STL/metre GLB bounds/volume, flat base and 20 non-printing papers")
