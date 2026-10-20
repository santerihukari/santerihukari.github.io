"""Independently check public ZIP contents against the loose published files."""

import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile


directory = Path(sys.argv[1])
private = re.compile(r'(?:["\s][a-z]:[/\\]|127\.0\.0\.1|localhost|/reference/bosch-ve)', re.I)
with zipfile.ZipFile(directory / "engine_parts.zip") as archive:
    names = archive.namelist()
    assert len(names) == len(set(names)), "Duplicate ZIP entries"
    for entry in archive.infolist():
        assert re.fullmatch(r"(?:parts/[a-z0-9_-]+\.stl|[a-z_]+\.(?:json|csv|svg|md))", entry.filename)
        data = archive.read(entry)
        assert hashlib.sha256(data).digest() == hashlib.sha256((directory / entry.filename).read_bytes()).digest(), entry.filename
        if not entry.filename.endswith(".stl"):
            assert not private.search(data.decode("utf-8")), entry.filename
    for required in ["service_catalogue.json", "capture_plan.json", "parts_service.csv", "motonet_replacements.csv", "motonet_research.json", "motonet_research.md"]:
        assert required in names, required
references = json.loads((directory / "component_references.json").read_text(encoding="utf-8"))
assert references["external_meshes_imported"] is False
for asset in references["assets"]:
    assert "user_supplied_archive" not in asset and "local_reference_preview" not in asset
print(f"PASS {directory.name}: {len(names)} public ZIP entries match loose files; no private paths or restricted reference assets")
