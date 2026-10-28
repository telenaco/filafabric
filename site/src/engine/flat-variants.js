import { findCrossings } from './crossings.js';
import { fitPeriod, fitLanes } from './repeats.js';
import { centredLanes } from './fill.js';
import { shapeAt } from './shapes.js';
import { chainPolylines, clipPolyline, densify, markRowOrder } from './layers.js';
import { maxAuxeticAmplitude } from './auxetic.js';
import { joinNetwork } from './network.js';

// Truly flat versions of designs that print as two layers: one print layer, no strand lifted over another. Where two strands
// meet they are joined in the plane (a designed joint, so the pipeline neither lifts one over the other nor counts a crossing).

/**
 * For strands already built (a card's transform hook): every point at the first layer height, and every place two strands meet
 * joined there, so nothing is lifted over anything and no crossing is counted.
 */
export function joinedPlane(strands, cfg) {
  const flat = onePlane(strands, cfg).map((strand) => ({ ...strand, joints: [...(strand.joints ?? [])] }));
  const { found } = findCrossings(flat, { strandWidth: cfg.t.extrusion_width });
  found.forEach((crossing, n) => { for (const index of new Set([crossing.sa, crossing.sb])) flat[index].joints.push({ id: `flat:${n}`, x: crossing.x, y: crossing.y }); });
  return flat;
}

/** Every point at the first layer height: a flat card is one layer, whatever the pipeline lifted at a crossing. */
export const onePlane = (strands, cfg) => strands.map((strand) => ({ ...strand, pts: strand.pts.map(({ cls, lifted, ...point }) => ({ ...point, z: cfg.t.layer_height })) }));

const gap = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * The fewest strokes the lines of each group allow, no line printed twice. Lines that meet or cross form a graph (network.js) and an
 * Eulerian trail walks as much of it as one continuous stroke as the graph permits. The groups come out in order, and the strokes of a
 * group follow one another by their nearest ends (a closed one starts where the nozzle is), so the nozzle follows one line wherever the
 * design lets it and only hops where the line has to stop.
 * @param lines    polylines of { x, y }; each may carry the `joints` it shares
 * @param groupOf  (line) → a number: lines with the same number are joined with each other and with no others
 * @returns polylines carrying their joints and a `rowOrder`, so the print order is kept as built
 */
export function strokesPerGroup(lines, groupOf, { snap = 0.08 } = {}) {
  const groups = new Map();
  for (const line of lines) { const key = groupOf(line); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(line); }
  const out = [];
  let at = null;
  for (const key of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(key), family = group[0].family;
    const joined = joinNetwork(group.map((pts, i) => ({ id: `g${key}-${i}`, pts, layer: 0, kind: 'base', family: 'g', role: 'native', ...(pts.joints?.length ? { joints: pts.joints } : {}) })), { snap });
    const left = joined.map((strand) => Object.assign(strand.pts.map((p) => ({ x: p.x, y: p.y })), { joints: strand.joints, family }));
    at ??= left[0][0];
    while (left.length) {
      let best = Infinity, pick = 0, vertex = 0, reverse = false;
      left.forEach((line, i) => {
        const closed = gap(line[0], line.at(-1)) < 1e-6;
        if (closed) { for (let j = 0; j < line.length - 1; j++) { const d = gap(line[j], at); if (d < best - 1e-9) { best = d; pick = i; vertex = j; reverse = false; } } return; }
        const head = gap(line[0], at), tail = gap(line.at(-1), at);
        if (Math.min(head, tail) < best - 1e-9) { best = Math.min(head, tail); pick = i; vertex = 0; reverse = tail < head; }
      });
      let line = left.splice(pick, 1)[0];
      const { joints } = line;
      if (vertex) line = [...line.slice(vertex, -1), ...line.slice(0, vertex + 1)];
      else if (reverse) line = line.slice().reverse();
      out.push(Object.assign(line, { joints, family, rowOrder: out.length }));
      at = line.at(-1);
    }
  }
  return out;
}

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
  // each line keeps the layer it came from: the layers still print one after the other, as on the layered card
  const polylines = layers.flatMap((layer, k) => layer.filter((line) => line.length >= 2).map((line) => Object.assign(line, { routingGroup: k })));
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
        if (piece.length >= 2 && Math.hypot(piece.at(-1).x - piece[0].x, piece.at(-1).y - piece[0].y) > 0.6) struts.push(Object.assign(piece, { family: 'struts', gap: k, column: n }));
      }
    }
  }
  joinStruts(chained, struts, 'strut');
  // the print order is the layered card's: every row first, then the struts a column at a time, up one and down the next, so the
  // nozzle follows one zigzag line up the sheet instead of hopping from strut to strut
  const columns = [...new Set(struts.map((strut) => strut.column))].sort((a, b) => a - b);
  const swept = columns.flatMap((column, i) => {
    const inColumn = struts.filter((strut) => strut.column === column).sort((a, b) => a.gap - b.gap);
    return i % 2 === 0 ? inColumn : inColumn.reverse().map((strut) => Object.assign(strut.slice().reverse(), { family: strut.family, joints: strut.joints, gap: strut.gap, column: strut.column }));
  });
  chained.forEach((row, i) => markRowOrder(row, i));
  swept.forEach((strut, i) => markRowOrder(strut, chained.length + i));
  const layer = [...chained, ...swept];
  layer.family = 'rows';
  return { layers: [layer], extra: { amplitude: A, cell, struts: struts.length, flat: true, transform: onePlane } };
}
