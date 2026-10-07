"""Verify the browser's STL download, including exact vertex welding."""
from pathlib import Path

import numpy as np
import trimesh

folder = Path(__file__).resolve().parents[2] / 'output/coffee-filter'
for name in ('holder.stl', 'holder-no-papers.stl'):
    raw = trimesh.load_mesh(folder / name, process=False)
    vertices, inverse = np.unique(raw.vertices, axis=0, return_inverse=True)
    mesh = trimesh.Trimesh(vertices=vertices, faces=inverse[raw.faces], process=False)
    assert mesh.is_watertight and mesh.is_winding_consistent
    assert mesh.body_count == 1 and mesh.euler_number == -8
    assert np.all(mesh.area_faces > 1e-12)
    assert abs(mesh.volume - 29323.84093) < 0.02
    assert np.allclose(mesh.bounds, [[-93.727432, -2.4, 0], [93.727432, 19.4, 50]], atol=0.001)
    print(f'PASS: {name}: one watertight body, four passages, open top/bottom, correct dimensions and volume, no paper geometry.')
