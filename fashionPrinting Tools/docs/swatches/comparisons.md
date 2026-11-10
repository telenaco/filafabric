# Comparison and calibration records

**No physical results are recorded here yet.** Geometry and browser previews are not print evidence.

Use **More → Comparison & calibration swatches**. It downloads a ZIP with separate G-code files at the exact requested dimensions, a manifest and a blank evidence record per piece. Print files separately; they are not automatically resized or combined onto an unsuitable bed.

| Comparison | Contents | Measure after printing |
|---|---|---|
| Rings | Flat / layered / raised | X/Y extension, drape, recovery |
| Grid | Fused / lifted / sliding | Bias shear, drape, crossing mobility |
| Bonding | Five-strand touching / gapped bundles | Low-strain stiffness |
| Layers | 6 × 0.1 / 4 × 0.15 / 2 × 0.3 mm | Same nominal thickness; extension to break |
| Waves | Wave net / bridged wave net | Drape and stretch |

## Calibration

The studio provides starting sweeps for lift/fan, channel height, climbing level/ramp, bridge roundness, thickness flow and colour exposure. These are experimental recipes, **not validated defaults**.

Measure cooled beads on the bed and over an existing net separately. In **Printer setup → Advanced → Measured thickness maps**, enter increasing `flow, width in mm` pairs. No table is populated automatically. Export the filament profile to retain measurements, or save a settings file for local overrides. Record material batch, temperature, speed and layer height. Widths outside the measured range are clamped, not extrapolated.

Copy completed records into `docs/swatches/`, attach front/back and flat/draped photos, and complete `TEMPLATE.md`. Only Luis-approved good physical evidence can promote **Tested** or remove **Needs repair**.

## Results

Pending physical prints. No stiffness, drape, recovery or sliding claim has been confirmed.
