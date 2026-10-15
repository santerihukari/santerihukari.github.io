"""Independently inspect attachment/profile exports; not a load or print test."""
from pathlib import Path
import argparse
import hashlib
import json

import numpy as np
import trimesh

folder = Path(__file__).resolve().parents[3] / "output/legacy-library"
source = folder.parents[1] / "src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js"
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
results = []
native_cases = ["rope", "ropeOffset", "ropeBodyOnly", "upperDeep", "lowerDeep", "unequalCurved",
                "eyeletTop", "eyeletBottom", "eyeletBoth", "eyeletOffset", "eyeletOneSlot", "eyeletOneRaised", "eyeletSixSlots",
                "widthRaised", "widthHollow", "widthDepth", "widthRope", "widthProbe", "reportedCurve", "liftProbe", "depthBelowBase", "eyeletHollow",
                "roundedDefault", "roundedRope", "roundedCurve", "roundedUnequal", "roundedEyelet", "roundedOneSided",
                "roundedSmall", "roundedLarge", "roundedNegative", "roundedRopeOffset", "roundedSix",
                "roundedShortStep", "roundedTightCorners", "roundedUnevenSpline",
                "roundedRopeBodyOnly", "roundedRopeUnrounded", "roundedTightOneSided"]
browser_cases = ["rope", "eyeletBoth", "eyeletOffset", "widthRope", "widthDepth", "upperDeep", "eyeletOneSlot", "reportedCurve",
                 "roundedDefault", "roundedRope", "roundedCurve"]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--native-case", action="append", choices=native_cases)
parser.add_argument("--browser-case", action="append", choices=browser_cases)
args = parser.parse_args()
native_cases = args.native_case or native_cases
browser_cases = args.browser_case or browser_cases
for name in native_cases:
    case = json.loads((folder / f"hangboard-profile/current-{name}.json").read_text())
    assert case["sourceHash"] == source_hash, f"{name}: regenerate the native fixture after source changes"
    assert case["brepValid"] and case["solids"] == 1
    assert all(probe["expected"] == probe["actual"] for probe in case["probes"])
    mesh = trimesh.load_mesh(folder / f"hangboard-profile/current-{name}.stl", process=False)
    assert np.isfinite(mesh.vertices).all() and mesh.volume > 0
    assert len(mesh.faces) == case["mesh"]["triangles"]
    assert abs(mesh.volume - case["analyticVolume"]) / case["analyticVolume"] < 0.005
    vertices, inverse = np.unique(np.round(mesh.vertices, 5), axis=0, return_inverse=True)
    welded = trimesh.Trimesh(vertices=vertices, faces=inverse[mesh.faces], process=False)
    assert welded.is_winding_consistent
    results.append({"case": case["name"], "triangles": len(mesh.faces), "volume_mm3": float(mesh.volume),
                    "watertight_at_0_00001_mm_weld": bool(welded.is_watertight)})
    print(json.dumps(results[-1]))

conversion = np.array([[1000, 0, 0, 0], [0, 0, -1000, 0], [0, 1000, 0, 0], [0, 0, 0, 1]])
browser = folder / "hangboard-attachments/browser"
for name in browser_cases:
    stl = trimesh.load_mesh(browser / f"{name}.stl", process=False)
    glb = trimesh.load_scene(browser / f"{name}.glb", process=False).to_geometry()
    glb.apply_transform(conversion)
    assert len(stl.faces) == len(glb.faces)
    np.testing.assert_allclose(stl.bounds, glb.bounds, atol=0.001, rtol=0)
    np.testing.assert_allclose(stl.triangles, glb.triangles, atol=0.001, rtol=0)
    assert stl.volume > 0 and glb.volume > 0
    assert abs(stl.volume - glb.volume) / stl.volume < 0.00001
    assert glb.visual.kind == "texture"
    watertight = []
    for mesh in (stl, glb):
        vertices, inverse = np.unique(np.round(mesh.vertices, 5), axis=0, return_inverse=True)
        welded = trimesh.Trimesh(vertices=vertices, faces=inverse[mesh.faces], process=False)
        assert welded.is_winding_consistent
        watertight.append(bool(welded.is_watertight))
    print(json.dumps({"browser_pair": name, "matching_triangles_units_bounds_volume": True,
                      "stl_glb_watertight_at_0_00001_mm_weld": watertight}))
