import { chainPolylines, clipPolyline, densify, appendPoints } from './layers.js';
import { fitCount } from './repeats.js';

/**
 * Ring mail: overlapping rings on a hexagonal lattice, a chainmail look, fused as one layer of rings and a second
 * layer of rings on the lattice shifted into the triangular gaps. Each ring of the second layer crosses three rings
 * of the first twice, so the layers hold each other with no straight run of strand.
 *
 * A row is printed ring by ring: round the ring from its top point and back, then straight along the line that is
 * tangent to the tops of the rings to the next top. Rows are joined into a serpentine.
 */
const TAU = Math.PI * 2;

/** Ring centres of a hexagonal lattice with rows `spacing * sqrt(3) / 2` apart, covering the box (and a ring beyond). */
function lattice(box, spacing, shiftX, shiftY, margin) {
  const rowH = (spacing * Math.sqrt(3)) / 2;
  const rows = [];
  const k0 = Math.floor((box.minY - margin - shiftY) / rowH) - 1;
  const k1 = Math.ceil((box.maxY + margin - shiftY) / rowH) + 1;
  for (let k = k0; k <= k1; k++) {
    const y = shiftY + k * rowH;
    const offset = (((k % 2) + 2) % 2) * (spacing / 2);
    const row = [];
    const n0 = Math.floor((box.minX - margin - shiftX - offset) / spacing) - 1;
    const n1 = Math.ceil((box.maxX + margin - shiftX - offset) / spacing) + 1;
    for (let n = n0; n <= n1; n++) row.push({ x: shiftX + offset + n * spacing, y });
    rows.push(row);
  }
  return rows;
}

function ringRows(rows, r, boundary) {
  const polylines = [];
  rows.forEach((row, k) => {
    const centres = k % 2 === 0 ? row : row.slice().reverse();
    const pts = [];
    for (const c of centres) {
      const top = { x: c.x, y: c.y + r };
      if (pts.length) appendPoints(pts, densify([pts[pts.length - 1], top]), 1);
      else pts.push(top);
      // clockwise from the top, a full turn, so the ring closes on the point it started from
      const n = Math.max(12, Math.ceil((TAU * r) / 0.5));
      for (let i = 1; i <= n; i++) {
        const a = Math.PI / 2 - (TAU * i) / n;
        pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      }
    }
    appendPoints(polylines, clipPolyline(pts, boundary));
  });
  return chainPolylines(polylines, boundary, 4 * r + 6);
}

/**
 * Whole rings only (repeats.js): the same hexagonal lattice, stretched a little so its outer rings touch the edges of
 * the box from inside, every ring whole. The second layer's rings sit in the triangular gaps between two rows of it,
 * so they are inside too: the edge is a row of whole rings, never a cut one.
 */
function wholeLattices(box, spacing, r) {
  const m = 0.3;
  const x0 = box.minX + r + m, x1 = box.maxX - r - m;
  const y0 = box.minY + r + m, y1 = box.maxY - r - m;
  const cols = fitCount(x1 - x0, spacing), sx = x1 > x0 ? (x1 - x0) / cols : 0;
  const rowsN = fitCount(y1 - y0, (spacing * Math.sqrt(3)) / 2), sy = y1 > y0 ? (y1 - y0) / rowsN : 0;
  const rowOf = (y, shifted) => (shifted
    ? Array.from({ length: cols }, (_, i) => ({ x: x0 + sx * (i + 0.5), y }))
    : Array.from({ length: cols + 1 }, (_, i) => ({ x: x0 + sx * i, y })));
  const a = [], b = [];
  for (let j = 0; j <= rowsN; j++) {
    a.push(rowOf(y0 + sy * j, j % 2 === 1));
    // a gap between row j and the next holds the rings of the second layer, a third of the way up
    if (j < rowsN) b.push(rowOf(y0 + sy * (j + 1 / 3), j % 2 === 0));
  }
  return { a, b };
}

/**
 * @param spacing  distance between neighbouring ring centres (mm)
 * @param ratio    ring diameter over spacing: 1 is tangent, larger overlaps (1.3 to 1.7 reads as mail)
 * @param whole    every ring whole, the lattice fitted to the box (otherwise a lattice from the corner, cut at the edges)
 */
export function chainmailLayers(boundary, { spacing = 6, ratio = 1.5, whole = true } = {}) {
  const box = boundary.bbox();
  const r = (spacing * ratio) / 2;
  if (whole && box.maxX - box.minX > 2 * r + 0.6 && box.maxY - box.minY > 2 * r + 0.6) {
    const { a, b } = wholeLattices(box, spacing, r);
    return { layers: [ringRows(a, r, boundary), ringRows(b, r, boundary)], extra: { radius: r } };
  }
  const a = lattice(box, spacing, box.minX, box.minY, r + spacing);
  const b = lattice(box, spacing, box.minX + spacing / 2, box.minY + (spacing * Math.sqrt(3)) / 6, r + spacing);
  return { layers: [ringRows(a, r, boundary), ringRows(b, r, boundary)], extra: { radius: r } };
}
