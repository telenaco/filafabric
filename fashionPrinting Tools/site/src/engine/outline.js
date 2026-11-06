// Outline geometry: turns rings traced from an SVG into a shape that fills a width x height swatch.
// Pure functions on rings of { x, y }; the SVG itself is read in the browser (src/ui/svg-outline.js).

const bboxOf = (rings) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};

function perpendicular(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function simplifyOpen(points, tolerance) {
  if (points.length <= 2) return points;
  let index = 0, max = 0;
  const a = points[0], b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicular(points[i], a, b);
    if (d > max) { max = d; index = i; }
  }
  if (max <= tolerance) return [a, b];
  const left = simplifyOpen(points.slice(0, index + 1), tolerance);
  const right = simplifyOpen(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Ramer-Douglas-Peucker for a closed ring: drops points that sit within `tolerance` of the line through their neighbours. */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring;
  // split at the point farthest from the first one, so the closed ring keeps its extremes
  let far = 0, best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y);
    if (d > best) { best = d; far = i; }
  }
  const first = simplifyOpen(ring.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...ring.slice(far), ring[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** Area of a ring (shoelace), sign ignored. */
export function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  return Math.abs(a) / 2;
}

/**
 * Rings traced in SVG coordinates (y pointing down) -> rings in a unit box (y pointing up, the long side 1),
 * simplified, with specks smaller than `minAreaFraction` of the whole removed.
 */
export function normalizeRings(rings, { tolerance = 0.0015, minAreaFraction = 0.0005 } = {}) {
  const flipped = rings.filter((r) => r.length >= 3).map((r) => r.map((p) => ({ x: p.x, y: -p.y })));
  if (flipped.length === 0) throw new Error('The SVG has no closed shapes to use as an outline');
  // drop specks first, so a stray dot cannot stretch the box the shape is fitted to
  const total = flipped.reduce((sum, r) => sum + ringArea(r), 0);
  const kept = flipped.filter((r) => ringArea(r) > 0 && ringArea(r) >= minAreaFraction * total);
  if (kept.length === 0) throw new Error('The SVG outline is too thin to fill');
  const box = bboxOf(kept);
  const size = Math.max(box.w, box.h);
  if (!(size > 0)) throw new Error('The SVG outline has no size');
  const unit = kept.map((r) => r.map((p) => ({ x: (p.x - box.minX) / size, y: (p.y - box.minY) / size })));
  return unit.map((r) => simplifyRing(r, tolerance)).filter((r) => r.length >= 3);
}

/** Rotates rings by `degrees` (counter-clockwise) about their box centre. */
export function rotateRings(rings, degrees) {
  if (!degrees) return rings;
  const box = bboxOf(rings);
  const cx = box.minX + box.w / 2, cy = box.minY + box.h / 2;
  const th = (degrees * Math.PI) / 180;
  const c = Math.cos(th), s = Math.sin(th);
  return rings.map((r) => r.map((p) => ({ x: cx + c * (p.x - cx) - s * (p.y - cy), y: cy + s * (p.x - cx) + c * (p.y - cy) })));
}

/** Width / height of the rings' bounding box. */
export function ringsAspect(rings) {
  const box = bboxOf(rings);
  return box.h > 0 ? box.w / box.h : 1;
}

/** Scales rings to fit inside a width x height swatch (keeping their proportions) and centres them, in mm. */
export function fitRings(rings, width, height) {
  const box = bboxOf(rings);
  const scale = Math.min(width / box.w, height / box.h);
  const ox = (width - box.w * scale) / 2 - box.minX * scale;
  const oy = (height - box.h * scale) / 2 - box.minY * scale;
  return rings.map((r) => r.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy })));
}

/** The outline as it will print: rotated, then fitted into the swatch. */
export function placeOutline(rings, { rotation = 0, width, height }) {
  return fitRings(rotateRings(rings, rotation), width, height);
}

/** Flat [x0, y0, x1, y1, ...] arrays (compact, for links and files) <-> rings of { x, y }. */
export const flattenRings = (rings, digits = 4) => rings.map((r) => r.flatMap((p) => [Number(p.x.toFixed(digits)), Number(p.y.toFixed(digits))]));
export const unflattenRings = (flat) => flat.map((r) => {
  const ring = [];
  for (let i = 0; i + 1 < r.length; i += 2) ring.push({ x: r[i], y: r[i + 1] });
  return ring;
});
