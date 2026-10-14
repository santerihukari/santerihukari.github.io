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

p=model.load_params()
payload=model.payload(p)
folder=source/'cabinet_air_damper_v1/generated'
assert json.loads((folder/'params.json').read_text())==asdict(p), 'Refresh the source release before publishing'
manifest=json.loads((folder/'print_manifest.json').read_text())
assert sum(item['quantity'] for item in manifest)==14 and len(manifest)==9
target=root/'assets/cad/air-damper'
target.mkdir(parents=True,exist_ok=True)
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
record={'revision':'Fixed V1: seal-free PLA experiment','parameters':payload['parameters'],'parts':parts,'maximum_stroke_mm':payload['maximum_stroke_mm'],'air_paths':payload['air_paths'],'report':payload['report'],'print_manifest':manifest,'copyright':'Santeri Hukari'}
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
(target/'source-manifest.json').write_text(json.dumps({'copyright':'Santeri Hukari','release':'2026-10-13 seal-free V1','source_sha256':hashes,'generator_sha256':sha256((source/'cabinet_air_damper_v1/model.py').read_bytes()).hexdigest(),'geometry_mode':'Fixed; dimensional regeneration is not offered by this page'},indent=2)+'\n',encoding='utf-8')
print('PASS exact fixed damper: capped sections, 9 designs / 14 pieces, printable poses and metre/Y-up GLB')
