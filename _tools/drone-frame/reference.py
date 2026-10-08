"""Extract a public configuration and geometry fixtures without importing reference CAD."""
from __future__ import annotations

import argparse
import ast
from dataclasses import asdict, replace
from hashlib import sha256
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('F:/param_cad'))
    args = parser.parse_args()
    source = args.source.resolve()
    sys.path.insert(0, str(source))
    from drone_frame_v1 import model as v1
    from drone_frame_v0 import model as v0
    from drone_frame_v0.controllers import CONTROLLERS

    root = Path(__file__).resolve().parents[2]
    source_default = v1.load_params(source / 'drone_frame_v1/params.json')
    # Read cached geometry only to extract scalar sweep bounds; never create source caches.
    cached_mesh = v1.references.cached_mesh
    def read_cached(model_id, cache_file):
        if not Path(cache_file).exists():
            raise ValueError(f'Required reference cache is absent for {model_id}; source is read-only')
        return cached_mesh(model_id, cache_file)
    v1.references.cached_mesh = read_cached
    sweeps = v1.lower_arm_braces.rotor_sweeps(source_default)
    plane = source_default.frame_thickness + source_default.prop_plane_above_mount
    datums = {'motor_seat_z': 19.8, 'motor_tip_z': 31.8, 'hub_seat_z': -2.5, 'hub_top_z': 2.5,
              'prop_bounds_offset_mm': [min(s['minimum_z'] for s in sweeps) + source_default.prop_deflection_allowance - plane,
                                        max(s['maximum_z'] for s in sweeps) - source_default.prop_deflection_allowance - plane],
              'prop_reference_radius_mm': max(s['radius_mm'] for s in sweeps)}
    default = replace(source_default, component_references={})
    historical = v0.load_params(source / 'drone_frame_v0/params.json')
    v0_values = asdict(default) | asdict(historical) | {'frame_variant': 'drone_frame_v0', 'component_references': {}, 'prop_seat_on_shaft': False, 'prop_nuts_enabled': False}
    groups = []
    tree = ast.parse((source / 'drone_frame_constraints/app/server.py').read_text(encoding='utf-8'))
    assignment = next(node for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'CONTROL_GROUPS' for target in node.targets))
    for call in assignment.value.elts:
        title, rows = (ast.literal_eval(arg) for arg in call.args)
        groups.append({'title': title, 'fields': [dict(zip(('key', 'label', 'min', 'max', 'step'), row)) | {'unit': 'deg' if row[0].endswith('rotation_z') else 'loops' if row[0] == 'separate_skirt_loops' else 'ratio' if row[0] == 'lower_arm_brace_reach' else 'mm'} for row in rows]})
    controllers = {key: {'label': item['label'].replace(' (6 owned)', ''), 'source': item['source'], 'basis': item['basis'], 'changes': item['changes']} for key, item in CONTROLLERS.items()}
    config = {'version': 1, 'defaults': asdict(default), 'historical': v0_values, 'groups': groups, 'controllers': controllers, 'colors': v0.COLORS,
              'datums': datums,
              'source_hashes': {name: sha256((source / name).read_bytes()).hexdigest() for name in ('drone_frame_v1/params.json', 'drone_frame_v1/model.py', 'drone_frame_v1/arm_joints.py', 'drone_frame_v1/underside_mount.py', 'drone_frame_v1/prop_mounts.py', 'drone_frame_v1/lower_arm_braces.py', 'drone_frame_v0/model.py', 'drone_frame_v0/carrier.py')}}
    destination = root / 'assets/cad/drone-frame/config.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    original_lower = v1.build_frame(source_default)
    def public_sweeps(p):
        z = p.frame_thickness + (datums['motor_seat_z'] - datums['hub_seat_z'] if p.prop_seat_on_shaft else p.prop_plane_above_mount)
        return [{'motor': name, 'center': list(xy), 'radius_mm': max(p.prop_diameter / 2, datums['prop_reference_radius_mm']),
                 'minimum_z': z + min(-p.prop_blade_thickness / 2, datums['prop_bounds_offset_mm'][0]) - p.prop_deflection_allowance,
                 'maximum_z': z + max(p.prop_blade_thickness / 2, datums['prop_bounds_offset_mm'][1]) + p.prop_deflection_allowance}
                for name, xy in v0.motor_centers(p).items()]
    v1.lower_arm_braces.rotor_sweeps = public_sweeps
    cases = [('current', default), ('historical', v1.Params(**v0_values))]
    for name, changes in (
        ('bolted', {'lower_arm_braces': False, 'upper_arm_extensions': True, 'upper_arm_joint_style': 'bolted'}), ('contact', {'lower_arm_braces': False, 'upper_arm_extensions': True, 'upper_arm_joint_style': 'contact_only'}),
        ('wider-motors', {'motor_x_offset': 106, 'motor_y_offset': 85}), ('higher-bay', {'clear_bay_height': 30}),
        ('no-upper-arms', {'upper_arm_extensions': False}), ('no-controller', {'carrier_enabled': False}),
        ('no-small-seats', {'small_board_mounts': False, 'imu_mount_enabled': False}),
        ('no-battery-slots', {'battery_ties_enabled': False}), ('thicker', {'frame_thickness': 11}),
        ('rotated-controller', {'esp32_rotation_z': 75}), ('shorter-shoe', {'upper_arm_end_station': 72}),
        ('teensy', CONTROLLERS['teensy_4_1']['changes'] | {'controller_preset': 'teensy_4_1'}),
        ('separate-carrier', {'controller_mount_style': 'separate_above'}),
        ('legacy-keyed', {'lower_arm_braces': False, 'upper_arm_extensions': True}),
        ('shorter-ribs', {'lower_arm_brace_reach': 0.8}),
        ('larger-blade-gap', {'lower_arm_brace_blade_gap': 1.5}),
        ('manual-props', {'prop_seat_on_shaft': False, 'prop_plane_above_mount': 24}),
    ):
        cases.append((name, replace(default, **changes)))
    fixtures = []
    for name, p in cases:
        try:
            solids = {'lower': v1.build_frame(p), 'coupon': v0.build_coupon(v1.base_params(p))}
            if p.frame_variant == 'drone_frame_v1':
                solids['upper'] = v1.build_upper(p)
                if v1.integrated_controller(p):
                    for index, clip in enumerate(v1.underside_mount.keeper_geometry(p)['clips']):
                        solids[f'keeper-{index+1}'] = clip
            if v1.separate_carrier(p):
                solids['carrier'] = v1.build_carrier(p)
            if name == 'current':
                assert abs(solids['lower'].volume() - original_lower.volume()) < 0.01, 'Public envelope changes original default print geometry'
            expected = {}
            for key, solid in solids.items():
                mesh = v0.manifold_mesh(solid)
                expected[key] = {'bounds': mesh.bounds.tolist(), 'volume': solid.volume(), 'genus': solid.genus(), 'components': len(solid.decompose())}
            fixtures.append({'name': name, 'parameters': asdict(p), 'expected': expected})
            print(f'Fixture: {name}', flush=True)
        except ValueError as error:
            fixtures.append({'name': name, 'parameters': asdict(p), 'error': str(error)})
            print(f'Invalid fixture: {name}: {error}', flush=True)
    (root / '_tools/drone-frame/fixtures.json').write_text(json.dumps(fixtures, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
