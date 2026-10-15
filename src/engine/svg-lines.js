import { clipStrands, connectStrands, orderStrands, analyzeFabric, travelDistance } from './fabric.js';
import { resolveCrossings } from './crossings.js';
import { PolygonBoundary } from './boundary.js';
import { simplifyRing, flattenRings } from './outline.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';

const MM = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, pt: 25.4 / 72, pc: 25.4 / 6, q: 0.25, '': 25.4 / 96 };
export function svgDimensions({ width, height, viewBox } = {}) {
  const length = (s) => { const m = /^\s*([+\d.eE-]+)\s*(mm|cm|in|px|pt|pc|q)?\s*$/.exec(s ?? ''); return m && Number(m[1]) > 0 ? Number(m[1]) * MM[m[2] ?? ''] : null; };
  const box = String(viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const aspect = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : null;
  let w = length(width), h = length(height);
  if (w && !h && aspect) h = w / aspect;
  if (h && !w && aspect) w = h * aspect;
  if (!w && !h && aspect) { w = box[2] * MM.px; h = box[3] * MM.px; }
  if (!(w > 0 && h > 0) || w > 1000 || h > 1000) throw new Error('SVG width and height must resolve to 0–1000 mm. Export with millimetre dimensions or a viewBox.');
  return { width: Number(w.toFixed(8)), height: Number(h.toFixed(8)) };
}

/** Separate SVG moveto subpaths without inventing extrusion across pen-up gaps. */
export function splitSvgSubpaths(d) {
  const tokens = String(d).match(/[a-zA-Z]|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g) ?? [];
  const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const parts = []; let run = [], i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) cmd = tokens[i++];
    if (!cmd || !(cmd.toUpperCase() in arity)) throw new Error('Unsupported SVG path command');
    const upper = cmd.toUpperCase(), relative = cmd !== upper, n = arity[upper];
    if (upper === 'Z') { run.push(cmd); x = sx; y = sy; cmd = null; continue; }
    const values = tokens.slice(i, i + n).map(Number);
    if (values.length !== n || !values.every(Number.isFinite)) throw new Error('Incomplete SVG path');
    i += n;
    if (upper === 'M') {
      if (run.length) parts.push(run.join(' '));
      x = values[0] + (relative ? x : 0); y = values[1] + (relative ? y : 0); sx = x; sy = y;
      run = ['M', x, y]; cmd = relative ? 'l' : 'L';
    } else {
      run.push(cmd, ...values);
      if (upper === 'H') x = values[0] + (relative ? x : 0);
      else if (upper === 'V') y = values[0] + (relative ? y : 0);
      else { x = values[n - 2] + (relative ? x : 0); y = values[n - 1] + (relative ? y : 0); }
    }
  }
  if (run.length) parts.push(run.join(' '));
  return parts;
}

export function sanitizeSvgLines(raw) {
  if (!raw || !Number.isFinite(raw.width) || !Number.isFinite(raw.height) || raw.width <= 0 || raw.height <= 0 || raw.width > 1000 || raw.height > 1000 || !Array.isArray(raw.paths)) return null;
  let count = 0;
  for (const path of raw.paths) {
    if (!Array.isArray(path) || path.length < 2) return null;
    count += path.length; if (count > 100000) return null;
    if (path.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) return null;
  }
  return { name: String(raw.name ?? 'SVG lines').slice(0, 100), width: raw.width, height: raw.height, paths: raw.paths.map((path) => path.map(({ x, y }) => ({ x, y }))) };
}

/**
 * Closed shapes and open lines of a drawing's paths (points in mm): a path whose end is back at its start is a shape,
 * unless it is a speck. Shapes come back without the repeated end point.
 */
export function classifyPaths(paths, { closeTolerance = 0.35, minArea = 0.5 } = {}) {
  const closed = [], open = [];
  for (const path of paths) {
    if (path.length < 2) continue;
    const a = path[0], b = path[path.length - 1];
    if (path.length >= 4 && Math.hypot(a.x - b.x, a.y - b.y) <= closeTolerance) {
      let area = 0;
      for (let i = 1; i < path.length; i++) area += path[i - 1].x * path[i].y - path[i].x * path[i - 1].y;
      if (Math.abs(area) / 2 >= minArea) { closed.push(path.slice(0, -1)); continue; }
    }
    open.push(path);
  }
  return { closed, open };
}

/**
 * The closed shapes of a drawing as an outline that stays registered to the drawing's own lines: rings measured in the
 * drawing's longer side (so every number is 0 to 1, as a saved outline needs), with the drawing's size in `page`.
 * Simplified until it is small enough to save. Null when the drawing has no closed shape.
 */
export function outlineFromVector(vector, { maxPoints = 1800, maxRings = 64 } = {}) {
  const { closed } = classifyPaths(vector.paths);
  if (closed.length === 0) return null;
  const long = Math.max(vector.width, vector.height);
  let rings = closed;
  for (let tolerance = 0.05; tolerance <= 3.3; tolerance *= 2) {
    rings = closed.map((ring) => simplifyRing(ring, tolerance)).filter((ring) => ring.length >= 3);
    if (rings.reduce((n, ring) => n + ring.length, 0) <= maxPoints) break;
  }
  const unit = (n) => Math.max(0, Math.min(1, n / long));
  rings = rings.slice(0, maxRings).map((ring) => ring.map((p) => ({ x: unit(p.x), y: unit(p.y) })));
  if (rings.length === 0) return null;
  return { name: `${vector.name} shapes`, rings: flattenRings(rings), rotation: 0, page: [vector.width, vector.height] };
}

/**
 * Imported open strokes print first, with the currently selected structure above them. `clipLines: false` is for a
 * drawing that is also the outline: its closed shapes lie on the boundary itself, so they are kept whole (and are not
 * checked against it), while its open lines are still trimmed to what is inside.
 */
export function composeSvgLines(result, vector, { fullWidth = vector.width, fullHeight = vector.height, offsetX = 0, offsetY = 0, clipLines = true } = {}) {
  const { cfg } = result, h = cfg.t.layer_height, w = cfg.t.extrusion_width;
  const boundary = new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const shapeSet = new Set(classifyPaths(vector.paths).closed.map((ring) => ring[0]));
  const drawn = vector.paths.map((path, i) => ({ id: `svg-${i}`, name: 'Imported SVG lines', kind: 'base', layer: 0, fixed: true, shape: shapeSet.has(path[0]), pts: path.map((p) => ({ x: p.x * fullWidth / vector.width - offsetX, y: p.y * fullHeight / vector.height - offsetY, z: h })) }));
  const imported = clipLines
    ? clipStrands(drawn, boundary, w / 2)
    : [...drawn.filter((s) => s.shape).map((s) => ({ ...s, onBoundary: true })), ...clipStrands(drawn.filter((s) => !s.shape), boundary, w / 2)];
  const body = result.strands.map((s) => ({ ...s, id: `pattern-${s.id}`, layer: (s.layer ?? 0) + 1, pts: s.pts.map(({ cls, ...p }) => ({ ...p, z: result.placements ? p.z + h : 2 * h, ...(result.placements && cls ? { cls } : {}) })) }));
  let strands = [...imported, ...body];
  const beforeMm = travelDistance(strands);
  if (!result.placements) {
    const repaired = connectStrands(strands, boundary, { strandWidth: w });
    const last = Math.max(1, ...strands.map((s) => s.layer)) + 1;
    strands = orderStrands(repaired.strands.map((s) => ({ ...s, layer: s.layer === -1 ? last : s.layer, pts: s.name === 'Structural tie' ? s.pts.map((p) => ({ ...p, z: 2 * h })) : s.pts })));
    strands = resolveCrossings(strands, { follow: true, lift: h, strandWidth: w }).strands;
  } else {
    strands = [...orderStrands(imported), ...body];
  }
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []) };
  stats.loops = result.stats.loops;
  const fabric = analyzeFabric(strands, { strandWidth: w, layerHeight: h, boundary });
  return { ...result, strands, moves, stats, fabric, vector: { name: vector.name, paths: imported.length, width: fullWidth, height: fullHeight, offsetX, offsetY }, routing: { beforeMm, afterMm: travelDistance(strands) }, warnings: [...result.warnings, ...fabric.issues], gcode: writeGcode(moves, cfg, { stats, comments: [`SVG first layer: ${vector.name}`, `SVG document ${fullWidth} x ${fullHeight} mm; preview window ${offsetX}, ${offsetY}`] }) };
}
