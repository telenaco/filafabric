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
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/**
 * Every place two passes cross, once each. Strands are { pts: [{ x, y }] }.
 * @returns { found, arcs }: found is [{ sa, sb, arcA, arcB, x, y, angle }] sorted in print order (angle: the acute
 *          angle between the strands in degrees); arcs[i][k] is the distance along strand i to its point k
 */
export function findCrossings(strands, { strandWidth = 0.5, cell = 1 } = {}) {
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

  // uniform grid: each segment goes in every cell its bounding box touches (numeric cell keys, so a large swatch
  // does not build millions of strings)
  const box = new Float64Array(segs.length * 4); // minX, minY, maxX, maxY per segment
  const cellKey = (ix, iy) => (ix + 1048576) * 2097152 + (iy + 1048576);
  const grid = new Map();
  segs.forEach((g, index) => {
    const p = strands[g.si].pts[g.i], q = strands[g.si].pts[g.i + 1];
    const minX = Math.min(p.x, q.x), maxX = Math.max(p.x, q.x), minY = Math.min(p.y, q.y), maxY = Math.max(p.y, q.y);
    box[4 * index] = minX; box[4 * index + 1] = minY; box[4 * index + 2] = maxX; box[4 * index + 3] = maxY;
    const x0 = Math.floor(minX / cell), x1 = Math.floor(maxX / cell);
    const y0 = Math.floor(minY / cell), y1 = Math.floor(maxY / cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const key = cellKey(ix, iy);
        const list = grid.get(key);
        if (list) list.push(index);
        else grid.set(key, [index]);
      }
    }
  });

  // every crossing once, with its position along both strands
  const found = [];
  const recent = new Map();
  for (const [cellId, list] of grid) {
    for (let m = 0; m < list.length; m++) {
      for (let n = m + 1; n < list.length; n++) {
        const ia = Math.min(list[m], list[n]), ib = Math.max(list[m], list[n]);
        // two segments share every cell their boxes overlap in: test the pair only in the first of those cells
        const ox = Math.max(box[4 * ia], box[4 * ib]), oy = Math.max(box[4 * ia + 1], box[4 * ib + 1]);
        if (ox > Math.min(box[4 * ia + 2], box[4 * ib + 2]) || oy > Math.min(box[4 * ia + 3], box[4 * ib + 3])) continue;
        if (cellKey(Math.floor(ox / cell), Math.floor(oy / cell)) !== cellId) continue;
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
        // the same crossing found twice (two segments meeting at a shared point) is within a strand width along
        // both strands; earlier crossings are kept in buckets of a strand width along A, so only the neighbouring
        // buckets are searched (one long strand crossing itself thousands of times stays fast)
        const bucket = Math.floor(arcA / strandWidth);
        let dup = false;
        for (let d = -1; d <= 1 && !dup; d++) {
          const list = recent.get(`${A.si}|${B.si}|${bucket + d}`);
          dup = !!list && list.some((c) => Math.abs(c.arcA - arcA) < strandWidth && Math.abs(c.arcB - arcB) < strandWidth);
        }
        if (dup) continue;
        const key = `${A.si}|${B.si}|${bucket}`;
        const near = recent.get(key);
        const da = Math.atan2(qa.y - pa.y, qa.x - pa.x), db = Math.atan2(qb.y - pb.y, qb.x - pb.x);
        let angle = Math.abs(((da - db) * 180) / Math.PI) % 180;
        if (angle > 90) angle = 180 - angle;
        const c = { sa: A.si, sb: B.si, arcA, arcB, x: pa.x + hit[0] * (qa.x - pa.x), y: pa.y + hit[0] * (qa.y - pa.y), angle };
        if (near) near.push(c);
        else recent.set(key, [c]);
        found.push(c);
      }
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
  const { found, arcs } = findCrossings(strands, { strandWidth, cell });

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
