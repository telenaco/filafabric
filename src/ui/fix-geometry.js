// "Check the geometry" in words a person can act on, and "Fix it": a short search over the design's own sliders that
// keeps the smallest change after which the fabric check passes. The search itself (building each candidate) is the
// caller's: this module only says what is wrong, what to try, in what order, and how much better a try is.

const SPACING = ['spacing', 'pitch', 'rowPitch', 'warpPitch', 'weftPitch', 'wavelength', 'period', 'cell', 'block', 'rowGap', 'designSpacing', 'backing1Spacing', 'backing2Spacing', 'loopSpacing', 'baseGap'];
const FEATURE = ['size', 'depth', 'amplitude', 'radius', 'loop', 'relief', 'lift', 'backingDepth', 'pileHeight', 'loopSize'];
const HEIGHT = ['depth', 'amplitude', 'relief', 'lift', 'backingDepth', 'pileHeight'];
const LENGTH = ['wavelength', 'period', 'length', 'pitch', 'rowPitch'];

/** Each problem the fabric check can raise: which sliders help, and which way. */
const PROBLEMS = [
  { id: 'separate', count: (f) => Math.max(0, (f.components ?? 1) - 1), weight: 100, moves: [[SPACING, -1], [FEATURE, +1], [['rowOverlap'], +1]] },
  { id: 'steep', count: (f) => Math.max(0, (f.maxSlopeDeg ?? 0) - 25.1), weight: 5, moves: [[HEIGHT, -1], [LENGTH, +1]] },
  { id: 'outside', count: (f) => f.outsideSegments ?? 0, weight: 1, moves: [[FEATURE, -1], [SPACING, -1]] },
  { id: 'below', count: (f) => f.reversedCrossings ?? 0, weight: 10, moves: [[SPACING, +1], [FEATURE, -1]] },
];

/** 0 when the fabric passes the check; otherwise larger the worse it is, so two tries can be compared. */
export function problemScore(fabric) {
  if (!fabric) return Infinity;
  if (fabric.exportable) return 0;
  const score = PROBLEMS.reduce((sum, p) => sum + p.count(fabric) * p.weight, 0);
  return score > 0 ? score : 1; // not exportable for a reason not counted here (nothing to print): still a problem
}

/** The check's findings, said plainly, each with what it means for the print. */
export function describeFabric(fabric) {
  const lines = [];
  const pieces = Math.max(1, fabric.components ?? 1);
  if (pieces > 1) lines.push(`The fabric comes out in ${pieces} pieces that don't touch, so it would fall apart.`);
  if (fabric.maxSlopeDeg > 25.1) lines.push(`Some strands climb at ${fabric.maxSlopeDeg.toFixed(0)}°, steeper than the 25° the nozzle can print cleanly.`);
  if (fabric.outsideSegments) lines.push(`${fabric.outsideSegments === 1 ? 'A bit of strand sticks' : `${fabric.outsideSegments} bits of strand stick`} out past the outline.`);
  if (fabric.reversedCrossings) lines.push(`${fabric.reversedCrossings === 1 ? 'One crossing has' : `${fabric.reversedCrossings} crossings have`} to pass under a strand that is already printed.`);
  return lines.length ? lines.join(' ') : 'Nothing fits inside this shape.';
}

const snap = (value, { min, max, step = 0.1 }) => {
  const v = Math.min(max, Math.max(min, Math.round((value - min) / step) * step + min));
  return Number(v.toFixed(6));
};

/**
 * Setting changes to try, smallest first: each helpful slider a little, then more, then all of them together.
 * sliders: [{ key, label }]; get(key) the current value; range(key) { min, max, step }.
 */
export function fixCandidates(fabric, { sliders, get, range, limit = 14 }) {
  const active = PROBLEMS.filter((p) => p.count(fabric) > 0);
  const known = new Map(sliders.filter((s) => range(s.key) && typeof get(s.key) === 'number').map((s) => [s.key, s]));
  // the helpful slider moves, the worst problem's first, each slider once
  const moves = [];
  for (const problem of active.length ? active : PROBLEMS.slice(0, 1)) {
    for (const [keys, direction] of problem.moves) for (const key of keys) {
      if (known.has(key) && !moves.some((m) => m.key === key)) moves.push({ key, direction });
    }
  }
  const candidates = [], seen = new Set();
  const add = (changes) => {
    const patch = {};
    for (const { key, direction, fraction } of changes) {
      const r = range(key), now = get(key), end = direction > 0 ? r.max : r.min;
      const next = snap(now + (end - now) * fraction, r);
      if (next !== now) patch[key] = next;
    }
    const id = JSON.stringify(patch);
    if (!Object.keys(patch).length || seen.has(id)) return;
    seen.add(id);
    candidates.push({ patch, changes: Object.entries(patch).map(([key, value]) => ({ key, label: known.get(key).label, from: get(key), to: value })) });
  };
  for (const fraction of [0.25, 0.5, 1]) for (const m of moves) add([{ ...m, fraction }]);
  if (moves.length > 1) for (const fraction of [0.5, 1]) add(moves.map((m) => ({ ...m, fraction })));
  // a slider already at its end, or a design that answers the other way: the same sliders, moved back
  for (const fraction of [0.25, 0.5]) for (const m of moves) add([{ ...m, direction: -m.direction, fraction }]);
  // a random layout can be unlucky: a new seed keeps the look and moves the pieces
  if (known.has('seed')) for (const step of [1, 2]) {
    const r = range('seed'), next = get('seed') + step <= r.max ? get('seed') + step : r.min + step - 1;
    if (!seen.has(`seed:${next}`)) { seen.add(`seed:${next}`); candidates.push({ patch: { seed: next }, changes: [{ key: 'seed', label: known.get('seed').label, from: get('seed'), to: next }] }); }
  }
  return candidates.slice(0, limit);
}

/** "Line spacing 3 → 2.4 mm, Wave depth 2 → 1.5 mm" */
export function describeChanges(changes, unitOf = () => '') {
  const fmt = (n) => Number(n.toFixed(2)).toString();
  return changes.map((c) => `${c.label} ${fmt(c.from)} → ${fmt(c.to)}${unitOf(c.key) ? ` ${unitOf(c.key)}` : ''}`).join(', ');
}
