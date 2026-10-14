from pathlib import Path
import sys
import json
sys.dont_write_bytecode=True
sys.path.insert(0,'F:/param_cad')
from climbing_crack_brace.model import LIMITS
root=Path(__file__).resolve().parents[2]
path=root/'assets/cad/climbing-volumes/config.json'
config=json.loads(path.read_text())
new={'overall_scale':1,'panel_length_factors':[],'mount_support_enabled':False,'joint_supports_enabled':False,'support_material':'timber','support_width':24,'timber_depth':24,'support_plywood_thickness':18,'mount_panel':0,'mount_plane':1,'mount_offset_u':0,'mount_offset_v':0,'mount_bolt_diameter':10,'joint_span_ratio':.3}
for key,value in new.items():config['defaults'].setdefault(key,value)
config['limits'].update({key:list(value) for key,value in LIMITS.items()})
path.write_text(json.dumps(config,indent=2)+'\n')
