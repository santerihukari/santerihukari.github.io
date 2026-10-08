"""Publish only rights-reviewed reference meshes; never write to the CAD source."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil

import numpy as np
import trimesh


LOCAL = {
    "tmotor_v2207_v3_dimensional", "tattu_1800_4s_dimensional",
    "generic_51_triblade_cw", "generic_51_triblade_ccw",
}
LICENSED = {
    "esp32_s3_wroom1_module": "radio_module",
    "xt60_m_reference": "power_connector",
    "xt60_f_reference": "power_connector",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    site = Path(__file__).resolve().parents[2]
    output = site / "assets/cad/drone-frame/references"
    output.mkdir(parents=True, exist_ok=True)
    kit = args.source / "drone_frame_v1_reference_kit"
    local = args.source / "drone_frame_v1/component_references"
    registry = [(local, item) for item in json.loads((local / "catalogue.json").read_text())["models"] if item["id"] in LOCAL]
    registry += [(kit, item) for item in json.loads((kit / "component_models.json").read_text())["models"] if item["id"] in LICENSED]
    if {item["id"] for _, item in registry} != LOCAL | LICENSED.keys():
        raise ValueError("The approved reference inventory is incomplete")
    manifest = {"version": 1, "units": "metres", "up_axis": "Y", "models": {}}
    for base, item in registry:
        source = base / item["file"]
        digest = sha256(source.read_bytes()).hexdigest()
        if digest != item["sha256"]:
            raise ValueError(f"Source changed; review required: {item['id']}")
        import cadquery as cq
        shape = cq.importers.importStep(str(source)).val()
        if not shape.isValid():
            raise ValueError(f"Invalid reference CAD: {item['id']}")
        vertices, faces = shape.tessellate(0.15, 0.18)
        mesh = trimesh.Trimesh(vertices=[point.toTuple() for point in vertices], faces=faces, process=True)
        transform = np.array(item.get("local_to_component_transform") or np.eye(4), dtype=float)
        mesh.apply_transform(transform)
        # Optional parts have no installation datum: display them centered, bottom at Z0.
        if item["id"] in LICENSED:
            shift = np.array([*mesh.bounds.mean(axis=0)[:2], mesh.bounds[0, 2]])
            mesh.apply_translation(-shift)
            transform[:3, 3] -= shift
        bounds = mesh.bounds.copy()
        model = {
            "label": item["label"], "file": f"references/{item['id']}.glb",
            "source": item["source_url"], "source_sha256": digest,
            "bounds_mm": bounds.tolist(), "source_to_component": transform.tolist(),
            "vertices": len(mesh.vertices), "triangles": len(mesh.faces),
            "physical_match": "unverified", "printable": False,
            "basis": item.get("notes", "Reference geometry; installation is unverified."),
            "author": "Santeri Hukari / local CAD workflow" if item["id"] in LOCAL else "Espressif Systems" if item["id"].startswith("esp32") else "KiCad contributors; source STEP author field: reportingsjrautodesk",
            "licence": "Original local geometry; no public reuse licence selected" if item["id"] in LOCAL else "CC-BY-SA-4.0 with KiCad electronic-design exception",
        }
        if item["id"] in LICENSED:
            model["slot"] = LICENSED[item["id"]]
            notice = "espressif_kicad_LICENSE.md" if item["id"].startswith("esp32") else "kicad_3dmodels_LICENSE.md"
            model["notice"] = f"references/{notice}"
            shutil.copyfile(kit / "licences" / notice, output / notice)
        mesh.metadata = {"reference": model, "changes": "STEP tessellated; datum normalized where documented; mm/Z-up converted to metres/Y-up"}
        mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        mesh.apply_scale(0.001)
        mesh.export(output / f"{item['id']}.glb", file_type="glb", include_normals=True)
        # Check the actual GLB, not just the pre-export geometry.
        loaded = trimesh.load(output / f"{item['id']}.glb", force="mesh")
        loaded.apply_scale(1000)
        loaded.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        if not np.allclose(loaded.bounds, bounds, atol=0.0001):
            raise ValueError(f"GLB units/axes/bounds mismatch: {item['id']}")
        model["sha256"] = sha256((output / f"{item['id']}.glb").read_bytes()).hexdigest()
        manifest["models"][item["id"]] = model
        print(item["id"], len(mesh.faces), (output / f"{item['id']}.glb").stat().st_size, flush=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
