import { centredLanes } from './fill.js';
import { shapeAt } from './shapes.js';
import { chainPolylines, clipPolyline, densify } from './layers.js';

/**
 * Auxetic and honeycomb meshes from rows of zigzag.
 *
 * Layer 1 is rows of zigzag, each row the mirror of the one below it, so the gap between two rows swings between a
 * waist (`rowPitch - 2 * amplitude`) and a wide point (`rowPitch + 2 * amplitude`). Layer 2 is a set of staircases
 * that climb through the lattice: up a strut between two rows, along the next row for half a period, up the next
 * strut, back along the row, and so on, one strand per column.
 *
 * Struts at the waists make convex hexagons (an ordinary honeycomb). Struts at the wide points make bow-tie cells
 * with inward corners, a re-entrant honeycomb: pulled one way it widens the other way (an auxetic).
 */
export const CELLS = Object.freeze({
  hexagon: { label: 'Hexagon', hint: 'Struts at the waists: an ordinary honeycomb' },
  reentrant: { label: 'Re-entrant', hint: 'Struts at the wide points: bow-tie cells that widen when pulled' },
});
export const CELL_IDS = Object.freeze(Object.keys(CELLS));

/** The widest the zigzag can swing and still leave the strand width and a little more at the waist. */
export const maxAuxeticAmplitude = (rowPitch, strandWidth = 0.45) => Math.max(0.25, (rowPitch - 2 * strandWidth - 0.4) / 2);

export function auxeticLayers(boundary, { rowPitch = 6, period = 8, amplitude = 2, cell = 'hexagon' } = {}) {
  if (!CELLS[cell]) throw new Error(`Unknown auxetic cell: ${cell}`);
  const A = Math.min(amplitude, maxAuxeticAmplitude(rowPitch));
  const box = boundary.bbox();
  const x0 = box.minX;
  // keep the zigzag inside the swatch: rows start one amplitude in from the edges
  const lanes = centredLanes(box.minY + A + 0.3, box.maxY - A - 0.3, rowPitch);
  // the wave is a zigzag whose extremes sit at a quarter and three quarters of the period
  const wave = (x) => shapeAt('zigzag', x - x0, { pitch: period, size: A }).v;
  const rowY = (k, x) => lanes[k] + (k % 2 === 0 ? 1 : -1) * wave(x);
  const sample = (k, from, to) => {
    const n = Math.max(1, Math.ceil(Math.abs(to - from) / 0.5));
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = from + ((to - from) * i) / n;
      return { x, y: rowY(k, x) };
    });
  };

  // layer 1: every row across the swatch, alternate rows reversed, joined into serpentines where the shape allows
  const rows = [];
  lanes.forEach((_, k) => {
    for (const piece of clipPolyline(sample(k, box.minX, box.maxX), boundary)) rows.push(k % 2 === 0 ? piece : piece.slice().reverse());
  });
  const layer1 = chainPolylines(rows, boundary, 3 * rowPitch);

  // layer 2: staircases. Struts of the even gaps sit at `evenAt` (mod period); odd gaps half a period away.
  // Row 0 is at +A where the zigzag peaks (a quarter period), and that is where the gap above it is narrowest.
  const evenAt = x0 + (cell === 'hexagon' ? period / 4 : (3 * period) / 4);
  const stairs = [];
  if (lanes.length >= 2) {
    const first = Math.floor((box.minX - evenAt) / period) - 1;
    const last = Math.ceil((box.maxX - evenAt) / period) + 1;
    for (let n = first; n <= last; n++) {
      let x = evenAt + n * period;
      const pts = [{ x, y: rowY(0, x) }];
      for (let k = 0; k + 1 < lanes.length; k++) {
        pts.push({ x, y: rowY(k + 1, x) });
        const next = x + (k % 2 === 0 ? 1 : -1) * (period / 2);
        if (k + 2 < lanes.length) {
          pts.push(...sample(k + 1, x, next).slice(1));
          x = next;
        }
      }
      stairs.push(densify(pts));
    }
  }
  const layer2 = [];
  for (const s of stairs) layer2.push(...clipPolyline(s, boundary));
  return { layers: [layer1, layer2], extra: { amplitude: A, cell } };
}
