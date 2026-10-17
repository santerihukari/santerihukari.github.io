"""Independent checks of the real crimp exports, not strength validation."""
import json
from pathlib import Path
import numpy as np
import trimesh

folder = Path(__file__).resolve().parents[2] / "output/climbing-hold"
for name in ["smooth", "default", "wide", "twoScrews", "roundedGrain"]:
    report = json.loads((folder / f"{name}.json").read_text())
    mesh = trimesh.load_mesh(folder / f"{name}.stl", process=True)
    assert mesh.is_watertight and mesh.is_winding_consistent
    assert np.isfinite(mesh.vertices).all() and len(mesh.split()) == 1
    assert mesh.euler_number == 2 - 2 * len(report["mounting"])
    assert abs(mesh.volume - report["volume_mm3"]) / mesh.volume < 1e-5
    assert abs(mesh.bounds[1, 1]) < 1e-6
    for hole in report["mounting"]:
        bore, head, web = hole["bore"] / 2, hole["head"] / 2, hole["web"]
        cone = (head - bore) / np.tan(np.deg2rad(hole["angle"] / 2))
        points, expected = [], []
        for fraction in [0, .25, .5, .75, 1]:
            depth = web / 2 if fraction == 0 else web + cone * fraction
            radius = bore if fraction == 0 else bore + fraction * (head - bore)
            for delta in [-.15, .15]:
                points.append([hole["x"] + radius + delta, -depth, hole["z"]])
                expected.append(delta > 0)
        np.testing.assert_array_equal(mesh.contains(np.array(points)), expected)
    print(f"{name}: one watertight hold, {len(report['mounting'])} through-holes, countersinks and webs verified", flush=True)

browser = folder / "browser"
if (browser / "crimp.stl").exists() and (browser / "crimp.glb").exists():
    stl = trimesh.load_mesh(browser / "crimp.stl", process=False)
    glb = trimesh.load_scene(browser / "crimp.glb", process=False).to_geometry()
    glb.apply_transform(np.array([[1000,0,0,0],[0,0,-1000,0],[0,1000,0,0],[0,0,0,1]]))
    np.testing.assert_allclose(stl.triangles, glb.triangles, atol=.001, rtol=0)
    print("Browser STL/GLB triangles and units match", flush=True)
