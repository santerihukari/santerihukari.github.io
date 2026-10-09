"""Independent checks of the browser's downloaded panel sets and GLB units."""
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile
import numpy as np
import trimesh

root = Path(__file__).resolve().parents[2]
output = root / 'output/climbing-volumes'
for path in sorted(output.glob('*_panels.zip')):
    with ZipFile(path) as archive:
        report = json.loads(archive.read('cutting_report.json'))
        assert len(archive.namelist()) == report['total_panels'] * 2 + 3
        for panel in report['panels']:
            mesh = trimesh.load(BytesIO(archive.read(f"panel_{panel['id']}.stl")), file_type='stl', process=True)
            assert mesh.is_watertight and mesh.is_winding_consistent
            assert len(mesh.split()) == 1
            assert abs(mesh.volume / panel['panel_volume_mm3'] - 1) < 1e-5
            projection = mesh.vertices @ np.asarray(panel['normal'])
            assert abs(np.ptp(projection) - report['parameters']['plywood_thickness']) < 1e-4
            svg = archive.read(f"panel_{panel['id']}_template.svg").decode('utf-8')
            assert 'h100"' in svg and 'mm"' in svg
        scene = trimesh.load(BytesIO(archive.read('assembly.glb')), file_type='glb', force='scene')
        joined = scene.to_geometry()
        assert max(joined.extents) < 5, 'GLB should be metres, not millimetres'
        assert any('mount_plane' in name for name in scene.graph.nodes_geometry)
        assert len(scene.geometry) == report['total_panels'] + report['reference_surface_count']
        print(f"PASS {path.name}: {report['total_panels']} connected panels, exact normal thickness, SVG scale, GLB metres")
