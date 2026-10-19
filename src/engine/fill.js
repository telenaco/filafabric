/**
 * Lays parallel lanes across a boundary and joins their inside stretches into as few continuous strands as
 * possible, the way a serpentine does: each lane runs the opposite way to the one before, and a strand carries
 * on into the next lane only when the short connector between them stays inside the outline. A concave shape
 * therefore splits into several strands instead of printing across a gap.
 *
 * @param boundary  anything with intervals(axis, c) and contains(x, y)
 * @param axis      'y': lanes are the lines y = c (running along x); 'x': lanes are x = c (running along y)
 * @param lanes     lane coordinates, in order
 * @param opts      inset: pull each stretch's ends in by this much (mm); minLength: drop shorter stretches;
 *                  maxJog: longest allowed shift along the lane between one stretch's end and the next's start
 * @returns strands: arrays of segments { lane, c, from, to }, printed from -> to
 */
export function serpentineChains(boundary, axis, lanes, { inset = 0, minLength = 1, maxJog = Infinity, cornerStart = false } = {}) {
  const strands = [];
  let open = []; // strands whose last segment is on the previous lane

  lanes.forEach((c, lane) => {
    const forward = lane % 2 === 0;
    const segments = [];
    for (const [a, b] of boundary.intervals(axis, c)) {
      const lo = a + inset, hi = b - inset;
      if (hi - lo >= minLength) segments.push(forward ? { lane, c, from: lo, to: hi } : { lane, c, from: hi, to: lo });
    }

    const next = [];
    const taken = new Set();
    for (const seg of segments) {
      // the open strand whose end is closest to where this segment starts, if the connector stays inside
      let best = null, bestJog = Infinity;
      for (const s of open) {
        if (taken.has(s)) continue;
        const last = s[s.length - 1];
        const jog = Math.abs(last.to - seg.from);
        if (jog < bestJog && jog <= maxJog && connectorInside(boundary, axis, last.c, last.to, seg.c, seg.from)) {
          best = s;
          bestJog = jog;
        }
      }
      if (best) {
        best.push(seg);
        taken.add(best);
        next.push(best);
      } else {
        const strand = [seg];
        strands.push(strand);
        next.push(strand);
      }
    }
    open = next;
  });

  if (cornerStart) {
    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      if (s.length > 1) {
        const len0 = Math.abs(s[0].to - s[0].from);
        const lenLast = Math.abs(s[s.length - 1].to - s[s.length - 1].from);
        if (lenLast < len0) {
          strands[i] = s.slice().reverse().map((seg) => ({ ...seg, from: seg.to, to: seg.from }));
        }
      }
    }
    strands.sort((a, b) => Math.abs(a[0].to - a[0].from) - Math.abs(b[0].to - b[0].from));
  }

  return strands;
}

/** Points along a lane-to-lane connector, checked every half millimetre. */
function connectorInside(boundary, axis, c0, s0, c1, s1) {
  const len = Math.hypot(c1 - c0, s1 - s0);
  const n = Math.max(2, Math.ceil(len / 0.5));
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const c = c0 + (c1 - c0) * f, s = s0 + (s1 - s0) * f;
    const inside = axis === 'y' ? boundary.contains(s, c) : boundary.contains(c, s);
    if (!inside) return false;
  }
  return true;
}

/** Lane coordinates `spacing` apart, centred in [min, max] so an outline is never cut by a lane at its very tip. */
export function centredLanes(min, max, spacing) {
  const span = max - min;
  const count = Math.floor(span / spacing + 1e-9) + 1;
  const start = min + (span - (count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, k) => start + k * spacing);
}
