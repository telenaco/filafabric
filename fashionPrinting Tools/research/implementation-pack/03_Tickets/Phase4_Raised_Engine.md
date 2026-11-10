# Phase 4: Raised engine capabilities

**Goal:** six new shared engine capabilities that the Raised cards (Phase 5) are built from, and the reporting that makes them visible. Each lives in its own pure module with its own tests (Contract C9). **None of them changes an existing card's output:** they are only switched on by the Phase 5 cards.

**Depends on:**
- T0.2 (strand tags);
- T0.3 (construction report);
- T1.7 (colour plan: the order of operations matters).

| Ticket | Capability | Module | Depends on | Size |
|---|---|---|---|---|
| T4.1 | Print order from nozzle clearance (E14) | `site/src/engine/order.js` | — | M |
| T4.2 | Bond control for parallel strands (E13) | `site/src/engine/layers.js` `hatch` | — | M |
| T4.3 | Lifted crossings (E10, Pattinson) | `site/src/engine/lift.js` | T4.1 | M |
| T4.4 | Bridged crossings (E12, Kim & Lee) | `site/src/engine/crossings.js` | T4.1 | S |
| T4.5 | Sliding channels (E11, Li et al.) | `site/src/engine/channels.js` | T4.1 | L |
| T4.6 | Climbing overlaps (E9) | `site/src/engine/climb.js` | T4.1 | L |
| T4.7 | Raised reporting, move classes and preview | `construction-report.js`, `verdict.js`, `preview.js` | T4.3–T4.6 | M |

**Where they run in the pipeline** (Contract C9; [architecture §4.1](../02_Architecture_and_Contracts.md#41-one-card)):

```
layersToStrands (settle) → [lift | bridge | channels | climb] → clearanceOrder → applyColourPlan → emitStrands
```

**Move classes and profile values.** Points of a strand carry `cls`; `emitStrands` copies it to the move, and `gcode.js` picks speed and fan by class (`speed_<cls>`, `fan_<cls>`; `rising` and `falling` use the `nonplanar` values). The existing classes are `base`, `supported`, `rising`, `falling`, `unsupported` and `travel` (`site/src/engine/params.js`, lines 48–58). **Use these classes; do not invent new ones** without adding profile defaults and a reviewer's OK.

**Note on cooling.** The default textile settings have every fan at 0%. Pattinson's lifted crossings rely on the strand cooling before it lands, so T4.3 exposes a fan override for its segments (see there).

---

## T4.1 Print order from nozzle clearance (`site/src/engine/order.js`)

**Source:** Wu 2020, [Paper 64](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-64-wu-2020--phd-dissertation_computational-tools-for-3d-printing-and-woven-textile-design), chapter 3. Wu draws a collision graph with an arc A→B when printing A after B would hit B; the scheduler keeps an acyclic subset, and unavoidable cycles are broken by splitting segments.

**Rule for a 3-axis bed printer:** a lower path must be printed **before** a nearby raised path that would otherwise block the nozzle body when the lower path is printed. (The research reports had this reversed until 26 October; it is now corrected.)

**Nozzle model (already in the profiles):**
- `cfg.t.nozzle_tip_radius` (default 0.6 mm);
- `cfg.t.nozzle_cone_half_angle` (default 30°);
- `emit.js` already uses them for travel hops (`tipRadius`, `coneSlope`, around line 158).

At height *h* above the tip, the body's radius is `tipRadius + h × tan(coneHalfAngle)`.

**Implementation**

```js
/**
 * Re-orders strands so the nozzle body never meets material printed earlier.
 * @returns {{ strands: Strand[], split: number, conflicts: { a: string, b: string, x: number, y: number }[] }}
 */
export function clearanceOrder(strands, { tipRadius, coneHalfAngle, layerHeight, bead, maxSplits = 50 }) {}
```

1. **Points:** resample every strand every 0.5 mm, keeping `z`.
2. **Grid:** a spatial grid with cells the size of the largest body radius in play: `tipRadius + (zMax − layerHeight) × tan(α)`.
3. **Edges:** for every pair of strands A ≠ B with sample points `a` and `b` where `b.z − a.z > layerHeight × 0.5` and the horizontal distance `d(a, b) < tipRadius + (b.z − a.z) × tan(α) + bead / 2`: A must print before B. Add the arc A→B.
   - Strands that *cross* (one resting on the other) give the arc from the lower to the upper one automatically, through the same test.
4. **Stable order:** use Kahn's algorithm. Among the strands that are ready, always pick the one with the smallest original index, so an already-safe order is left unchanged.
5. **Cycles:**
   - Find strongly connected components (Tarjan).
   - In each, split the longest strand at the sample point nearest to the conflict, so that its lower part can go first and its upper part later.
   - Give the two pieces the same `family`, `role` and `source`, with ids `<id>-a` and `<id>-b`, and repeat.
   - After `maxSplits` splits, stop and report the remaining arcs in `conflicts`.
6. Return the strands in the new order.

**Integration:** call it in `layeredResult` and in the raised results **only when the card asks** (`extra.clearanceOrder: true`), so existing snapshots stay identical. The Phase 5 cards switch it on. A follow-up after Phase 8 decides whether all cards get it.

**Tests** (`dev/tests/order.test.js`)
- A raised strand (z = 1.2 mm) listed before a flat strand passing 0.4 mm beside it: the flat strand moves first.
- The same pair 5 mm apart: the order is unchanged.
- A constructed cycle (two strands each raised where the other is low) is resolved with exactly one split, and the pieces keep their tags.
- An already-safe order is returned unchanged (identity).
- A 100 × 100 mm input with about 400 strands finishes in under 500 ms.

**Review focus:** the direction of the rule; stability (no needless re-ordering); tags on split pieces.

---

## T4.2 Bond control for parallel strands (`hatch` in `site/src/engine/layers.js`)

**Source:** Pattinson et al. 2019, [Paper 66](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices), p. 7, Fig. 2G–H. Five parallel wavy elements printed touching weld into one thicker element; with a small lateral gap they stay apart:
- all gapped: 20 N/m up to 10% strain, maximum 207 N/m at 40%;
- three central bonded: 53 → 150 N/m;
- all bonded: about 110 N/m.

**What to build:** strands grouped in **bundles**. Inside a bundle, neighbours either touch (and fuse) or keep a small gap; bundles are separated by the usual spacing. A mask can choose per bundle.

**Implementation:** extend `hatch(boundary, opts)` with:

```js
bundle = 1,          // strands per bundle (1 = today's behaviour; nothing changes)
bundleTouch = true,  // true: neighbours inside a bundle at 0.9 × bead (they fuse); false: bead + bundleGap apart
bundleGap = 0.3,     // mm, used when not touching
bundleMask = null,   // (x, y) => boolean, sampled at each bundle's centre line midpoint: true = touch
bead = 0.45,
```

- The line positions inside a bundle are computed around the bundle centre; the bundle centres keep today's `spacing`.
- With `bundle === 1`, the output must be **identical** to today's. Assert this in a test against several existing cards' snapshots.
- Tag each strand with `bundle` (an index) and `bonded` (boolean), so the construction report can count bonded bundles.
- The Pattern effect `bonding` (Contract C6) supplies `bundleMask` from the picture: dark means touch.

**Cards that use it:**
- **Grid & isogrid** (`crosshatch`) gets *Strands per bundle* (1–5) and *Neighbouring strands: touching / gap* in Look and feel, hidden while the bundle is 1.
- **Rotated stack** (T2.1) gets the same.
- **Wave net** (Squiggle generator) is a later follow-up: its generator does not use `hatch`. List it on the board; don't do it here.

**Tests** (`dev/tests/bond-control.test.js`)
- `bundle = 1` is identical to today.
- With `bundle = 5` and touching, adjacent lines inside a bundle are 0.9 × bead apart (± 0.01); with gap, `bead + bundleGap` apart.
- The mask selects bundles by their centre.
- In the construction report, a touching bundle counts as one component (its strands are within a bead), and a gapped bundle as five unless they cross other families.

---

## T4.3 Lifted crossings (`site/src/engine/lift.js`)

**Source:** Pattinson et al. 2019, [Paper 66](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-66-pattinson-2019--biomechanically-tailored-meshes-for-compliant-wearable-and-implantable-devices), p. 13, Fig. 6a.
- The nozzle is lifted as it passes over an earlier, orthogonal strand, so the new strand cools before it lands; those crossings stay unbonded.
- The unbonded swatch drooped about 230% more as a cantilever and draped over a golf ball; the bonded twin did not.
- **No lift height, speed or temperature is given.** Every number below is a starting proposal, to be calibrated in Phase 8.

**Implementation**

```js
/**
 * Raises later strands where they cross earlier ones, so they land after cooling and do not bond.
 * @param {Strand[]} strands  in print order, after crossing settling
 * @param {{ lift: number, length: number, hold?: number, mask?: (x, y) => boolean, layerHeight: number, bead: number }} opts
 * @returns {Strand[]}  copies; crossing points gain cls and a `lifted` mark the construction report reads
 */
export function liftCrossings(strands, { lift = 1.0, length = 3.0, hold = null, mask = null, layerHeight, bead }) {}
```

1. Find crossings with `findCrossings` (`site/src/engine/crossings.js`). For each crossing between an earlier strand T and a later strand S, where `mask?.(x, y) ?? true`:
   - on S, let `c` be the arc-length position of the crossing;
   - set `hold = hold ?? bead + 0.4` (the span kept up over the crossing).
2. **Rebuild S's z profile:**
   - between `c − hold/2 − length` and `c − hold/2`, rise from its settled z to `z_T + lift` with a half-cosine ramp (class `rising`);
   - hold over `[c − hold/2, c + hold/2]` (class `unsupported`);
   - descend symmetrically (class `falling`);
   - where two lifts overlap along S, merge them into one longer hold.
3. Insert points so that every ramp has at least 6 points, and keep `flow` as it was.
4. Mark the crossing point with `lifted: true`, for the construction report.
5. **Slope check:** `lift / length ≤ 0.5`. Larger requested lifts lengthen `length` automatically and produce a note.
6. **Fan:**
   - The card exposes an Advanced setting *Fan on lifted strands (%)* (default 60). It maps onto `fan_nonplanar` and `fan_unsupported` for this result only, through the existing per-design overrides of the profile values.
   - Find how Advanced overrides reach `resolveConfig` in `site/src/ui/main.js` and `site/src/engine/params.js`; **do not add a new mechanism.**

**Tests** (`dev/tests/lift.test.js`)
- On a 2-family 0/90 grid, each masked crossing's later strand is at `z_T + lift` (± 0.02) over the hold.
- Ramps never exceed the slope limit.
- Unmasked crossings are unchanged.
- The construction report counts `lifted` crossings equal to the masked crossings.
- Move classes `rising`, `unsupported` and `falling` appear in order around each lift.

---

## T4.4 Bridged crossings (`bridgeCrossings` in `site/src/engine/crossings.js`)

**Source:** Kim & Lee 2025, [Paper 31](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-31-kim-lee-2025--continuous-textile-structures-utilizing-3d-printing). They modelled each crossing strand as a filleted up/down zigzag whose crossing height is the line thickness plus half the fillet radius.

**Implementation:** `bridgeCrossings(strands, { filletRadius = 1.0, lineThickness = layerHeight, mask })`.
- Crossing height `h = lineThickness + filletRadius / 2` (the paper's rule).
- The profile over each crossing is a circular fillet up (radius `filletRadius`), a short flat top across the crossing (`bead + 0.2`), and a fillet down.
- Classes as in T4.3.
- It reuses T4.3's crossing search and merging; **share the helper; don't copy it.**

**Tests:** the top height equals `lineThickness + R/2` (± 0.02); the profile is tangent-continuous (no slope jump above 5° between consecutive segments); unmasked crossings are unchanged.

---

## T4.5 Sliding channels (`site/src/engine/channels.js`)

**Sources:**
- Li et al. 2022, [Paper 67](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-67-li-2022--programmable-digital-weaves), the paper's §III-A and Figs. 1–9;
- the authors' MIT-licensed G-code: <https://github.com/liyuesolo/ProgrammableDigitalWeaves/tree/main/Projects/ProgrammableDigitalWeaves/GCode>. `SlidingGrid.gcode`, `FusedGrid.gcode` and `Type1`–`Type4.gcode` are the references; read them, but don't copy them into the repo.

**What Li prints** (from `SlidingGrid.gcode`; PLA, 0.5 mm strands, 4 mm pitch):
1. **Lower family** flat at nozzle Z 0.5.
2. **Upper family:** each strand is one continuous span:
   - 12 mm on the bed at Z 0.2 (an anchor) at 200 mm/min;
   - a 12 mm ramp up to Z 1.5 at 400 mm/min;
   - the whole 80 mm field at Z 1.5 and 600 mm/min;
   - then the mirror image.
   - The span is extruded at about 55% of a normal strand's flow.
3. **A channel at every crossing**, printed after everything else:
   - plunge to Z 0.5 on the lower strand, 1.20 mm before the crossing;
   - rise to Z 2.5 directly above the crossing (100 mm/min);
   - descend to Z 0.5, 1.68 mm after it (200 mm/min);
   - about 47% flow.
   - The channel runs **along the lower strand**, so it is fused to it and encloses the upper strand, which can then slide along its own length.
4. **Temperatures and fan:** 180 °C nozzle, 60 °C bed, fan off.
5. **Differences from the paper's text:** 20% longer second leg (the file uses 40%), 300 mm/min channels (the file uses 100/200), a 1.0 mm channel height (consistent with the file if measured from the sliding strand).

**The general case.** In Li's mixed designs (Types 3–4) the captive strand differs from crossing to crossing, so **a strand can be base at one crossing and captive at the next.** Build it like `weave.js` does with its two levels:

```js
/**
 * @param {Strand[]} families  two or more families of flat strands (from a generator), in print order
 * @param {{ mask: (crossing) => 'fused' | 'a' | 'b', spanLift = 1.0, channelLift = 2.0, legBefore = 1.2,
 *           legAfterFactor = 1.4, spanFlow = 0.55, channelFlow = 0.47, anchor = 12, ramp = 12, layerHeight, bead }} opts
 *   mask returns, per crossing, which family is captive ('a' or 'b') or 'fused' for an ordinary bonded crossing
 * @returns {Strand[]}  base pieces, then raised pieces, then channels (role 'channel'), already in a safe print order
 */
export function slidingChannels(families, opts) {}
```

1. **Crossings:** find all crossings between the families, and ask `mask` for each.
2. **Levels per strand:**
   - along each strand, mark the crossings where it is captive (raised) and where it is base (flat);
   - split the strand into pieces at the midpoint between consecutive crossings of different level;
   - pieces at a level change get ramps of length `min(ramp, gap/2)`.
   - A strand that is captive at its first and last crossings gets bed anchors of length `anchor` beyond the field edge, if it fits inside the boundary; otherwise the ramp starts at the boundary inset.
3. **Raised pieces** sit at `z0 + spanLift`, where `z0` is the first-layer height, with `flow = spanFlow`.
4. **Fused crossings:** the raised strand dips locally to `z0 + layerHeight` over `±legBefore` and bonds. Check the dip shape against Li's `Type4.gcode`, and describe what you found in the PR.
5. **Channels:** for each captive crossing:
   - a path along the **base** strand: from `legBefore` before the crossing at `z0`, up to `z0 + channelLift` directly over the crossing point, down to `z0` at `legBefore × legAfterFactor` after;
   - `role: 'channel'`, `flow = channelFlow`, classes `rising` / `falling`.
6. **Print order:** all base pieces, then all raised pieces, then all channels. Run `clearanceOrder` (T4.1) on the result.
7. **Speeds:** expose *Channel speed (mm/s)*, default 3.3 (= 200 mm/min), as an Advanced override applied to `speed_nonplanar` for this result.

**Defaults:** use Li's values, with `z0` from the profile. **Mark every number in the card as Li's PLA value** until Phase 8 calibrates TPU.

**Tests** (`dev/tests/channels.test.js`). Encode Li's numbers as expectations; **don't read the external files in tests.** On a 20 × 20 strand grid at 4 mm pitch with all crossings captive in family B:
- base strands are at z0;
- raised spans are at `z0 + 1.0`;
- there are 400 channels;
- each channel's apex is at `z0 + 2.0`;
- the legs are 1.20 and 1.68 mm (± 0.02);
- channel flow is 0.47 and span flow 0.55;
- **a mixed mask** (checkerboard captive A/B) produces pieces with ramps, and every strand's pieces keep its tags;
- **fused crossings** produce no channel, and the report counts them `fused`;
- every channel has `role: 'channel'`, and the report's `byStack` counts them.

**Review focus:** the level logic is shared with, or modelled on, `weave.js`, not a second invented scheme; print order is safe.

---

## T4.6 Climbing overlaps (`site/src/engine/climb.js`)

**Source:** Luis's Rings · raised (26 October): *"each ring climbs over the one before it, so the fabric builds up three or four layers and joins by height instead of being flattened."* There is no paper for this exact build. The papers bear on it:
- Laput, [Paper 36](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-36-laput-2015--3d-printed-hair-soft-strands-fibers-and-bristles): bridged strands come out stiffer than expected;
- Kim & Lee, [Paper 31](../../reports/FilaFabric_Research_Reference_and_Design_Notes.md#paper-31-kim-lee-2025--continuous-textile-structures-utilizing-3d-printing): crossing height.

**What to build:** paths in print order are laid onto the material already printed. Where a path overlaps earlier material, it rides on top of it, one level up, with smooth ramps, up to a maximum number of levels.

```js
/**
 * @param {{x,y}[][]} paths   in print order (e.g. rings, row by row)
 * @param {{ bead, layerHeight, levelHeight = layerHeight, maxLevels = 4, rampLength = 1.5, cell = 0.2 }} opts
 * @returns {{ strands: Strand[], clipped: number }}  clipped = points held at the maximum level (a note when > 0)
 */
export function climbOverlaps(paths, opts) {}
```

1. **Height field:** a grid over the bounding box with cells of `cell` mm. Each cell holds the top height of the material printed so far (0 = bed).
2. **For each path:**
   1. Resample it every `cell` mm.
   2. For each point, `under` = the maximum height in the field within `bead / 2` of the point.
   3. **Target z:** `layerHeight` where `under` is 0 (on the bed); otherwise `under + levelHeight`.
   4. **Cap:** `zMax = maxLevels × levelHeight`. Points above it are held at `zMax`, which means they fuse into the material below, and are counted in `clipped`.
   5. **Slope limit:** a forward pass and a backward pass, so that z changes by at most `levelHeight / rampLength` per millimetre. Points that rise are class `rising`, points that fall `falling`, the rest `supported` (or `base` on the bed).
   6. **Update the field** along the path's footprint (radius `bead / 2`) with `z` (the top of the new bead).
3. Return strands with `family` and `role` from the input (via a `tags` option), and the point classes.

**Build orders** (provided for R-01, chosen by the card):
- `rows`: rings in row order. Each ring climbs onto the previous one in its row and the row before, building a staircase up to `maxLevels`.
- `checker`: phase A rings first (all on the bed), then phase B (each climbing one level onto its A neighbours). At most 2 levels.
- `spiral`: from the centre outwards. Levels grow towards the edge.

**Tests** (`dev/tests/climb.test.js`)
- Two overlapping rings: the second ring's points over the overlap sit at `layerHeight + levelHeight`; elsewhere on the bed.
- Three in a row: levels 1, 2 and 3.
- With `maxLevels = 2`: the third ring is capped and `clipped > 0`.
- The slope never exceeds the limit.
- The field update is correct (a fourth ring away from the others stays on the bed).
- `checker` never exceeds 2 levels.

**Review focus:** the height field's resolution and speed (100 × 100 mm in under 1 s); slope smoothing doesn't drop below the material underneath (assert `z ≥ under + levelHeight − 0.01` wherever `under > 0`, except at ramp ends).

---

## T4.7 Raised reporting, move classes and preview

**Files:** `site/src/engine/construction-report.js`, `site/src/ui/verdict.js`, `site/src/ui/preview.js`, `site/src/ui/sideview.js`

**Implementation**
1. **Construction report:** read `lifted` points (T4.3), `role: 'channel'` (T4.5) and climb levels (T4.6). Add `levels: { max, histogram }` for climbed results.
2. **Verdict copy** (plain language):
   - *Lifted crossings: N of M (unbonded where lifted).*
   - *Sliding channels: N; slides along X: a, along Y: b; fused: f.*
   - *Builds up to L levels (Z up to H mm).*
   - *K points could not climb higher and fuse into the layer below.*
3. **Preview:** colour channel strands by role (accent), lifted spans with the non-planar colour, and climbing levels as a height tint.
4. **Side view:** the default section for raised cards crosses at least one lifted crossing, channel or overlap. Pick a section through the densest such feature.
5. **G-code header comment** for raised cards: the capability and its key numbers (lift, channel and level heights), so a swatch record shows how it was built.

**Tests:** report fields on fixture results from T4.3–T4.6; verdict strings contain the counts.
