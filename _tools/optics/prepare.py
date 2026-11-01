"""Import the approved optics prototype and pin its browser numerical runtime."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output/optics-lab"
DEST = ROOT / "assets/optics"
VERSION = "314.0.7"
ORIGIN = f"https://cdn.jsdelivr.net/pyodide/v{VERSION}/full/"


def digest(data):
    return hashlib.sha256(data).hexdigest()


class BodySpan(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.source = source; self.start = self.end = None
        self.offsets = [0]
        for line in source.splitlines(keepends=True):self.offsets.append(self.offsets[-1]+len(line))

    def source_offset(self):
        line,column = self.getpos(); return self.offsets[line-1]+column

    def handle_starttag(self, tag, attrs):
        if tag == "body":self.start = self.source_offset()+len(self.get_starttag_text())

    def handle_endtag(self, tag):
        if tag == "body":self.end = self.source_offset()


def snapshot():
    if not (SOURCE / "optics.py").is_file():raise SystemExit("Retained local prototype is missing")
    DEST.mkdir(parents=True,exist_ok=True)
    for name in ["app.js","scene-content.js","optical-scene.js","sensor.js","field-of-view.mjs","camera-presets.mjs","exposure.mjs","style.css"]:
        target = DEST / name
        if not target.exists():shutil.copy2(SOURCE / "public" / name,target)
    shutil.copytree(SOURCE / "public/icons",DEST / "icons",dirs_exist_ok=True)
    shutil.copytree(SOURCE / "licenses",DEST / "licenses",dirs_exist_ok=True)
    for source,name in [(SOURCE/"deps/anytree-2.13.0.dist-info/licenses/LICENSE","AnyTree-Apache-2.0.txt"),
                        (SOURCE/"deps/transforms3d-0.4.2.dist-info/LICENSE","Transforms3d-BSD.txt"),
                        (SOURCE/"deps/transforms3d-0.4.2.dist-info/AUTHORS","Transforms3d-AUTHORS.txt")]:
        shutil.copy2(source,DEST/"licenses"/name)
    include = ROOT / "_includes/optics-lab.html"
    if not include.exists():
        source = (SOURCE / "public/index.html").read_text(encoding="utf-8")
        parser = BodySpan(source); parser.feed(source)
        if parser.start is None or parser.end is None:raise SystemExit("Prototype body is missing")
        include.write_text(source[parser.start:parser.end].strip()+"\n",encoding="utf-8")
    sys.path.insert(0,str(SOURCE)); import optics
    optics.calculate({"model":"singlet","rgb":True})
    optics.calculate({"model":"doublet","blades":3,"focus":"infinity"})
    dep_root = (SOURCE / "deps").resolve()
    files = {Path(module.__file__).resolve() for module in tuple(sys.modules.values())
             if getattr(module,"__file__",None) and Path(module.__file__).resolve().is_relative_to(dep_root)}
    # Include only the numerical import closure, never local environments/caches.
    if any(path.suffix != ".py" for path in files):raise SystemExit("Unexpected binary in pure-Python closure")
    entries = {"optics.py":(SOURCE / "optics.py").read_bytes()}
    entries.update({"deps/"+path.relative_to(dep_root).as_posix():path.read_bytes() for path in files})
    entries.update({"licenses/"+path.name:path.read_bytes() for path in (DEST / "licenses").glob("*.txt")})
    with zipfile.ZipFile(DEST / "physics.zip","w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,data in sorted(entries.items()):
            info = zipfile.ZipInfo(name,(2026,11,1,0,0,0)); info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info,data)
    (DEST / "defaults.json").write_text(json.dumps(optics.DEFAULTS,indent=2)+"\n",encoding="utf-8")
    bundle = (DEST / "physics.zip").read_bytes()
    (DEST / "physics-manifest.json").write_text(json.dumps({"source":"approved local optics prototype",
        "bundle":{"sha256":digest(bundle),"bytes":len(bundle)},
        "files":{name:{"bytes":len(data),"sha256":digest(data)} for name,data in sorted(entries.items())}},indent=2)+"\n",encoding="utf-8")
    print(f"Physics: {len(entries)} files, {(DEST / 'physics.zip').stat().st_size:,} bytes")


def runtime():
    target = DEST / "runtime" / VERSION; target.mkdir(parents=True,exist_ok=True)
    prior_path=DEST/"runtime-manifest.json"
    prior=json.loads(prior_path.read_text(encoding="utf-8")) if prior_path.exists() else {}
    def fetch(name, expected=None):
        if Path(name).name != name:raise ValueError("Unsafe package filename")
        path = target / name
        data = path.read_bytes() if path.exists() else urllib.request.urlopen(ORIGIN+name,timeout=120).read()
        if expected and digest(data) != expected:raise ValueError(f"Hash mismatch: {name}")
        if not path.exists():path.write_bytes(data)
        print(f"{name}: {len(data):,} bytes",flush=True)
        return data
    lock = json.loads(urllib.request.urlopen(ORIGIN+"pyodide-lock.json",timeout=60).read())
    selected = {}
    def select(name):
        if name in selected:return
        p = lock["packages"][name]; selected[name] = p
        for dependency in p["depends"]:select(dependency)
    for name in ["numpy","scipy"]:select(name)
    records = {}
    for name in ["pyodide.mjs","pyodide.asm.mjs","pyodide.asm.wasm","python_stdlib.zip"]:
        expected=prior.get("files",{}).get(name,{}).get("sha256") if prior.get("version")==VERSION else None
        data = fetch(name,expected); records[name] = {"bytes":len(data),"sha256":digest(data)}
    for p in selected.values():
        data = fetch(p["file_name"],p["sha256"]); records[p["file_name"]] = {"bytes":len(data),"sha256":digest(data)}
    lock["packages"] = selected
    (target / "pyodide-lock.json").write_text(json.dumps(lock,separators=(",",":"))+"\n",encoding="utf-8")
    license_url = f"https://raw.githubusercontent.com/pyodide/pyodide/{VERSION}/LICENSE"
    data = urllib.request.urlopen(license_url,timeout=60).read();(target / "LICENSE").write_bytes(data)
    python_license=urllib.request.urlopen(f"https://raw.githubusercontent.com/python/cpython/v{lock['info']['python']}/LICENSE",timeout=60).read()
    (DEST/"licenses/CPython.txt").write_bytes(python_license)
    (DEST / "runtime-manifest.json").write_text(json.dumps({"version":VERSION,"origin":ORIGIN,
        "packages":{name:p["version"] for name,p in selected.items()},"files":records},indent=2)+"\n",encoding="utf-8")
    print(f"Runtime payload: {sum(r['bytes'] for r in records.values()):,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser();parser.add_argument("--snapshot",action="store_true");parser.add_argument("--runtime",action="store_true")
    args = parser.parse_args()
    if args.snapshot:snapshot()
    if args.runtime:runtime()
