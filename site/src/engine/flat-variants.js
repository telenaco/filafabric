import { findCrossings } from './crossings.js';
import { fitPeriod, fitLanes } from './repeats.js';
import { centredLanes } from './fill.js';
import { shapeAt } from './shapes.js';
import { chainPolylines, clipPolyline, densify } from './layers.js';
import { maxAuxeticAmplitude } from './auxetic.js';

// Truly flat versions of designs that print as two layers: one print layer, no strand lifted over another. Where two strands
// meet they are joined in the plane (a designed joint, so the pipeline neither lifts one over the other nor counts a crossing).

/** Every point at the first layer height: a flat card is one layer, whatever the pipeline lifted at a crossing. */
export const onePlane = (strands, cfg) => strands.map((strand) => ({ ...strand, pts: strand.pts.map(({ cls, lifted, ...point }) => ({ ...point, z: cfg.t.layer_height })) }));

const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/**
 * Every place two strands (or a strand and itself) cross becomes a joint in the plane, and all the strands go into one layer.
 * @param layers  the layers of a two-layer design
 * @returns {Array[]} one layer holding every polyline, each carrying the joints it shares
 */
export function planarLayers(layers, { bead = 0.45 } = {}) {
  const polylines = layers.flat().filter((line) => line.length >= 2);
  const { found } = findCrossings(polylines.map((pts) => ({ pts })), { strandWidth: bead });
  found.forEach((crossing, n) => {
    const id = `flat:${n}`;
    for (const index of new Set([crossing.sa, crossing.sb])) (polylines[index].joints ??= []).push({ id, x: crossing.x, y: crossing.y });
  });
  const layer = polylines;
  layer.family = layers.family ?? layers.families?.[0];
  return [layer];
}

/** Join `strut` ends to the rows they touch, so the pipeline leaves them in one plane. */
function joinStruts(rows, struts, tag) {
  let n = 0;
  for (const strut of struts) {
    for (const end of [strut[0], strut.at(-1)]) {
      const id = `${tag}:${n++}`;
      let joined = false;
      for (const row of rows) {
        for (let i = 1; i < row.length && !joined; i++) {
          if (distanceToSegment(end, row[i - 1], row[i]) < 0.02) { (row.joints ??= []).push({ id, x: end.x, y: end.y }); joined = true; }
        }
        if (joined) break;
      }
      if (joined) (strut.joints ??= []).push({ id, x: end.x, y: end.y });
    }
  }
}

/**
 * The Re-entrant mesh and the Honeycomb with every strand in one layer: rows of zigzag, and a short strut between two rows wherever
 * the cell wants one (at the waists for hexagons, at the wide points for bow-ties). The struts end on the rows, so nothing crosses.
 */
export function auxeticFlatLayers(boundary, { rowPitch = 6, period = 8, amplitude = 2, cell = 'hexagon', whole = true } = {}) {
  const A = Math.min(amplitude, maxAuxeticAmplitude(rowPitch)), box = boundary.bbox(), x0 = box.minX;
  if (whole) period = fitPeriod(box.maxX - box.minX, period);
  const lanes = (whole ? fitLanes : centredLanes)(box.minY + A + 0.3, box.maxY - A - 0.3, rowPitch);
  const wave = (x) => shapeAt('zigzag', x - x0, { pitch: period, size: A }).v;
  const rowY = (k, x) => lanes[k] + (k % 2 === 0 ? 1 : -1) * wave(x);
  const xs = (() => {
    const n = Math.ceil((box.maxX - box.minX) / 0.5), set = new Set(Array.from({ length: n + 1 }, (_, i) => +(box.minX + ((box.maxX - box.minX) * i) / n).toFixed(6)));
    for (let v = x0 + period / 4 + Math.floor((box.minX - x0 - period / 4) / (period / 2)) * (period / 2); v <= box.maxX + 1e-9; v += period / 2) if (v >= box.minX - 1e-9) set.add(+v.toFixed(6));
    return [...set].sort((a, b) => a - b);
  })();
  const sample = (k) => xs.map((x) => ({ x, y: rowY(k, x) }));
  const rows = [];
  lanes.forEach((_, k) => { for (const piece of clipPolyline(sample(k), boundary)) rows.push(k % 2 === 0 ? piece : piece.slice().reverse()); });
  const chained = chainPolylines(rows, boundary, 3 * rowPitch);
  // the struts: the first gap's sit at `evenAt` (mod period), the next gap's half a period along, and so on up the sheet
  const evenAt = x0 + (cell === 'hexagon' ? period / 4 : (3 * period) / 4);
  const struts = [];
  for (let k = 0; k + 1 < lanes.length; k++) {
    const shift = (k % 2) * (period / 2), first = Math.floor((box.minX - evenAt - shift) / period) - 1, last = Math.ceil((box.maxX - evenAt - shift) / period) + 1;
    for (let n = first; n <= last; n++) {
      const x = evenAt + shift + n * period;
      for (const piece of clipPolyline(densify([{ x, y: rowY(k, x) }, { x, y: rowY(k + 1, x) }]), boundary)) {
        if (piece.length >= 2 && Math.hypot(piece.at(-1).x - piece[0].x, piece.at(-1).y - piece[0].y) > 0.6) struts.push(Object.assign(piece, { family: 'struts' }));
      }
    }
  }
  joinStruts(chained, struts, 'strut');
  const layer = [...chained, ...struts];
  layer.family = 'rows';
  return { layers: [layer], extra: { amplitude: A, cell, struts: struts.length, flat: true, transform: onePlane } };
}
