"""Publish an exact fixed CAD revision, with separate printable files and capped sections."""
from pathlib import Path, PureWindowsPath
from dataclasses import asdict
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
import json
import shutil
import sys
sys.dont_write_bytecode = True
import re
import numpy as np
import trimesh

root=Path(__file__).resolve().parents[2]
source=Path('F:/param_cad')
sys.path.insert(0,str(source))
from cabinet_air_damper_v1 import model

baseline=model.load_params()
native=source/'cabinet_air_damper_v1/generated'
settings=json.loads((Path(__file__).with_name('tolerances.json')).read_text())
assert sha256((source/'cabinet_air_damper_v1/model.py').read_bytes()).hexdigest()==settings['generator_sha256'], 'Review changed source before regenerating the fit trial'
assert sha256((source/'cabinet_air_damper_v1/params.json').read_bytes()).hexdigest()==settings['baseline_params_sha256'], 'Review changed source parameters before regenerating the fit trial'
assert json.loads((native/'params.json').read_text())==asdict(baseline), 'Refresh the source release before publishing'
assert set(settings['changes'])=={'bore_diameter_compensation','piston_diameter_compensation'}, 'Only the two sliding-surface corrections may change'
p=model.Params.from_json(asdict(baseline)|settings['changes'])
folder=root/'output/damper/clearance-trial'
model.export(p,folder)
payload=model.payload(p)
assert payload['report']['geometry_status']=='pass'
manifest=json.loads((folder/'print_manifest.json').read_text())
assert sum(item['quantity'] for item in manifest)==14 and len(manifest)==9
target=root/'assets/cad/air-damper'
target.mkdir(parents=True,exist_ok=True)
unchanged={}
for item in manifest:
    name=item['file']
    if item['part'] not in {'housing','plunger'}:
        assert (folder/name).read_bytes()==(native/name).read_bytes(), f'Unrequested print geometry changed: {name}'
        unchanged[name]=sha256((native/name).read_bytes()).hexdigest()
assert unchanged['front_cap.stl']==settings['front_cap_sha256'], 'The locked front cap must not change'
assert sha256((target/'front_cap.stl').read_bytes()).hexdigest()==settings['front_cap_sha256'], 'Current front cap differs from the locked print'
files=[item['file'] for item in manifest]+['tape_cut_template.svg','longitudinal_sections.svg','reset_valve_section.svg','print_manifest.json','fit_report.json','params.json']
hashes={}
for name in files:
    if name.endswith('.stl'):
        mesh=trimesh.load(folder/name,force='mesh')
        expected=next(item for item in manifest if item['file']==name)
        assert mesh.is_watertight and mesh.is_winding_consistent and len(mesh.split())==1
        assert np.max(np.abs(mesh.extents-expected['dimensions_mm']))<.025
        assert abs(mesh.volume/expected['volume_mm3']-1)<.00001
        assert abs(mesh.bounds[0,2])<.025
    shutil.copyfile(folder/name,target/name)
    hashes[name]=sha256((target/name).read_bytes()).hexdigest()
parts=[]
for item in payload['parts']:
    parts.append({'name':item['id'],'label':item['name'],'color':item['color'],'reference':not item['printed'],'moving':item['moving'],'positions':np.asarray(item['vertices'],dtype=np.float32).ravel().tolist(),'indices':np.asarray(item['faces']).ravel().tolist(),'section_positions':np.asarray(item.get('section_vertices',[]),dtype=np.float32).ravel().tolist(),'section_indices':np.asarray(item.get('section_faces',[])).ravel().tolist()})
payload['report']['fit_trial']=settings
(folder/'fit_report.json').write_text(json.dumps(payload['report'],indent=2)+'\n',encoding='utf-8')
shutil.copyfile(folder/'fit_report.json',target/'fit_report.json')
hashes['fit_report.json']=sha256((target/'fit_report.json').read_bytes()).hexdigest()
record={'revision':settings['revision'],'parameters':payload['parameters'],'parts':parts,'maximum_stroke_mm':payload['maximum_stroke_mm'],'air_paths':payload['air_paths'],'report':payload['report'],'print_manifest':manifest,'copyright':'Santeri Hukari'}
(target/'model.json').write_text(json.dumps(record,separators=(',',':'))+'\n',encoding='utf-8')
scene=trimesh.load(folder/'assembly.glb',force='scene')
transform=trimesh.transformations.rotation_matrix(-np.pi/2,[1,0,0]);transform[:3,:3]*=.001
scene.apply_transform(transform)
scene.metadata.update({'author':'Santeri Hukari','original_design_copyright':'Copyright 2026 Santeri Hukari','revision':record['revision'],'units':'metres','up_axis':'Y'})
for mesh in scene.geometry.values():
    mesh.metadata.update({'author':'Santeri Hukari','original_design_copyright':'Copyright 2026 Santeri Hukari'})
scene.export(target/'assembly.glb')
check=trimesh.load(target/'assembly.glb',force='scene')
assert check.extents.max()<.2 and len(check.geometry)==len(scene.geometry)
notes=(source/'cabinet_air_damper_v1/README.md').read_text(encoding='utf-8')
notes=notes[notes.index('## Geometry'):notes.index('## Viewer And Regeneration')]
notes='# Cabinet air damper V1 - fixed seal-free PLA experiment\n\nOriginal CAD and copyright: Santeri Hukari.\nThis is a fixed revision, not browser-parametric CAD or verified damping hardware.\nMaterials: PLA, piano-wire spring and double-sided tape only. No O-rings or metal screws.\n\n'+notes
notes=notes.replace('| Shell | OD28, bore20, X0..50 |','| Shell | OD28, CAD bore20.40, X0..50 |').replace('| Piston | OD19.92, length22, X0..22 at extension |','| Piston | CAD OD19.70, length22, X0..22 at extension |').replace('| Nominal radial sliding clearance | 0.04 per side |','| CAD radial sliding clearance | 0.35 per side; not a measured printed clearance |').replace('| Diameter fitting alternatives | 19.90 / 19.92 / 19.94 |','| Estimated printed diametral clearance | 0.29; unverified trial |')
start=notes.index('CAD bore compensation and piston compensation')
end=notes.index('## What To Print',start)
notes=notes[:start]+'''## Measured-Fit Trial 1

The first test pieces measured about 19.67 mm inside the housing and 20.00 mm
outside the piston: approximately 0.33 mm interference. This revision uses
a 20.40 mm CAD bore (+0.40 mm compensation) and 19.70 mm CAD piston
(-0.22 mm compensation). If the same print errors repeat, the result would
be about 20.07 / 19.78 mm: 0.29 mm diametral clearance, or 0.145 mm per side.
These are estimates, not measured results. Measure roundness and taper too.

The front cap STL is byte-identical to the previous release. Rod geometry
is unchanged at 6.00 mm CAD diameter (reported print about 5.65 mm).
Rear cap, pins, clips, reed and tape template also remain unchanged. Only
the housing bore and piston sliding diameter have been adjusted. No whole
part scaling is used. Existing caps and fasteners can be retained; use the
revised housing and plunger together for this fit trial.

This is an unprinted fit trial, not a verified damping revision. Additional
air leakage may reduce damping. Dry-fit the parts without forcing them,
then test leakage, reset and damping before installation. The original
0.04 mm radial design goal is not a claim about this trial's printed fit.

'''+notes[end:]
start=notes.index('`plunger_19p90.stl`')
end=notes.index('The STL orientations are:',start)
notes=notes[:start]+'Use the matching housing.stl and plunger.stl from this revision. Previous\nnear-nominal diameter alternatives are not part of this print set.\n\n'+notes[end:]
notes=notes.replace('Separate, print-oriented STLs and matching STEP files are in `generated/`.','This download contains separate, print-oriented STLs. Matching STEP files\nare available in the local CAD trial output, not in the website print set.').replace('| plunger.stl (or ONE diameter alternative) | 1 |','| plunger.stl | 1 |')
notes=re.sub(r'[A-Z]:[^\s`]+',lambda match:PureWindowsPath(match.group(0)).name,notes)
assert not re.search(r'(?i)[A-Z]:[\\/]',notes)
(target/'README.md').write_text(notes,encoding='utf-8')
with ZipFile(target/'print-set.zip','w',ZIP_DEFLATED) as package:
    for name in files:package.write(target/name,arcname=name)
    package.writestr('README.md',notes)
icon_source=next(source.glob('*/app/node_modules/lucide-static/icons/play.svg')).parent
(target/'icons').mkdir(exist_ok=True)
for name in ('play.svg','pause.svg','rotate-ccw.svg'):
    shutil.copyfile(icon_source/name,target/'icons'/name)
shutil.copyfile(icon_source.parent/'LICENSE',target/'icons/LICENSE.txt')
(target/'source-manifest.json').write_text(json.dumps({'copyright':'Santeri Hukari','release':settings['release'],'published_sha256':hashes,'baseline_sha256':{name:sha256((native/name).read_bytes()).hexdigest() for name in files},'unchanged_print_sha256':unchanged,'generator_sha256':settings['generator_sha256'],'fit_trial':settings,'geometry_mode':'Fixed measured-fit trial regenerated from read-only source; only bore and piston diameter compensation changed'},indent=2)+'\n',encoding='utf-8')
print('PASS fixed damper fit trial: seven unchanged print designs including front cap, CAD bore20.40/piston19.70, 9 designs / 14 pieces')
