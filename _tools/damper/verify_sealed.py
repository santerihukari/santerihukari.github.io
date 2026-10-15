"""Independent mesh/template verification; accepts generated model JSON on stdin."""

import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

import numpy as np
import trimesh


def mesh(data, name):
    vertices = np.asarray(data["positions"], dtype=float).reshape((-1, 3))
    faces = np.asarray(data["indices"], dtype=np.int64).reshape((-1, 3))
    assert len(vertices) and len(faces) and np.isfinite(vertices).all(), name
    assert faces.min() >= 0 and faces.max() < len(vertices), name
    result = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    assert result.is_watertight and result.is_winding_consistent and result.is_volume, name
    assert result.body_count == 1 and result.volume > 0, name
    return result


def main(data):
    baseline = json.loads((Path(__file__).parents[2] / "assets/cad/air-damper/model.json").read_text())
    part_map = {part["name"]: part for part in data["parts"]}
    old_map = {part["name"]: part for part in baseline["parts"]}
    assert part_map["housing"]["positions"] == old_map["housing"]["positions"]
    assert part_map["housing"]["indices"] == old_map["housing"]["indices"]
    if data["sealed_parameters"]["piston_rings"] == 0:
        assert part_map["plunger"]["positions"] == old_map["plunger"]["positions"]
        assert part_map["plunger"]["indices"] == old_map["plunger"]["indices"]
    printed = {part["name"] for part in data["parts"] if not part["reference"]}
    assert printed == set(data["print_meshes"]) == {item["part"] for item in data["print_manifest"]}
    sections = 0
    for entry in data["print_manifest"]:
        name = entry["part"]
        full = mesh(part_map[name], name)
        exported = mesh(data["print_meshes"][name], name + " STL")
        assert np.allclose(exported.extents, entry["dimensions_mm"], atol=1e-5), name
        assert abs(exported.bounds[0, 2]) < 1e-6, name
        assert abs(full.volume - exported.volume) < 0.02, name
        assert entry["quantity"] == 1 and entry["watertight"] and entry["bodies"] == 1, name
        if part_map[name]["section_positions"]:
            mesh({"positions": part_map[name]["section_positions"], "indices": part_map[name]["section_indices"]}, name + " section")
            sections += 1
    flap = mesh(part_map["reset_flap"], "silicone flap")
    svg = ET.fromstring(data["reset_template_svg"])
    width, height = float(svg.attrib["width"].removesuffix("mm")), float(svg.attrib["height"].removesuffix("mm"))
    view = [float(value) for value in svg.attrib["viewBox"].split()]
    assert math.isclose(width, view[2]) and math.isclose(height, view[3])
    path = svg.find("{http://www.w3.org/2000/svg}path").attrib["d"]
    polygons = []
    for contour in path.split("Z"):
        if not contour.strip():
            continue
        values = [float(value) for value in re.findall(r"[-+]?\d+(?:\.\d+)?", contour)]
        polygons.append(np.asarray(values).reshape((-1, 2)))
    assert len(polygons) == 2, "one outer contour and one anchor hole"
    areas = []
    for polygon in polygons:
        areas.append(abs(np.sum(polygon[:, 0] * np.roll(polygon[:, 1], -1) - np.roll(polygon[:, 0], -1) * polygon[:, 1])) / 2)
    assert abs(min(areas) - math.pi * (1.85 / 2) ** 2) < 0.003
    area = max(areas) - min(areas)
    assert abs(area * data["sealed_parameters"]["flap_thickness_mm"] - flap.volume) < 0.002
    for row in data["report"]["sealed"]["motion"]:
        assert max(row["intersections_mm3"].values()) < 0.0001
    print(f"PASS independent trimesh: {len(printed)} one-body print designs, {sections} capped sections, exact baseline and 1:1 silicone SVG")


if __name__ == "__main__":
    main(json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else json.load(sys.stdin))
