"""Independently verify browser exports at each fixed-slope stack depth."""
from pathlib import Path
import json
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2] / 'output/coffee-filter/depth-density'
items = json.loads((ROOT / 'expected.json').read_text(encoding='utf8'))
assert len(items) == 18
for item in items:
    mesh = trimesh.load(ROOT / (item['name'] + '.stl'), force='mesh')
    assert mesh.is_volume and mesh.is_watertight and mesh.is_winding_consistent
    assert len(mesh.split()) == 1
    np.testing.assert_allclose(mesh.bounds.reshape(-1), item['bounds'], atol=2e-5)
    assert abs(mesh.volume / item['volume'] - 1) < 2e-5
    scene = trimesh.load(ROOT / (item['name'] + '.glb'))
    assert isinstance(scene, trimesh.Scene) and len(scene.geometry) == item['count'] + 1
    node = next(name for name in scene.graph.nodes_geometry if name.replace(' ', '_').startswith('Coffee_filter_holder'))
    holder = scene.geometry[scene.graph[node][1]].copy()
    holder.apply_transform(scene.graph[node][0])
    assert holder.is_volume
    x0, y0, z0, x1, y1, z1 = item['bounds']
    np.testing.assert_allclose(holder.bounds, np.array([[x0, z0, -y1], [x1, z1, -y0]]) * .001, atol=2e-7)
    assert abs(holder.volume / (item['volume'] * 1e-9) - 1) < 2e-5
    print(f"PASS {item['name']}: one watertight solid, mm/metre bounds and volume, {item['count']} preview papers")
print('18 independent STL/GLB export pairs passed')
