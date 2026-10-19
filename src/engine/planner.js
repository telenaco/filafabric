import { airStrandDiameter } from './extrusion.js';
import { segmentInside } from './fabric.js';

const Z_MARGIN = 0.05;

/** Coarse grid of the highest printed nozzle Z per cell; used for travels and clearance checks. */
export class HeightMap {
  constructor(bbox, cell = 0.5, margin = 10) {
    this.cell = cell;
    this.minX = bbox.minX - margin;
    this.minY = bbox.minY - margin;
    this.nx = Math.ceil((bbox.maxX - bbox.minX + 2 * margin) / cell) + 1;
    this.ny = Math.ceil((bbox.maxY - bbox.minY + 2 * margin) / cell) + 1;
    this.data = new Float64Array(this.nx * this.ny).fill(-Infinity);
    this.maxZ = -Infinity;
  }

  index(x, y) {
    const ix = Math.round((x - this.minX) / this.cell);
    const iy = Math.round((y - this.minY) / this.cell);
    if (ix < 0 || iy < 0 || ix >= this.nx || iy >= this.ny) return -1;
    return iy * this.nx + ix;
  }

  add(x, y, z) {
    const i = this.index(x, y);
    if (i < 0) return;
    if (z > this.data[i]) this.data[i] = z;
    if (z > this.maxZ) this.maxZ = z;
  }

  addSegment(a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / (this.cell / 2)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      this.add(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    }
  }

  maxWithin(x, y, r) {
    let best = -Infinity;
    const c = Math.ceil(r / this.cell);
    const cx = Math.round((x - this.minX) / this.cell);
    const cy = Math.round((y - this.minY) / this.cell);
    const limit = r * r + this.cell * this.cell;
    for (let dy = -c; dy <= c; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= this.ny) continue;
      for (let dx = -c; dx <= c; dx++) {
        const ix = cx + dx;
        if (ix < 0 || ix >= this.nx) continue;
        if ((dx * dx + dy * dy) * this.cell * this.cell > limit) continue;
        const z = this.data[iy * this.nx + ix];
        if (z > best) best = z;
      }
    }
    return best;
  }

  maxAlong(a, b, r) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / this.cell));
    let best = -Infinity;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      best = Math.max(best, this.maxWithin(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, r));
    }
    return best;
  }

  /** True if an already-printed strand is inside the nozzle cone at (x, y, z). */
  collides(x, y, z, model) {
    const { tipRadius, tanA, clearance } = model;
    if (this.maxZ <= z + Z_MARGIN) return false;
    const rMax = tipRadius + (this.maxZ - z) * tanA + clearance;
    const c = Math.ceil(rMax / this.cell);
    const cx = Math.round((x - this.minX) / this.cell);
    const cy = Math.round((y - this.minY) / this.cell);
    for (let dy = -c; dy <= c; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= this.ny) continue;
      for (let dx = -c; dx <= c; dx++) {
        const ix = cx + dx;
        if (ix < 0 || ix >= this.nx) continue;
        const zc = this.data[iy * this.nx + ix];
        if (zc <= z + Z_MARGIN) continue;
        const d = Math.hypot(this.minX + ix * this.cell - x, this.minY + iy * this.cell - y);
        if (d < tipRadius + (zc - z) * tanA + clearance) return true;
      }
    }
    return false;
  }
}

/** How far outside the sample the height map must reach: a loop can lean past the edge by its length. */
export function heightMapMargin(cfg) {
  return Math.max(10, cfg.t.loop_length + 2);
}

export function clearanceModel(cfg) {
  const { t, derived } = cfg;
  // printed strands in the air are wider than the nominal round strand (foam, extra flow): keep that much more room
  const widest = Math.max(airStrandDiameter('rising', cfg), airStrandDiameter('unsupported', cfg));
  const pad = 0.5 * (widest - derived.freeDiameter);
  return {
    tipRadius: t.nozzle_tip_radius,
    tanA: Math.tan((t.nozzle_cone_half_angle * Math.PI) / 180),
    clearance: t.clearance + pad,
  };
}

function classify(strand, a, b, cfg) {
  if (strand.kind === 'base') return 'base';
  const { t, derived } = cfg;
  const zr = (a.z + b.z) / 2 - derived.loopBaseZ;
  if (zr <= t.support_threshold) return 'supported';
  if (zr >= t.unsupported_fraction * strand.lift) return 'unsupported';
  return b.z >= a.z ? 'rising' : 'falling';
}

/**
 * Turns the base and the placed loops into one ordered list of moves (each the target of a G1).
 * Strands print in the given order; travels lift over what is already printed.
 */
/**
 * A same-row bridge is a line printed along the base, at the loops' feet. It must not drag the nozzle beneath what is
 * already printed above that line (the arch of a loop the next one overlaps). The stretch within a nozzle radius of
 * each end, where the two loops' own feet and legs stand, is left out: the nozzle is already there, or arrives there.
 */
function bridgeClear(map, a, b, model, layerHeight) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), skip = model.tipRadius + model.clearance;
  if (d <= 2 * skip) return true;
  const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  const under = map.maxAlong({ x: a.x + ux * skip, y: a.y + uy * skip }, { x: b.x - ux * skip, y: b.y - uy * skip }, model.tipRadius);
  return under <= Math.max(a.z, b.z) + layerHeight;
}

export function plan(cfg, base, placements, boundary, { strands: supplied = null } = {}) {
  const { t, derived } = cfg;
  const map = new HeightMap(boundary.bbox(), 0.5, heightMapMargin(cfg));
  const model = clearanceModel(cfg);
  const moves = [];
  const strands = supplied ?? [];
  // an outline can need several base strands (one per region a single serpentine can cover)
  if (!supplied && base) (base.strands ?? [base.points]).forEach((pts, i) => strands.push({ kind: 'base', id: i === 0 ? 'base' : `base-${i + 1}`, pts, lift: 0 }));
  for (const p of supplied ? [] : placements) {
    strands.push({
      kind: 'loop',
      id: p.id,
      lift: p.lift,
      row: p.row,
      pts: p.points.map((q) => ({ x: q.x, y: q.y, z: derived.loopBaseZ + q.z })),
    });
  }

  let cur = null;
  let prevStrand = null;
  let violations = 0;
  let pendingUnretract = false;
  const travel = (x, y, z) => ({ x, y, z, cls: 'travel', extrude: false });

  for (const strand of strands) {
    if (strand.pts.length < 2) continue;
    const first = strand.pts[0];

    // --- travel to the strand start
    if (cur === null) {
      const safeZ = first.z + Math.max(5, t.clearance);
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    } else {
      const dist = Math.hypot(first.x - cur.x, first.y - cur.y);
      const dz = Math.abs(first.z - cur.z);
      const isSameRowLoop =
        prevStrand?.kind === 'loop' &&
        strand.kind === 'loop' &&
        strand.row !== undefined &&
        prevStrand.row === strand.row &&
        dz < 1e-6;

      if (isSameRowLoop && dist > 1e-6 && segmentInside(cur, first, boundary) && bridgeClear(map, cur, first, model, t.layer_height)) {
        moves.push({
          x: first.x,
          y: first.y,
          z: first.z,
          cls: 'supported',
          extrude: true,
          tag: strand.id,
        });
        map.addSegment(cur, first);
      } else if (dist > 1e-6 || dz > 1e-6) {
        const under = dist > 1e-6 ? map.maxAlong(cur, first, model.tipRadius) : map.maxWithin(cur.x, cur.y, model.tipRadius);
        const tz = under > -Infinity ? Math.max(under + model.clearance, cur.z, first.z) : Math.max(cur.z, first.z) + derived.retraction.zHop;
        const seq = [];
        if (tz > cur.z + 1e-9) seq.push(travel(cur.x, cur.y, tz));
        if (dist > 1e-6) seq.push(travel(first.x, first.y, tz));
        if (tz > first.z + 1e-9) seq.push(travel(first.x, first.y, first.z));
        if (seq.length > 0) {
          if (dist >= derived.retraction.minTravel && derived.retraction.length > 0) {
            seq[0].retract = 'retract';
            pendingUnretract = true;
          }
          moves.push(...seq);
        }
      }
    }

    // --- validate against what is already printed (own strand is not in the map yet)
    const flagged = new Set();
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      if (map.collides(p.x, p.y, p.z, model)) {
        flagged.add(i);
        violations++;
      }
    }

    // --- extrude the strand
    for (let i = 1; i < strand.pts.length; i++) {
      const a = strand.pts[i - 1], b = strand.pts[i];
      const move = { x: b.x, y: b.y, z: b.z, cls: supplied ? b.cls ?? (strand.kind === 'base' ? 'base' : 'supported') : classify(strand, a, b, cfg), extrude: true, tag: strand.id };
      if (b.flow !== undefined && b.flow !== 1) move.flow = b.flow;
      if (i === 1 && pendingUnretract) {
        move.retract = 'unretract';
        pendingUnretract = false;
      }
      if (flagged.has(i)) move.violation = true;
      moves.push(move);
    }

    for (let i = 1; i < strand.pts.length; i++) map.addSegment(strand.pts[i - 1], strand.pts[i]);
    cur = strand.pts[strand.pts.length - 1];
    prevStrand = strand;
  }

  const warnings = [];
  if (violations > 0) {
    warnings.push(
      `${violations} move(s) come closer to printed strands than the clearance model allows. ` +
        `Usual causes: loops spaced more tightly than the nozzle tip is wide, and the caps of neighbouring loops crossing at the same height (normal at 50% overlap). ` +
        `Use the count to compare layouts rather than as pass or fail; tick 'Show violations' above the preview to see where.`
    );
  }
  return { moves, warnings, violations };
}
