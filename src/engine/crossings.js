/**
 * Over and under. Strands are printed in order; where two passes cross, one has to be on top.
 *
 * By default the later pass lies over the earlier one: it lifts by `lift` (about one layer) over the strand it
 * crosses and drops back to the bed beyond it, so the fabric stays one layer thick everywhere else. A `decide`
 * rule can instead say `earlier-over`: the earlier strand then arches up by `arch` over a span of `archSpan`, so
 * the later strand passes beneath it at bed level (a woven binding).
 *
 * Input strands are { id, kind, pts: [{ x, y, z }] } in print order. Output points are new objects; raised points
 * carry `cls: 'supported'` so the speed, flow and preview treat them as strand lying on strand.
 */

const smooth = (t) => 0.5 * (1 + Math.cos(Math.PI * t)); // 1 at t = 0, 0 at t = 1

/** Height weight 0..1 at distance `d` from a bump centre: flat for `plateau`, then a raised-cosine fall over `ramp`. */
function bumpWeight(d, plateau, ramp) {
  const a = Math.abs(d);
  if (a <= plateau) return 1;
  if (a >= plateau + ramp) return 0;
  return smooth((a - plateau) / ramp);
}

function lowerBound(arr, value) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Intersection of segments p→p+r and q→q+s: [t, u] along each, or null. */
function intersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const qpx = cx - ax, qpy = cy - ay;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  const eps = 1e-9;
  return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps ? [Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, u))] : null;
}

/**
 * Every place two passes cross, once each. Strands are { pts: [{ x, y }] }.
 * @returns { found, arcs }: found is [{ sa, sb, arcA, arcB, x, y, angle }] sorted in print order (angle: the acute
 *          angle between the strands in degrees); arcs[i][k] is the distance along strand i to its point k
 */
export function findCrossings(strands, { strandWidth = 0.5, cell = 1, mergeDistance = strandWidth } = {}) {
  const minArc = 3 * strandWidth;

  // cumulative arc length of every point, and one record per segment in print order
  const arcs = strands.map((s) => {
    const a = new Float64Array(s.pts.length);
    for (let i = 1; i < s.pts.length; i++) a[i] = a[i - 1] + Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
    return a;
  });
  const segs = [];
  strands.forEach((s, si) => {
    for (let i = 0; i + 1 < s.pts.length; i++) segs.push({ si, i });
  });

  // uniform grid: each segment goes in every cell its bounding box touches
  const grid = new Map();
  segs.forEach((g, index) => {
    const p = strands[g.si].pts[g.i], q = strands[g.si].pts[g.i + 1];
    const x0 = Math.floor(Math.min(p.x, q.x) / cell), x1 = Math.floor(Math.max(p.x, q.x) / cell);
    const y0 = Math.floor(Math.min(p.y, q.y) / cell), y1 = Math.floor(Math.max(p.y, q.y) / cell);
    Object.assign(g, { x0, x1, y0, y1 });
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const key = `${ix},${iy}`;
        const list = grid.get(key);
        if (list) list.push(index);
        else grid.set(key, [index]);
      }
    }
  });

  // every crossing once, with its position along both strands
  const found = [];
  const recent = new Map();
  // Deduplicate only the current segment's neighbours; retaining all candidate pairs scales quadratically.
  for (let ia = 0; ia < segs.length; ia++) {
    const g = segs[ia], neighbours = new Set();
    for (let ix = g.x0; ix <= g.x1; ix++) for (let iy = g.y0; iy <= g.y1; iy++) {
      for (const ib of grid.get(`${ix},${iy}`) ?? []) if (ib > ia) neighbours.add(ib);
    }
    for (const ib of neighbours) {
        const A = segs[ia], B = segs[ib];
        const pa = strands[A.si].pts[A.i], qa = strands[A.si].pts[A.i + 1];
        const pb = strands[B.si].pts[B.i], qb = strands[B.si].pts[B.i + 1];
        const hit = intersect(pa.x, pa.y, qa.x, qa.y, pb.x, pb.y, qb.x, qb.y);
        if (!hit) continue;
        const arcA = arcs[A.si][A.i] + hit[0] * (arcs[A.si][A.i + 1] - arcs[A.si][A.i]);
        const arcB = arcs[B.si][B.i] + hit[1] * (arcs[B.si][B.i + 1] - arcs[B.si][B.i]);
        if (A.si === B.si && Math.abs(arcB - arcA) < minArc) continue;
        // the end of a closed strand meeting its own start is the closing joint, not a crossing
        if (A.si === B.si && A.i === 0 && B.i === strands[B.si].pts.length - 2 && hit[0] < 1e-9 && hit[1] > 1 - 1e-9) continue;
        const key = `${A.si}|${B.si}`;
        const near = recent.get(key);
        if (near && near.some((c) => Math.abs(c.arcA - arcA) < mergeDistance && Math.abs(c.arcB - arcB) < mergeDistance)) continue;
        const da = Math.atan2(qa.y - pa.y, qa.x - pa.x), db = Math.atan2(qb.y - pb.y, qb.x - pb.x);
        let angle = Math.abs(((da - db) * 180) / Math.PI) % 180;
        if (angle > 90) angle = 180 - angle;
        const c = { sa: A.si, sb: B.si, arcA, arcB, x: pa.x + hit[0] * (qa.x - pa.x), y: pa.y + hit[0] * (qa.y - pa.y), angle };
        if (near) near.push(c);
        else recent.set(key, [c]);
        found.push(c);
    }
  }
  // deterministic order whatever the grid iteration was
  found.sort((p, q) => p.sa - q.sa || p.arcA - q.arcA || p.sb - q.sb || p.arcB - q.arcB);
  return { found, arcs };
}

/**
 * @param strands  ordered strands
 * @param opts     lift (mm, default 0.25), ramp (mm, 1.6), strandWidth (mm, 0.5), cell (mm, 1),
 *                 arch (mm, 1), archSpan (mm, 3), archRamp (mm, 3), decide ({ a, b, x, y }) → 'later-over' | 'earlier-over'
 * @returns        { strands, crossings, maxLift, maxSlopeDeg }
 */
export function resolveCrossings(strands, opts = {}) {
  const { lift = 0.25, ramp = 1.6, strandWidth = 0.5, cell = 1, arch = 1, archSpan = 3, archRamp = 3, decide = null } = opts;
  const { found, arcs } = findCrossings(strands, { strandWidth, cell, ...(opts.follow ? { mergeDistance: 1e-6 } : {}) });
  if (opts.follow) return followSupports(strands, found.filter((c) => !(strands[c.sa].fixed && strands[c.sb].fixed)), arcs, { lift, ramp, preserve: opts.preserve ?? false });

  // bumps per strand
  const bumps = strands.map(() => []);
  for (const c of found) {
    const verdict = decide ? decide({ a: c.sa, b: c.sb, x: c.x, y: c.y }) : 'later-over';
    if (verdict === 'earlier-over') bumps[c.sa].push({ arc: c.arcA, h: arch, plateau: archSpan / 2, ramp: archRamp });
    else bumps[c.sb].push({ arc: c.arcB, h: lift, plateau: 0.75 * strandWidth, ramp });
  }

  let maxLift = 0;
  let maxSlope = 0;
  const out = strands.map((s, si) => {
    const raise = new Float64Array(s.pts.length);
    for (const b of bumps[si]) {
      const reach = b.plateau + b.ramp;
      for (let i = lowerBound(arcs[si], b.arc - reach); i < s.pts.length && arcs[si][i] <= b.arc + reach; i++) {
        raise[i] = Math.max(raise[i], b.h * bumpWeight(arcs[si][i] - b.arc, b.plateau, b.ramp));
      }
    }
    const pts = s.pts.map((p, i) => {
      if (raise[i] > 1e-6) {
        maxLift = Math.max(maxLift, raise[i]);
        return { ...p, z: p.z + raise[i], cls: 'supported' };
      }
      return { ...p };
    });
    for (let i = 1; i < pts.length; i++) {
      const dxy = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (dxy > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(pts[i].z - pts[i - 1].z) / dxy);
    }
    return { ...s, pts };
  });

  return { strands: out, crossings: found.length, maxLift, maxSlopeDeg: (Math.atan(maxSlope) * 180) / Math.PI };
}

/** Exact crossing knots, solved in extrusion order. Ramps never move a previously solved joint. */
function followSupports(strands, found, arcs, { lift, ramp, preserve = false }) {
  const marks = strands.map(() => new Map());
  const mark = (si, arc) => {
    const key = Math.round(arc * 1e7) / 1e7;
    if (!marks[si].has(key)) marks[si].set(key, { arc: key, earlier: [], z: null });
    return marks[si].get(key);
  };
  for (const c of found) {
    const a = mark(c.sa, c.arcA), b = mark(c.sb, c.arcB);
    if (a !== b) b.earlier.push(a);
  }
  let maxLift = 0, maxSlope = 0;
  const out = strands.map((s, si) => {
    const base = Math.min(...s.pts.map((p) => p.z));
    const knots = [...marks[si].values()].sort((a, b) => a.arc - b.arc);
    const knotArcs = knots.map((k) => k.arc);
    const originalZ = (arc) => {
      const j = Math.min(s.pts.length - 1, lowerBound(arcs[si], arc)), i = Math.max(0, j - 1);
      const t = Math.max(0, Math.min(1, (arc - arcs[si][i]) / Math.max(1e-12, arcs[si][j] - arcs[si][i])));
      return s.pts[i].z + (s.pts[j].z - s.pts[i].z) * t;
    };
    for (const k of knots) {
      k.z = Math.max(preserve ? originalZ(k.arc) : base, ...k.earlier.map((a) => (a.z ?? base) + lift));
      maxLift = Math.max(maxLift, k.z - base);
    }
    const zAt = (arc) => {
      if (!knots.length) return preserve ? originalZ(arc) : base;
      const i = lowerBound(knotArcs, arc);
      const a = knots[i - 1], b = knots[i];
      if (b && Math.abs(b.arc - arc) < 1e-6) return b.z;
      if (preserve) return originalZ(arc) + Math.max(0, a ? (a.z - originalZ(a.arc)) * bumpWeight(arc - a.arc, 0, ramp) : 0, b ? (b.z - originalZ(b.arc)) * bumpWeight(arc - b.arc, 0, ramp) : 0);
      if (a && b && b.arc - a.arc < 2 * ramp) {
        const t = (arc - a.arc) / (b.arc - a.arc);
        return a.z + (b.z - a.z) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      }
      return Math.max(base, a ? base + (a.z - base) * bumpWeight(arc - a.arc, 0, ramp) : base, b ? base + (b.z - base) * bumpWeight(arc - b.arc, 0, ramp) : base);
    };
    const nodes = [...arcs[si], ...knots.map((k) => k.arc)].sort((a, b) => a - b);
    const pts = [];
    for (const arc of nodes) {
      if (pts.length && Math.abs(arc - pts.at(-1)._arc) < 1e-7) continue;
      const j = Math.min(s.pts.length - 1, lowerBound(arcs[si], arc));
      const a = s.pts[Math.max(0, j - 1)], b = s.pts[j];
      const t = j ? Math.max(0, Math.min(1, (arc - arcs[si][j - 1]) / Math.max(1e-12, arcs[si][j] - arcs[si][j - 1]))) : 0;
      const z = zAt(arc);
      pts.push({ ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z, _arc: arc, ...(z > base + 1e-6 ? { cls: 'supported' } : {}) });
    }
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (d > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(pts[i].z - pts[i - 1].z) / d);
    }
    return { ...s, pts };
  });
  // A short gap between crossing knots must not create a nearly vertical extrusion. Propagate the required
  // heights along each path and into later supports, rather than lowering a joint back through printed material.
  const slope = Math.tan(25 * Math.PI / 180);
  const at = out.map((s) => s.pts.map((p) => p._arc));
  const point = (si, arc) => out[si].pts[Math.min(out[si].pts.length - 1, lowerBound(at[si], arc - 1e-7))];
  for (let pass = 0; pass < 120; pass++) {
    let changed = false;
    const raise = (p, z) => { if (z > p.z + 1e-9) { p.z = z; p.cls = 'supported'; changed = true; } };
    for (const s of out) {
      for (let i = 1; i < s.pts.length; i++) { const a = s.pts[i - 1], b = s.pts[i]; raise(b, a.z - slope * Math.hypot(b.x - a.x, b.y - a.y)); }
      for (let i = s.pts.length - 2; i >= 0; i--) { const a = s.pts[i + 1], b = s.pts[i]; raise(b, a.z - slope * Math.hypot(b.x - a.x, b.y - a.y)); }
    }
    for (const c of found) raise(point(c.sb, c.arcB), point(c.sa, c.arcA).z + lift);
    if (!changed) break;
  }
  maxSlope = 0; maxLift = 0;
  for (let si = 0; si < out.length; si++) {
    const s = out[si], base = Math.min(...strands[si].pts.map((p) => p.z));
    for (let i = 0; i < s.pts.length; i++) {
      maxLift = Math.max(maxLift, s.pts[i].z - base);
      if (i) { const a = s.pts[i - 1], b = s.pts[i], d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(b.z - a.z) / d); }
      delete s.pts[i]._arc;
    }
  }
  return { strands: out, crossings: found.length, maxLift, maxSlopeDeg: Math.atan(maxSlope) * 180 / Math.PI };
}
