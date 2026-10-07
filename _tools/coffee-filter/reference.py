"""Generate parity fixtures from the unchanged local Python reference app."""
import argparse
import hashlib
import importlib.util
import json
import sys
from dataclasses import asdict
from pathlib import Path

import trimesh

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path(r'F:\param_cad'))
args = parser.parse_args()
source = args.source / 'coffee_filter_paper_holder_profiles/app/server.py'
spec = importlib.util.spec_from_file_location('coffee_reference', source)
reference = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = reference
spec.loader.exec_module(reference)

variants = {
    'default': {}, 'rise-zero': {'front_rise': 0}, 'rise-max': {'front_rise': 16},
    'paper-drop': {'paper_drop': 10}, 'side-rest-default-drop': {'paper_drop': 17}, 'thick-wall': {'wall_thickness': 5},
    'small-rounding': {'edge_radius': 0.2}, 'large-rounding': {'edge_radius': 1.1},
    'tall-guide': {'wall_height': 55}, 'small-radius': {'radius': 100},
    'wide-screws': {'screw_spacing': 120}, 'deep-stack': {'usable_depth': 45},
}
fixtures = []
for layout in ('symmetric', 'side_rest'):
    for profile in ('measured', 'right_angle'):
        for name, changes in variants.items():
            values = {'layout': layout, **({'angle': 90, 'tip_cut': 0} if profile == 'right_angle' else {}), **changes}
            params = reference.ModelSpec.from_json(values)
            fixture = {'name': f'{layout}-{profile}-{name}', 'parameters': asdict(params)}
            try:
                vertices, faces, outline, contact, bounds = reference.make_model(params)
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
                fixture.update(bounds=bounds, volume=float(mesh.volume), contact_z=float(contact), paper_outline=outline.tolist())
            except ValueError as error:
                fixture['error'] = str(error)
            fixtures.append(fixture)

sources = ['coffee_filter_paper_holder_profiles/app/server.py', 'coffee_filter_paper_holder_profiles/build_profiles.py',
           'coffee_filter_paper_holder_profiles/side_rest_holder.py', 'coffee_filter_paper_holder/coffee_filter_paper_holder.py',
           'coffee_filter_paper_holder_production/production_holder.py']
result = {'source_sha256': {name: hashlib.sha256((args.source / name).read_bytes()).hexdigest() for name in sources}, 'fixtures': fixtures}
target = Path(__file__).with_name('reference-fixtures.json')
target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'Wrote {len(fixtures)} fixtures ({sum("error" not in f for f in fixtures)} valid) to {target}')
