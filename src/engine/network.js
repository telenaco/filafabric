// Lines that meet are one network, and a network can be printed in far fewer strokes than it has lines.
//
// Every stroke of a drawing costs a retract, a lift, a travel and a drop (travel.js joins strokes that merely touch end
// to end). Strokes that meet at a T or cross each other form a graph, and graph theory says how few strokes that graph
// needs if no edge is printed twice: a connected piece whose lines meet in 2k places of odd count needs exactly k
// strokes (one if every junction is even), the open Eulerian trail decomposition of the rural postman problem. This
// builds the graph, finds those strokes with Hierholzer's algorithm, and hands back the same lines, printed once each.
//
//   1. split every line where another meets or crosses it (a grid finds the candidates);
//   2. nodes are line ends and those split points, merged within `snap`; edges are the pieces between nodes;
//   3. per connected piece, pair the odd nodes by greedy nearest neighbour, add a dummy edge for every pair but one,
//      walk one Eulerian path with Hierholzer, and cut it at the dummy edges: the strokes.
//
// A line end that lies within `bridge` of another line, but does not quite touch it, is joined to it by a short step
// that `allow` has approved (the studio passes "stays inside the outline"). Only flat, plain strands take part, so a
// raised or flow-carrying strand is never rebuilt.

const EPS = 1e-9;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

function plain(s) {
  if (s.name === 'Structural tie' || (s.layer ?? 0) < 0 || s.pts.length < 2) return false;
  const z = s.pts[0].z ?? 0;
  return s.pts.every((p) => p.cls === undefined && p.flow === undefined && Math.abs((p.z ?? 0) - z) < 1e-6);
}

/** The point of segment a-b nearest to p: { x, y, t, d }. */
function foot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
}

/** Where segments p-q and r-s cross in their interiors (or one's end touches the other's interior): { t, u } or null. */
function crossing(p, q, r, s) {
  const rx = q.x - p.x, ry = q.y - p.y, sx = s.x - r.x, sy = s.y - r.y, den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) return null;
  const qx = r.x - p.x, qy = r.y - p.y;
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? { t, u } : null;
}

/**
 * Rebuilds one group of strands (one layer and kind) as the fewest strokes of its network.
 * @returns the strands, or null when the group is too big to treat (the caller keeps the original)
 */
function network(input, { snap, bridge, allow, maxSegments, maxOdd }) {
  // a point repeated is a segment of no length: it is dropped
  const group = input.map((s) => ({ ...s, pts: s.pts.filter((p, i) => i === 0 || dist(p, s.pts[i - 1]) > 1e-9) })).filter((s) => s.pts.length >= 2);
  const segments = [];
  group.forEach((s, si) => { for (let j = 1; j < s.pts.length; j++) segments.push({ si, j, a: s.pts[j - 1], b: s.pts[j] }); });
  if (segments.length > maxSegments) return null;

  // a grid of the segments, to find what could meet what
  const cell = 2;
  const grid = new Map();
  const cellsOf = (a, b, pad) => {
    const x0 = Math.floor((Math.min(a.x, b.x) - pad) / cell), x1 = Math.floor((Math.max(a.x, b.x) + pad) / cell);
    const y0 = Math.floor((Math.min(a.y, b.y) - pad) / cell), y1 = Math.floor((Math.max(a.y, b.y) + pad) / cell);
    const out = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${x},${y}`);
    return out;
  };
  segments.forEach((seg, k) => { for (const key of cellsOf(seg.a, seg.b, 0)) { if (!grid.has(key)) grid.set(key, []); grid.get(key).push(k); } });

  const closed = group.map((s) => dist(s.pts[0], s.pts.at(-1)) < snap);
  const cuts = new Map(); // `${si}:${j}` -> [{ t, x, y }]
  const addCut = (si, j, t, x, y) => {
    const key = `${si}:${j}`;
    if (!cuts.has(key)) cuts.set(key, []);
    cuts.get(key).push({ t, x, y });
  };
  const bridges = [];
  // a vertex inside a line where another line meets it is a node too
  const marks = new Set();
  const mark = (si, index) => { if (index > 0 && index < group[si].pts.length - 1) marks.add(`${si}:${index}`); };
  const adjacent = (p, q) => {
    if (p.si !== q.si) return false;
    const n = group[p.si].pts.length - 1;
    return Math.abs(p.j - q.j) <= 1 || (closed[p.si] && Math.abs(p.j - q.j) === n - 1);
  };

  // crossings and touches between segments
  segments.forEach((p, i) => {
    const seen = new Set();
    for (const key of cellsOf(p.a, p.b, 0)) {
      for (const k of grid.get(key) ?? []) {
        if (k <= i || seen.has(k)) continue;
        seen.add(k);
        const q = segments[k];
        if (adjacent(p, q)) continue;
        const hit = crossing(p.a, p.b, q.a, q.b);
        if (!hit) continue;
        const x = p.a.x + (p.b.x - p.a.x) * hit.t, y = p.a.y + (p.b.y - p.a.y) * hit.t;
        if (hit.t > 1e-7 && hit.t < 1 - 1e-7) addCut(p.si, p.j, hit.t, x, y);
        else mark(p.si, hit.t <= 1e-7 ? p.j - 1 : p.j);
        if (hit.u > 1e-7 && hit.u < 1 - 1e-7) addCut(q.si, q.j, hit.u, x, y);
        else mark(q.si, hit.u <= 1e-7 ? q.j - 1 : q.j);
      }
    }
  });

  // line ends that touch, or nearly touch, the side of another line
  const reach = Math.max(snap, bridge);
  group.forEach((s, si) => {
    if (closed[si]) return;
    for (const end of [0, s.pts.length - 1]) {
      const p = s.pts[end];
      let best = null;
      const seen = new Set();
      for (const key of cellsOf(p, p, reach)) {
        for (const k of grid.get(key) ?? []) {
          if (seen.has(k)) continue;
          seen.add(k);
          const q = segments[k];
          if (q.si === si && (end === 0 ? q.j <= 2 : q.j >= s.pts.length - 3)) continue; // its own neighbouring segments
          const f = foot(p, q.a, q.b);
          if (f.d <= reach && (!best || f.d < best.d)) best = { ...f, si: q.si, j: q.j };
        }
      }
      if (!best) continue;
      const vertex = best.t <= 1e-7 ? best.j - 1 : best.t >= 1 - 1e-7 ? best.j : -1;
      const join = () => (vertex >= 0 ? mark(best.si, vertex) : addCut(best.si, best.j, best.t, best.x, best.y));
      if (best.d <= snap) join();
      else if (bridge > 0 && (!allow || allow(p, best))) {
        join();
        bridges.push({ si, from: p, to: { x: best.x, y: best.y, z: p.z } });
      }
    }
  });

  // nodes: line ends and cuts, merged within snap
  const nodes = [], nodeGrid = new Map();
  const nodeAt = (x, y) => {
    const cx = Math.floor(x / snap), cy = Math.floor(y / snap);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const id of nodeGrid.get(`${cx + dx},${cy + dy}`) ?? []) if (Math.hypot(nodes[id].x - x, nodes[id].y - y) <= snap) return id;
    }
    const id = nodes.length;
    nodes.push({ x, y });
    const key = `${cx},${cy}`;
    if (!nodeGrid.has(key)) nodeGrid.set(key, []);
    nodeGrid.get(key).push(id);
    return id;
  };

  // edges: the pieces of every line between nodes
  const edges = [];
  const addEdge = (a, b, pts, si, dummy = false) => edges.push({ a, b, pts, si, dummy, used: false });
  group.forEach((s, si) => {
    let piece = [{ ...s.pts[0] }];
    let from = nodeAt(s.pts[0].x, s.pts[0].y);
    for (let j = 1; j < s.pts.length; j++) {
      const a = s.pts[j - 1], b = s.pts[j], z = a.z ?? 0;
      for (const c of (cuts.get(`${si}:${j}`) ?? []).sort((p, q) => p.t - q.t)) {
        const here = { x: c.x, y: c.y, z };
        const node = nodeAt(c.x, c.y);
        if (node === from && piece.length === 1) continue;
        piece.push(here);
        addEdge(from, node, piece, si);
        piece = [{ ...here }];
        from = node;
      }
      piece.push({ ...b });
      if (marks.has(`${si}:${j}`)) {
        const node = nodeAt(b.x, b.y);
        addEdge(from, node, piece, si);
        piece = [{ ...b }];
        from = node;
      }
      if (j === s.pts.length - 1) {
        const node = nodeAt(b.x, b.y);
        addEdge(from, node, piece, si);
      }
    }
  });
  for (const br of bridges) addEdge(nodeAt(br.from.x, br.from.y), nodeAt(br.to.x, br.to.y), [{ ...br.from }, br.to], br.si);

  // the graph, piece by piece
  const adj = nodes.map(() => []);
  edges.forEach((e, id) => { adj[e.a].push(id); adj[e.b].push(id); });
  const componentOf = new Int32Array(nodes.length).fill(-1);
  const components = [];
  for (let n = 0; n < nodes.length; n++) {
    if (componentOf[n] >= 0 || !adj[n].length) continue;
    const members = [n];
    componentOf[n] = components.length;
    for (let k = 0; k < members.length; k++) {
      for (const id of adj[members[k]]) {
        const e = edges[id];
        for (const m of [e.a, e.b]) if (componentOf[m] < 0) { componentOf[m] = components.length; members.push(m); }
      }
    }
    components.push(members);
  }

  const strokes = [];
  for (const members of components) {
    const odd = members.filter((n) => adj[n].length % 2 === 1);
    if (odd.length > maxOdd) return null;
    // pair the odd nodes: each pair but the last becomes a dummy edge, a jump between two strokes
    const left = new Set(odd), pairs = [];
    while (left.size > 1) {
      const [u] = left;
      left.delete(u);
      let best = -1, bestD = Infinity;
      for (const v of left) { const d = dist(nodes[u], nodes[v]); if (d < bestD) { bestD = d; best = v; } }
      left.delete(best);
      pairs.push([u, best]);
    }
    const dummies = [];
    for (const [u, v] of pairs.slice(0, -1)) {
      const id = edges.length;
      addEdge(u, v, [{ ...nodes[u], z: 0 }, { ...nodes[v], z: 0 }], -1, true);
      adj[u].push(id); adj[v].push(id);
      dummies.push(id);
    }
    // an Eulerian path from one of the two odd nodes left (or any node when there are none), by Hierholzer
    const start = pairs.length ? pairs.at(-1)[0] : members.reduce((best, n) => (nodes[n].x + nodes[n].y < nodes[best].x + nodes[best].y ? n : best), members[0]);
    const next = new Map();
    const stack = [{ node: start, via: -1, from: -1 }], walk = [];
    while (stack.length) {
      const top = stack.at(-1), list = adj[top.node];
      let p = next.get(top.node) ?? 0;
      while (p < list.length && edges[list[p]].used) p++;
      next.set(top.node, p);
      if (p === list.length) {
        stack.pop();
        if (top.via >= 0) walk.push(top);
      } else {
        const id = list[p], e = edges[id];
        e.used = true;
        stack.push({ node: e.a === top.node ? e.b : e.a, via: id, from: top.node });
      }
    }
    walk.reverse();
    // cut the path at its dummy edges: those are the jumps, and what lies between them is a stroke
    let current = null;
    const flush = () => { if (current && current.pts.length > 1) strokes.push(current); current = null; };
    for (const step of walk) {
      const e = edges[step.via];
      if (e.dummy) { flush(); continue; }
      const pts = e.a === step.from ? e.pts : [...e.pts].reverse();
      if (!current) current = { si: e.si, pts: pts.map((p) => ({ ...p })) };
      else current.pts.push(...pts.slice(dist(current.pts.at(-1), pts[0]) < snap * 2 ? 1 : 0).map((p) => ({ ...p })));
    }
    flush();
  }
  return strokes.map((stroke, k) => ({ ...group[stroke.si], id: `${group[stroke.si].id}-n${k}`, pts: stroke.pts }));
}

/**
 * The strands of a drawing as the fewest strokes their network allows, with every line printed exactly once.
 * @param within  (bridge) a line end this near another line is joined to it, if `allow` says the step may be printed
 * @returns the strands: the plain ones rebuilt, anything else (and a group too large to treat) as it was
 */
export function joinNetwork(strands, { snap = 0.05, within = 0, allow = null, maxSegments = 40000, maxOdd = 4000 } = {}) {
  if (strands.length < 2) return strands;
  const groups = new Map(), rest = [];
  for (const s of strands) {
    if (!plain(s)) { rest.push(s); continue; }
    // what must not be mixed: another layer, kind or name, or a different standing against the outline
    const key = `${s.layer ?? 0}|${s.kind}|${s.name ?? ''}|${!!s.onBoundary}|${!!s.shape}|${!!s.fixed}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const out = [...rest];
  for (const group of groups.values()) {
    const built = group.length > 1 ? network(group, { snap, bridge: within, allow, maxSegments, maxOdd }) : null;
    if (!built) { out.push(...group); continue; }
    const pause = group.some((s) => s.pauseBefore);
    built.forEach((s, i) => out.push(pause ? { ...s, pauseBefore: i === 0 } : { ...s, pauseBefore: false }));
  }
  return out;
}
