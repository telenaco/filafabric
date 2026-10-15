import { PolygonBoundary } from './boundary.js';
import { ConfigError } from './params.js';
import { sampleGrid, isoLines } from './isolines.js';
import { clipPolyline } from './layers.js';
import { linePasses, offsetPolyline } from './drawing.js';
import { windowRings } from './window.js';
import { clipStrands } from './fabric.js';
import { MAX_MOVES } from './tiler.js';
import { polygonRegion } from './polygon-region.js';

const MAX_GUIDES = 32;
const MAX_POLES = 128;
const MIN_GAP = 1.2;
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

function samplesOf(ring, count = 96) {
  const lengths = [0];
  for (let i = 0; i < ring.length; i++) lengths.push(lengths.at(-1) + Math.hypot(ring[(i + 1) % ring.length].x - ring[i].x, ring[(i + 1) % ring.length].y - ring[i].y));
  const perimeter = lengths.at(-1), out = [];
  if (!(perimeter > 1e-6)) throw new ConfigError(['A green guide must enclose an opening.']);
  for (let k = 0, edge = 0; k < count; k++) {
    const arc = perimeter * k / count;
    while (edge + 1 < ring.length && lengths[edge + 1] < arc) edge++;
    const a = ring[edge], b = ring[(edge + 1) % ring.length], t = (arc - lengths[edge]) / Math.max(1e-20, lengths[edge + 1] - lengths[edge]);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function describe(guide) {
  let ring = guide.ring;
  if (!Array.isArray(ring) || ring.length < 3 || ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new ConfigError(['A green guide needs a finite closed contour.']);
  if (Math.hypot(ring[0].x - ring.at(-1).x, ring[0].y - ring.at(-1).y) < 1e-8) ring = ring.slice(0, -1);
  const box = boxOf(ring), cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const radii = ring.map((p) => Math.hypot(p.x - cx, p.y - cy)), r = radii.reduce((n, v) => n + v, 0) / radii.length;
  if (!(r > 1e-5) || box.maxX - box.minX < 1e-6 || box.maxY - box.minY < 1e-6) throw new ConfigError(['A green guide must enclose an opening.']);
  const circular = radii.every((v) => Math.abs(v - r) < r * 1e-4) && Math.abs(box.maxX - box.minX - box.maxY + box.minY) < r * 1e-4;
  return { ...guide, ring, box, cx, cy, r, circular, boundary: new PolygonBoundary([ring]), samples: samplesOf(ring) };
}

// Every pole stays strictly inside its actual contour. A concave opening gets poles in its individual arms,
// rather than a centre or a radius that can lie in surrounding material.
function interiorPoles(g, count) {
  const candidates = [], { box, boundary, ring } = g, w = box.maxX - box.minX, h = box.maxY - box.minY;
  const offer = (x, y) => {
    if (!boundary.contains(x, y)) return;
    const d = distance({ x, y }, ring);
    if (d > Math.min(w, h) * 1e-5) candidates.push({ x, y, d });
  };
  for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) offer(box.minX + (i + 0.5) * w / 18, box.minY + (j + 0.5) * h / 18);
  // Inset edge probes also find long, thin features that a regular interior grid can miss.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    for (const sign of [-1, 1]) for (const fraction of [0.03, 0.12]) offer((a.x + b.x) / 2 - sign * dy / len * Math.min(w, h) * fraction, (a.y + b.y) / 2 + sign * dx / len * Math.min(w, h) * fraction);
  }
  if (!candidates.length) throw new ConfigError(['This green contour is too narrow to guide a mesh.']);
  const poles = [];
  for (let k = 0; k < count && candidates.length; k++) {
    let best = 0, score = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      const separation = poles.length ? Math.min(...poles.map((q) => Math.hypot(p.x - q.x, p.y - q.y))) : p.d;
      const value = separation * Math.sqrt(p.d);
      if (value > score) { score = value; best = i; }
    }
    const p = candidates.splice(best, 1)[0];
    poles.push({ x: p.x, y: p.y, radius: p.d, order: 1 });
  }
  return poles;
}

function basisAt(pole, x, y) {
  const dx = x - pole.x, dy = y - pole.y, d = dx * dx + dy * dy;
  if (d < 1e-24) return [NaN, NaN];
  const a = pole.radius * dx / d, b = -pole.radius * dy / d;
  let u = a, v = b;
  for (let k = 1; k < pole.order; k++) [u, v] = [u * a - v * b, u * b + v * a];
  return [u, v];
}

// Column-scaled ridge least squares. The ridge makes nearly redundant interior poles harmless and gives a
// finite approximation at sharp corners; it is a geometric fit, not an exact exterior mapping theorem.
function leastSquares(rows, rhs, columns) {
  const scale = new Float64Array(columns);
  for (const row of rows) for (let j = 0; j < columns; j++) scale[j] += row[j] * row[j];
  for (let j = 0; j < columns; j++) scale[j] = Math.sqrt(scale[j]) || 1;
  const matrix = Array.from({ length: columns }, () => new Float64Array(columns)), target = new Float64Array(columns);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let j = 0; j < columns; j++) row[j] /= scale[j];
    for (let j = 0; j < columns; j++) {
      target[j] += row[j] * rhs[i];
      for (let k = 0; k <= j; k++) matrix[j][k] += row[j] * row[k];
    }
  }
  for (let j = 0; j < columns; j++) {
    matrix[j][j] += 1e-8;
    for (let k = 0; k <= j; k++) {
      let sum = matrix[j][k];
      for (let n = 0; n < k; n++) sum -= matrix[j][n] * matrix[k][n];
      matrix[j][k] = j === k ? Math.sqrt(Math.max(1e-14, sum)) : sum / matrix[k][k];
    }
  }
  const answer = new Float64Array(columns);
  for (let j = 0; j < columns; j++) {
    let sum = target[j];
    for (let k = 0; k < j; k++) sum -= matrix[j][k] * answer[k];
    answer[j] = sum / matrix[j][j];
  }
  for (let j = columns - 1; j >= 0; j--) {
    let sum = answer[j];
    for (let k = j + 1; k < columns; k++) sum -= matrix[k][j] * answer[k];
    answer[j] = sum / matrix[j][j];
  }
  return Array.from(answer, (v, j) => v / scale[j]);
}

/** Analytic flow f(z)=z+sum c/(z-p)^k, fitted so Im f is constant along each opening. Units are millimetres. */
export function guidePotential(rawGuides) {
  if (!Array.isArray(rawGuides) || !rawGuides.length || rawGuides.length > MAX_GUIDES) throw new ConfigError([`Use between 1 and ${MAX_GUIDES} green guide contours.`]);
  const guides = rawGuides.map(describe);
  let poles, coefficients;
  if (guides.length === 1 && guides[0].circular) {
    const g = guides[0];
    poles = [{ x: g.cx, y: g.cy, radius: g.r, order: 1 }];
    coefficients = [g.r, 0]; // exact Joukowski flow around a single circle
  } else {
    const perGuide = Math.min(24, Math.floor(MAX_POLES / guides.length));
    poles = guides.flatMap((g) => g.circular ? Array.from({ length: Math.min(6, perGuide) }, (_, i) => ({ x: g.cx, y: g.cy, radius: g.r, order: i + 1 })) : interiorPoles(g, perGuide));
    const columns = 2 * poles.length + guides.length, rows = [], rhs = [];
    guides.forEach((g, gi) => {
      for (const p of g.samples) {
        const row = new Float64Array(columns);
        poles.forEach((pole, j) => { const [u, v] = basisAt(pole, p.x, p.y); row[2 * j] = v; row[2 * j + 1] = u; });
        row[2 * poles.length + gi] = -1;
        rows.push(row); rhs.push(g.cy - p.y);
      }
    });
    coefficients = leastSquares(rows, rhs, columns);
  }
  const at = (x, y) => {
    let u = x, v = y;
    for (let j = 0; j < poles.length; j++) {
      const [a, b] = basisAt(poles[j], x, y), cr = coefficients[2 * j], ci = coefficients[2 * j + 1];
      u += cr * a - ci * b; v += cr * b + ci * a;
    }
    return [u, v];
  };
  const derivative = (x, y) => {
    let u = 1, v = 0;
    for (let j = 0; j < poles.length; j++) {
      const pole = poles[j], [a, b] = basisAt(pole, x, y), dx = x - pole.x, dy = y - pole.y, d = dx * dx + dy * dy;
      const ar = -pole.order * (a * dx + b * dy) / d, ai = -pole.order * (b * dx - a * dy) / d;
      u += coefficients[2 * j] * ar - coefficients[2 * j + 1] * ai;
      v += coefficients[2 * j] * ai + coefficients[2 * j + 1] * ar;
    }
    return [u, v];
  };
  const errors = guides.map((g) => {
    const values = g.samples.map((p) => at(p.x, p.y)[1]), mean = values.reduce((n, v) => n + v, 0) / values.length;
    return Math.sqrt(values.reduce((n, v) => n + (v - mean) ** 2, 0) / values.length);
  });
  return { at, derivative, guides, fitError: Math.max(...errors), poles: poles.length };
}

const sameRing = (a, b) => {
  const ba = boxOf(a), bb = boxOf(b);
  if (Object.keys(ba).some((key) => Math.abs(ba[key] - bb[key]) > 1e-6)) return false;
  return a.every((p) => distance(p, b) < 1e-6) && b.every((p) => distance(p, a) < 1e-6);
};

const boxesOverlap = (a, b) => a.minX <= b.maxX + 1e-8 && a.maxX >= b.minX - 1e-8 && a.minY <= b.maxY + 1e-8 && a.maxY >= b.minY - 1e-8;

// Extract the boundary of outer minus the UNION of openings. Splitting edges at crossings and testing both
// sides also handles nested openings and existing garment holes, without even-odd islands in their overlaps.
function subtractOpenings(boundary, openingRings, candidates) {
  const openings = openingRings.map((r) => new PolygonBoundary([r]));
  const material = (x, y) => boundary.contains(x, y) && !openings.some((b) => b.contains(x, y));
  const rings = polygonRegion(candidates, material);
  return rings.length ? new PolygonBoundary(rings) : new PolygonBoundary([candidates[0], candidates[0]]);
}
/** The same clipped, deduplicated guide openings used by both mesh generation and full-panel backing. */
export function conformalGuideRegion(boundary, rawGuides) {
  if (!Array.isArray(rawGuides) || rawGuides.length > MAX_GUIDES) throw new ConfigError([`Use at most ${MAX_GUIDES} green guide contours.`]);
  const box = boundary.bbox(), w = box.maxX - box.minX, h = box.maxY - box.minY;
  const outerRings = boundary.rings ?? [[{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }]];
  const rings = [...outerRings], openings = [];
  for (const raw of rawGuides) {
    const g = describe(raw);
    for (const local of windowRings([g.ring], w, h, box.minX, box.minY)) {
      const ring = local.map((p) => ({ x: p.x + box.minX, y: p.y + box.minY }));
      openings.push(ring);
      const existing = rings.findIndex((r) => sameRing(r, ring));
      // Only already-excluded rings are duplicates. Garment outlines may have several outer islands.
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
  const overlaps = openings.some((ring, i) => openings.slice(i + 1).some((other) => boxesOverlap(boxOf(ring), boxOf(other)))
    || outerRings.slice(1).some((other) => !sameRing(ring, other) && boxesOverlap(boxOf(ring), boxOf(other))));
  if (overlaps) return subtractOpenings(boundary, openings, [...outerRings, ...openings]);
  return new PolygonBoundary(rings);
}

/** Actual contour holes and analytic level lines; outside guides influence the field but never enlarge the window. */
export function guidedConformalLayers(boundary, { spacing = 3, guides, guideHems = true, strandWidth = 0.45 } = {}) {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new ConfigError(['Conformal mesh spacing must be finite and positive.']);
  const box = boundary.bbox(), w = box.maxX - box.minX, h = box.maxY - box.minY;
  const cell = Math.max(0.35, Math.min(spacing / 6, Math.max(w, h) / 320));
  if ((Math.ceil(w / cell) + 3) * (Math.ceil(h / cell) + 3) > 400000) throw new ConfigError(['This swatch is too large for the conformal mesh grid; use a smaller one.']);
  const potential = guidePotential(guides);
  const region = conformalGuideRegion(boundary, guides);
  const outsideOpenings = (x, y) => !potential.guides.some((g) => g.boundary.contains(x, y));
  const slopes = [];
  for (let y = box.minY + cell; y < box.maxY; y += 8 * cell) for (let x = box.minX + cell; x < box.maxX; x += 8 * cell) {
    if (!region.contains(x, y) || !outsideOpenings(x, y)) continue;
    const slope = Math.hypot(...potential.derivative(x, y));
    if (Number.isFinite(slope)) slopes.push(slope);
  }
  if (!slopes.length) throw new ConfigError(['The green openings fill this preview window.']);
  slopes.sort((a, b) => a - b);
  const step = spacing * Math.max(0.1, slopes[Math.floor(slopes.length / 2)]);
  // Continue the analytic field a couple of cells into an opening. Marching squares can then reach its
  // exact edge before geometric clipping, rather than leaving a missing-cell gap beside the printed wall.
  const sample = (x, y) => {
    for (const g of potential.guides) if (g.boundary.contains(x, y) && distance({ x, y }, g.ring) > 2 * cell) return [NaN, NaN];
    return potential.at(x, y);
  };
  const uField = sampleGrid(box, cell, (x, y) => sample(x, y)[0]);
  const vField = sampleGrid(box, cell, (x, y) => sample(x, y)[1]);
  const roomy = (p) => step / Math.hypot(...potential.derivative(p.x, p.y)) >= MIN_GAP;
  const family = (field) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of field.data) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if ((hi - lo) / step > 2000) throw new ConfigError(['The guide field needs too many mesh lines; increase spacing or simplify the contours.']);
    const out = [];
    for (let level = (Math.ceil(lo / step) + 0.5) * step, k = 0; level <= hi; level += step, k++) for (const line of isoLines(field, level)) {
      for (const clipped of clipPolyline(line, region)) {
        let run = [];
        const flush = () => { if (run.length > 1) out.push(k % 2 ? run.reverse() : run); run = []; };
        for (const p of clipped) { if (roomy(p)) run.push(p); else flush(); }
        flush();
      }
    }
    return out;
  };
  const layers = [family(uField), family(vField)];
  if (guideHems) for (const g of potential.guides) {
    const wall = { pts: [...g.ring, g.ring[0]], width: g.width, closed: true };
    layers[0].unshift(...linePasses(wall, strandWidth).flatMap((pts) => clipPolyline(pts, boundary, 0)));
  }
  return { layers, outline: region.rings, extra: { holes: potential.guides.length, guideCount: potential.guides.length, guideFitError: potential.fitError, guidePoles: potential.poles, cell, guideApproximate: true } };
}

const interpolate = (a, b, t) => t <= 1e-12 ? { ...a } : ({ ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t });
function nearestFoot(p, ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
    const x = a.x + t * dx, y = a.y + t * dy, d = Math.hypot(p.x - x, p.y - y);
    if (!best || d < best.d) best = { x, y, d, edge: i, t };
  }
  return best;
}

function denseWithCuts(pts, ring, step, budget) {
  const out = [], cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const push = (p) => { if (++budget.count > MAX_MOVES) throw new ConfigError(['Guide repulsion exceeds the move limit; use wider spacing or a smaller sample.']); out.push(p); };
  if (!pts.length) return out;
  push({ ...pts[0] });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], rx = b.x - a.x, ry = b.y - a.y, n = Math.max(1, Math.ceil(Math.hypot(rx, ry) / step));
    if (budget.count + n > MAX_MOVES) throw new ConfigError(['Guide repulsion exceeds the move limit; use wider spacing or a smaller sample.']);
    const cuts = Array.from({ length: n }, (_, k) => (k + 1) / n);
    for (let j = 0; j < ring.length; j++) {
      const p = ring[j], q = ring[(j + 1) % ring.length], sx = q.x - p.x, sy = q.y - p.y, den = cross(rx, ry, sx, sy);
      if (Math.abs(den) < 1e-12) continue;
      const t = cross(p.x - a.x, p.y - a.y, sx, sy) / den, u = cross(p.x - a.x, p.y - a.y, rx, ry) / den;
      if (t > 1e-10 && t < 1 - 1e-10 && u >= -1e-10 && u <= 1 + 1e-10) cuts.push(t);
    }
    cuts.sort((p, q) => p - q);
    for (let k = 0; k < cuts.length; k++) if (!k || cuts[k] - cuts[k - 1] > 1e-10) push(interpolate(a, b, cuts[k]));
  }
  return out;
}

const arcLengths = (pts) => {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths.at(-1) + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return lengths;
};
const atArc = (pts, lengths, t) => {
  const arc = t * lengths.at(-1);
  let lo = 0, hi = lengths.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (lengths[mid] <= arc) lo = mid; else hi = mid; }
  return interpolate(pts[lo], pts[hi], (arc - lengths[lo]) / Math.max(1e-20, lengths[hi] - lengths[lo]));
};

function contourArc(ring, from, to) {
  const forward = (a, b) => {
    const out = [{ x: a.x, y: a.y }], start = a.edge + a.t;
    let end = b.edge + b.t;
    if (end < start + 1e-10) end += ring.length;
    for (let k = Math.floor(start) + 1; k < end - 1e-10; k++) out.push(ring[k % ring.length]);
    out.push({ x: b.x, y: b.y });
    return out;
  };
  const a = forward(from, to), b = forward(to, from).reverse();
  return arcLengths(a).at(-1) <= arcLengths(b).at(-1) ? a : b;
}

/**
 * Bend any existing XY pattern around green openings. A compact outward displacement bends nearby lines;
 * paths through an opening follow an offset of its actual contour. Penetration controls that offset so
 * neighbouring paths do not all collapse onto one rim. Z, incoming flow and move classes follow the source
 * path by arc length, including their transition points. The final exact subtraction prevents shortcuts
 * through concavities or overlapping openings. This routing is geometric, not a physical-strength model.
 */
export function repelGuideStrands(strands, rawGuides, { strandWidth = 0.45, influence = null, boundary = null } = {}) {
  if (!rawGuides?.length || !strands.length) return strands;
  if (rawGuides.length > MAX_GUIDES) throw new ConfigError([`Use at most ${MAX_GUIDES} green guide contours.`]);
  const guides = rawGuides.map(describe), step = Math.max(0.2, Math.min(0.75, strandWidth));
  let current = strands;
  for (const g of guides) {
    const size = Math.min(g.box.maxX - g.box.minX, g.box.maxY - g.box.minY), push = Math.max(strandWidth, size * 0.3);
    const reach = influence ?? Math.max(2.5 * push, 4 * strandWidth), clearance = strandWidth * 0.6;
    if (!Number.isFinite(reach) || reach <= 0) throw new ConfigError(['Guide influence must be finite and positive.']);
    const area = g.ring.reduce((sum, p, i) => { const q = g.ring[(i + 1) % g.ring.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
    const unitRing = offsetPolyline([...g.ring, g.ring[0]], area >= 0 ? -1 : 1);
    const normalAt = (foot) => {
      const i = foot.edge, a = unitRing[i], b = unitRing[i + 1];
      return { x: a.x + (b.x - a.x) * foot.t - foot.x, y: a.y + (b.y - a.y) * foot.t - foot.y };
    };
    const displace = (p) => {
      const foot = nearestFoot(p, g.ring), inside = g.boundary.contains(p.x, p.y);
      if (!inside && foot.d >= reach) return p;
      let normal;
      if (foot.d < 1e-8) normal = normalAt(foot);
      else normal = { x: (p.x - foot.x) / foot.d * (inside ? -1 : 1), y: (p.y - foot.y) / foot.d * (inside ? -1 : 1) };
      const amount = inside ? foot.d + push : push * (1 - foot.d / reach) ** 2;
      return { ...p, x: p.x + normal.x * amount, y: p.y + normal.y * amount };
    };
    const budget = { count: 0 };
    current = current.map((s) => {
      if (s.pts.length < 2 || s.pts.every((p) => p.x < g.box.minX - reach) || s.pts.every((p) => p.x > g.box.maxX + reach)
        || s.pts.every((p) => p.y < g.box.minY - reach) || s.pts.every((p) => p.y > g.box.maxY + reach)) return s;
      // A small motif wholly inside the opening moves as a whole instead of degenerating into repeated rim points.
      if (s.pts.every((p) => g.boundary.contains(p.x, p.y))) {
        const centre = s.pts.reduce((p, q) => ({ x: p.x + q.x / s.pts.length, y: p.y + q.y / s.pts.length }), { x: 0, y: 0 });
        const foot = nearestFoot(centre, g.ring), normal = foot.d > 1e-8 ? { x: (foot.x - centre.x) / foot.d, y: (foot.y - centre.y) / foot.d } : normalAt(foot);
        const radius = s.pts.reduce((r, p) => Math.max(r, Math.hypot(p.x - centre.x, p.y - centre.y)), 0);
        // Keep different depths on different offsets; a row of enclosed motifs must not share one translated rim.
        const shift = foot.d + radius + clearance + push * Math.max(0.1, 1 - foot.d / (size / 2));
        return { ...s, pts: s.pts.map((p) => ({ ...p, x: p.x + normal.x * shift, y: p.y + normal.y * shift })) };
      }
      const dense = denseWithCuts(s.pts, g.ring, step, budget), out = [];
      const append = (p) => { const prev = out.at(-1); if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y, (p.z ?? 0) - (prev.z ?? 0)) > 1e-9) out.push(p); };
      for (let i = 0; i + 1 < dense.length;) {
        const inside = g.boundary.contains((dense[i].x + dense[i + 1].x) / 2, (dense[i].y + dense[i + 1].y) / 2);
        let end = i + 1;
        while (end + 1 < dense.length && g.boundary.contains((dense[end].x + dense[end + 1].x) / 2, (dense[end].y + dense[end + 1].y) / 2) === inside) end++;
        const run = dense.slice(i, end + 1), a = nearestFoot(run[0], g.ring), b = nearestFoot(run.at(-1), g.ring);
        if (inside && a.d < 1e-5 && b.d < 1e-5) {
          const arc = contourArc(g.ring, a, b), arcLength = arcLengths(arc), sourceLength = arcLengths(run), length = arcLength.at(-1);
          const depth = run.reduce((d, p) => Math.max(d, nearestFoot(p, g.ring).d), 0);
          const middleOffset = clearance + (push - clearance) * Math.max(0.15, 1 - depth / (size / 2));
          const n = Math.max(2, Math.ceil(length / step));
          const fractions = [...Array.from({ length: n + 1 }, (_, k) => k / n), ...sourceLength.map((d) => d / Math.max(1e-20, sourceLength.at(-1)))].sort((p, q) => p - q);
          for (let k = 0; k < fractions.length; k++) {
            const t = fractions[k];
            if (k && t - fractions[k - 1] < 1e-9) continue;
            const p = atArc(arc, arcLength, t), foot = nearestFoot(p, g.ring), normal = normalAt(foot), offset = push + (middleOffset - push) * Math.sin(Math.PI * t) ** 2;
            append({ ...atArc(run, sourceLength, t), x: p.x + normal.x * offset, y: p.y + normal.y * offset });
          }
        } else for (const p of run) append(displace(p));
        i = end;
      }
      budget.count += out.length;
      if (budget.count > MAX_MOVES) throw new ConfigError(['Guide repulsion exceeds the move limit; use wider spacing or a smaller sample.']);
      return { ...s, pts: out };
    });
  }
  if (!boundary) {
    const pts = strands.flatMap((s) => s.pts), b = boxOf(pts), pad = Math.max(1, strandWidth);
    boundary = new PolygonBoundary([[{ x: b.minX - pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.maxY + pad }, { x: b.minX - pad, y: b.maxY + pad }]]);
  }
  return clipStrands(current, conformalGuideRegion(boundary, rawGuides), 0);
}
