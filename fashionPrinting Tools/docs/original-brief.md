# Original brief (verbatim) and decisions made during brainstorming

Saved 2026-10-14. The text under "Original brief" is the user's message, preserved as written (including typos).
The design spec in `docs/superpowers/specs/` is the working interpretation of it.

## Original brief

i woudl like to createa  website to do some 3d printitng of fabrics with the following functionalityYes. I’d describe it to the coding agent as a parametric non-planar textile G-code generator, rather than simply a fish-scale pattern. The important part is that you want to experiment with textile behavior: a sparse flexible substrate plus dense, raised, thread-like loops.
You can give the agent something close to this:
Create a Python script that generates direct G-code for experimental non-planar FDM textile printing. Do not use a slicer. The script should calculate every X/Y/Z/E movement directly and output a `.gcode` file.
The initial test area should be a 100 × 100 mm rectangular textile sample, but all dimensions and pattern parameters must be variables at the beginning of the script so they can easily be changed later.
The textile consists of two interconnected structures:
1. Sparse flexible base
Generate a very open continuous serpentine structure across the 100 × 100 mm area. The purpose of this layer is not to create a solid sheet but to act like a sparse textile substrate that provides flexibility and drape while giving the raised loops something to attach to.
Start with approximately 5 mm spacing between neighboring serpentine lines, but expose this as a parameter.
Avoid unnecessary travel and retractions. Ideally the base should be printed as one continuous extrusion path wherever possible.
2. Raised non-planar loop/pile structure
On top of the base, generate a dense repeated pattern of narrow elongated loops resembling a long paperclip, fish scale, or textile pile.
Each basic loop should initially be approximately:

* width: 6 mm
* length/height in XY: 15 mm
* maximum Z lift: 3 mm
* horizontal pitch: 3 mm, meaning neighboring loops overlap by approximately 50%.

The loop should not simply be a planar shape printed at one Z height. It is a continuous 3D extrusion trajectory.
The nozzle begins at approximately the normal first-layer height where the loop connects to the supporting textile. As it travels along the elongated loop, Z should progressively increase, creating a strand that leaves the XY plane. It should reach a configurable maximum height of approximately 3 mm above the base, and then progressively descend again so the other end reconnects with the supporting structure.
In other words, each loop is anchored to the textile but its middle portion is physically suspended above it.
Z should change continuously during XY movement rather than moving vertically, printing horizontally, and moving vertically again. The objective is a smooth 3D curve.
Use a mathematical function for the Z profile — for example a sine or smooth bell-shaped curve — so that Z=base height at the anchors and smoothly reaches `base_height + loop_lift` around the free portion of the loop.
The loops should overlap densely so that the finished surface behaves visually more like pile, frayed fibers, loose threads, wool, or a hairy textile than a conventional rigid fish-scale structure.
The initial version can use perfectly regular geometry, but design the program so that later we can optionally introduce controlled randomness into:

* loop length
* loop width
* maximum Z height
* XY position
* orientation
* spacing

This randomness should be switchable off so deterministic tests can be compared.
Toolpath generation
Represent curved geometry as many short linear `G1` movements. Provide a parameter controlling curve resolution, such as 0.25–0.5 mm between calculated points.
Calculate extrusion (`E`) from the actual 3D distance traveled:
`distance = sqrt(dx² + dy² + dz²)`
rather than using only XY distance.
Extrusion should be calculated from filament diameter, nozzle/extrusion width, nominal deposited strand dimensions, and an adjustable extrusion multiplier.
Because some strands are intentionally unsupported, provide separate configurable speeds for:

* base printing
* supported loop portions
* rising/falling non-planar portions
* unsupported portions
* travel

Keep unsupported extrusion relatively slow initially.
Pattern generation
Fill the 100 × 100 mm test area automatically. Do not hard-code the number of loops. Calculate how many repetitions fit from the sample dimensions and pattern pitch.
Neighboring loops should initially overlap by 50%, so a 6 mm-wide loop uses approximately a 3 mm pitch.
Rows may also be staggered so that alternate rows are offset by half the pattern pitch, producing a more textile-like interlocking distribution rather than a rigid Cartesian grid.
The longer-term intention is to replace the rectangular 100 × 100 mm boundary with an imported SVG silhouette. Therefore, keep boundary generation separate from pattern generation in the program architecture. Eventually, generated loops should be clipped/selected according to whether they fall inside an arbitrary 2D boundary.
Important experimental controls
Put all major values in a clearly labelled parameter section at the beginning of the Python script:
`sample_width = 100`
`sample_height = 100`
`base_spacing = 5`
`loop_width = 6`
`loop_length = 15`
`loop_pitch = 3`
`loop_z_lift = 3`
`layer_height = 0.2`
`nozzle_diameter = 0.4`
`filament_diameter = 1.75`
plus temperatures, print speeds, extrusion multiplier, curve resolution and safe travel Z.
Organize the Python code into separate functions/classes for:

1. machine/printer configuration
2. extrusion calculation
3. serpentine base generation
4. individual 3D-loop generation
5. repetition/tiling of loops
6. boundary checking
7. G-code output

Also produce a 3D preview of the calculated toolpath before generating G-code, preferably using Matplotlib, showing X, Y and Z. Use different line groups for travel moves and extrusion paths if practical.
The script should initially generate a conservative test file rather than trying to optimize printing speed.
Do not assume that ordinary slicer collision checking applies. Include configurable clearance values because the nozzle may need to move close to previously printed raised loops.
One thing I would change from what we were saying verbally: don't tell the programmer that the geometry literally has to be a paperclip. That's a useful visual analogy, but it may constrain the implementation unnecessarily.
I would define the fundamental object as a parametric 3D fiber/loop:
\[ P(t)=(x(t),y(t),z(t)),\quad 0\leq t\leq1 \]
Then the shape in XY and the lift in Z are independent. For example, you could eventually swap a paperclip-shaped XY trajectory for a teardrop, sinusoid, horseshoe, asymmetric fiber, etc., without rewriting the G-code engine.
And there is a particularly interesting second-stage experiment here: don't necessarily print a complete base layer and then print all the pile afterward. We could interweave the base trajectory and raised loops into one continuous extrusion path — essentially getting much closer to weaving with molten filament than conventional layer-by-layer 3D printing. That could be where this becomes substantially different from the usual "3D-printed mesh" approach.

## Decisions made during brainstorming (2026-10-14)

| Topic | Decision |
|---|---|
| Delivery | A browser website with the engine in JavaScript (the brief's Python + Matplotlib is replaced by JS + three.js); not a Python script |
| Stack | Static site, plain ES modules, no build step; three.js vendored; `node --test` for the engine |
| Printer | Prusa MK3S (more machines later: user will share G-code from other machines; profiles are derived from it) |
| Filament | Filaflex Foamy 95 (Recreus 95A foaming TPU), currently printed with PrusaSlicer's "Generic FLEX" profile; user expects it can be improved |
| v1 boundary | Rectangle, 10 × 10 cm (100 × 100 mm) |
| Future boundary | User uploads an SVG; pattern fills it; user can **rotate the SVG** relative to the pattern so the fill fits well |
| Decomposition | 1) generator + website + profiles (this spec) 2) G-code → profile extractor 3) SVG boundary 4) interwoven single path |
| Process | Design approved in sections; spec at `docs/superpowers/specs/2026-10-14-textile-gcode-generator-design.md`; all project files are kept in this folder |
