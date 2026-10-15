"""Independent checks of actual browser GLBs, without the JS renderer/generator."""
import json
from pathlib import Path
import struct

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'output/drone-frame'
REGISTRY = json.loads((ROOT / 'assets/cad/drone-frame/references/manifest.json').read_text())['models']


def descendants(nodes, index):
    yield index
    for child in nodes[index].get('children', []):
        yield from descendants(nodes, child)


for profile in ['full', 'fit_check', 'bench_test']:
    suffix = '' if profile == 'full' else '-' + profile.replace('_', '-')
    path = OUTPUT / f'drone_frame_v1{suffix}-assembly-preview.glb'
    data = path.read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    assert struct.unpack_from('<I', data, 8)[0] == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    document = json.loads(data[20:20 + size])
    nodes = document['nodes']
    root = next(node for node in nodes if 'parameters' in node.get('extras', {}))
    assert root['extras']['parameters']['print_profile'] == profile
    if 'matrix' in root:
        conversion = np.array(root['matrix']).reshape((4, 4), order='F')[:3, :3]
    else:
        q = root.get('rotation', [0, 0, 0, 1])
        conversion = trimesh.transformations.quaternion_matrix([q[3], *q[:3]])[:3, :3] @ np.diag(root.get('scale', [1, 1, 1]))
    assert np.allclose(conversion, [[.001, 0, 0], [0, 0, .001], [0, -.001, 0]], atol=1e-10), 'Units or Z-up/Y-up conversion applied incorrectly'
    assert len(document['materials']) >= 8, 'Component finishes lost'
    assert not any('print_bed' in node.get('name', '') or 'cable-guide' in node.get('name', '') for node in nodes)

    sources = root['extras']['sources']
    assert not any(name in json.dumps(sources) for name in ['David Scambell', 'Alexander Kuznetsov', 'YD-ESP32-S3'])
    for id, model in REGISTRY.items():
        credit = next(c for c in sources['components'] if id in c.get('public_models', []))
        assert model['author'] in credit['author'] and credit['licence']
        if model.get('notice'):
            assert credit['notice'] == model['notice']

    scene = trimesh.load(path, force='scene', process=True)
    assert np.isfinite(scene.bounds).all()
    assert .15 < max(scene.extents) < .6 and .02 < scene.extents[1] < .15, 'Scene is not a plausible metre/Y-up frame'
    references = 0
    for index, node in enumerate(nodes):
        metadata = node.get('extras', {})
        if not metadata.get('reference'):
            continue
        model = REGISTRY[metadata['reference']]
        assert metadata['author'] == model['author'] and metadata['licence'] == model['licence']
        assert metadata['source_sha256'] == model['source_sha256'] and metadata['printable'] is False
        if model.get('notice'):
            assert metadata['licence_notice'].endswith('/' + model['notice'])
        transform, _ = scene.graph[node.get('name', str(index))]
        inverse = np.linalg.inv(transform)
        vertices, triangles = [], 0
        for child in descendants(nodes, index):
            if 'mesh' not in nodes[child]:
                continue
            pose, geometry = scene.graph[nodes[child].get('name', str(child))]
            mesh = scene.geometry[geometry]
            vertices.append(trimesh.transform_points(mesh.vertices, inverse @ pose))
            triangles += len(mesh.faces)
        points = np.concatenate(vertices)
        assert triangles == model['triangles'], node.get('name')
        assert np.allclose([points.min(axis=0), points.max(axis=0)], model['bounds_mm'], atol=1e-4), node.get('name')
        references += 1
    assert references >= 10, 'Detailed public references were omitted'
    print(f'PASS {path.name}: metre/Y-up scene, {len(scene.geometry)} meshes, {references} exact reference bounds/counts, public credits and licence metadata')
