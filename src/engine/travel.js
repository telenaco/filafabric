// Ordering a layer's strands so the nozzle travels as little as it can.
//
// Every move between two strands is a retract, a lift, a travel and a drop, so a drawing made of many separate lines
// spends much of its time not printing. What the plotter and 3D-printing literature agrees on, and what is done here:
//
//   1. Merge strands that touch end to end into one (what vpype's `linemerge` does). It is the cheapest saving: each
//      join removes a whole retract-lift-travel-drop, not only some distance.
//   2. Order what is left greedily, the next strand being the one whose nearer end is closest (orderStrands in
//      fabric.js; vpype's `linesort`). Fast, and usually within 25% of the best order, but it strands the nozzle far from
//      the next piece at the end of a sweep, and on some drawings is worse than a plain layer order.
//   3. Improve that order with local search on the travel moves alone: 2-opt (reverse a run of strands, each one
//      flipped, which only changes the two moves at its ends) and Or-opt (move one to three strands elsewhere, either
//      way round). The patents and theses on toolpath planning report 60% or more of the extrusion-free travel taken
//      away by this kind of search, against exact solvers that are far too slow for a page that regenerates on every
//      slider move. Closed shapes also pick the seam that fits their neighbours.
//
// The work is capped by a count of evaluations, not by the clock, so the same drawing always gives the same G-code.
//
// Before any of that, lines that meet or cross are one network and need only as many strokes as it has pairs of odd
// junctions (network.js, an Eulerian trail decomposition): joinStrokes() is merging and that, in one call.
import { joinNetwork } from './network.js';

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (p, q) => dist(p, q) < 1e-6;

/** A strand that is a plain flat line: one height, no per-point move class, so it can be joined to another. */
function joinable(s) {
  if (s.name === 'Structural tie' || (s.layer ?? 0) < 0 || s.pts.length < 2 || near(s.pts[0], s.pts.at(-1))) return false;
  const z = s.pts[0].z ?? 0;
  return s.pts.every((p) => p.cls === undefined && Math.abs((p.z ?? 0) - z) < 1e-6);
}

/**
 * Joins strands of one layer whose ends lie within `within` mm of each other, as a single strand (the short step across
 * is part of it). A chain may grow at both ends. Closed shapes, ties, raised strands and strands of another layer or
 * kind are left alone, and a colour-change pause on any strand of a chain stays on the chain.
 * @param allow  (p, q) → whether the step from p to q may be printed; the studio passes "stays inside the outline", so
 *               a step never crosses a hole or leaves the shape
 */
export function mergeTouching(strands, { within = 0.1, allow = null } = {}) {
  if (!(within > 0) || strands.length < 2) return strands;
  const items = strands.map((s) => ({ s, used: false, ok: joinable(s) }));
  const cell = Math.max(within, 1e-3);
  const grid = new Map();
  const at = (e) => (e.end === 0 ? e.item.s.pts[0] : e.item.s.pts.at(-1));
  const keyOf = (layer, x, y) => `${layer}|${x}|${y}`;
  for (const item of items) {
    if (!item.ok) continue;
    for (const end of [0, 1]) {
      const p = end === 0 ? item.s.pts[0] : item.s.pts.at(-1);
      const key = keyOf(item.s.layer ?? 0, Math.floor(p.x / cell), Math.floor(p.y / cell));
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ item, end });
    }
  }
  const nearest = (self, p, layer, kind) => {
    let best = null, bestD = within;
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const e of grid.get(keyOf(layer, cx + dx, cy + dy)) ?? []) {
        if (e.item.used || e.item === self || e.item.s.kind !== kind) continue;
        const d = dist(p, at(e));
        if (d < bestD && (d < 1e-9 || !allow || allow(p, at(e)))) { bestD = d; best = e; }
      }
    }
    return best;
  };
  const out = [];
  for (const item of items) {
    if (item.used) continue;
    item.used = true;
    if (!item.ok) { out.push(item.s); continue; }
    const layer = item.s.layer ?? 0, kind = item.s.kind;
    let pts = [...item.s.pts], pause = !!item.s.pauseBefore, joined = false;
    for (let side = 0; side < 2; side++) {
      for (;;) {
        const e = nearest(item, pts.at(-1), layer, kind);
        if (!e) break;
        e.item.used = true;
        joined = true;
        pause = pause || !!e.item.s.pauseBefore;
        const more = e.end === 0 ? e.item.s.pts : [...e.item.s.pts].reverse();
        // lines that meet exactly share a point: it is printed once
        pts = [...pts, ...more.slice(dist(pts.at(-1), more[0]) < 1e-9 ? 1 : 0)];
      }
      pts.reverse();
    }
    out.push(joined ? { ...item.s, pts, pauseBefore: pause } : item.s);
  }
  return out;
}

/**
 * What the drawing pipelines call before ordering: strokes that touch end to end are merged, then lines that meet or
 * cross are rebuilt as the fewest strokes their network needs, each line printed once.
 */
export function joinStrokes(strands, { within = 0.1, allow = null } = {}) {
  return joinNetwork(mergeTouching(strands, { within, allow }), { within, allow });
}

/** The ring of a closed strand without its repeated end, rotated to start at vertex v and closed again. */
function rotated(pts, v) {
  const ring = pts.slice(0, -1);
  return v ? [...ring.slice(v), ...ring.slice(0, v), ring[v]] : pts;
}

/**
 * Improves the order and the direction of a layer's strands (already in a decent, greedy order) to cut the travel from
 * `start` through all of them. Pure geometry: the strands come back with the same points, open ones possibly reversed,
 * closed ones possibly started at another vertex.
 * @param budget  at most this many candidate moves are evaluated (the result is the same on every machine)
 */
export function improveTravel(strands, start, { budget = 3_000_000 } = {}) {
  const n = strands.length;
  if (n < 2) return strands;
  const first = strands.map((s) => s.pts[0]);
  const last = strands.map((s) => s.pts.at(-1));
  const closed = strands.map((_, i) => near(first[i], last[i]));
  const order = Array.from({ length: n }, (_, i) => i);
  const flip = new Uint8Array(n);
  const entry = (i) => (flip[i] ? last[i] : first[i]);
  const exit = (i) => (flip[i] ? first[i] : last[i]);
  let spent = 0;

  const reverseRun = (i, j) => {
    for (let a = i, b = j; a < b; a++, b--) { const t = order[a]; order[a] = order[b]; order[b] = t; }
    for (let k = i; k <= j; k++) flip[order[k]] ^= 1;
  };

  let improved = true;
  while (improved && spent < budget) {
    improved = false;

    // 2-opt: reversing order[i..j] (each strand flipped) changes only the move into i and the move out of j
    for (let i = 0; i < n - 1 && spent < budget; i++) {
      const before0 = i === 0 ? start : exit(order[i - 1]);
      const head = entry(order[i]);
      for (let j = i + 1; j < n; j++) {
        spent++;
        const tail = exit(order[j]);
        const next = j + 1 < n ? entry(order[j + 1]) : null;
        const old = dist(before0, head) + (next ? dist(tail, next) : 0);
        const now = dist(before0, tail) + (next ? dist(head, next) : 0);
        if (now < old - 1e-9) {
          reverseRun(i, j);
          improved = true;
          break;
        }
      }
    }

    // Or-opt: move one to three strands in a row somewhere else, as they are or turned round
    for (let len = 1; len <= 3 && spent < budget; len++) {
      for (let i = 0; i + len <= n && spent < budget; i++) {
        const a = order[i], z = order[i + len - 1];
        const prev = i === 0 ? start : exit(order[i - 1]);
        const next = i + len < n ? entry(order[i + len]) : null;
        const gain = dist(prev, entry(a)) + (next ? dist(exit(z), next) : 0) - (next ? dist(prev, next) : 0);
        if (gain < 1e-9) continue;
        let bestCost = gain - 1e-9, bestGap = -1, bestTurn = false;
        for (let k = 0; k <= n; k++) {
          if (k >= i && k <= i + len) continue;
          spent += 2;
          const x = k === 0 ? start : exit(order[k - 1]);
          const y = k < n ? entry(order[k]) : null;
          const cut = y ? dist(x, y) : 0;
          const plain = dist(x, entry(a)) + (y ? dist(exit(z), y) : 0) - cut;
          const turned = dist(x, exit(z)) + (y ? dist(entry(a), y) : 0) - cut;
          if (plain < bestCost) { bestCost = plain; bestGap = k; bestTurn = false; }
          if (turned < bestCost) { bestCost = turned; bestGap = k; bestTurn = true; }
        }
        if (bestGap >= 0) {
          const run = order.splice(i, len);
          if (bestTurn) { run.reverse(); for (const s of run) flip[s] ^= 1; }
          order.splice(bestGap > i ? bestGap - len : bestGap, 0, ...run);
          improved = true;
        }
      }
    }
  }

  // closed shapes start where it is shortest to come from the strand before and go on to the one after
  const result = order.map((idx) => {
    const s = strands[idx];
    if (closed[idx] || !flip[idx]) return s;
    return { ...s, pts: [...s.pts].reverse() };
  });
  for (let p = 0; p < result.length; p++) {
    const s = result[p];
    if (!closed[order[p]] || s.pts.length < 4) continue;
    const from = p === 0 ? start : result[p - 1].pts.at(-1);
    const to = p + 1 < result.length ? result[p + 1].pts[0] : null;
    let bestV = 0, best = Infinity;
    for (let v = 0; v < s.pts.length - 1; v++) {
      const c = dist(from, s.pts[v]) + (to ? dist(s.pts[v], to) : 0);
      if (c < best - 1e-9) { best = c; bestV = v; }
    }
    if (bestV) result[p] = { ...s, pts: rotated(s.pts, bestV) };
  }
  return result;
}
