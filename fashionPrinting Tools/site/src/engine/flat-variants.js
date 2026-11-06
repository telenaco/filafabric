import { findCrossings } from './crossings.js';
import { fitPeriod, fitLanes } from './repeats.js';
import { centredLanes } from './fill.js';
import { shapeAt } from './shapes.js';
import { chainPolylines, clipPolyline, densify, markRowOrder } from './layers.js';
import { maxAuxeticAmplitude } from './auxetic.js';
import { joinNetwork } from './network.js';
import { clipStrands } from './fabric.js';

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

/** How far a point is from the boundary's outline. */
const edgeDistance = (boundary, p) => {
  let best = Infinity;
  for (const ring of boundary.rings ?? []) for (let i = 0; i < ring.length; i++) best = Math.min(best, distanceToSegment(p, ring[i], ring[(i + 1) % ring.length]));
  return best;
};

const sampled = (line, step) => {
  const out = [];
  for (let i = 0; i < line.length; i++) {
    out.push(line[i]);
    if (i + 1 < line.length) { const n = Math.floor(gap(line[i], line[i + 1]) / step); for (let k = 1; k <= n; k++) out.push({ x: line[i].x + (line[i + 1].x - line[i].x) * k / (n + 1), y: line[i].y + (line[i + 1].y - line[i].y) * k / (n + 1) }); }
  }
  return out;
};

/**
 * What the swatch edge leaves loose, taken away: a pattern cut by the edge can leave a piece with an end that touches nothing (its
 * neighbour was cut away) or a piece that touches nothing at all. Open lines whose two ends each meet another line, or the edge, stay
 * (a closed line has no ends); the rest go, round after round, and then everything not joined to the largest connected piece. What is
 * left is one sheet with no dangling end, whose cells at the edge are cut by it.
 * @param touch  how close two lines must run to count as touching: a little under a bead, as the construction report counts it
 */
export function tidyEdge(lines, boundary, { touch = 0.4 } = {}) {
  const cellOf = (v) => Math.floor(v / touch);
  const index = (list) => {
    const grid = new Map();
    list.forEach((line, i) => { for (const p of sampled(line, touch / 2)) { const key = `${cellOf(p.x)},${cellOf(p.y)}`; let bucket = grid.get(key); if (!bucket) grid.set(key, bucket = []); bucket.push([i, p]); } });
    return grid;
  };
  const near = (grid, p, i, visit) => {
    const cx = cellOf(p.x), cy = cellOf(p.y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [j, q] of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (j !== i && gap(p, q) <= touch && visit(j)) return true;
    return false;
  };
  let list = lines;
  for (let round = 0; round < 12; round++) {
    const grid = index(list);
    const joined = (p, i) => near(grid, p, i, () => true) || edgeDistance(boundary, p) <= touch;
    const kept = list.filter((line, i) => gap(line[0], line.at(-1)) < 1e-6 || (joined(line[0], i) && joined(line.at(-1), i)));
    if (kept.length === list.length) break;
    list = kept;
  }
  if (list.length < 2) return list;
  const grid = index(list), parent = list.map((_, i) => i), root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  list.forEach((line, i) => { for (const p of sampled(line, touch / 2)) near(grid, p, i, (j) => { parent[root(j)] = root(i); return false; }); });
  const length = new Map();
  list.forEach((line, i) => length.set(root(i), (length.get(root(i)) ?? 0) + line.reduce((n, p, k) => (k ? n + gap(p, line[k - 1]) : n), 0)));
  const [largest] = [...length.entries()].sort((a, b) => b[1] - a[1])[0];
  return list.filter((_, i) => root(i) === largest);
}

const onLine = (line, p, tolerance = 0.05) => {
  for (let i = 1; i < line.length; i++) if (distanceToSegment(p, line[i - 1], line[i]) < tolerance) return true;
  return false;
};

/**
 * Lines cut to the boundary, so a pattern can run past the swatch edge and the edge cuts it: a line wholly inside stays as it is, a
 * line that leaves it becomes the pieces inside it. Every piece keeps the line's family and the joints that lie on it; a line with
 * nothing inside it disappears.
 * @param lines  polylines of { x, y }, with properties such as `family` and `joints`
 * @param inset  how far inside the outline a line stops: half a bead, as the pipeline will cut it, so a line cut at a shallow angle
 *               ends where it will print and not a little short of its neighbour
 */
export function clipLines(lines, boundary, { minLength = 1, inset = 0 } = {}) {
  const out = [];
  for (const line of lines) {
    const pieces = line.every((p) => (boundary.contains(p.x, p.y) || edgeDistance(boundary, p) < 1e-6) && edgeDistance(boundary, p) >= inset - 1e-6) ? [line]
      : inset > 0 ? clipStrands([{ pts: densify(line).map((p) => ({ ...p, z: 0 })) }], boundary, inset).map((s) => s.pts.map(({ z, ...p }) => p)).filter((run) => run.reduce((n, p, i) => n + (i ? gap(p, run[i - 1]) : 0), 0) >= minLength)
      : clipPolyline(line, boundary, minLength);
    for (const piece of pieces) {
      if (piece !== line) for (const key of Object.keys(line)) if (Number.isNaN(Number(key)) && key !== 'joints') piece[key] = line[key];
      if (line.joints?.length && piece !== line) piece.joints = line.joints.filter((joint) => onLine(piece, joint));
      out.push(piece);
    }
  }
  return out;
}

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
