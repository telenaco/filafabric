// How a drawing is read. A vector file says what to print with colour and stroke width:
//
//   - a closed shape in pure RED is filled with the pattern;
//   - a closed shape in pure BLUE is left empty: a hole. Shapes inside shapes nest like a boolean: the innermost shape
//     a point lies in decides it, so blue inside red cuts a hole and red inside that blue is filled again;
//   - a closed shape in GREEN is printed solid, on top of the pattern once the pattern is done: a round shape as a coil,
//     any other as a zigzag (solid-fill.js). An open green line is a line like any other;
//   - everything else is a line, and a line is printed as drawn: open paths, and closed shapes of any other colour.
//     A line about as wide as the extrusion is one pass; a wider one is printed as several passes side by side.
//
// A shape that is not closed is never filled. A drawing that carries no colour information (an older saved file, the
// built-in sample) keeps the previous rule: every closed path is a shape, and shapes inside shapes alternate fill, hole.
//
// Everything here is plain geometry in millimetres: no browser, no printing. The printing pipeline takes the polylines.

import { unionFilledRegions } from './polygon-region.js';

export const FILL = 'red';
export const HOLE = 'blue';
export const SOLID = 'green';
export const MAX_PASSES = 8;

/* ---------- what is saved of a drawing ---------- */

const COLOURS = new Set(['red', 'blue', 'green', 'other']);

/** A drawing from a file or a saved setting, or null when it cannot be one. Keeps `styles` only when they line up with the paths. */
export function sanitizeSvgLines(raw) {
  if (!raw || !Number.isFinite(raw.width) || !Number.isFinite(raw.height) || raw.width <= 0 || raw.height <= 0 || raw.width > 1000 || raw.height > 1000 || !Array.isArray(raw.paths)) return null;
  let count = 0;
  for (const path of raw.paths) {
    if (!Array.isArray(path) || path.length < 2) return null;
    count += path.length; if (count > 100000) return null;
    if (path.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) return null;
  }
  const out = { name: String(raw.name ?? 'SVG lines').slice(0, 100), width: raw.width, height: raw.height, paths: raw.paths.map((path) => path.map(({ x, y }) => ({ x, y }))) };
  const styles = raw.styles;
  if (Array.isArray(styles) && styles.length === raw.paths.length
    && styles.every((s) => s && COLOURS.has(s.color) && Number.isFinite(s.width) && s.width >= 0 && s.width <= 1000)) {
    out.styles = styles.map((s) => ({ color: s.color, width: Math.round(s.width * 1000) / 1000 }));
  }
  return out;
}

/* ---------- closed or open ---------- */

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/** The ring (without its repeated end point) of a path that comes back to its start, or null: open paths and specks. */
export function closedRing(path, { closeTolerance = 0.35, minArea = 0.5 } = {}) {
  if (path.length < 4) return null;
  const a = path[0], b = path[path.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) > closeTolerance) return null;
  const ring = path.slice(0, -1);
  return ringArea(ring) >= minArea ? ring : null;
}

/** Closed shapes and open lines of a drawing's paths (points in mm). Shapes come back without the repeated end point. */
export function classifyPaths(paths, options) {
  const closed = [], open = [];
  for (const path of paths) {
    if (path.length < 2) continue;
    const ring = closedRing(path, options);
    if (ring) closed.push(ring); else open.push(path);
  }
  return { closed, open };
}

/* ---------- nesting ---------- */

function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const boxOf = (ring) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

/** The smallest shape each shape lies inside (mostly: a shape that shares an edge with its parent still counts). */
function nest(shapes) {
  for (const s of shapes) {
    s.area = ringArea(s.ring);
    s.box = boxOf(s.ring);
    const step = Math.max(1, Math.floor(s.ring.length / 10));
    s.samples = [];
    for (let i = 0; i < s.ring.length; i += step) s.samples.push(s.ring[i]);
    s.parent = null;
  }
  for (const s of shapes) {
    let best = null;
    for (const t of shapes) {
      if (t === s || t.area <= s.area) continue;
      if (s.box.minX < t.box.minX - 1e-6 || s.box.maxX > t.box.maxX + 1e-6 || s.box.minY < t.box.minY - 1e-6 || s.box.maxY > t.box.maxY + 1e-6) continue;
      if (best && t.area >= best.area) continue;
      let hits = 0;
      for (const p of s.samples) if (inside(p.x, p.y, t.ring)) hits++;
      if (hits >= Math.ceil(s.samples.length * 0.6)) best = t;
    }
    s.parent = best;
  }
  for (const s of shapes) {
    let d = 0;
    for (let p = s.parent; p; p = p.parent) d++;
    s.depth = d;
  }
}

/**
 * Reads a drawing.
 * @param vector  { width, height, paths, styles? } in mm
 * @param scale   the drawing is placed at `scaleX`, `scaleY` times its own size; stroke widths follow
 * @returns {{
 *   shapes: { ring, role: 'fill'|'hole', color, depth, kept }[],   every closed red or blue shape (all closed ones when there are no colours)
 *   fills:  { ring, holes: ring[] }[],                              the regions to fill: a filled shape and the holes cut out of it
 *   rings:  ring[],                                                 every ring of every region: even-odd gives the filled area
 *   lines:  { pts, width, closed, index }[],                        what prints as lines
 *   solids: { ring, index }[],                                      closed green shapes, printed solid on top
 *   styled: boolean,                                                the file said which colours its shapes are
 * }}
 */
export function interpretDrawing(vector, { scaleX = 1, scaleY = 1 } = {}) {
  const widthScale = Math.sqrt(Math.abs(scaleX * scaleY)) || 1;
  const styled = Array.isArray(vector.styles) && vector.styles.length === vector.paths.length;
  const shapes = [], lines = [], solids = [];
  vector.paths.forEach((path, index) => {
    if (path.length < 2) return;
    const pts = path.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
    const style = styled ? vector.styles[index] : null;
    const ring = closedRing(pts);
    // a solid shape is all fill: its edge is the fill's own first pass, so it is not printed again as a line
    if (ring && style?.color === SOLID) solids.push({ ring, index });
    else if (ring && (!style || style.color === FILL || style.color === HOLE)) shapes.push({ ring, color: style ? style.color : null, index });
    else lines.push({ pts, width: style ? style.width * widthScale : 0, closed: !!ring, index });
  });

  nest(shapes);
  for (const s of shapes) {
    s.role = s.color === FILL ? 'fill' : s.color === HOLE ? 'hole' : s.depth % 2 === 0 ? 'fill' : 'hole';
    s.kept = false;
  }
  const children = new Map(shapes.map((s) => [s, []]));
  for (const s of shapes) if (s.parent) children.get(s.parent).push(s);
  // a filled shape inside a filled shape adds nothing: the holes in it belong to the one outside
  const holesOf = (node, out) => {
    for (const c of children.get(node)) {
      if (c.role === 'hole') out.push(c); else holesOf(c, out);
    }
    return out;
  };
  const fills = [];
  for (const s of shapes) {
    if (s.role !== 'fill' || (s.parent && s.parent.role !== 'hole')) continue;
    const holes = holesOf(s, []);
    s.kept = true;
    for (const h of holes) h.kept = true;
    fills.push({ ring: s.ring, holes: holes.map((h) => h.ring) });
  }
  const rings = unionFilledRegions(fills);
  for (const s of shapes) delete s.samples;
  return { shapes, fills, rings, lines, solids, styled };
}

/* ---------- lines and their passes ---------- */

/** How many passes a line of this width needs when one pass is `bead` wide. A line with no width is one pass. */
export function passesFor(width, bead = 0.45) {
  if (!(width > 0) || !(bead > 0)) return 1;
  return Math.max(1, Math.min(MAX_PASSES, Math.round(width / bead)));
}

/** A polyline moved sideways by d (positive to the left of its direction), with mitred corners that never run away. */
export function offsetPolyline(pts, d) {
  const n = pts.length;
  if (n < 2 || d === 0) return pts.map((p) => ({ ...p }));
  const closed = n > 3 && Math.hypot(pts[0].x - pts[n - 1].x, pts[0].y - pts[n - 1].y) < 1e-9;
  const seg = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, len = Math.hypot(dx, dy);
    seg.push(len > 1e-12 ? { x: -dy / len, y: dx / len } : null);
  }
  const normalAt = (i) => {
    let a = i > 0 ? seg[i - 1] : closed ? seg[n - 2] : null;
    let b = i < n - 1 ? seg[i] : closed ? seg[0] : null;
    a = a ?? b;
    b = b ?? a;
    if (!a) return { x: 0, y: 0, k: 1 };
    const sx = a.x + b.x, sy = a.y + b.y, len = Math.hypot(sx, sy);
    if (len < 1e-9) return { ...a, k: 1 };
    const mx = sx / len, my = sy / len;
    const cos = Math.max(0.5, mx * a.x + my * a.y);
    return { x: mx, y: my, k: 1 / cos };
  };
  const out = pts.map((p, i) => {
    const m = normalAt(i);
    return { ...p, x: p.x + m.x * d * m.k, y: p.y + m.y * d * m.k };
  });
  if (closed) out[n - 1] = { ...out[n - 1], x: out[0].x, y: out[0].y };
  return out;
}

/** One printed path per pass: the line itself for one pass, otherwise parallel paths that together fill its width. */
export function linePasses(line, bead = 0.45) {
  const n = passesFor(line.width, bead);
  if (n === 1) return [line.pts];
  // Adjacent beads share at least 20% of their width so a multi-pass stroke bonds as one line.
  const pitch = Math.min(line.width / n, bead * 0.8);
  return Array.from({ length: n }, (_, k) => offsetPolyline(line.pts, (k - (n - 1) / 2) * pitch));
}

/**
 * The drawing as polylines for the first printed layer, shifted by (offsetX, offsetY).
 * `edges: 'all'` prints the outline of every red or blue shape as a line (it is clipped to the swatch like any line);
 * `edges: 'kept'` is for a drawing that is also the garment outline: only the edges of the filled regions, and they are
 * returned in `whole`, because they lie on the boundary themselves.
 * @returns { model, clipped: [{ pts, shape }], whole: [{ pts, shape }] }
 */
export function drawingPolylines(vector, { scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, bead = 0.45, edges = 'all' } = {}) {
  const model = interpretDrawing(vector, { scaleX, scaleY });
  const shift = (pts) => pts.map((p) => ({ x: p.x - offsetX, y: p.y - offsetY }));
  const clipped = [], whole = [];
  for (const line of model.lines) for (const pts of linePasses(line, bead)) clipped.push({ pts: shift(pts), shape: false });
  const kept = edges === 'kept';
  for (const s of model.shapes) {
    if (kept && !s.kept) continue;
    const poly = { pts: shift([...s.ring, s.ring[0]]), shape: true };
    (kept ? whole : clipped).push(poly);
  }
  return { model, clipped, whole };
}

/* ---------- the page ---------- */

/**
 * The drawing with its page cut down to what is drawn, plus a margin (and half the widest line, so no line is trimmed
 * at the edge). For a drawing whose page is bigger than anything that could be printed: an A4 page with a small motif in
 * the middle. Positions and sizes of the paths are unchanged; only the page moves.
 */
export function cropToDrawing(vector, { margin = 3 } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of vector.paths) {
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return vector;
  const widest = Array.isArray(vector.styles) ? Math.max(0, ...vector.styles.map((s) => s.width)) : 0;
  const pad = margin + widest / 2;
  const x0 = minX - pad, y0 = minY - pad;
  const tenth = (n) => Math.min(1000, Math.max(1, Math.ceil(n * 10 - 1e-9) / 10));
  const round = (n) => Math.round(n * 1e4) / 1e4;
  return {
    ...vector,
    width: tenth(maxX - minX + 2 * pad),
    height: tenth(maxY - minY + 2 * pad),
    paths: vector.paths.map((path) => path.map((p) => ({ x: round(p.x - x0), y: round(p.y - y0) }))),
  };
}

/* ---------- what the import card says ---------- */

/** { fills, holes, solids, lines, passes } of a drawing: how many shapes are filled, how many holes, how many solid shapes, how many lines, the most passes any line takes. */
export function summariseDrawing(vector, { bead = 0.45 } = {}) {
  const m = interpretDrawing(vector);
  const holes = new Set(m.fills.flatMap((f) => f.holes)).size;
  return { fills: m.fills.length, holes, solids: m.solids.length, lines: m.lines.length, passes: m.lines.reduce((n, l) => Math.max(n, passesFor(l.width, bead)), 1), styled: m.styled };
}

export function describeDrawing(s) {
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts = [];
  if (s.fills) parts.push(`${plural(s.fills, 'filled shape')}${s.holes ? ` with ${plural(s.holes, 'hole')}` : ''}`);
  if (s.lines) parts.push(`${plural(s.lines, 'line')}${s.passes > 1 ? ` (up to ${s.passes} passes)` : ''}`);
  if (s.solids) parts.push(plural(s.solids, 'solid shape'));
  return parts.length ? parts.join(', ') : 'nothing to print yet';
}
