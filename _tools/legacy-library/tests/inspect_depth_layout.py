"""Independent mesh checks; not a physical fit or climbing-load assessment."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import trimesh

root = Path(__file__).resolve().parents[3]
folder = root / "output/legacy-library/depth-layout"
source_hash = hashlib.sha256((root / "src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js").read_bytes()).hexdigest()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--case", action="append")
parser.add_argument("--browser", action="store_true")
parser.add_argument("--browser-case", default="rope")
args = parser.parse_args()
names = args.case or ["upperDeep", "lowerDeep", "rope", "ropeQuarter", "curved", "unequalBody", "diamond", "strongCrown", "eyelet", "oneSided", "equal", "openEqual", "openDiamond", "openUpper", "openLower", "openRope", "openEyelet", "newDefault", "wideFlat80", "wideFlat120", "monoMixed"]
for name in names:
    data = json.loads((folder / f"{name}.json").read_text())
    assert data["sourceHash"] == source_hash, f"{name}: rebuild fixture"
    mesh = trimesh.load_mesh(folder / f"{name}.stl", process=True)
    assert np.isfinite(mesh.vertices).all() and mesh.volume > 0
    assert mesh.is_winding_consistent
    if data["params"]["back_wall_y"] == 0 and data["params"]["slot_depth_y"] != data["params"]["upper_slot_depth_y"]:
        assert mesh.is_watertight, f"{name}: open back must not leave an open mesh"
    assert abs(mesh.volume - data["analyticVolume"]) / data["analyticVolume"] < 0.005
    if data["probes"]:
        actual = mesh.contains(np.array([p["point"] for p in data["probes"]]))
        expected = np.array([p["inside"] for p in data["probes"]])
        assert np.array_equal(actual, expected), f"{name}: {np.where(actual != expected)[0].tolist()}"
    print(json.dumps({"case": name, "mesh_probes": len(data["probes"]), "watertight": mesh.is_watertight,
                      "triangles": len(mesh.faces), "volume_mm3": float(mesh.volume)}))

if args.browser:
    browser = folder / "browser"
    if args.browser_case != "rope":
        browser /= args.browser_case
    stl = trimesh.load_mesh(browser / f"{args.browser_case}.stl", process=False)
    glb = trimesh.load_scene(browser / f"{args.browser_case}.glb", process=False).to_geometry()
    glb.apply_transform(np.array([[1000, 0, 0, 0], [0, 0, -1000, 0], [0, 1000, 0, 0], [0, 0, 0, 1]]))
    np.testing.assert_allclose(stl.triangles, glb.triangles, atol=0.001, rtol=0)
    np.testing.assert_allclose(stl.bounds, glb.bounds, atol=0.001, rtol=0)
    assert stl.volume > 0 and abs(stl.volume - glb.volume) / stl.volume < 0.00001
    print("Browser STL/GLB triangles, millimetres, bounds and volume agree")
