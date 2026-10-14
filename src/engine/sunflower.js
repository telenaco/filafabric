import { clipPolyline, chainPolylines, densify, trailsFromEdges } from './layers.js';
import { ConfigError } from './params.js';

/**
 * Sunflower: seeds placed the way a sunflower places them (Vogel's model: seed n at radius c·√n, turned by the
 * golden angle each time), so they are spread evenly at every radius. Each seed's nearest neighbours lie along two
 * families of spirals (parastichies), one turning each way, numbered by consecutive Fibonacci numbers (8 and 13, 13
 * and 21, ...). The first layer joins every seed to its neighbour along the spirals that turn one way, the second
 * along those that turn the other way, so both layers pass through every seed and cross there. Towards the edge the
 * spirals split into the next Fibonacci number, as they do in the flower, so the cells stay the same size.
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
export const MAX_SEEDS = 12000;

/**
 * @param spacing  mm between neighbouring seeds
 * @param hub      radius of the open centre, mm (the spirals start there)
 */
export function sunflowerLayers(boundary, { spacing = 4, hub = 3 } = {}) {
  const box = boundary.bbox();
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const R = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + spacing;
  // each seed holds pi·c² of area; a hexagonal cell of that area has neighbours about 1.9·c apart
  const c = spacing / 1.905;
  const total = Math.ceil((R / c) ** 2);
  if (total > MAX_SEEDS) throw new ConfigError([`This would need about ${total} seeds; the limit is ${MAX_SEEDS}. Use a larger spacing or a smaller swatch.`]);
  const first = Math.ceil((hub / c) ** 2);
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

  const layers = edges.map((list) => {
    const trails = trailsFromEdges(list.map((e) => densify(e)));
    const pieces = trails.flatMap((t) => clipPolyline(t, boundary));
    return chainPolylines(pieces, boundary, 1.5 * spacing);
  });
  return { layers, extra: { seeds: total - first } };
}
