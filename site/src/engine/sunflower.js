import { clipPolyline, chainPolylines, densify, trailsFromEdges } from './layers.js';
import { ConfigError } from './params.js';
import { solidHub } from './hub.js';

/**
 * Sunflower: seeds placed the way a sunflower places them (Vogel's model: seed n at radius c·√n, turned by the
 * golden angle each time), so they are spread evenly at every radius. Each seed's nearest neighbours lie along two
 * families of spirals (parastichies), one turning each way, numbered by consecutive Fibonacci numbers (8 and 13, 13
 * and 21, ...). The first layer joins every seed to its neighbour along the spirals that turn one way, the second
 * along those that turn the other way, so both layers pass through every seed and cross there. Towards the edge the
 * spirals split into the next Fibonacci number, as they do in the flower, so the cells stay the same size.
 *
 * The centre is closed, the way the spiderweb's is: a small flat spiral (a solid hub, hub.js) fills it and is the start
 * of the line that reaches furthest in, and the seeds the hub covers are not drawn. The seed at the very centre stays
 * when the hub is smaller than a cell, so both families of spirals start from the same place. `hubStyle: 'open'` leaves
 * a hole the size of `hub` instead.
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
export const MAX_SEEDS = 12000;

/**
 * @param spacing      mm between neighbouring seeds
 * @param hub          radius of the centre, mm: filled with a solid hub, or left open (the spirals start outside it)
 * @param hubStyle     'solid' (default) or 'open'
 * @param strandWidth  the bead's width, mm: the pitch of the solid hub
 */
export function sunflowerLayers(boundary, { spacing = 4, hub = 0.6, hubStyle = 'solid', strandWidth = 0.45 } = {}) {
  hub = Math.max(0, hub);
  const solid = hubStyle !== 'open';
  const box = boundary.bbox();
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const R = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + spacing;
  // each seed holds pi·c² of area; a hexagonal cell of that area has neighbours about 1.9·c apart
  const c = spacing / 1.905;
  const total = Math.ceil((R / c) ** 2);
  if (total > MAX_SEEDS) throw new ConfigError([`This would need about ${total} seeds; the limit is ${MAX_SEEDS}. Use a larger spacing or a smaller swatch.`]);
  // open: the spirals start at the first seed outside the hole. solid: the hub covers the seeds inside it, and the seed
  // at the centre stays while the hub is smaller than one cell, so both families start from the same place
  const first = solid ? Math.floor((hub / c) ** 2 + 1e-9) : Math.ceil((hub / c) ** 2);
  const seeds = [];
  for (let n = 0; n < total; n++) {
    const r = c * Math.sqrt(n), a = n * GOLDEN;
    seeds.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }

  // join each seed to its two nearest Fibonacci neighbours further out: consecutive Fibonacci numbers, and so
  // spirals that turn opposite ways; the parity of the Fibonacci index says which way, and so which layer
  const edges = [[], []];
  const seen = new Set();
  for (let n = first; n < total; n++) {
    const options = [];
    FIB.forEach((f, i) => {
      if (n + f < total) options.push({ i, m: n + f, d: Math.hypot(seeds[n + f].x - seeds[n].x, seeds[n + f].y - seeds[n].y) });
    });
    options.sort((p, q) => p.d - q.d);
    for (const o of options.slice(0, 2)) {
      const key = `${n}-${o.m}`;
      if (seen.has(key) || o.d > 2.2 * spacing) continue;
      seen.add(key);
      edges[o.i % 2].push([seeds[n], seeds[o.m]]);
    }
  }

  const trails = edges.map((list) => trailsFromEdges(list.map((e) => densify(e))));

  if (solid && hub > 0) {
    // the line that reaches furthest in starts from the hub: it begins at the centre, winds out to the hub's radius and
    // goes on along the line's own course, so the core is part of a strand and nothing has to be tied on
    let best = null;
    trails.forEach((layer, k) => layer.forEach((pts, i) => {
      for (const end of [0, pts.length - 1]) {
        const d = Math.hypot(pts[end].x - cx, pts[end].y - cy);
        if (!best || d < best.d) best = { k, i, end, d };
      }
    }));
    if (best && best.d <= hub + 2.2 * spacing) {
      const pts = trails[best.k][best.i];
      let rest = best.end === 0 ? pts : [...pts].reverse();
      // what lies inside the hub is covered by it
      while (rest.length > 2 && Math.hypot(rest[0].x - cx, rest[0].y - cy) < hub) rest = rest.slice(1);
      const reach = Math.hypot(rest[0].x - cx, rest[0].y - cy);
      const angle = Math.atan2(rest[0].y - cy, rest[0].x - cx);
      trails[best.k][best.i] = [...solidHub({ x: cx, y: cy }, Math.min(hub, reach), strandWidth, angle), ...rest];
    }
  }

  const layers = trails.map((list) => {
    const pieces = list.flatMap((t) => clipPolyline(t, boundary));
    return chainPolylines(pieces, boundary, 1.5 * spacing);
  });
  return { layers, extra: { seeds: total - first, hub, hubStyle: solid ? 'solid' : 'open' } };
}
