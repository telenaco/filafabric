/**
 * Gaps in a row narrower than this (mm) are jumped: the row carries on beyond the gap, so both sides grow together.
 * A wider gap splits the shape into branches, and each branch is printed to its end before the next one starts.
 */
export const BRANCH_GAP = 60;

/**
 * The order to print the pieces of parallel lanes in, the way a person would lay them: row after row from the first
 * lane, every piece of a row whose gaps are under `gap`, each row the opposite way to the one before. Where a row splits
 * with a wider gap the shape has branches: the branch being printed is carried on to its end, then the next one starts
 * from its own first row; where branches join again, the joined part comes after all of them.
 *
 * @param rows     per lane, in order, the lane's pieces as objects with `lo` < `hi` along the lane (anything else is kept)
 * @param gap      the widest gap a row jumps (mm)
 * @param reverse  take the lanes from the last to the first (a rotated hatch, so its first lane is bottom or left)
 * @param forward  the first row's direction: from lo to hi (true) or hi to lo
 * @returns [{ lane, piece, forward }] in print order, `lane` the index into `rows`
 */
export function orderLanePieces(rows, { gap = BRANCH_GAP, reverse = false, forward = true } = {}) {
  const laneAt = (k) => (reverse ? rows.length - 1 - k : k);
  const overlaps = (a, b) => a.lo <= b.hi && b.lo <= a.hi;
  // 1. a row's pieces whose gaps are under `gap` form one cluster, printed together
  const clusters = rows.map((_, k) => {
    const lane = laneAt(k), out = [];
    for (const piece of [...rows[lane]].sort((a, b) => a.lo - b.lo)) {
      const last = out.at(-1);
      if (last && piece.lo - last.hi <= gap) { last.pieces.push(piece); last.hi = Math.max(last.hi, piece.hi); }
      else out.push({ lane, lo: piece.lo, hi: piece.hi, pieces: [piece] });
    }
    return out;
  });
  // 2. cells: runs of clusters, one per row, each resting on just one cluster below that carries on into it alone
  const cells = [];
  let active = [];
  for (const row of clusters) {
    const above = new Map(active.map((cell) => [cell, row.filter((cl) => overlaps(cell.last, cl))]));
    const next = [];
    for (const cl of row) {
      const under = active.filter((cell) => overlaps(cell.last, cl));
      if (under.length === 1 && above.get(under[0]).length === 1) {
        under[0].rows.push(cl); under[0].last = cl; next.push(under[0]);
      } else {
        const cell = { rows: [cl], last: cl, below: under, above: [] };
        for (const u of under) u.above.push(cell);
        cells.push(cell); next.push(cell);
      }
    }
    active = next;
  }
  // 3. carry on up the branch being printed; when it ends, the lowest branch not yet printed whose own base is done
  const done = new Set(), order = [];
  const ready = (cell) => !done.has(cell) && cell.below.every((b) => done.has(b));
  let pos = null, last = null;
  const nearest = (list) => list.reduce((best, cell) => {
    const d = pos === null ? 0 : Math.min(Math.abs(pos - cell.rows[0].lo), Math.abs(pos - cell.rows[0].hi));
    return d < best.d ? { cell, d } : best;
  }, { cell: null, d: Infinity }).cell;
  const out = [];
  while (order.length < cells.length) {
    const cell = nearest(last?.above.filter(ready) ?? []) ?? cells.find(ready);
    done.add(cell); order.push(cell); last = cell;
    // 4. rows in turn, alternating; a branch starts at the end of its first row nearer where the last one finished
    let dir = pos === null ? forward : Math.abs(pos - cell.rows[0].lo) <= Math.abs(pos - cell.rows[0].hi);
    for (const row of cell.rows) {
      for (const piece of dir ? row.pieces : [...row.pieces].reverse()) out.push({ lane: row.lane, piece, forward: dir });
      pos = dir ? row.hi : row.lo;
      dir = !dir;
    }
  }
  return out;
}

/**
 * Lays parallel lanes across a boundary and joins their inside stretches into continuous strands, in the order of
 * orderLanePieces (row after row, gaps under BRANCH_GAP jumped, wider ones printed branch by branch). Consecutive
 * stretches join only across neighbouring lanes and only when the short connector between them stays inside the
 * outline, so a concave shape never prints across a gap: the nozzle travels there instead.
 *
 * @param boundary  anything with intervals(axis, c) and contains(x, y)
 * @param axis      'y': lanes are the lines y = c (running along x); 'x': lanes are x = c (running along y)
 * @param lanes     lane coordinates, in order
 * @param opts      inset: pull each stretch's ends in by this much (mm); minLength: drop shorter stretches;
 *                  maxJog: longest allowed shift along the lane between one stretch's end and the next's start;
 *                  gap, reverse, forward: as orderLanePieces; allowConnector(a, b): optional exact XY connection check
 * @returns strands: arrays of segments { lane, c, from, to }, printed from -> to, in print order
 */
export function serpentineChains(boundary, axis, lanes, { inset = 0, minLength = 1, maxJog = Infinity, gap = BRANCH_GAP, reverse = false, forward = true, allowConnector = null } = {}) {
  const rows = lanes.map((c) => boundary.intervals(axis, c)
    .map(([a, b]) => ({ lo: a + inset, hi: b - inset }))
    .filter((p) => p.hi - p.lo >= minLength));
  const strands = [];
  let cur = null, last = null;
  for (const { lane, piece, forward: dir } of orderLanePieces(rows, { gap, reverse, forward })) {
    const seg = { lane, c: lanes[lane], from: dir ? piece.lo : piece.hi, to: dir ? piece.hi : piece.lo };
    const joins = cur && Math.abs(seg.lane - last.lane) === 1 && Math.abs(last.to - seg.from) <= maxJog
      && (allowConnector
        ? allowConnector(axis === 'y' ? { x: last.to, y: last.c } : { x: last.c, y: last.to }, axis === 'y' ? { x: seg.from, y: seg.c } : { x: seg.c, y: seg.from })
        : connectorInside(boundary, axis, last.c, last.to, seg.c, seg.from));
    if (joins) cur.push(seg);
    else { cur = [seg]; strands.push(cur); }
    last = seg;
  }
  return strands;
}

/**
 * For lanes laid in a frame turned by `angle` degrees (the frame's lanes are y' = c, running along x'): whether to take
 * the lanes in reverse and which way to start, so the first lane is the bottom one (left one for upright lanes) and the
 * first row starts at its left (bottom) end.
 */
export function laneStart(angle) {
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), eps = 1e-9;
  // across the lanes the frame's y' grows along (-s, c); along a lane its x' grows along (c, s)
  const across = -s + c, along = c + s;
  return {
    reverse: across < -eps || (Math.abs(across) <= eps && c < 0),
    forward: along > eps || (Math.abs(along) <= eps && s > 0),
  };
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
