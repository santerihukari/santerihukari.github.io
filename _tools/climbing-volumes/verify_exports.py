"""Independent trimesh/Manifold checks of Node and browser fabrication exports."""
import sys
sys.dont_write_bytecode = True

from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

import manifold3d
import numpy as np
import trimesh

HERE = Path(__file__).resolve().parent
output = HERE / 'artifacts'
paths = sorted(output.rglob('*_panels.zip'))
assert paths, 'No current exported bundles found; run verify_native.mjs first.'
SVG = '{http://www.w3.org/2000/svg}'

def solid(mesh):
    return manifold3d.Manifold(manifold3d.Mesh64(np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.uint64)))

def load(archive, name, volume):
    mesh = trimesh.load(BytesIO(archive.read(name)), file_type='stl', process=True)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.is_volume, name
    assert len(mesh.split()) == 1, name
    assert abs(mesh.volume / volume - 1) < 2e-5, name
    return mesh

for path in paths:
    with ZipFile(path) as archive:
        report = json.loads(archive.read('cutting_report.json'))
        params = report['parameters']
        supports = report['inner_supports']
        assert isinstance(supports, list)
        assert report['support_count'] == len(supports)
        assert report['total_fabrication_parts'] == report['total_panels'] + len(supports)
        expected = {'cutting_report.json', 'params.json', 'assembly.glb'}
        expected |= {name for panel in report['panels'] for name in (f"panel_{panel['id']}.stl", f"panel_{panel['id']}_template.svg")}
        expected |= {part['id'] + '.stl' for part in supports}
        if supports:
            expected.add('support_cut_list.json')
            assert json.loads(archive.read('support_cut_list.json')) == supports
        assert set(archive.namelist()) == expected, path.name
        assert json.loads(archive.read('params.json')) == params
        panels = {}
        for panel in report['panels']:
            mesh = load(archive, f"panel_{panel['id']}.stl", panel['panel_volume_mm3'])
            panels[panel['id']] = mesh
            projection = mesh.vertices @ np.asarray(panel['normal'])
            assert abs(np.ptp(projection) - params['plywood_thickness']) < .002
            svg = ET.fromstring(archive.read(f"panel_{panel['id']}_template.svg"))
            view = list(map(float, svg.attrib['viewBox'].split()))
            assert abs(float(svg.attrib['width'].removesuffix('mm')) - view[2]) < 1e-5
            assert abs(float(svg.attrib['height'].removesuffix('mm')) - view[3]) < 1e-5
            assert any('h100' in element.attrib.get('d', '') for element in svg.findall(SVG + 'path'))
            bores = [element for element in svg.findall(SVG + 'polygon') if 'data-bore' in element.attrib]
            assert len(bores) == len(panel['mounting_holes'])
            outline = np.asarray(panel['outer_outline_xy_mm'])
            offset = 55 - outline.min(axis=0)
            for polygon, hole in zip(bores, panel['mounting_holes']):
                points = np.asarray([list(map(float, pair.split(','))) for pair in polygon.attrib['points'].split()])
                np.testing.assert_allclose(points - offset, hole['outline_xy_mm'], atol=1e-6)
                ring = np.asarray(hole['face_outline_mm'])
                axis = np.asarray(hole['axis_local'])
                delta = ring - np.asarray(hole['wall_center_mm'])
                radial = delta - (delta @ axis)[:, None] * axis
                np.testing.assert_allclose(np.linalg.norm(radial, axis=1), hole['diameter_mm'] / 2, atol=1e-6)
                np.testing.assert_allclose(ring @ panel['normal'], panel['long_face_plane_mm'], atol=1e-6)
                assert mesh.euler_number == 0, 'Panel must contain a real through-hole'
                rotation = trimesh.geometry.align_vectors([0, 0, 1], axis)
                rotation[:3, 3] = np.asarray(hole['wall_center_mm']) - axis
                probe = manifold3d.Manifold.cylinder(hole['wall_to_outer_face_mm'] + 5, hole['diameter_mm'] * .49, circular_segments=96).transform(rotation[:3])
                assert (solid(mesh) ^ probe).volume() < 1e-5, 'Panel bore is obstructed'
        support_meshes = {}
        for part in supports:
            mesh = load(archive, part['id'] + '.stl', part['volume_mm3'])
            support_meshes[part['id']] = mesh
            origin, axes = np.asarray(part['stock_origin_mm']), np.asarray(part['stock_axes_local'])
            stock = (mesh.vertices - origin) @ axes.T
            assert np.all(np.abs(stock) <= np.asarray(part['stock_dimensions_mm']) / 2 + .002)
            assert mesh.vertices[:, 1].min() >= -.002
            if params['mounting_faces'] == 2:
                assert mesh.vertices[:, 0].min() >= -.002
            for panel in report['panels']:
                assert np.max(mesh.vertices @ panel['normal']) <= panel['long_face_plane_mm'] - params['plywood_thickness'] + .002
                overlap = (solid(mesh) ^ solid(panels[panel['id']])).volume()
                # STL coordinates are float32; bound contact slivers by a 0.0002 mm equivalent depth.
                allowance = .0002 * sum(contact['contact_area_mm2'] for contact in part['contacts'])
                assert overlap < max(.02, allowance), 'Support penetrates a panel'
            for contact in part['contacts']:
                triangles = mesh.vertices[mesh.faces]
                selected = np.all(np.abs(triangles @ contact['normal_local'] - contact['limit_mm']) < .002, axis=1)
                area = mesh.area_faces[selected].sum()
                assert area > 0
                assert abs(area / contact['contact_area_mm2'] - 1) < 2e-4, 'Incorrect drilled contact area'
            if part['kind'] == 'joint_cleat':
                assert len(part['contacts']) == 2
            else:
                assert mesh.euler_number == 0, 'Spacer must contain a real through-hole'
                hole = part['holes'][0]
                axis = np.asarray(hole['axis_local'])
                rotation = trimesh.geometry.align_vectors([0, 0, 1], axis)
                rotation[:3, 3] = np.asarray(hole['wall_center_mm']) - axis
                probe = manifold3d.Manifold.cylinder(hole['wall_to_outer_face_mm'] + 5, hole['diameter_mm'] * .49, circular_segments=96).transform(rotation[:3])
                assert (solid(mesh) ^ probe).volume() < 1e-5, 'Spacer bore is obstructed'
                triangles = mesh.vertices[mesh.faces]
                wall_area = mesh.area_faces[np.all(np.abs(triangles @ axis) < .002, axis=1)].sum()
                assert abs(wall_area / part['wall_contact_area_mm2'] - 1) < 2e-4
        for identifier, mesh in support_meshes.items():
            for other, other_mesh in support_meshes.items():
                if identifier < other:
                    assert (solid(mesh) ^ solid(other_mesh)).volume() < .02, 'Supports overlap'
        scene = trimesh.load(BytesIO(archive.read('assembly.glb')), file_type='glb', force='scene')
        assert not any('base_radius_reference' in name for name in scene.graph.nodes_geometry)
        assert any('mount_plane' in name for name in scene.graph.nodes_geometry)
        assert len(scene.geometry) == report['total_panels'] + len(supports) + report['reference_surface_count']
        assembled = []
        for name in scene.graph.nodes_geometry:
            transform, geometry = scene.graph[name]
            if 'mount_plane' not in name:
                mesh = scene.geometry[geometry].copy(); mesh.apply_transform(transform)
                assembled.append(mesh)
        extents = trimesh.util.concatenate(assembled).extents
        source_mesh = trimesh.util.concatenate(list(panels.values()) + list(support_meshes.values()))
        np.testing.assert_allclose(extents, source_mesh.extents[[0, 2, 1]] * .001, atol=2e-6, rtol=2e-5)
        print(f"PASS {path.name}: {len(panels)} watertight panels, {len(supports)} fitted supports, clear bores, exact templates/ZIP, GLB metres")
print(f'PASS independent fabrication checks: {len(paths)} bundles')
