"""Read-only native oracle. All generated fixtures remain in this tool directory."""
import sys
sys.dont_write_bytecode = True

from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import numpy as np

SOURCE = Path('F:/param_cad')
sys.path.insert(0, str(SOURCE))
from climbing_crack_brace import model

HERE = Path(__file__).resolve().parent
config = json.loads((HERE.parents[1] / 'assets/cad/climbing-volumes/config.json').read_text())
assert all(config['limits'][key] == list(value) for key, value in model.LIMITS.items())
defaults = config['defaults']
cases = {
    'incut_105_45_45': {'panel_tilts': [105, 45, 45]},
    'incut_105_100_35': {'panel_tilts': [105, 100, 35]},
    'scale_025': {'brace_reach': 750, 'overall_scale': .25},
    'scale_3': {'overall_scale': 3},
    'scale_15': {'overall_scale': 15},
    'factors_025': {'brace_reach': 750, 'panel_length_factors': [.25] * 3},
    'factors_15': {'panel_length_factors': [15] * 3},
    'factors_unequal': {'panel_length_factors': [2.5, 2, 2], 'overall_scale': 3},
    'scaled_legacy': {'panel_wall_lengths': [300, 400, 500], 'overall_scale': 3, 'panel_tilts': [90, 90, 45]},
    'incut_factored': {'panel_tilts': [105, 45, 45], 'panel_length_factors': [1, 1.05, .95], 'overall_scale': 3},
}
for mode in (1, 2):
    for material in ('timber', 'plywood'):
        cases[f'supported_{mode}_{material}'] = {'mounting_faces': mode, 'surface_count': 3 if mode == 1 else 2,
            'mount_support_enabled': True, 'joint_supports_enabled': True, 'support_material': material}
cases.update({
    'supported_corner_bands': {'mounting_faces': 2, 'surface_count': 2, 'opening_angle': 90, 'corner_segments': 3,
        'mount_support_enabled': True, 'joint_supports_enabled': True},
    'supported_corner_plane2': {'mounting_faces': 2, 'surface_count': 2, 'mount_plane': 2,
        'mount_support_enabled': True, 'joint_supports_enabled': True},
    'supported_incut': {'panel_tilts': [105, 100, 35], 'mount_panel': 2,
        'mount_support_enabled': True, 'joint_supports_enabled': True},
    'supported_perpendicular': {'panel_tilts': [90, 90, 45], 'mount_panel': 2,
        'mount_support_enabled': True, 'joint_supports_enabled': True},
    'scaled_stock': {'overall_scale': 3, 'support_width': 90, 'timber_depth': 85, 'mount_bolt_diameter': 25,
        'mount_support_enabled': True},
    'thin_plywood_stock': {'support_material': 'plywood', 'support_width': 8, 'support_plywood_thickness': 3,
        'mount_bolt_diameter': 2, 'mount_support_enabled': True},
    'stock_unchanged_scale': {'overall_scale': 3, 'mount_support_enabled': True, 'joint_supports_enabled': True},
})
rejects = {
    'open_170_45_45': {'panel_tilts': [170, 45, 45]},
    'marginal_135_90_45': {'panel_tilts': [135, 90, 45]},
    'mixed_lengths': {'panel_wall_lengths': [300, 400, 500], 'panel_length_factors': [1] * 3},
    'overflow': {'overall_scale': 1e308},
    'numeric_range': {'overall_scale': 1e8},
    'overlapping_supports': {'support_width': 44, 'timber_depth': 44, 'joint_span_ratio': .6,
        'mount_support_enabled': True, 'joint_supports_enabled': True},
    'mount_incut': {'panel_tilts': [105, 45, 45], 'mount_support_enabled': True},
    'mount_perpendicular': {'panel_tilts': [90, 90, 45], 'mount_support_enabled': True},
    'mount_missing_plane': {'mount_plane': 2, 'mount_support_enabled': True},
    'mount_outside': {'mount_offset_u': 2000, 'mount_support_enabled': True},
    'bolt_oversize': {'mount_bolt_diameter': 30, 'mount_support_enabled': True},
}
def mesh_data(mesh):
    return {'vertices': mesh.vertices.tolist(), 'indices': mesh.faces.reshape(-1).tolist(), 'volume_mm3': float(mesh.volume), 'bounds_mm': mesh.bounds.tolist()}

def contact_data(part):
    mesh = part['mesh']
    contacts = []
    for face in part['report']['contacts']:
        vertices = mesh.vertices[np.abs(mesh.vertices @ face['normal_local'] - face['limit_mm']) < 1e-6]
        triangles = mesh.vertices[mesh.faces]
        mask = np.all(np.abs(triangles @ face['normal_local'] - face['limit_mm']) < 1e-6, axis=1)
        # Native vertex-loop reports cannot represent a face with a hole. Use the real triangles.
        from scipy.spatial import ConvexHull
        normal = np.asarray(face['normal_local'])
        u = np.cross(normal, [1, 0, 0] if abs(normal[0]) < .8 else [0, 1, 0]); u /= np.linalg.norm(u)
        basis = np.column_stack((u, np.cross(normal, u)))
        hull = ConvexHull(vertices @ basis)
        contacts.append({'panel': face['panel'], 'area_mm2': float(mesh.area_faces[mask].sum()),
                         'outer_vertices_mm': vertices[hull.vertices].tolist()})
    axis = part['report']['holes'][0]['axis_local'] if part['report']['holes'] else None
    wall_area = None
    if axis:
        triangles = mesh.vertices[mesh.faces]
        wall_area = float(mesh.area_faces[np.all(np.abs(triangles @ axis) < 1e-6, axis=1)].sum())
    return {'contacts': contacts, 'wall_area_mm2': wall_area}

fixtures = []
for identifier, overrides in cases.items():
    params = model.Params.from_json(defaults | overrides)
    panels, supports = model.build_geometry(params)
    fixtures.append({'id': identifier, 'parameters': asdict(params), 'report': model.cutting_report(params, panels, supports),
        'meshes_mm': [mesh_data(panel.mesh) for panel in panels],
        'supports_mm': {part['id']: mesh_data(part['mesh']) | contact_data(part) for part in supports}})
    print(f'PASS native {identifier}: {len(panels)} panels, {len(supports)} supports')
for identifier, overrides in rejects.items():
    try:
        model.build_geometry(model.Params.from_json(defaults | overrides))
    except ValueError as error:
        fixtures.append({'id': identifier, 'parameters': defaults | overrides, 'reject': str(error)})
        print(f'PASS native rejects {identifier}')
    else:
        raise AssertionError(f'Native source unexpectedly accepted {identifier}')
provenance = {name: hashlib.sha256((SOURCE / 'climbing_crack_brace' / name).read_bytes()).hexdigest()
    for name in ('model.py', 'volumes.py', 'shells.py', 'inner_supports.py')}
(HERE / 'native-fixtures.json').write_text(json.dumps({'source_sha256': provenance, 'limits': model.LIMITS, 'fixtures': fixtures}, indent=2) + '\n')
