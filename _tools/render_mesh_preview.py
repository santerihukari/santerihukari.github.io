"""Render a neutral project thumbnail from an STL or PLY mesh."""

from __future__ import annotations

import argparse
from pathlib import Path

import vtk
import yaml


def build_reader(source: Path):
    suffix = source.suffix.lower()
    if suffix == ".stl":
        reader = vtk.vtkSTLReader()
    elif suffix == ".ply":
        reader = vtk.vtkPLYReader()
    else:
        raise ValueError(f"Unsupported mesh format: {suffix}")
    reader.SetFileName(str(source))
    return reader


def render(source: Path, output: Path, azimuth: float, elevation: float, dolly: float = 1.22) -> None:
    reader = build_reader(source)
    reader.Update()
    if reader.GetOutput().GetNumberOfPoints() == 0:
        raise ValueError(f"Mesh is empty: {source}")

    mapper = vtk.vtkPolyDataMapper()
    mapper.SetInputConnection(reader.GetOutputPort())
    if reader.GetOutput().GetPointData().GetScalars() is not None:
        mapper.SetColorModeToDirectScalars()
        mapper.ScalarVisibilityOn()
    else:
        mapper.ScalarVisibilityOff()

    actor = vtk.vtkActor()
    actor.SetMapper(mapper)
    actor.GetProperty().SetColor(0.33, 0.38, 0.43)
    actor.GetProperty().SetInterpolationToPhong()

    renderer = vtk.vtkRenderer()
    renderer.SetBackground(0.93, 0.94, 0.95)
    renderer.AddActor(actor)
    renderer.ResetCamera()

    camera = renderer.GetActiveCamera()
    camera.Azimuth(azimuth)
    camera.Elevation(elevation)
    camera.Roll(0)
    camera.Dolly(dolly)
    renderer.ResetCameraClippingRange()

    window = vtk.vtkRenderWindow()
    window.SetOffScreenRendering(1)
    window.SetMultiSamples(8)
    window.SetSize(960, 720)
    window.AddRenderer(renderer)
    window.Render()

    capture = vtk.vtkWindowToImageFilter()
    capture.SetInput(window)
    capture.SetInputBufferTypeToRGB()
    capture.ReadFrontBufferOff()
    capture.Update()

    output.parent.mkdir(parents=True, exist_ok=True)
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(str(output))
    writer.SetInputConnection(capture.GetOutputPort())
    writer.Write()
    window.Finalize()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, nargs="?")
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--library", type=Path)
    parser.add_argument("--development-root", type=Path)
    parser.add_argument("--azimuth", type=float, default=35)
    parser.add_argument("--elevation", type=float, default=24)
    args = parser.parse_args()
    if args.library:
        library = args.library.resolve()
        site_root = library.parent.parent
        data = yaml.safe_load(library.read_text(encoding="utf-8"))
        jobs = []
        for model in data["models"]:
            for variant in model.get("variants", []):
                if variant.get("preview"):
                    jobs.append((site_root / "assets" / "stl" / variant["file"], variant["preview"]))
            withheld = model.get("withheld", {})
            if withheld.get("preview"):
                if not args.development_root:
                    parser.error("--development-root is required for withheld previews")
                jobs.append((args.development_root / withheld["preview_file"], withheld["preview"]))
        for source, preview in jobs:
            if not source.is_file():
                parser.error(f"Mesh not found: {source}")
            output = (site_root / preview.lstrip("/")).resolve()
            if not output.is_relative_to(site_root):
                parser.error(f"Preview path is outside the site: {preview}")
            render(source.resolve(), output, args.azimuth, args.elevation, dolly=0.95)
            print(f"Rendered {source.name} -> {output.name}", flush=True)
    elif args.source and args.output:
        render(args.source.resolve(), args.output.resolve(), args.azimuth, args.elevation)
    else:
        parser.error("Provide source and output, or --library")


if __name__ == "__main__":
    main()
