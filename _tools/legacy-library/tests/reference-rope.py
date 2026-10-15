"""Inspect the published rope-route reference without modifying it."""
from pathlib import Path
import hashlib
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import trimesh

root = Path(__file__).resolve().parents[3]
source = root / "assets/stl/portable-hangboard-12mm-20mm-wood-inserts.stl"
folder = root / "output/legacy-library/hangboard-attachments"
folder.mkdir(parents=True, exist_ok=True)
mesh = trimesh.load_mesh(source)
fig, axes = plt.subplots(2, 3, figsize=(13, 7))
for ax, depth in zip(axes.flat, [0.2, 5, 9, 11, 17, 21.8]):
    section = mesh.section(plane_origin=[0, 0, depth], plane_normal=[0, 0, 1])
    for curve in section.discrete:
        ax.plot(curve[:, 0], curve[:, 1], linewidth=0.8)
    ax.set_aspect("equal")
    ax.set_title(f"Reference depth z={depth} mm")
    ax.set_xlim(-55, 55)
    ax.set_ylim(-32, 32)
fig.tight_layout()
fig.savefig(folder / "reference-sections.png", dpi=130)
fig, axes = plt.subplots(2, 3, figsize=(13, 7))
for ax, height in zip(axes.flat, [-18, -12, -8, 0, 8, 12]):
    section = mesh.section(plane_origin=[0, height, 0], plane_normal=[0, 1, 0])
    for curve in section.discrete:
        ax.plot(curve[:, 0], curve[:, 2], linewidth=0.8)
    ax.set_aspect("equal")
    ax.set_title(f"Reference height y={height} mm")
    ax.set_xlim(35, 56)
    ax.set_ylim(-1, 24)
fig.tight_layout()
fig.savefig(folder / "reference-side-sections.png", dpi=130)
print(json.dumps({"source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                  "bounds": mesh.bounds.tolist(), "watertight": bool(mesh.is_watertight)}))
