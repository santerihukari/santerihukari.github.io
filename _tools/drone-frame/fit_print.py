"""Independently inspect and package all three drone prototype print versions."""
from hashlib import sha256
import json
from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

import numpy as np
import trimesh


def main():
    root = Path(__file__).resolve().parents[2]
    config_file = root / 'assets/cad/drone-frame/config.json'
    config = json.loads(config_file.read_text(encoding='utf-8'))
    config_hash = sha256(config_file.read_bytes()).hexdigest()
    hardware_file = root / '_tools/drone-frame/hardware-defaults.json'
    assert sha256(hardware_file.read_bytes()).hexdigest() == config['hardware_defaults_sha256']
    output = root / 'output/drone-frame'
    estimates = json.loads((output / 'slicer-estimates.json').read_text(encoding='utf-8'))
    purposes = {
        'fit_check': 'UNPOWERED LAYOUT JIG ONLY. No powered motors, propeller testing, hovering or flight. Hole XY positions and motor screw grip are retained; bay height, full-height joints, controller retention, cable ports and frame stiffness are NOT reproduced.',
        'bench_test': 'INTERMEDIATE BENCH-TEST DRAFT. Intended for a later controlled test setup, but safe powered testing has NOT been established. Strength, secure restraint, wiring, fasteners and dynamic prop clearance require independent validation. Not flight-ready.',
        'full': 'FULL FRAME / ROBUST DRAFT. Full-thickness source geometry, not a verified robust or flight-ready frame. Strength, stiffness, fatigue, vibration and thrust capacity remain untested.',
    }
    for version, purpose in purposes.items():
        source = output / 'print-variants' / version
        record = json.loads((source / 'report.json').read_text(encoding='utf-8'))
        assert record['config_sha256'] == config_hash, 'Regenerate version exports after a configuration change'
        p, report = record['parameters'], record['report']
        assert p == config['defaults'] | {'print_profile': version}
        assert report['printer']['status'] == 'pass' and report['printer']['upper']['status'] == 'pass'
        slug = version.replace('_', '-')
        destination = output / ('fit-check' if version == 'fit_check' else slug)
        destination.mkdir(parents=True, exist_ok=True)
        names = {'lower': f'drone-{slug}-lower.stl', 'upper': f'drone-{slug}-upper.stl', 'coupon': 'motor-pad-fit-coupon.stl'}
        files = {}
        for part, name in names.items():
            mesh = trimesh.load(source / f'{part}.stl', force='mesh', process=True)
            expected = record['expected'][part]
            assert mesh.is_watertight and mesh.is_winding_consistent and len(mesh.split()) == 1, f'{version}/{part}'
            assert np.max(np.abs(mesh.bounds - expected['bounds'])) < 0.025, f'{version}/{part}'
            assert abs(mesh.volume / expected['volume'] - 1) < 0.00001, f'{version}/{part}'
            assert abs(mesh.bounds[0, 2]) < 0.025, f'{version}/{part}'
            assert np.all(mesh.extents[:2] + 2 * p['brim_width'] <= [p['printer_bed_width'], p['printer_bed_depth']])
            shutil.copyfile(source / f'{part}.stl', destination / name)
            files[name] = {'sha256': sha256((destination / name).read_bytes()).hexdigest(), 'dimensions_mm': mesh.extents.tolist(), 'volume_mm3': float(mesh.volume), 'watertight': True}
            print(f'PASS {slug}/{name}: watertight, source bounds/volume, print Z0', flush=True)
        (destination / 'parameters.json').write_text(json.dumps(p, indent=2) + '\n', encoding='utf-8')
        (destination / 'fit-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        times = estimates['versions'][version]
        for part in ('lower', 'upper'):
            assert times[part]['stl_sha256'] == sha256((source / f'{part}.stl').read_bytes()).hexdigest(), 'Reslice after a geometry change'
            if version == 'fit_check':
                assert times[part]['auto_support_check'] and times[part]['support_sections'] == 0
        manifest = {'version': version, 'purpose': purpose, 'config_sha256': config_hash, 'files': files, 'slicer_estimates': times, 'estimate_basis': estimates['basis']}
        (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        notes = f"""# Drone prototype: {slug}

{purpose}

Print the normal-height motor-pad coupon first to check the mounting pattern
and screw engagement. Then use BOTH matching lower and upper parts for the
selected purpose. Motor grip and hardware hole XY positions match the full
version. The FIT JIG is not a full-height assembly: use separate spacers if
checking the electronics stack, and compare the full model for omitted fit.
Never assume matching geometry establishes strength.

Fit check uses flat 0.84 mm base/roof skins, 1.2 mm ribs and open panels.
Root-bolt bosses are 1.68 mm tall with 1.2 mm walls. Tall root webs, locating
lips/grooves, arm ribs and controller retention are omitted. Motor pads and
the coupon retain normal 5.3 mm thickness. Default jig slicing with automatic
supports enabled generates zero support paths. Edited settings, motor recesses
or other orientations require a fresh support check. Handle the thin jig gently.
Bench-test uses closed 3 mm base / 2.4 mm roof skins and 2.4 mm webs, keeping
arm ribs. Full frame retains the original 5.3 mm base / 4 mm roof / 3 mm webs.
These values describe the default variants; parameters.json is authoritative.

All STLs are in millimetres and at print Z0. Use 0-degree print rotation.
Ender-3 V2 usable bed: 220 x 220 x 250 mm. Lower footprint: 203 x 206 mm;
5 mm brim gives 213 x 216 mm. Version-specific dimensions are in manifest.json.
No separate skirt. Bed clips and purge lines are not included in the allowance.

Local slicer estimate: lower {times['lower']['estimated_time']} / {times['lower']['filament_grams']:.2f} g;
upper {times['upper']['estimated_time']} / {times['upper']['filament_grams']:.2f} g.
{estimates['basis']}
Only STLs, parameters and reports are packaged; G-code is not provided for
printing, and no job has been sent to a printer.

ESC: T-Motor Velox V50A 6S 4IN1 32BIT, 45.4 x 43.8 x 8 mm envelope,
measured board hole centres approximately 30.55 mm and board holes 4 mm.
Frame bores use 3.4 mm M3 clearance on the nominal 30.5 mm pattern.
Confirm screws, grommets, solder joints and cables physically.
Only 1 mm nominal roof clearance above the ESC; service clearance is unverified.
Motor-pad hole-edge web is 1.3 mm, below the conservative 2 mm allowance.
Motor engagement is nominally 2.7 mm of 3 mm thread depth; heads protrude
3 mm below the base. Confirm screws do not bottom or contact motor windings.
Prop checks use 64.77 mm radius and a 3 mm vertical deflection allowance;
dynamic clearance and purchased prop dimensions remain unverified.

Original design copyright: Santeri Hukari. No public design licence selected.
No vendor CAD/component meshes included. Files and hashes are in manifest.json.
"""
        (destination / 'README.md').write_text(notes, encoding='utf-8')
        contents = [*names.values(), 'parameters.json', 'fit-report.json', 'manifest.json', 'README.md']
        archive = output / f'drone-{slug}-print-set.zip'
        with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as package:
            for name in contents:
                package.write(destination / name, arcname=name)
        with ZipFile(archive) as package:
            assert set(package.namelist()) == set(contents) and package.testzip() is None
            for name in contents:
                assert package.read(name) == (destination / name).read_bytes()
        if version == 'fit_check':
            shutil.copyfile(archive, output / 'drone-bench-fit-check.zip')
        print(f'PASS print package: {archive}', flush=True)


if __name__ == '__main__':
    main()
