# Cabinet air damper V1 - fixed seal-free PLA experiment

Original CAD and copyright: Santeri Hukari.
This is a fixed revision, not browser-parametric CAD or verified damping hardware.
Materials: PLA, piano-wire spring and double-sided tape only. No O-rings or metal screws.

## Geometry

All units mm. +X points from the door into the cabinet; Z=0 is the entire
flat adhesive underside. Cylinder axis Y=0, Z=16.

| Item | Default |
|---|---|
| Base | 80 x 44 x 3, R3 corners |
| Shell | OD28, bore20, X0..50 |
| Piston | OD19.92, length22, X0..22 at extension |
| Nominal radial sliding clearance | 0.04 per side |
| Diameter fitting alternatives | 19.90 / 19.92 / 19.94 |
| Rod and guide | 6 / 6.3 |
| Button | OD12, X-29..-26, front R1 |
| Working / maximum travel | 17 / 20 |
| Working contact tip X | -12 |
| Spring seat gaps, travel0 /17 /20 | 28 /11 /8 |
| Spring reference | OD8, wire0.32, 6 turns, free32 |
| Conservative solid-length allowance | 6; measure the real spring |
| Reset inlet / PLA reed | OD1.5 / thickness0.24 |
| Rear tape ring cut size | ID20.6 / OD25.9 |
| Rear tape recess depth | 0.2; tape compression unverified |

The original 37 mm chamber was lengthened to50 to accommodate the longer
seal-free piston while preserving its original rod, stop positions and
spring-seat spacing. A shallow cylindrical relief behind the housing lets
the rear cap sit against its end without intersecting the base; at least
1.8 mm of base remains there, with its underside completely uninterrupted.

CAD bore compensation and piston compensation are separate from the
finished dimensions. The intended radial gap0.03..0.05 is unusually tight
for raw FDM parts. Nominal STL size does not guarantee this gap, circularity,
low friction, or useful damping. Plan on measuring and gently finishing
the printed bore/piston. Do not force an interference fit.

## What To Print

Separate, print-oriented STLs and matching STEP files are in `generated/`.
`print_manifest.json` records quantities, validated bounds and volumes.

| File | Quantity |
|---|---:|
| housing.stl | 1 |
| plunger.stl (or ONE diameter alternative) | 1 |
| front_cap.stl | 1 |
| rear_cap.stl | 1 |
| front_cap_pin.stl | 2 |
| rear_cap_pin.stl | 2 |
| cap_clip.stl | 4 |
| reset_reed.stl | 1 |
| reed_pin.stl | 1 |

Front and rear pins presently have the same dimensions but remain separate
files because cap thicknesses are independently editable. All parts are
separate prints; do not print the assembly as one fused object. The GLB
spring and tape, and STEP spring envelope, are reference items only.

`plunger_19p90.stl`, `plunger_19p92.stl`, `plunger_19p94.stl` are alternatives,
not additional assembly parts. `reed_pin_1p55.stl` and `reed_pin_1p75.stl`
are optional push-pin fitting trials; the default is1.65. Loose variants
do not guarantee retention.

The STL orientations are:

- Housing axis vertical, original X0 on the bed; base stands on its front
  edge. Use a brim if needed and keep support material OUT of the bore.
  External ears/gussets may need support according to the slicer.
- Plunger button down. The large piston shoulder needs external support;
  remove it carefully and finish the sliding lands. The rod must remain
  straight. These exports are not a support-free claim.
- Front cap inner mating face down, guide up. Rear cap outer face down,
  spring boss up: printing its mating face down would suspend that face
  over the rear boss. Inspect/finish the rear valve seat and tape recess.
- Pins head down; C-clips and reed flat on the bed. Use0.12 mm layers for
  the0.24 mm reed (two layers), without supports. The reed is small and
  experimental; print spares, avoid excessive first-layer squish.

Around the housing bore, the original brief suggests0.12..0.16 mm layers
and at least5 perimeters. Inspect slicer paths for the reed and clips before
printing. PLA reed fatigue and printed retainer strength are unmeasured.

## Assembly And First Test

1. Fit the rod into the front guide cap before installing that cap. The
   integral button/piston will not pass through the small guide opening.
2. Insert piston from the open rear of the housing, with its rod emerging
   through the front. Slide the front cap onto its face; insert two pins
   from the front and fit their C-clips just behind the front ears.
3. With the rear still open, verify smooth motion over the entire stroke.
   Choose/finish a piston diameter before trying to seal the chamber.
4. Place the flat PLA reed against the inside of the rear cap, circular
   pad covering the reset inlet. Press the printed reed pin into the blind
   pilot atY0/Z23; its head clamps the anchor, not the round sealing pad.
   The reed must lift freely into the chamber and return to its seat.
5. Cut the rear tape annulus using `tape_cut_template.svg`. Keep tape and
   backing away from the bore and inlet. The nominal recess is0.2 deep;
   verify your actual tape compresses enough for the hard cap faces to
   seat and makes an airtight static joint. Adjust recess depth if needed.
6. Fit the wound piano-wire spring around the two centering bosses. Seat
   the rear cap, insert its two printed pins from the rear, and attach
   C-clips just ahead of the rear ears. Test the clips' retention gently.
7. A slow steady push must continue moving; a faster push should show more
   resistance, and the spring should reset the plunger. If it jams, stop
   and inspect the fit. If there is little damping, check cap/reed/wall
   leaks before making the piston larger. A nominal gap is not a result.
8. Only after bench testing, temporarily position against the real door.
   Existing hinges supply closing force; this weak spring only resets.
   Confirm door contact at17 mm travel, with3 mm travel remaining. This
   device must not serve as the door's end stop. Test tape shear/peel and
   door trajectory gently before permanent bonding.

The spring is an editable geometric reference, not a proven spring recipe.
Wire0.32 is a provisional starting dimension rather than the much stiffer
1 mm placeholder. Measure free length, outside/inside diameter and solid
length. Its force must overcome piston friction without preventing the
hinges from closing. Actual spring rate and hinge force are not simulated.

## CAD Verification

`generated/fit_report.json` records41 sampled positions through0..20,
all printed moving/fixed intersections, fixed-part pairs, and exact CAD
checks at0/17/20. The reed pin's0.05 diametral interference is deliberate;
other positive overlap is a failure. A conservative full reed-lift envelope
is checked against the spring envelope. Piston travel stays inside the
bore; spring/boss margins and uninterrupted tape area are checked.

Every printable STL is watertight, positive-volume, and one connected
body. Tessellation uses0.005 mm linear tolerance and0.05 angular tolerance
to avoid a coarse mesh consuming the small fit clearance. These geometric
checks do not measure actual leakage, reed flexure, fatigue, tape strength,
closing time, hinge motion or manufactured tolerances.

`longitudinal_sections.png/.svg` show extension, working closure and the
mechanical limit; `reset_valve_section.png/.svg` cuts through the offset
reset inlet. The gap is real scale, so it is barely visible in the overview.

