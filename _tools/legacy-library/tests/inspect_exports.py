"""Independently parse browser exports with Trimesh, without the app/OCCT."""
from pathlib import Path
import json

import numpy as np
import trimesh

FOLDER = Path(__file__).resolve().parents[3] / "output" / "legacy-library"
SLUGS = [
    "grid-organizer", "round-badminton-pole-head", "square-badminton-pole-head",
    "twisted-vase", "spline-vase", "bolt-generator", "depth-taper-hangboard",
]
ANALYTIC_VOLUMES = [
    84175.3691410263, 36314.48155655937, 31637.20030521119,
    66202.75626712937, 63031.264775838936, 2011.8861147218665,
    312460.3746148631,
]
GLB_TO_CAD_MM = np.array([
    [1000, 0, 0, 0], [0, 0, -1000, 0], [0, 1000, 0, 0], [0, 0, 0, 1]
])


def welded(mesh):
    vertices, inverse = np.unique(np.round(mesh.vertices, 5), axis=0, return_inverse=True)
    return trimesh.Trimesh(vertices=vertices, faces=inverse[mesh.faces], process=False)


for slug, analytic_volume in zip(SLUGS, ANALYTIC_VOLUMES):
    stl = trimesh.load_mesh(FOLDER / f"{slug}.stl", process=False)
    scene = trimesh.load_scene(FOLDER / f"{slug}.glb", process=False)
    assert len(scene.geometry) == 1, f"{slug}: expected the original single merged object"
    glb = scene.to_geometry()
    glb.apply_transform(GLB_TO_CAD_MM)
    for mesh in (stl, glb):
        assert len(mesh.faces) > 0 and len(mesh.vertices) > 0
        assert np.isfinite(mesh.vertices).all()
        assert mesh.volume > 0, f"{slug}: inward or inconsistent export winding"
        assert abs(mesh.volume - analytic_volume) / analytic_volume < 0.005
    assert len(stl.faces) == len(glb.faces), f"{slug}: exported triangle count differs"
    assert np.allclose(stl.bounds, glb.bounds, atol=0.001), f"{slug}: units or axis mapping differ"
    assert abs(stl.volume - glb.volume) / stl.volume < 0.00001, f"{slug}: STL/GLB volume mismatch"
    stl_welded, glb_welded = welded(stl), welded(glb)
    assert stl_welded.is_winding_consistent, f"{slug}: STL edge winding"
    assert glb_welded.is_winding_consistent, f"{slug}: GLB edge winding"
    assert glb.visual.kind == "texture", f"{slug}: GLB lost its material"
    print(json.dumps({
        "slug": slug, "triangles": len(stl.faces),
        "bounds_mm": stl.bounds.tolist(), "stl_volume_mm3": float(stl.volume),
        "glb_volume_mm3": float(glb.volume), "winding_consistent": True,
        "stl_watertight": bool(stl_welded.is_watertight),
        "glb_watertight": bool(glb_welded.is_watertight),
    }), flush=True)
