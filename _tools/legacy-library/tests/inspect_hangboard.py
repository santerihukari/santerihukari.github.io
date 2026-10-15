"""Check original/optimized STL pairs and browser exports without the CAD kernel."""
from pathlib import Path
import json

import numpy as np
import trimesh


folder = Path(__file__).resolve().parents[3] / "output/legacy-library/hangboard-profile"
summary = json.loads((folder / "comparison.json").read_text())
for case in summary["summary"]:
    name = case["name"]
    before = trimesh.load_mesh(folder / f"reference-{name}.stl", process=False)
    after = trimesh.load_mesh(folder / f"current-{name}.stl", process=False)
    np.testing.assert_array_equal(after.vertices, before.vertices)
    np.testing.assert_array_equal(after.faces, before.faces)
    assert after.volume == before.volume > 0
    assert after.is_winding_consistent == before.is_winding_consistent
    print(json.dumps({"case": name, "identical_stl_geometry": True, "triangles": len(after.faces)}))

stl = trimesh.load_mesh(folder / "browser/curved.stl", process=False)
glb = trimesh.load_scene(folder / "browser/curved.glb", process=False).to_geometry()
glb.apply_transform(np.array([
    [1000, 0, 0, 0], [0, 0, -1000, 0], [0, 1000, 0, 0], [0, 0, 0, 1]
]))
assert len(stl.faces) == len(glb.faces)
np.testing.assert_allclose(stl.bounds, glb.bounds, atol=0.001, rtol=0)
np.testing.assert_allclose(stl.triangles, glb.triangles, atol=0.001, rtol=0)
assert stl.volume > 0 and glb.volume > 0
assert abs(stl.volume - glb.volume) / stl.volume < 0.00001
assert glb.visual.kind == "texture"
print(json.dumps({"browser_stl_glb_match": True, "triangles": len(stl.faces), "bounds_mm": stl.bounds.tolist()}))
