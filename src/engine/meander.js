import { hatch, clipPolyline } from './layers.js';

/**
 * Meanders: a space-filling curve (Hilbert or Peano) as one continuous strand that never crosses itself, and an
 * independent hatch across it at an angle as the second layer. The curve folds back and forth, so it stretches by
 * unfolding (hidden slack) and reads as lace; the hatch crosses every fold so no stretch of curve goes unheld.
 */
export const CURVES = Object.freeze({
  hilbert: { label: 'Hilbert', hint: 'Tight folds of 90°, in a square grid of 2ⁿ cells' },
  peano: { label: 'Peano', hint: 'Long serpentines of 3 x 3 cells, in a grid of 3ⁿ' },
});
export const CURVE_IDS = Object.freeze(Object.keys(CURVES));

/** The Hilbert curve of order n as grid cells (i, j) in 0..2ⁿ-1, in visiting order. */
export function hilbertCells(order) {
  const n = 1 << order;
  const cells = [];
  for (let d = 0; d < n * n; d++) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t >> 1);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t >>= 2;
    }
    cells.push({ x, y });
  }
  return cells;
}

/** The Peano curve of order n as grid cells in 0..3ⁿ-1, in visiting order. */
export function peanoCells(order) {
  if (order === 0) return [{ x: 0, y: 0 }];
  const sub = peanoCells(order - 1);
  const m = 3 ** (order - 1);
  const out = [];
  for (let bx = 0; bx < 3; bx++) {
    for (let k = 0; k < 3; k++) {
      const by = bx % 2 === 0 ? k : 2 - k;
      for (const c of sub) {
        const x = by % 2 === 1 ? m - 1 - c.x : c.x; // reflected across x in odd rows of blocks
        const y = bx % 2 === 1 ? m - 1 - c.y : c.y; // reflected across y in odd columns
        out.push({ x: bx * m + x, y: by * m + y });
      }
    }
  }
  return out;
}

/** One round of Chaikin corner cutting on an open polyline (the ends stay put). */
function chaikin(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (i > 1) out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    if (i < pts.length - 1) out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The order that makes the cells about `cell` mm across over the larger side. */
export function curveOrder(curve, size, cell) {
  const base = curve === 'peano' ? 3 : 2;
  return Math.max(1, Math.min(curve === 'peano' ? 4 : 6, Math.round(Math.log(Math.max(size / cell, base)) / Math.log(base))));
}

/**
 * @param curve    'hilbert' | 'peano'
 * @param cell     target cell size in mm (the curve's strand spacing)
 * @param angle    angle of the second layer's hatch, degrees
 * @param spacing  spacing of the hatch, mm
 */
export function meanderLayers(boundary, { curve = 'hilbert', cell = 6, angle = 45, spacing = 5 } = {}) {
  if (!CURVES[curve]) throw new Error(`Unknown meander curve: ${curve}`);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const order = curveOrder(curve, Math.max(w, h), cell);
  const cells = curve === 'peano' ? peanoCells(order) : hilbertCells(order);
  const n = curve === 'peano' ? 3 ** order : 1 << order;
  let pts = cells.map((c) => ({ x: box.minX + ((c.x + 0.5) * w) / n, y: box.minY + ((c.y + 0.5) * h) / n }));
  // round the corners so the strand turns instead of stopping dead
  pts = chaikin(chaikin(pts));
  const layer1 = clipPolyline(pts, boundary);
  const layer2 = hatch(boundary, { angle, spacing });
  return { layers: [layer1, layer2], extra: { order, cells: n } };
}
