import { clipStrands, connectStrands, orderStrands, analyzeFabric, travelDistance } from './fabric.js';
import { resolveCrossings } from './crossings.js';
import { PolygonBoundary } from './boundary.js';
import { simplifyRing, flattenRings } from './outline.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';
import { classifyPaths, interpretDrawing, drawingPolylines, sanitizeSvgLines } from './drawing.js';
import { svgDimensions } from './svg-parse.js';

// The reading of a drawing lives in drawing.js (what red, blue and line widths mean) and svg-parse.js (the file).
export { svgDimensions, classifyPaths, sanitizeSvgLines };

/**
 * The filled shapes of a drawing (red ones, less the blue holes in them) as an outline that stays registered to the
 * drawing's own lines: rings measured in the drawing's longer side (so every number is 0 to 1, as a saved outline
 * needs), with the drawing's size in `page`. Simplified until it is small enough to save. Null when nothing is filled.
 */
export function outlineFromVector(vector, { maxPoints = 1800, maxRings = 64 } = {}) {
  const closed = interpretDrawing(vector).rings;
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
 * The drawing prints first, with the currently selected structure above it: its lines (each as many passes as its
 * width asks for) and the outlines of its red and blue shapes. `clipLines: false` is for a drawing that is also the
 * outline: the edges of its filled shapes lie on the boundary itself, so they are kept whole, and its lines are printed
 * as drawn (a line across a hole is what ties an island to the rest), trimmed only to the swatch. Neither is checked
 * against the outline.
 */
export function composeSvgLines(result, vector, { fullWidth = vector.width, fullHeight = vector.height, offsetX = 0, offsetY = 0, clipLines = true } = {}) {
  const { cfg } = result, h = cfg.t.layer_height, w = cfg.t.extrusion_width;
  const boundary = new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const { clipped, whole } = drawingPolylines(vector, { scaleX: fullWidth / vector.width, scaleY: fullHeight / vector.height, offsetX, offsetY, bead: w, edges: clipLines ? 'all' : 'kept' });
  let serial = 0;
  const strand = (poly) => ({ id: `svg-${serial++}`, name: 'Imported SVG lines', kind: 'base', layer: 0, fixed: true, shape: poly.shape, pts: poly.pts.map((p) => ({ x: p.x, y: p.y, z: h })) });
  const swatch = new PolygonBoundary([[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const lines = clipLines
    ? clipStrands(clipped.map(strand), boundary, w / 2)
    : clipStrands(clipped.map(strand), swatch, w / 2).map((s) => ({ ...s, onBoundary: true }));
  const imported = [...whole.map((poly) => ({ ...strand(poly), onBoundary: true })), ...lines];
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
