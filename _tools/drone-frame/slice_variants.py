"""Compare prototype times offline; generate estimates, never send jobs to a printer."""
import json
from pathlib import Path
import re
import shutil
import subprocess
from hashlib import sha256


def main():
    root = Path(__file__).resolve().parents[2]
    output = root / 'output/drone-frame'
    cache = output / 'slicer-cache'
    vendor = cache / 'vendor'
    vendor.mkdir(parents=True, exist_ok=True)
    installed = Path.home() / 'AppData/Roaming/PrusaSlicer/vendor'
    for name in ('Creality.ini', 'Templates.ini'):
        shutil.copyfile(installed / name, vendor / name)
    (cache / 'PrusaSlicer.ini').write_text('[presets]\nfilament = Prusament PLA @CREALITY\nprint = 0.28 mm SUPERDRAFT (0.4 mm nozzle) @CREALITY\nprinter = Creality Ender-3 V2 (0.4 mm nozzle)\n\n[vendor:Creality]\nmodel:ENDER3V2 = 0.4\n', encoding='utf-8')
    slicer = Path('F:/Program Files/Prusa3D/PrusaSlicer/prusa-slicer-console.exe')
    results = {}
    for version in ('full', 'fit_check', 'bench_test'):
        results[version] = {}
        for part in ('lower', 'upper'):
            directory = output / 'print-variants' / version
            gcode = directory / f'{part}-estimate.gcode'
            command = [str(slicer), '--datadir', str(cache), '--printer-profile', 'Creality Ender-3 V2 (0.4 mm nozzle)', '--print-profile', '0.28 mm SUPERDRAFT (0.4 mm nozzle) @CREALITY', '--material-profile', 'Prusament PLA @CREALITY', '--fill-density', '10%', '--brim-width', '5', '--skirts', '0', '--center', '110,110', '--export-gcode', '--output', str(gcode), str(directory / f'{part}.stl')]
            if version == 'fit_check':
                command[1:1] = ['--support-material', '--support-material-auto']
            process = subprocess.run(command, capture_output=True, text=True)
            if process.returncode:
                raise RuntimeError(process.stdout + process.stderr)
            text = gcode.read_text(encoding='utf-8')
            time = re.search(r'^; estimated printing time \(normal mode\) = (.+)$', text, re.M).group(1)
            seconds = sum(int(value) * {'d': 86400, 'h': 3600, 'm': 60, 's': 1}[unit] for value, unit in re.findall(r'(\d+)([dhms])', time))
            grams = float(re.search(r'^; filament used \[g\] = ([\d.]+)$', text, re.M).group(1))
            supports = len(re.findall(r'^;TYPE:Support material(?: interface)?$', text, re.M))
            if version == 'fit_check':
                assert re.search(r'^; support_material = 1$', text, re.M)
                assert re.search(r'^; support_material_auto = 1$', text, re.M)
                assert supports == 0, f'{part}: default layout jig still generates supports'
            results[version][part] = {'estimated_time': time, 'estimated_seconds': seconds, 'filament_grams': grams, 'support_sections': supports, 'auto_support_check': version == 'fit_check', 'stl_sha256': sha256((directory / f'{part}.stl').read_bytes()).hexdigest()}
            print(f'{version} {part}: {time}, {grams:.2f} g, {supports} support sections', flush=True)
    record = {'basis': 'PrusaSlicer 2.9.6, installed Creality Ender-3 V2 0.4 mm / 0.28 mm SUPERDRAFT / Prusament PLA presets, 10% infill, 5 mm brim, no skirt. Parts sliced individually. Fit jig explicitly checked with automatic supports enabled; other versions use preset support settings. Not the user saved project. Estimates are not measured printer time or strength qualification.', 'versions': results}
    (output / 'slicer-estimates.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
