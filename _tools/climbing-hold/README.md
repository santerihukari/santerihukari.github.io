# Parametric crimp climbing hold

Page: `/parametric-models/crimp-hold/`. New-library only; no original model or photo gallery has been replaced. Original design and model copyright: Santeri Hukari.

## Shape and browser runtime

`src/climbing_hold/model.mjs` defines a shelf cut through an elliptical dome. A tangent circular arc joins the incut shelf to the front. Elliptical width caps round the side transitions. The wall face lies exactly on Y=0; the body extends along -Y. Width, grip depth, incut and lip radius are basic controls. Body dimensions, texture and hardware are grouped separately.

Closed cross-sections are tessellated in the browser's worker. The existing physical-texture modifier refines them at the configured print layers. Its analytical-height and contact-boundary callbacks include the rounded lip and curved width caps. This is real geometry, not a visual map. The default is independent jagged layer profiles, 0.80 mm maximum nominal relief at 0.20 mm layer spacing. Put the flat back on the bed and match first/subsequent slicer layers. Toolpaths, extrusion and printed feel have not been tested.

Manifold 3.4.1 subtracts hardware bores and seats **after** texturing. There are no textures on the flat back, bolt bore, countersink or screw seats. Each fastener has a conical seat above a solid web connected to the full body, plus a cylindrical access recess to the front. There are no separate loose bosses or printed fasteners.

The common new-library shell supplies numeric inputs and sliders, touch-scroll handling, manual Update, shareable parameter URLs, stable camera position, hover/selection, coordinate indicator, light/dark themes and responsive fullscreen. STL is in millimetres; GLB uses the shared metre conversion. Files are generated on the device. No new runtime dependency or remote API is required.

## Hardware assumptions

- M10 is common for metric climbing holds. Moon explicitly specifies M10 countersunk bolts and 5 mm anti-rotation screws for its wood holds: https://moonclimbing.com/moonboard/holds-and-bolts/wood-holds-set-c.html
- **Actual specified bolt:** IKH PUK10040109A, "KUUSIOKOLORUUVI M10X40 10.9 10KPL UPPO DIN7991". Supplier lists DIN 7991 / ISO 10642, fully threaded M10 x 1.5, 40 mm overall length, 6 mm hex, maximum head diameter **22.4 mm** and maximum head height **6.2 mm**: https://www.ikh.fi/fi/kuusiokoloruuvi-m10x40-10-9-10kpl-uppo-din7991-puk10040109a
- The first prototype's 20.4 mm access hole was too small for this product, even though smaller 20 mm DIN heads exist. Default access/countersink mouth is now **22.8 mm**: maximum specified head plus **0.4 mm diametral trial print allowance**. The latter is a design allowance, not a bolt tolerance or a proven printed fit. Old prototype links with 20.4 mm are migrated; current custom values remain intact.
- Main through-hole stays **11 mm**, the ISO 273 normal/medium M10 clearance: https://www.bossard.com/nl-en/-/media/bossard-group/website/documents/technical-resources/en/f-040-en.pdf
- The countersink is **90 degrees**. At default dimensions, `(22.8 - 11) / 2 = 5.9 mm` is the *truncated seat* depth, above the 10 mm web. This is not the bolt's 6.2 mm full head height: the wider 11 mm bore removes the lower part of the ideal cone. The access recess starts **15.9 mm from the wall face**.
- In a nominal, ideal 90-degree fit with the maximum 22.4 mm reference head, the head top sits **15.7 mm from the wall**, 0.2 mm below the access mouth, and the 40 mm bolt projects **24.3 mm behind the hold**. Countersunk overall length includes the head. This is a geometric envelope calculation, not measured thread engagement. Unknown wall thickness, T-nut barrel/flange position, actual head tolerances and print bias can change the fit. Do not treat projection as the number of engaged threads.
- The main bolt centre moves slightly upward to leave more material between its enlarged access well and the lower screw well. The wall face and textured grip are otherwise unchanged.
- **Smaller screws remain provisional:** the user specified ordinary Torx wood screws, probably T25. Drive size does not establish diameter, head dimensions, length or head angle. ESSVE provides a concrete 5 mm / TX25 countersunk example with a 10 mm head: https://essve.com/en/products/construction-and-wood-screws/wood-screws/countersunk/wood-screw-c4-countersunk-head-c4-surface-treatment/wood-screw-cs-5-0x50-c4
- Current smaller-seat trial: **5.5 mm clearance through the hold**, **10.4 mm access/head opening**, assumed **90-degree** head, **2.45 mm truncated countersink depth**, **5.5 mm web**. The 10.4 mm opening is a head-access recess, not a 10.4 mm through-hole. The wall's screw pilot hole is separate and is not specified by this model. Two side holes plus optional lower third hole. Actual screw head dimensions, underside ribs and angle must be checked; no screw length is assumed from "T25".
- No installation torque or strength is prescribed. Geometry checks and nominal reference-fastener collision checks do not establish printed strength, allowable bolt tension, pull-through resistance or installation safety.

## Validation boundary

This is an unvalidated printed climbing-hold prototype. It has **no load rating**, EN 12572 certification, pull-through, dynamic-load, fatigue, creep, skin-comfort or printed-fit results. A closed digital mesh is not evidence of climbing safety. Material choice, printing, mounting and testing require independent assessment before climbing use. Sharp relief may abrade skin.

Run `node --test _tools/climbing-hold/model.test.mjs`, then `node _tools/climbing-hold/browser.cjs` against a rebuilt Jekyll server, and `python _tools/climbing-hold/inspect_crimp.py` for independent Trimesh seat/mesh checks. Generated checks and downloads remain under ignored `output/climbing-hold/`; they are not shipped with the website.
