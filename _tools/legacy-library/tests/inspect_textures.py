"""Inspect actual textured hangboards, never separate texture coupons."""
import json
import os
from pathlib import Path
import numpy as np
import trimesh

folder = Path(__file__).resolve().parents[3] / "output/legacy-library/textures"
aggressive = os.environ.get("TEXTURE_SET") == "aggressive"
names = (["aggressive-default--layer-random-waves", "aggressive-default--sharp-cones", "aggressive-default--alternating-triangles", "aggressive-curvedMono--layer-random-waves"] if aggressive else
         ["default--fine-stone", "default--blunt-cones", "default--shallow-dimples", "curvedMono--fine-stone"])
for name in names:
    mesh = trimesh.load_mesh(folder / f"{name}.stl", process=True)
    assert mesh.is_watertight and mesh.is_winding_consistent
    assert np.isfinite(mesh.vertices).all() and mesh.volume > 0
    assert len(mesh.split()) == 1
    report = json.loads((folder / (name.split("--")[0] + ".json")).read_text())
    texture = next(item for item in report["reports"] if item["pattern"] == name.split("--")[1])
    assert abs(mesh.volume - texture["metrics"]["volume"]) / mesh.volume < 1e-5
    print(f"{name}: one watertight hangboard; {len(mesh.faces)} triangles")

browser = folder / ("browser-aggressive" if aggressive else "browser")
preset = "layer-random-waves" if aggressive else "fine-stone"
if (browser / f"{preset}.stl").exists() and (browser / f"{preset}.glb").exists():
    stl = trimesh.load_mesh(browser / f"{preset}.stl", process=False)
    glb = trimesh.load_scene(browser / f"{preset}.glb", process=False).to_geometry()
    glb.apply_transform(np.array([[1000,0,0,0],[0,0,-1000,0],[0,1000,0,0],[0,0,0,1]]))
    np.testing.assert_allclose(stl.triangles, glb.triangles, atol=0.001, rtol=0)
    np.testing.assert_allclose(stl.bounds, glb.bounds, atol=0.001, rtol=0)
    print("Browser STL and GLB have the same physical triangles in correct units")
