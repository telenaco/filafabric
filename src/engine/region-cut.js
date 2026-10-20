import { PolygonBoundary } from './boundary.js';
import { ConfigError } from './params.js';
import { windowRings } from './window.js';
import { polygonRegion } from './polygon-region.js';

/**
 * An outline with holes cut in it: the material of `boundary` less the union of the `openings` (rings in mm), cropped to
 * the boundary's box. Used for the blue shapes of a drawing that has no red one: they are holes in the page.
 * Overlapping or nested openings are one hole (an opening inside an opening does not put material back), and an
 * opening that matches one of the boundary's own islands removes that island.
 */

export const MAX_OPENINGS = 32;

const boxOf = (ring) => ring.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const distance = (p, ring) => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
};
const sameRing = (a, b) => {
  const ba = boxOf(a), bb = boxOf(b);
  if (Object.keys(ba).some((key) => Math.abs(ba[key] - bb[key]) > 1e-6)) return false;
  return a.every((p) => distance(p, b) < 1e-6) && b.every((p) => distance(p, a) < 1e-6);
};
const boxesOverlap = (a, b) => a.minX <= b.maxX + 1e-8 && a.maxX >= b.minX - 1e-8 && a.minY <= b.maxY + 1e-8 && a.maxY >= b.minY - 1e-8;

function cleanRing(raw) {
  let ring = raw;
  if (!Array.isArray(ring) || ring.length < 3 || ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new ConfigError(['A hole needs a finite closed contour.']);
  if (Math.hypot(ring[0].x - ring.at(-1).x, ring[0].y - ring.at(-1).y) < 1e-8) ring = ring.slice(0, -1);
  const box = boxOf(ring);
  if (box.maxX - box.minX < 1e-6 || box.maxY - box.minY < 1e-6) throw new ConfigError(['A hole must enclose an area.']);
  return ring;
}

// The boundary of outer minus the UNION of openings. Splitting edges at crossings and testing both sides also handles
// nested openings and existing garment holes, without even-odd islands in their overlaps.
function subtractUnion(boundary, openingRings, candidates) {
  const openings = openingRings.map((r) => new PolygonBoundary([r]));
  const material = (x, y) => boundary.contains(x, y) && !openings.some((b) => b.contains(x, y));
  const rings = polygonRegion(candidates, material);
  return rings.length ? new PolygonBoundary(rings) : new PolygonBoundary([candidates[0], candidates[0]]);
}

export function cutOpenings(boundary, openingRings) {
  if (!Array.isArray(openingRings) || openingRings.length > MAX_OPENINGS) throw new ConfigError([`Use at most ${MAX_OPENINGS} holes.`]);
  const box = boundary.bbox(), w = box.maxX - box.minX, h = box.maxY - box.minY;
  const outerRings = boundary.rings ?? [[{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }]];
  const rings = [...outerRings], openings = [];
  for (const raw of openingRings) {
    for (const local of windowRings([cleanRing(raw)], w, h, box.minX, box.minY)) {
      const ring = local.map((p) => ({ x: p.x + box.minX, y: p.y + box.minY }));
      openings.push(ring);
      const existing = rings.findIndex((r) => sameRing(r, ring));
      // only rings already excluded are duplicates: a garment outline may have several outer islands
      if (existing >= outerRings.length && existing >= 0) continue;
      if (existing >= 0) {
        const r = outerRings[existing], area = r.reduce((sum, p, i) => { const q = r[(i + 1) % r.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
        const hasMaterialInside = r.some((a, i) => {
          const b = r[(i + 1) % r.length], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
          if (len < 1e-12) return false;
          const sign = area >= 0 ? 1 : -1;
          return boundary.contains((a.x + b.x) / 2 - sign * dy / len * 1e-5, (a.y + b.y) / 2 + sign * dx / len * 1e-5);
        });
        if (!hasMaterialInside) continue;
      }
      rings.push(ring);
    }
  }
  const overlaps = openings.some((ring, i) => openings.slice(i + 1).some((other) => boxesOverlap(boxOf(ring), boxOf(other))))
    || openings.some((ring) => outerRings.slice(1).some((other) => !sameRing(ring, other) && boxesOverlap(boxOf(ring), boxOf(other))));
  if (overlaps) return subtractUnion(boundary, openings, [...outerRings, ...openings]);
  return new PolygonBoundary(rings);
}
