// Geometric screening, not a material-strength model. All distances are millimetres.
import { findCrossings } from './crossings.js';
import { improveTravel } from './travel.js';
const mix = (a, b, t) => ({ ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t });
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
// Flow is stored on the destination point: it applies to the whole incoming extrusion move.
const widthFactor = (p) => ['rising', 'falling', 'unsupported'].includes(p.cls) ? Math.sqrt(p.flow ?? 1) : (p.flow ?? 1);

function projection(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
}

/** Closest positions along two XY segments, including endpoint and collinear contacts. */
export function segmentContact(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = cross(rx, ry, sx, sy);
  if (Math.abs(den) > 1e-12) {
    const t = cross(c.x - a.x, c.y - a.y, sx, sy) / den;
    const u = cross(c.x - a.x, c.y - a.y, rx, ry) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { t, u, distance: 0 };
  }
  const candidates = [[0, projection(a, c, d)], [1, projection(b, c, d)], [projection(c, a, b), 0], [projection(d, a, b), 1]];
  let best = null;
  for (const [t, u] of candidates) {
    const p = mix(a, b, t), q = mix(c, d, u);
    const distance = Math.hypot(p.x - q.x, p.y - q.y);
    if (!best || distance < best.distance) best = { t, u, distance };
  }
  return best;
}

export function contactGraph(strands, { strandWidth = 0.45, layerHeight = 0.2, planar = false, joined = [], cellSize = null } = {}) {
  const parent = strands.map((_, i) => i);
  const root = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { parent[root(a)] = root(b); };
  for (const group of joined) for (const i of group) join(group[0], i);
  const cell = cellSize ?? Math.max(1, strandWidth * 3), grid = new Map();
  let joints = 0;
  strands.forEach((s, si) => {
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], width = strandWidth * widthFactor(b), pad = width / 2;
      const x0 = Math.floor((Math.min(a.x, b.x) - pad) / cell), x1 = Math.floor((Math.max(a.x, b.x) + pad) / cell);
      const y0 = Math.floor((Math.min(a.y, b.y) - pad) / cell), y1 = Math.floor((Math.max(a.y, b.y) + pad) / cell);
      const seen = new Set();
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        for (const q of grid.get(`${x},${y}`) ?? []) {
          if (root(si) === root(q.si) || seen.has(q)) continue;
          seen.add(q);
          const hit = segmentContact(a, b, q.a, q.b);
          if (hit.distance > (width + q.width) / 2 + 1e-9) continue;
          const za = mix(a, b, hit.t).z, zb = mix(q.a, q.b, hit.u).z;
          if (planar || Math.abs(za - zb) <= layerHeight + 0.04) { join(si, q.si); joints++; }
        }
      }
      const q = { a, b, si, width };
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(q);
      }
    }
  });
  const groups = new Map();
  strands.forEach((s, i) => { if (s.pts.length < 2) return; const k = root(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  return { components: groups.size, groups: [...groups.values()], labels: strands.map((_, i) => root(i)), joints };
}

/**
 * An outline's edges filed on a grid, built once per outline: a question about one place (does this segment cross the
 * outline, is this point a bead's width from it) reads only the edges near it. A detailed drawing has thousands of
 * edges, and every strand of a swatch is asked about every quarter millimetre, so reading them all each time was most
 * of the time it took to build a swatch inside one. The answers are the same; only the edges that cannot matter are
 * skipped.
 */
const edgeGrids = new WeakMap();
function edgeGrid(boundary) {
  let grid = edgeGrids.get(boundary);
  if (grid) return grid;
  const edges = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of boundary.rings ?? []) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const e = { a, b, minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y), seen: 0 };
    edges.push(e);
    minX = Math.min(minX, e.minX); minY = Math.min(minY, e.minY); maxX = Math.max(maxX, e.maxX); maxY = Math.max(maxY, e.maxY);
  }
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  const cell = Math.max(0.5, Math.sqrt(area / Math.max(1, edges.length)) * 2);
  const nx = edges.length ? Math.max(1, Math.ceil((maxX - minX) / cell) + 1) : 0, ny = edges.length ? Math.max(1, Math.ceil((maxY - minY) / cell) + 1) : 0;
  const cells = Array.from({ length: nx * ny }, () => []);
  for (const e of edges) {
    for (let j = Math.floor((e.minY - minY) / cell); j <= Math.floor((e.maxY - minY) / cell); j++) {
      for (let i = Math.floor((e.minX - minX) / cell); i <= Math.floor((e.maxX - minX) / cell); i++) cells[j * nx + i].push(e);
    }
  }
  grid = { cells, cell, minX, minY, nx, ny, stamp: 0 };
  edgeGrids.set(boundary, grid);
  return grid;
}

/** Calls `visit` on each edge whose box meets the given box, once each; stops when `visit` returns true. */
function someEdgeNear(boundary, x0, y0, x1, y1, visit) {
  const g = edgeGrid(boundary);
  if (!g.nx) return false;
  const i0 = Math.max(0, Math.floor((x0 - g.minX) / g.cell)), i1 = Math.min(g.nx - 1, Math.floor((x1 - g.minX) / g.cell));
  const j0 = Math.max(0, Math.floor((y0 - g.minY) / g.cell)), j1 = Math.min(g.ny - 1, Math.floor((y1 - g.minY) / g.cell));
  const stamp = ++g.stamp;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    for (const e of g.cells[j * g.nx + i]) {
      if (e.seen === stamp) continue;
      e.seen = stamp;
      if (e.maxX < x0 || e.minX > x1 || e.maxY < y0 || e.minY > y1) continue;
      if (visit(e)) return true;
    }
  }
  return false;
}

function cutsAlong(a, b, boundary) {
  const cuts = [0, 1], rx = b.x - a.x, ry = b.y - a.y;
  someEdgeNear(boundary, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), ({ a: p, b: q }) => {
    const sx = q.x - p.x, sy = q.y - p.y;
    const den = cross(rx, ry, sx, sy);
    if (Math.abs(den) < 1e-12) return false;
    const t = cross(p.x - a.x, p.y - a.y, sx, sy) / den, u = cross(p.x - a.x, p.y - a.y, rx, ry) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    return false;
  });
  return [...new Set(cuts)].sort((p, q) => p - q);
}

/** How far p is from the edge a–b. */
function edgeDistance(p, a, b) {
  const t = projection(p, a, b);
  return Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.y - (a.y + (b.y - a.y) * t));
}

export function safePoint(p, boundary, inset) {
  if (!boundary.contains(p.x, p.y)) {
    // outside, only a point on the outline itself counts, and only when no clearance is asked
    if (inset !== 0) return false;
    const r = 1e-7;
    if (!someEdgeNear(boundary, p.x - r, p.y - r, p.x + r, p.y + r, (e) => edgeDistance(p, e.a, e.b) <= r)) return false;
  }
  if (inset <= 0) return true;
  return !someEdgeNear(boundary, p.x - inset, p.y - inset, p.x + inset, p.y + inset, (e) => edgeDistance(p, e.a, e.b) < inset - 1e-8);
}

/** The point t of the way from a to b (x and y only: what safePoint reads). */
const along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function segmentInside(a, b, boundary, inset = 0) {
  const cuts = cutsAlong(a, b, boundary);
  for (let i = 1; i < cuts.length; i++) if (!safePoint(along(a, b, (cuts[i - 1] + cuts[i]) / 2), boundary, inset)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
  for (let i = 0; i <= n; i++) if (!safePoint(along(a, b, i / n), boundary, inset)) return false;
  return true;
}

/** Clip complete segments, retaining interpolated Z and a bead-radius inset around edges and holes. */
export function clipStrands(strands, boundary, inset = 0.225) {
  const out = [];
  for (const strand of strands) {
    let run = [], part = 0;
    const push = (p) => { const a = run.at(-1); if (!a || Math.hypot(a.x - p.x, a.y - p.y, a.z - p.z) > 1e-8) run.push(p); };
    const flush = () => { if (run.length > 1) { out.push({ ...strand, pauseBefore: !!strand.pauseBefore && part === 0, id: `${strand.id ?? 'strand'}-p${part++}`, pts: run }); } run = []; };
    for (let j = 1; j < strand.pts.length; j++) {
      const a = strand.pts[j - 1], b = strand.pts[j], cuts = cutsAlong(a, b, boundary);
      const clearance = inset * widthFactor(b);
      if (clearance === 0) {
        for (let c = 1; c < cuts.length; c++) {
          const lo = cuts[c - 1], hi = cuts[c];
          if (safePoint(mix(a, b, (lo + hi) / 2), boundary, 0)) { push(mix(a, b, lo)); push(mix(a, b, hi)); }
          else flush();
        }
        continue;
      }
      if (segmentInside(a, b, boundary, clearance)) { push(a); push(b); continue; }
      const ts = [0];
      for (let c = 1; c < cuts.length; c++) {
        const from = cuts[c - 1], to = cuts[c];
        const n = Math.max(2, Math.ceil((to - from) * Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
        for (let k = 1; k <= n; k++) ts.push(from + (to - from) * k / n);
      }
      let prev = mix(a, b, 0), was = safePoint(prev, boundary, clearance);
      if (was) push(prev);
      else flush(); // A new segment can require more clearance when its flow increases.
      for (let k = 1; k < ts.length; k++) {
        const p = mix(a, b, ts[k]), good = safePoint(p, boundary, clearance);
        if (was !== good) {
          let lo = ts[k - 1], hi = ts[k];
          for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; if (safePoint(mix(a, b, mid), boundary, clearance) === was) lo = mid; else hi = mid; }
          const edge = mix(a, b, good ? hi : lo);
          if (good) push(edge); else { push(edge); flush(); }
        }
        if (good) push(p);
        prev = p; was = good;
      }
    }
    flush();
  }
  return out;
}

/** Let an open pattern end finish on a printed border's centreline. Never continue through a hole or move a closed motif. */
export function finishAtPrintedBoundary(strands, boundary, bead = 0.45) {
  return strands.map((s) => {
    if (s.pts.length < 2) return s;
    const first = s.pts[0], last = s.pts.at(-1);
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) return s;
    const pts = [...s.pts];
    for (const [i, j] of [[0, 1], [pts.length - 1, pts.length - 2]]) {
      const p = pts[i], q = pts[j], length = Math.hypot(p.x - q.x, p.y - q.y);
      if (length < 1e-9) continue;
      let nearest = Infinity, nearestPoint = null, hit = null;
      const reach = 2 * bead, end = { ...p, x: p.x + (p.x - q.x) / length * reach, y: p.y + (p.y - q.y) / length * reach };
      for (const ring of boundary.rings ?? []) for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length], foot = mix(a, b, projection(p, a, b));
        const distance = Math.hypot(p.x - foot.x, p.y - foot.y);
        if (distance < nearest) { nearest = distance; nearestPoint = { ...p, x: foot.x, y: foot.y }; }
      }
      if (nearest > bead + 1e-7 || nearest < 1e-7) continue;
      for (const t of cutsAlong(p, end, boundary).slice(1)) {
        const candidate = mix(p, end, t);
        // cutsAlong includes the ray's far end; it is eligible only if it lies on an edge.
        if (safePoint(candidate, boundary, 0) && !safePoint(candidate, boundary, 1e-6) && segmentInside(p, candidate, boundary)) { hit = candidate; break; }
      }
      // At a glancing angle, a short finish into the border is better than a long sideways extension.
      if (!hit && nearestPoint && segmentInside(p, nearestPoint, boundary)) hit = nearestPoint;
      if (hit) pts[i] = hit;
    }
    return { ...s, pts };
  });
}

/** Short paired ties, wholly inside the outline. Separate SVG islands remain separate and are reported. */
export function connectStrands(strands, boundary, { strandWidth = 0.45, maxTie = 12 } = {}) {
  const graph = contactGraph(strands, { strandWidth, planar: true });
  if (graph.components <= 1) return { strands, ties: 0 };
  const samples = [];
  strands.forEach((s, si) => { let last = null; s.pts.forEach((p, i) => { if (!last || i === s.pts.length - 1 || Math.hypot(p.x - last.x, p.y - last.y) >= 0.8) { samples.push({ p, si, group: graph.labels[si] }); last = p; } }); });
  const cell = maxTie, grid = new Map(), candidates = new Map();
  for (const a of samples) {
    const x = Math.floor(a.p.x / cell), y = Math.floor(a.p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const b of grid.get(`${x + dx},${y + dy}`) ?? []) {
      if (a.group === b.group) continue;
      const d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
      if (d > maxTie || d < 1e-7) continue;
      const key = [a.group, b.group].sort((p, q) => p - q).join(':');
      const list = candidates.get(key) ?? [];
      if (list.length && d >= list.at(-1).d && list.length >= 8) continue;
      if (!segmentInside(a.p, b.p, boundary, strandWidth / 2)) continue;
      list.push({ a, b, d, key }); list.sort((p, q) => p.d - q.d); list.length = Math.min(list.length, 8); candidates.set(key, list);
    }
    const key = `${x},${y}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(a);
  }
  const parent = strands.map((_, i) => i), root = (i) => { while (parent[i] !== i) i = parent[i]; return i; };
  for (const group of graph.groups) for (const i of group) parent[i] = group[0];
  const ties = [];
  for (const c of [...candidates.values()].map((v) => v[0]).sort((a, b) => a.d - b.d)) {
    if (root(c.a.si) === root(c.b.si)) continue;
    parent[root(c.a.si)] = root(c.b.si);
    const pair = [c];
    const second = candidates.get(c.key).find((q) => Math.hypot(q.a.p.x - c.a.p.x, q.a.p.y - c.a.p.y) >= 1 && Math.hypot(q.b.p.x - c.b.p.x, q.b.p.y - c.b.p.y) >= 1);
    if (second) pair.push(second);
    for (const q of pair) {
      const n = Math.max(2, Math.ceil(q.d / 0.4));
      ties.push({ id: `tie-${ties.length + 1}`, kind: 'supported', layer: -1, name: 'Structural tie', pts: Array.from({ length: n + 1 }, (_, i) => ({ ...mix(q.a.p, q.b.p, i / n), flow: 1 })) });
    }
  }
  return { strands: [...strands, ...ties], ties: ties.length };
}

export function gridStrands(boundary, { spacing = 5, layerHeight = 0.2, inset = 0.225 } = {}) {
  const box = boundary.bbox(), strands = [];
  for (const [layer, axis] of ['x', 'y'].entries()) {
    const lo = axis === 'x' ? box.minX : box.minY, hi = axis === 'x' ? box.maxX : box.maxY;
    const count = Math.max(1, Math.floor((hi - lo - 2 * inset) / spacing) + 1), start = (lo + hi - (count - 1) * spacing) / 2;
    for (let k = 0; k < count; k++) for (const [a, b] of boundary.intervals(axis, start + k * spacing)) {
      if (b - a <= 2 * inset) continue;
      const from = a + inset, to = b - inset, n = Math.max(1, Math.ceil((to - from) / 0.5));
      strands.push({ id: `grid-${layer}-${k}-${strands.length}`, kind: layer ? 'supported' : 'base', layer, name: 'Crossed backing', pts: Array.from({ length: n + 1 }, (_, i) => {
        const u = from + (to - from) * (k % 2 ? 1 - i / n : i / n);
        return axis === 'x' ? { x: start + k * spacing, y: u, z: layerHeight * (layer + 1) } : { x: u, y: start + k * spacing, z: layerHeight * (layer + 1) };
      }) });
    }
  }
  return strands;
}

export function analyzeFabric(strands, { strandWidth = 0.45, layerHeight = 0.2, boundary = null, supportedAt = null } = {}) {
  const graph = contactGraph(strands, { strandWidth, layerHeight });
  const { found, arcs } = findCrossings(strands, { strandWidth });
  const pointAt = (si, arc) => {
    const list = arcs[si]; let lo = 0, hi = list.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (list[mid] <= arc) lo = mid; else hi = mid; }
    return mix(strands[si].pts[lo], strands[si].pts[hi], (arc - list[lo]) / Math.max(1e-12, list[hi] - list[lo]));
  };
  const zAt = (si, arc) => pointAt(si, arc).z;
  const supports = strands.map(() => []);
  let reversedCrossings = 0, separatedCrossings = 0;
  for (const c of found) {
    const dz = zAt(c.sb, c.arcB) - zAt(c.sa, c.arcA);
    if (dz < -0.02) reversedCrossings++;
    if (Math.abs(dz) > layerHeight + 0.04) separatedCrossings++;
    if (dz >= -0.02 && dz <= layerHeight + 0.04) supports[c.sb].push(c.arcB);
  }
  let longestUnsupported = 0, maxSlopeDeg = 0, outsideSegments = 0;
  strands.forEach((s, si) => {
    const marks = [...supports[si]];
    s.pts.forEach((p, i) => {
      if (p.z <= layerHeight + 0.04 || supportedAt?.(p)) marks.push(arcs[si][i]);
      if (i) {
        const a = s.pts[i - 1], d = Math.hypot(p.x - a.x, p.y - a.y);
        if (d > 1e-8) maxSlopeDeg = Math.max(maxSlopeDeg, Math.atan2(Math.abs(p.z - a.z), d) * 180 / Math.PI);
        // a strand marked onBoundary is the outline's own edge, drawn along the boundary it defines
        if (boundary && !s.onBoundary && !segmentInside(a, p, boundary)) outsideSegments++;
      }
    });
    marks.sort((a, b) => a - b);
    let prev = 0;
    const freeGap = (a, b) => {
      // A long segment lying on the bed is supported along its entire length.
      if (b <= a) return;
      const mid = pointAt(si, (a + b) / 2);
      if (mid.z > layerHeight + 0.04 && !supportedAt?.(mid)) longestUnsupported = Math.max(longestUnsupported, b - a);
    };
    for (const arc of marks) { freeGap(prev, arc); prev = arc; }
    freeGap(prev, arcs[si].at(-1) ?? 0);
  });
  const issues = [];
  if (graph.components > 1) issues.push(`${graph.components} separate fabric regions remain`);
  if (reversedCrossings) issues.push(`${reversedCrossings} crossings pass below an already printed strand`);
  if (maxSlopeDeg > 25.1) issues.push(`${maxSlopeDeg.toFixed(1)}° extrusion slope exceeds the 25° planning limit`);
  if (outsideSegments) issues.push(`${outsideSegments} extruded segments leave the outline`);
  return { components: graph.components, joints: graph.joints, reversedCrossings, separatedCrossings, longestUnsupported, maxSlopeDeg, outsideSegments, issues, exportable: strands.length > 0 && issues.length === 0, physicallyVerified: false };
}

/**
 * Layer precedence first; within a layer, bottom-left start and nearest endpoint/closed-loop seam. `improve` follows
 * the greedy order with a 2-opt and Or-opt pass over the travel moves (travel.js), for drawings with many strands.
 */
export function orderStrands(strands, { start = null, improve = false } = {}) {
  if (!strands.length) return [];
  let minX = Infinity, minY = Infinity;
  for (const s of strands) for (const p of s.pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }
  let at = start ?? { x: minX, y: minY };
  const groups = new Map();
  for (const s of strands) { const k = s.layer ?? 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const out = [];
  for (const layer of [...groups.keys()].sort((a, b) => a - b)) {
    const left = [...groups.get(layer)];
    const layerStart = at, layerFirst = out.length;
    let pause = left.some((s) => s.pauseBefore);
    const hadPause = pause;
    // lines laid row by row (orderLanePieces) keep that order and direction: an even texture matters more than travel
    if (left.every((s) => Number.isFinite(s.rowOrder))) {
      left.map((s, i) => [s, i]).sort((a, b) => a[0].rowOrder - b[0].rowOrder || a[1] - b[1]).forEach(([s], i) => out.push({ ...s, pauseBefore: pause && i === 0 }));
      at = out.at(-1)?.pts.at(-1) ?? at;
      continue;
    }
    while (left.length) {
      let best = Infinity, pick = 0, vertex = 0, reverse = false, closed = false;
      left.forEach((s, i) => {
        if (!s.pts.length) return;
        const a = s.pts[0], b = s.pts.at(-1), loop = Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
        // a closed loop may start at any vertex but its repeated last one, an open strand at either end (walked in
        // place: a list of the candidates for every strand at every pick was most of the time a packing of rings took)
        const last = s.pts.length - 1;
        for (let j = 0; loop ? j < last : j <= last; j = loop || j === last ? j + 1 : last) {
          const p = s.pts[j], d = Math.hypot(p.x - at.x, p.y - at.y);
          if (d < best - 1e-9) { best = d; pick = i; vertex = j; reverse = !loop && j > 0; closed = loop; }
        }
      });
      const s = left.splice(pick, 1)[0];
      let pts = s.pts;
      if (closed && vertex) { const ring = pts.slice(0, -1); pts = [...ring.slice(vertex), ...ring.slice(0, vertex), ring[vertex]]; }
      else if (reverse) pts = [...pts].reverse();
      out.push({ ...s, pts, pauseBefore: pause }); pause = false;
      at = pts.at(-1) ?? at;
    }
    if (improve && out.length - layerFirst > 2) {
      const better = improveTravel(out.splice(layerFirst), layerStart);
      better.forEach((s, i) => out.push({ ...s, pauseBefore: hadPause && i === 0 }));
      at = out.at(-1).pts.at(-1) ?? at;
    }
  }
  return out;
}

export function travelDistance(strands) {
  let d = 0;
  for (let i = 1; i < strands.length; i++) { const a = strands[i - 1].pts.at(-1), b = strands[i].pts[0]; if (a && b) d += Math.hypot(b.x - a.x, b.y - a.y); }
  return d;
}

/** Raised strands keep their shingle-order rows. Only loops may reverse; hairs must start at their anchors. */
export function orderPlacements(placements, { reverse = false } = {}) {
  const rows = new Map();
  for (const p of placements) { if (!rows.has(p.row)) rows.set(p.row, []); rows.get(p.row).push(p); }
  const out = []; let at = null;
  for (const row of [...rows.keys()].sort((a, b) => b - a)) {
    const left = [...rows.get(row)];
    while (left.length) {
      let pick = 0, flip = false, best = Infinity;
      left.forEach((p, i) => { for (const rev of reverse ? [false, true] : [false]) {
        const q = rev ? p.points.at(-1) : p.points[0], d = at ? Math.hypot(q.x - at.x, q.y - at.y) : q.x;
        if (d < best) { best = d; pick = i; flip = rev; }
      } });
      const p = left.splice(pick, 1)[0], points = flip ? [...p.points].reverse() : p.points;
      out.push({ ...p, points }); at = points.at(-1);
    }
  }
  return out;
}

/** Iterative 3D Douglas–Peucker, before crossing planning so exact joint knots are never simplified away. */
export function simplifyStrands(strands, tolerance = 0.02) {
  return strands.map((s) => {
    const pts = s.pts;
    if (pts.length < 3) return s;
    const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = 1;
    // where a strand's flow changes both ends of the change stay, or the thickness would be smeared along the line
    for (let i = 1; i < pts.length; i++) if ((pts[i].flow ?? 1) !== (pts[i - 1].flow ?? 1)) keep[i] = keep[i - 1] = 1;
    while (stack.length) {
      const [lo, hi] = stack.pop(), a = pts[lo], b = pts[hi], dx = b.x - a.x, dy = b.y - a.y, dz = (b.z ?? 0) - (a.z ?? 0), len = dx * dx + dy * dy + dz * dz;
      let best = tolerance * tolerance, at = -1;
      for (let i = lo + 1; i < hi; i++) {
        const p = pts[i], t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + ((p.z ?? 0) - (a.z ?? 0)) * dz) / Math.max(1e-20, len)));
        const d = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2 + ((p.z ?? 0) - (a.z ?? 0) - t * dz) ** 2;
        if (d > best) { best = d; at = i; }
      }
      if (at >= 0) { keep[at] = 1; stack.push([lo, at], [at, hi]); }
    }
    return { ...s, pts: pts.filter((_, i) => keep[i]) };
  });
}
