"""Prepare public ZIP metadata without altering any CAD or other entry bytes."""

import io
from pathlib import Path
import re
import sys
import zipfile


source, public_references = map(Path, sys.argv[1:])
replacement = public_references.read_bytes()
output = io.BytesIO()
with zipfile.ZipFile(source) as original, zipfile.ZipFile(output, "w") as public:
    names = original.namelist()
    if len(names) != len(set(names)) or names.count("component_references.json") != 1:
        raise ValueError("Unexpected archive inventory")
    for entry in original.infolist():
        if not re.fullmatch(r"(?:parts/[a-z0-9_-]+\.stl|[a-z_]+\.(?:json|csv|svg|md))", entry.filename):
            raise ValueError("Unexpected public ZIP entry: " + entry.filename)
        data = replacement if entry.filename == "component_references.json" else original.read(entry)
        public.writestr(entry, data)
sys.stdout.buffer.write(output.getvalue())
