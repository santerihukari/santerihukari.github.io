# Model library integration

The original library remains at `/stl_param/`. The new library comprises:

| Model | Route | Geometry |
| --- | --- | --- |
| Coffee filter holder | `/parametric-models/` | Existing browser worker; unchanged geometry |
| Drone frame | `/parametric-models/drone-frame/` | Current source port, with the preferred published upper retained |
| Door/frame latch | `/parametric-models/door-frame-latch/` | Authoritative browser engine and installed example |
| Climbing volumes | `/parametric-models/climbing-volumes/` | Browser panels, incuts, scaling and inner supports |
| Cabinet air damper | `/parametric-models/cabinet-air-damper/` | Fixed revision; assembly motion, section and matching files |

The text keychain is excluded at the user's request. The air damper is explicitly
fixed, not a mesh-deformation substitute for parametric CAD.

## Boundaries

`F:/param_cad` is an authoritative, read-only source. Importers use explicit
asset allowlists and never regenerate its layout, caches or private CAD. Run
Python with `PYTHONDONTWRITEBYTECODE=1`. Public assets exclude unlicensed reference
models, photo originals, private paths and credentials. Third-party software and
CAD notices remain attached to their assets. Original local geometry is credited
to Santeri Hukari; that does not override third-party licences.

The drone exception is reproducible in `_tools/drone-frame/website-defaults.json`.
Current-source bridge geometry remains available without replacing the preferred
upper by default. All three website print purposes remain. A fit jig is unpowered
only; no model is flight-qualified, strength-certified or physically fit-verified.

## Verification

Each family has tools under `_tools/<family>/` for source fixtures, geometry,
independent STL/GLB inspection and browser interactions. Runtime exports must
correspond to the last valid generated parameters; invalid input must disable
downloads. Display transforms, references, explosion and cutaway must not alter
printable STL geometry.

Build with `bundle exec jekyll build`, serve at `127.0.0.1:4000`, then run focused
browser checks at desktop/mobile sizes in both themes. Repeat asset/worker checks
with a nonempty Jekyll `baseurl`. Verify coloured canvas pixels, interaction,
share-link restoration, download content, private-path exclusion and viewport fit.
Keep screenshots, test meshes, slicer outputs and generated `_site` out of Git.

Before pushing, review the staged diff and run `git diff --check`. A successful
SSH push is distinct from a successful GitHub Pages deployment.
