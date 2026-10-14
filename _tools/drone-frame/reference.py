"""Extract a public configuration and geometry fixtures without importing reference CAD."""
from __future__ import annotations

import argparse
import ast
from dataclasses import asdict, fields, replace
from hashlib import sha256
import json
from pathlib import Path
import sys
from types import SimpleNamespace


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('F:/param_cad'))
    parser.add_argument('--current-source', action='store_true', help='Extract the authoritative live source instead of the older prepared website snapshot')
    parser.add_argument('--upgrade-website-snapshot', action='store_true', help='Add website-only print-version metadata to the already verified snapshot, without importing CAD source')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    if args.upgrade_website_snapshot:
        config_file = root / 'assets/cad/drone-frame/config.json'
        fixtures_file = root / '_tools/drone-frame/fixtures.json'
        config = json.loads(config_file.read_text(encoding='utf-8'))
        fixtures = json.loads(fixtures_file.read_text(encoding='utf-8'))
        config['version'] = 5
        for key in ('defaults', 'historical'):
            config[key].setdefault('print_profile', 'full')
        for case in fixtures:
            case['parameters'].setdefault('print_profile', 'full')
        config_file.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
        fixtures_file.write_text(json.dumps(fixtures, indent=2) + '\n', encoding='utf-8')
        print('Upgraded verified website snapshot only; CAD source and source geometry fixtures unchanged')
        return
    source = args.source.resolve()
    def public_values(p):
        return {key: value for key, value in asdict(p).items() if key not in {'draft_profile', 'fit_base_thickness', 'fit_rail_width', 'fit_boundary_width'}}
    sys.path.insert(0, str(source))
    from drone_frame_v1 import model as v1
    from drone_frame_v0 import model as v0
    from drone_frame_v0.controllers import CONTROLLERS

    prepared = json.loads((source / 'website_model_assets/drone_parameters.json').read_text(encoding='utf-8'))
    if args.current_source:
        from drone_frame_v1.printer_profiles import PROFILES
        prepared = {'defaults': asdict(v1.load_params(source / 'drone_frame_v1/params.json')), 'printer_profiles': PROFILES}
    if set(prepared['defaults']) != {field.name for field in fields(v1.Params)}:
        raise ValueError('Prepared drone parameters no longer match the CAD source. Refresh the CAD handoff before regenerating website fixtures.')
    if json.loads(json.dumps(asdict(v1.load_params(source / 'drone_frame_v1/params.json')))) != prepared['defaults']:
        raise ValueError('Prepared drone defaults differ from the current source; refresh the CAD handoff first.')
    source_default = v1.Params(**prepared['defaults'])
    # Read cached geometry only to extract scalar sweep bounds; never create source caches.
    cached_mesh = v1.references.cached_mesh
    def read_cached(model_id, cache_file):
        if not Path(cache_file).exists():
            raise ValueError(f'Required reference cache is absent for {model_id}; source is read-only')
        return cached_mesh(model_id, cache_file)
    v1.references.cached_mesh = read_cached
    sweeps = v1.lower_arm_braces.rotor_sweeps(source_default)
    plane = v1.motor_platform.mount_z(source_default) + source_default.prop_plane_above_mount
    datums = {'motor_seat_z': 19.8, 'motor_tip_z': 31.8, 'hub_seat_z': -2.5, 'hub_top_z': 2.5,
              'prop_bounds_offset_mm': [min(s['minimum_z'] for s in sweeps) + source_default.prop_deflection_allowance - plane,
                                        max(s['maximum_z'] for s in sweeps) - source_default.prop_deflection_allowance - plane],
              'prop_reference_radius_mm': max(s['radius_mm'] for s in sweeps)}
    hardware_file = root / '_tools/drone-frame/hardware-defaults.json'
    hardware = json.loads(hardware_file.read_text(encoding='utf-8'))
    source_public = replace(source_default, component_references={})
    website_file = root / '_tools/drone-frame/website-defaults.json'
    website = json.loads(website_file.read_text(encoding='utf-8'))
    default = replace(source_public, **(hardware['parameters'] | website['parameters']))
    historical = v0.load_params(source / 'drone_frame_v0/params.json')
    v0_values = asdict(default) | asdict(historical) | {'frame_variant': 'drone_frame_v0', 'component_references': {}, 'motor_recess_enabled': False, 'prop_seat_on_shaft': False, 'prop_nuts_enabled': False, 'under_controller_ties_enabled': False}
    groups = json.loads((source / 'website_model_assets/drone_controls.json').read_text(encoding='utf-8'))
    if args.current_source:
        tree = ast.parse((source / 'drone_frame_constraints/app/server.py').read_text(encoding='utf-8'))
        value = next(node.value for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'CONTROL_GROUPS' for target in node.targets))
        groups = [{'title': ast.literal_eval(call.args[0]), 'fields': [{'key': key, 'label': label, 'min': low, 'max': high, 'step': step, 'unit': 'deg' if key.endswith('rotation_z') else 'ratio' if key == 'lower_arm_brace_reach' else 'mm'} for key, label, low, high, step in ast.literal_eval(call.args[1])]} for call in value.elts]
        groups = [group for group in groups if group['title'] != 'Fit-only jig']
    controllers = {key: {'label': item['label'].replace(' (6 owned)', ''), 'source': item['source'], 'basis': item['basis'], 'changes': item['changes']} for key, item in CONTROLLERS.items()}
    config = {'version': 6 if args.current_source else 5, 'defaults': public_values(default) | {'print_profile': 'full'}, 'historical': {key: value for key, value in v0_values.items() if key in public_values(default)} | {'print_profile': 'full'}, 'groups': groups, 'controllers': controllers, 'colors': v0.COLORS, 'printer_profiles': prepared['printer_profiles'],
              'hardware_defaults': hardware, 'hardware_defaults_sha256': sha256(hardware_file.read_bytes()).hexdigest(),
              'website_defaults': website,
              'datums': datums,
              'source_hashes': {name: sha256((source / name).read_bytes()).hexdigest() for name in ('website_model_assets/drone_parameters.json', 'website_model_assets/drone_controls.json', 'drone_frame_v1/model.py', 'drone_frame_v1/motor_platform.py', 'drone_frame_v1/top_mount.py', 'drone_frame_v1/motor_cables.py', 'drone_frame_v1/printer_profiles.py', 'drone_frame_v1/arm_joints.py', 'drone_frame_v1/underside_mount.py', 'drone_frame_v1/prop_mounts.py', 'drone_frame_v1/lower_arm_braces.py', 'drone_frame_v0/model.py', 'drone_frame_v0/carrier.py')}}
    destination = root / 'assets/cad/drone-frame/config.json'
    if args.current_source:
        signature_file = source / 'drone_frame_v1/generated/bridged_controller_L_guides/signature_outline.json'
        signature = json.loads(signature_file.read_text(encoding='utf-8'))
        config['signature'] = {key: signature[key] for key in ('text', 'base_em_size_mm', 'contours')}
        bench = json.loads((source / 'drone_frame_v1/bench_retention/params.json').read_text(encoding='utf-8'))
        config['controller_guides'] = {key: bench[key] for key in ('controller_clamp_thickness', 'controller_clamp_gap', 'controller_clamp_overlap', 'controller_clamp_recess_depth')}
        for name in ('drone_frame_v1/params.json', 'drone_frame_v1/signature.py', 'drone_frame_v1/bench_retention/controller_clamps.py', 'drone_frame_constraints/app/server.py'):
            config['source_hashes'][name] = sha256((source / name).read_bytes()).hexdigest()
        config['source_hashes']['drone_frame_v1/generated/bridged_controller_L_guides/signature_outline.json'] = sha256(signature_file.read_bytes()).hexdigest()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    original_lower = v1.build_frame(default)
    def public_sweeps(p):
        z = v1.motor_platform.mount_z(p) + (datums['motor_seat_z'] - datums['hub_seat_z'] if p.prop_seat_on_shaft else p.prop_plane_above_mount)
        return [{'motor': name, 'center': list(xy), 'radius_mm': max(p.prop_diameter / 2, datums['prop_reference_radius_mm']),
                 'minimum_z': z + min(-p.prop_blade_thickness / 2, datums['prop_bounds_offset_mm'][0]) - p.prop_deflection_allowance,
                 'maximum_z': z + max(p.prop_blade_thickness / 2, datums['prop_bounds_offset_mm'][1]) + p.prop_deflection_allowance}
                for name, xy in v0.motor_centers(p).items()]
    v1.lower_arm_braces.rotor_sweeps = public_sweeps
    legacy = asdict(default) | json.loads((source / 'drone_frame_v1/revisions/2026-10-10_before_motor_recesses/params.json').read_text(encoding='utf-8')) | {'motor_recess_enabled': False, 'motor_compact_pad': False, 'motor_cable_ports_enabled': False, 'lower_body_length': 0, 'component_references': {}, 'under_controller_ties_enabled': False, 'upper_signature_enabled': False, 'controller_center_support_enabled': False, 'controller_side_supports_enabled': False, 'controller_long_tie_slots': False, 'controller_antenna_roof_opening': True}
    cases = [('current', default), ('historical', v1.Params(**v0_values)), ('mk4', replace(default, **prepared['printer_profiles'][1]['changes'])),
             ('source-handoff-ender', source_public), ('source-handoff-mk4', replace(source_public, **prepared['printer_profiles'][1]['changes']))]
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
        ('no-controller-ties', {'under_controller_ties_enabled': False}),
        ('larger-controller-ties', {'under_tie_slot_length': 5, 'under_tie_slot_width': 2}),
        ('controller-outside-roof', {'esp32_center_x': 25}),
        ('shorter-lower-body', {'lower_body_length': 100}),
        ('shared-body-length', {'lower_body_length': 0}),
        ('no-cable-slots', {'motor_cable_ports_enabled': False}),
        ('narrower-cable-slots', {'motor_cable_port_width': 3}),
        ('unsafe-cable-slots', {'motor_cable_port_width': 5}),
        ('source-bridge', asdict(source_public)),
        ('narrow-support', asdict(source_public) | {'controller_center_support_width': 10, 'controller_support_bearing_width': 3}),
        ('no-side-guides', asdict(source_public) | {'controller_side_supports_enabled': False}),
        ('four-roof-ties', asdict(source_public) | {'controller_long_tie_slots': False}),
    ):
        cases.append((name, replace(v1.Params(**legacy) if name in {'bolted', 'contact', 'legacy-keyed', 'shorter-shoe'} else default, **changes)))
    fixtures = []
    for name, p in cases:
        try:
            solids = {'lower': v1.build_frame(p), 'coupon': v1.motor_platform.coupon(p)}
            if p.frame_variant == 'drone_frame_v1':
                solids['upper'] = v1.build_upper(p)
                if v1.integrated_controller(p):
                    for index, clip in enumerate(v1.underside_mount.keeper_geometry(p)['clips']):
                        solids[f'keeper-{index+1}'] = clip
            if v1.separate_carrier(p):
                solids['carrier'] = v1.build_carrier(p)
            if p.carrier_enabled and p.controller_mount_style == 'integrated_top' and p.controller_center_support_enabled and p.controller_long_tie_slots and p.under_controller_ties_enabled:
                from drone_frame_v1.bench_retention import controller_clamps
                guide = controller_clamps.geometry(p, SimpleNamespace(**config['controller_guides']))['solid']
                solids['controller-guide-1'] = guide
                solids['controller-guide-2'] = guide
            if name == 'current':
                assert abs(solids['lower'].volume() - original_lower.volume()) < 0.01, 'Public envelope changes original default print geometry'
                assert abs(solids['upper'].volume() - website['upper_reference']['volume']) < 0.01, 'Do not replace the preferred website upper frame'
            expected = {}
            for key, solid in solids.items():
                mesh = v0.manifold_mesh(solid)
                expected[key] = {'bounds': mesh.bounds.tolist(), 'volume': solid.volume(), 'genus': solid.genus(), 'components': len(solid.decompose())}
            fixtures.append({'name': name, 'parameters': public_values(p) | {'print_profile': 'full'}, 'expected': expected})
            print(f'Fixture: {name}', flush=True)
        except ValueError as error:
            fixtures.append({'name': name, 'parameters': public_values(p) | {'print_profile': 'full'}, 'error': str(error)})
            print(f'Invalid fixture: {name}: {error}', flush=True)
    old_cases = json.loads((root / '_tools/drone-frame/fixtures.json').read_text(encoding='utf-8'))
    previous = next((case for case in old_cases if case['name'] == 'previous-website-default'), next(case for case in old_cases if case['name'] == 'current'))
    previous_parameters = {key: value for key, value in previous['parameters'].items() if key not in {'draft_profile', 'fit_base_thickness', 'fit_rail_width', 'fit_boundary_width'}}
    fixtures.append(previous | {'name': 'previous-website-default', 'parameters': public_values(default) | previous_parameters | {'motor_compact_pad': False, 'motor_cable_ports_enabled': False, 'lower_body_length': 0, 'print_profile': 'full', 'upper_signature_enabled': False, 'controller_center_support_enabled': False, 'controller_side_supports_enabled': False, 'controller_long_tie_slots': False, 'controller_antenna_roof_opening': True}})
    (root / '_tools/drone-frame/fixtures.json').write_text(json.dumps(fixtures, indent=2) + '\n', encoding='utf-8')
    if args.current_source:
        print('Current geometry extracted read-only; older prepared handoff fixtures deliberately not refreshed')
        return
    provided = json.loads((source / 'website_model_assets/drone_fixtures.json').read_text(encoding='utf-8'))
    summary = []
    for item in provided:
        record = {key: item[key] for key in ('id', 'frame', 'printer', 'body_lengths_mm', 'derived_layout', 'motor_screws', 'clearance', 'controller_mount', 'motor_cables', 'bay')}
        mesh = item['upper_mesh_mm']
        import numpy as np
        import trimesh
        upper = trimesh.Trimesh(vertices=np.asarray(mesh['vertices']), faces=np.asarray(mesh['faces']), process=False)
        record['upper'] = {'bounds': upper.bounds.tolist(), 'solid_volume_mm3': float(upper.volume), 'vertices': len(upper.vertices), 'faces': len(upper.faces)}
        summary.append(record)
    (root / '_tools/drone-frame/handoff-fixtures.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
