"""Native-Python parity fixtures; generated reports stay outside the public site."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[2]
REFERENCE=ROOT/"output/optics-lab"
sys.path.insert(0,str(REFERENCE))
from optics import calculate

source=(REFERENCE/"optics.py").read_bytes()
with zipfile.ZipFile(ROOT/"assets/optics/physics.zip") as archive:
    if archive.read("optics.py")!=source:raise SystemExit("Publication model differs from retained numerical reference")
cases=[]
for model in ["ideal","singlet","doublet"]:
    for settings in [{},{"focus":"infinity"},{"shiftX":4,"shiftY":-2,"sensorW":23.5,"sensorH":15.7},
                     {"focal":135,"focus":30,"fnumber":22,"rgb":True}]:
        raw={"model":model,**settings};cases.append({"settings":raw,"result":calculate(raw)})
for settings in [{"blades":3},{"blades":4},{"blades":9,"focus":.45},
                 {"targetA":100,"targetAX":-30,"targetAY":12,"subject":2,"targetC":.3,"targetCY":-8},
                 {"focus":"infinity","sensorOffset":-3}]:
    cases.append({"settings":settings,"result":calculate(settings)})
for shape in ["star","heart","cross","slit"]:
    raw={"apertureShape":shape,"focal":85,"focus":.52};cases.append({"settings":raw,"result":calculate(raw)})
for lock in [False,True]:
    raw={"workMode":"exposure","exposureLock":lock,"shutter":.016,"iso":200};cases.append({"settings":raw,"result":calculate(raw)})
for shutter in [1/8000,30,900,1e308]:
    raw={"workMode":"exposure","shutter":shutter};cases.append({"settings":raw,"result":calculate(raw)})
for settings in [{"shutter":1/1000},{"shutter":1/8000,"fnumber":22},{"shutter":900}]:
    raw={"workMode":"exposure","autoIso":True,**settings};cases.append({"settings":raw,"result":calculate(raw)})
destination=ROOT/"output/optics-site";destination.mkdir(parents=True,exist_ok=True)
(destination/"fixtures.json").write_text(json.dumps({"source_sha256":hashlib.sha256(source).hexdigest(),"cases":cases},allow_nan=False,separators=(",",":")),encoding="utf-8")
print(f"Prepared {len(cases)} native-Python reference cases")
