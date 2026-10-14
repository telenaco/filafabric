import { chainPolylines, clipPolyline, densify } from './layers.js';

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
      if (pts.length) pts.push(...densify([pts[pts.length - 1], top]).slice(1));
      else pts.push(top);
      // clockwise from the top, a full turn, so the ring closes on the point it started from
      const n = Math.max(12, Math.ceil((TAU * r) / 0.5));
      for (let i = 1; i <= n; i++) {
        const a = Math.PI / 2 - (TAU * i) / n;
        pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      }
    }
    polylines.push(...clipPolyline(pts, boundary));
  });
  return chainPolylines(polylines, boundary, 4 * r + 6);
}

/**
 * @param spacing  distance between neighbouring ring centres (mm)
 * @param ratio    ring diameter over spacing: 1 is tangent, larger overlaps (1.3 to 1.7 reads as mail)
 */
export function chainmailLayers(boundary, { spacing = 6, ratio = 1.5 } = {}) {
  const box = boundary.bbox();
  const r = (spacing * ratio) / 2;
  const a = lattice(box, spacing, box.minX, box.minY, r + spacing);
  const b = lattice(box, spacing, box.minX + spacing / 2, box.minY + (spacing * Math.sqrt(3)) / 6, r + spacing);
  return { layers: [ringRows(a, r, boundary), ringRows(b, r, boundary)], extra: { radius: r } };
}
