import { sampleFiber } from './fiber.js';
import { ConfigError } from './params.js';

const EPS = 1e-9;
// Compatibility exports: full toolpaths have no fixed loop/move-count ceiling.
// Finite geometry, the printer's volume and the JavaScript runtime's actual capacity still apply.
export const MAX_LOOPS = Infinity;
export const MAX_MOVES = Infinity;
const NO_JITTER = Object.freeze({ width: 0, length: 0, lift: 0 });

/** X positions of the two leg lines a loop centred at cx would have. */
function legLines(t, cx) {
  const half = t.loop_width / 2;
  return t.fiber_shape === 'arch' ? [cx, cx] : [cx - half, cx + half];
}

function conflicts(candidate, existing, gap) {
  if (gap <= 0) return false;
  for (const c of candidate) for (const e of existing) if (Math.abs(c - e) < gap - EPS) return true;
  return false;
}

function fiberParams(t, jitter, liftScale = 1) {
  const width = Math.max(0.5, t.loop_width + jitter.width);
  const length = Math.max(t.loop_length + jitter.length, width / 2 + 0.5);
  return {
    shape: t.fiber_shape,
    width,
    length,
    lift: Math.max(0, t.loop_z_lift * liftScale + jitter.lift),
    dwell: Math.min(t.anchor_dwell, 0.4 * length),
    profile: t.z_profile,
    resolution: t.curve_resolution,
  };
}

/**
 * Places fibers on the boundary. Rows have their feet on base lines; alternate rows are staggered;
 * loops that would put a leg closer than `leg_gap` to another leg are nudged sideways.
 * Rows are returned far-to-near ("shingle order") so the nozzle never dives under a raised strand.
 *
 * `liftAt(x, y)` (mm, the middle of the loop) gives a 0..1+ factor on the pile height, so a pattern field can raise
 * some loops and lower others.
 */
export function tile(cfg, boundary, rng, { rows: rowYs = null, liftAt = null } = {}) {
  const { t, derived } = cfg;
  const bbox = boundary.bbox();
  const half = t.loop_width / 2;
  // rows sit on the base lines: by default every row pitch from the bottom edge; an outline passes its own lines
  const rowCount = rowYs ? rowYs.length : Math.floor((bbox.maxY - bbox.minY) / derived.rowPitch + EPS) + 1;
  const perRow = Math.max(0, Math.floor((bbox.maxX - bbox.minX - t.loop_width) / t.loop_pitch + EPS) + 1);
  if (perRow * rowCount > MAX_LOOPS) {
    throw new ConfigError([
      `Too many loops (about ${perRow * rowCount}); the limit is ${MAX_LOOPS}. Increase loop_pitch or base_spacing, or use a smaller sample.`,
    ]);
  }

  const halfWidth = t.loop_width / 2;
  const fiberLength = t.fiber_shape === 'arch' ? t.loop_length : 2 * (t.loop_length - halfWidth) + Math.PI * halfWidth;
  const estimatedMoves = Math.ceil((perRow * rowCount * fiberLength) / t.curve_resolution);
  if (estimatedMoves > MAX_MOVES) {
    throw new ConfigError([
      `This layout would need about ${estimatedMoves} moves; the limit is ${MAX_MOVES}. Use a coarser curve_resolution, fewer loops or a smaller sample.`,
    ]);
  }

  const template = t.random_enabled || liftAt ? null : sampleFiber(fiberParams(t, NO_JITTER));
  const rows = [];
  const counts = { candidates: 0, kept: 0, dropped: 0, unresolvedLegs: 0 };

  for (let k = 0; k < rowCount; k++) {
    const footY = rowYs ? rowYs[k] : bbox.minY + k * derived.rowPitch;
    const stagger = k % 2 === 1 ? t.row_stagger * t.loop_pitch : 0;
    const legs = [];
    const row = [];
    for (let i = 0; ; i++) {
      const nominalX = bbox.minX + half + stagger + i * t.loop_pitch;
      if (nominalX + half > bbox.maxX + EPS) break;
      counts.candidates++;

      let shift = 0;
      let resolved = false;
      for (let n = 0; n <= 3; n++) {
        if (!conflicts(legLines(t, nominalX + n * t.leg_gap), legs, t.leg_gap)) {
          shift = n * t.leg_gap;
          resolved = true;
          break;
        }
      }
      if (!resolved) counts.unresolvedLegs++;

      let jitter = NO_JITTER;
      let dx = 0, dy = 0, rot = 0;
      if (t.random_enabled) {
        jitter = {
          length: rng.symmetric(t.amp_length),
          width: rng.symmetric(t.amp_width),
          lift: rng.symmetric(t.amp_lift),
        };
        dx = rng.symmetric(t.amp_xy);
        dy = rng.symmetric(t.amp_xy);
        rot = rng.symmetric(t.amp_orientation);
        dx += rng.symmetric(t.amp_spacing);
      }

      const liftScale = liftAt ? liftAt(nominalX + shift, footY + t.loop_length / 2) : 1;
      const fp = fiberParams(t, jitter, liftScale);
      const fiber = template ?? sampleFiber(fp);
      const cx = nominalX + shift + dx;
      const cy = footY + dy;
      const th = (rot * Math.PI) / 180;
      const c = Math.cos(th), s = Math.sin(th);
      const points = fiber.points.map((p) => ({
        x: cx + c * p.x - s * p.y,
        y: cy + s * p.x + c * p.y,
        z: p.z,
        s: p.s,
        part: p.part,
      }));

      // Variation may move the body, but both feet must remain on their printed anchoring row.
      if (t.include_base && points.length) { points[0].y = footY; points.at(-1).y = footY; }
      if (!boundary.containsPolyline(points, t.boundary_policy)) {
        counts.dropped++;
        continue;
      }
      legs.push(points[0].x, points[points.length - 1].x);
      row.push({ id: `r${k}c${i}`, row: k, col: i, footY, points, arcLength: fiber.arcLength, lift: fp.lift });
      counts.kept++;
    }
    rows.push(row);
  }

  const warnings = [];
  if (counts.unresolvedLegs > 0) {
    warnings.push(`${counts.unresolvedLegs} loop(s) could not keep the ${t.leg_gap} mm leg gap; increase loop_pitch or reduce leg_gap`);
  }
  if (counts.kept === 0) warnings.push('No loops fit inside the boundary; only the base will print');
  const placements = rows.reverse().flat();
  if (t.random_enabled) {
    // The nudge was chosen from nominal positions; jitter can undo it, so check the final geometry.
    const broken = countLegGapViolations(placements, t.leg_gap);
    if (broken > 0) {
      warnings.push(`Random placement left ${broken} loop pair(s) closer than the ${t.leg_gap} mm leg gap; reduce the XY, width or orientation variation`);
    }
  }
  return { placements, warnings, counts };
}

/** Counts pairs of loops in the same row whose leg lines are closer than `gap`. */
export function countLegGapViolations(placements, gap) {
  const byRow = new Map();
  for (const p of placements) {
    if (!byRow.has(p.row)) byRow.set(p.row, []);
    byRow.get(p.row).push([p.points[0].x, p.points[p.points.length - 1].x]);
  }
  let violations = 0;
  for (const list of byRow.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (conflicts(list[i], list[j], gap)) violations++;
      }
    }
  }
  return violations;
}
