import { clipPolyline, chainPolylines } from './layers.js';
import { orderLines } from './flowlines.js';
import { minCrossingAmplitude } from './squiggle.js';

/**
 * Spirograph: rings of trochoid loops, the curve a spirograph draws when the pen is held outside its little wheel,
 * laid in rings round the centre so they fill the swatch out to its corners. Each ring is a closed curve
 *   p(t) = c + ρ·e^{it} + A·e^{-i(n-1)t},
 * which swings in and out n times a turn and, when (n - 1)·A > ρ, curls into a loop at every swing. The rings of
 * one layer never touch (their swing stays below half the ring spacing); the second layer's rings lie half a spacing
 * further out, so each one swings into the rings on both sides of it, as in the parallel squiggle mesh, and is
 * turned half a loop so its loops sit between those of its neighbours.
 */

const TAU = Math.PI * 2;

/** One closed ring: mean radius rho, n swings a turn, swing A, turned by `phase` radians. */
export function trochoidRing(c, rho, n, A, phase = 0) {
  const speed = rho + (n - 1) * A; // the fastest the pen moves, mm per radian
  const steps = Math.max(64, Math.ceil((TAU * speed) / 0.4));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (TAU * i) / steps;
    const big = t + phase, small = -(n - 1) * t + n * phase;
    pts.push({ x: c.x + rho * Math.cos(big) + A * Math.cos(small), y: c.y + rho * Math.sin(big) + A * Math.sin(small) });
  }
  return pts;
}

/**
 * @param spacing  mm between neighbouring rings of one layer
 * @param loop     how far each swing curls: below 1 a wave, above 1 a loop that crosses itself
 * @param hub      radius of the open centre, mm
 */
export function spirographLayers(boundary, { spacing = 4, loop = 1.5, hub = 3, strandWidth = 0.45 } = {}) {
  const box = boundary.bbox();
  const c = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const R = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + spacing;
  // the swing: enough to reach into the rings on both sides (a quarter spacing and half a strand), not so much that
  // two rings of one layer touch (half a spacing less a strand)
  const swing = Math.max(minCrossingAmplitude(spacing, strandWidth), Math.min(0.42 * spacing, spacing / 2 - strandWidth));
  // each swing's length along the ring is set by how far it curls: (n - 1)·A ≈ loop·ρ
  const lobe = (TAU * swing) / loop;
  const first = Math.max(hub, (5 * lobe) / TAU, swing + 1);
  const ring = (rho, turned) => {
    const n = Math.max(5, Math.round((loop * rho) / swing) + 1);
    return { rho, n, pts: trochoidRing(c, rho, n, swing, turned ? Math.PI / n : 0) };
  };
  const rings = [[], []];
  for (let rho = first; rho - swing < R; rho += spacing) {
    rings[0].push(ring(rho, false));
    rings[1].push(ring(rho + spacing / 2, true));
  }
  const layers = rings.map((list) => chainPolylines(orderLines(list.flatMap((r) => clipPolyline(r.pts, boundary))), boundary, 1.5 * spacing));
  return { layers, extra: { rings: rings[0].length, swing, loops: rings[0].reduce((a, r) => a + r.n, 0) } };
}
