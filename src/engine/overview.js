// Display-only full-piece XY geometry. These results never enter an exporter or a printable result cache.
import { designById } from '../ui/designs.js';
import { boundaryFor, hatch } from './layers.js';
import { interpretDrawing } from './drawing.js';
import { conformalGuideRegion } from './conformal.js';
import { generateSquiggleTextile, SAMPLERS, createImageSampler } from './squiggle.js';
import { generateCoilTextile } from './coil.js';
import { generateSpiralTextile, normalLines } from './spiral.js';
import { generateWeaveTextile } from './weave.js';
import { reliefPlacements } from './relief.js';
import { fringePlacements } from './fringe.js';
import { tile } from './tiler.js';
import { resolveConfig, ConfigError } from './params.js';
import { createRng } from './rng.js';
import { createField } from './fields.js';
import { spacerStrands, pillarWeaveStrands } from './pillars.js';

export function useWholeOverview(width, height, machine, choice = 'auto') {
  return choice === 'overview' || choice === 'auto' && (width > machine.bed.width || height > machine.bed.depth);
}

/** Do not hide ordinary validation errors behind a successful-looking 2D preview. */
export const canSimplifyPreview = error => /too many|moves[^.]*limit|exceeds?[^.]*(?:budget|move limit)|memory|allocation|bottom-left preview window/i.test(error?.message ?? '');

/** Preserve the real document dimensions, placement, holes and source strokes, even if texture building fails. */
export function overviewShape(input) {
  const { width, height, vector } = input;
  if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 5000)) throw new ConfigError(['Preview dimensions must be positive and at most 5000 mm.']);
  const model = vector ? interpretDrawing(vector, { scaleX: width / vector.width, scaleY: height / vector.height }) : null;
  const rings = input.outline ?? (input.shapeOutline && model?.rings.length ? model.rings : boundaryFor(width, height).rings);
  const source = vector ? vector.paths.map((pts, i) => ({
    pts: pts.map(p => ({ x: p.x * width / vector.width, y: p.y * height / vector.height })),
    color: vector.styles?.[i]?.color ?? 'black',
  })) : [];
  return { width, height, rings, source, guides: model?.guides ?? [] };
}

const LENGTH_KEYS = new Set(['spacing', 'depth', 'wavelength', 'amplitude', 'size', 'pitch', 'rowPitch', 'period', 'cell', 'block', 'gap', 'radius', 'warpPitch', 'weftPitch', 'designSpacing', 'backing1Spacing', 'backing2Spacing', 'rowGap', 'length', 'base_spacing', 'loop_width', 'loop_length', 'loop_pitch', 'leg_gap', 'anchor_dwell']);
export function overviewSettings(settings, factor) {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, LENGTH_KEYS.has(key) && typeof value === 'number' ? value * factor : value]));
}

export function rawLayers(input, shape, factor) {
  const mod = designById(input.design), { width, height } = shape;
  const s = { ...mod.defaults(), ...overviewSettings(input.settings ?? {}, factor), width, height, colorChange: false };
  const outer = boundaryFor(width, height, shape.rings);
  const boundary = shape.guides.length ? conformalGuideRegion(outer, shape.guides) : outer;
  const bead = (input.machine?.nozzle_diameter ?? .4) * 1.125;
  const context = { vector: input.vector, bead, vectorSize: [width, height], vectorOffset: [0, 0], includeLines: false };
  if (mod.overviewLayers) return mod.overviewLayers(s, boundary, context);
  const layersOf = result => [result.strands.map(s => s.pts)];
  if (input.design === 'spacer') return layersOf(spacerStrands(boundary, { ...s, layers: 1 }));
  if (input.design === 'pillarweave') return layersOf(pillarWeaveStrands(boundary, { ...s, layers: 2 }));
  if (input.design === 'squiggle') return layersOf(generateSquiggleTextile({ ...s, boundary, planCrossings: false,
    sampler: s.pattern === 'image' && input.image ? createImageSampler(input.image, width, height, { yUp: true }) : SAMPLERS[s.pattern] ?? SAMPLERS.centerSpot }));
  const field = ['coil', 'boucle', 'relief'].includes(input.design) && s.pattern && s.pattern !== 'none' ? createField(s.pattern, { scale: s.patternScale ?? 1 }) : null;
  if (input.design === 'coil' || input.design === 'boucle') return layersOf(generateCoilTextile({ ...s, boundary, planCrossings: false,
    shape: input.design === 'boucle' ? 'ring' : s.shape, rowOverlap: input.design === 'boucle' ? 0 : s.rowOverlap / 100,
    sizeAt: field ? (x, y) => field(x, y, width, height) : null }));
  if (input.design === 'weave') return layersOf(generateWeaveTextile({ ...s, boundary }));
  if (input.design === 'spiral') {
    const result = generateSpiralTextile({ ...s, boundary });
    return [result.strands.map(s => s.pts), s.second === 'normals' ? normalLines(result.field, boundary, { spacing: s.spacing }) : []];
  }
  if (input.design === 'relief') return [reliefPlacements({ ...s, boundary, field }).placements.map(p => p.points)];
  if (input.design === 'fringe') return [fringePlacements(s).placements.map(p => p.points)];
  if (input.design === 'loop-pile') {
    // The loop sampler uses configuration helpers, but preview dimensions never become a fictitious printable bed.
    const cfg = resolveConfig(input.machine, input.material, { ...input.settings, sample_width: Math.min(width, 1000), sample_height: Math.min(height, 1000) });
    Object.assign(cfg.t, overviewSettings(input.settings, factor), { sample_width: width, sample_height: height });
    cfg.derived.rowPitch = cfg.t.row_pitch_multiple * cfg.t.base_spacing;
    return [hatch(boundary, { spacing: cfg.t.base_spacing }), tile(cfg, boundary, createRng(cfg.t.random_seed)).placements.map(p => p.points)];
  }
  throw new Error('This design has no lightweight texture preview.');
}

/** The pattern sizes the 2D view tries, smallest first: true scale, then larger only when a design refuses or the drawing would be too big. */
export const OVERVIEW_FACTORS = [1, 1.6, 2.5, 4];

/**
 * Drops points that lie within `tolerance` of the line from the last kept point to the next one: one pass, so a
 * zigzag of millions of points thins in a moment (an exact Douglas-Peucker split is far slower on those).
 */
export function thinPolyline(pts, tolerance) {
  if (pts.length < 3) return pts.map(({ x, y }) => ({ x, y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  let a = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const off = len > 1e-9 ? Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len : Math.hypot(p.x - a.x, p.y - a.y);
    if (off > tolerance) { out.push({ x: p.x, y: p.y }); a = p; }
  }
  const last = pts[pts.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

/** Packs polylines into flat arrays: cheap to transfer from the worker, and to draw. */
export function packLines(lines) {
  const vertices = lines.reduce((n, s) => n + s.pts.length, 0);
  const xy = new Float32Array(vertices * 2), starts = new Uint32Array(lines.length + 1), layer = new Uint8Array(lines.length);
  let k = 0;
  lines.forEach((s, i) => {
    starts[i] = k / 2; layer[i] = s.layer;
    for (const p of s.pts) { xy[k++] = p.x; xy[k++] = p.y; }
  });
  starts[lines.length] = vertices;
  return { xy, starts, layer, vertices };
}

/**
 * The whole piece's texture in XY, drawn at the size it prints. Only when a design cannot build the whole piece (its own
 * limits) or the drawing would pass maxVertices is the pattern enlarged, and the result says by how much (factor), so the
 * view can label it. Lines are never dropped; print settings are never changed.
 */
export function buildOverview(input, { maxVertices = 4000000, factors = OVERVIEW_FACTORS } = {}) {
  const shape = overviewShape(input);
  // well below a strand's width: simplification never shows at true scale
  const tolerance = Math.min(0.08, Math.max(0.02, Math.max(shape.width, shape.height) / 20000));
  let issue = null;
  const strandWidth = (input.machine?.nozzle_diameter ?? .4) * 1.125;
  for (const factor of factors) {
    let layers;
    try { layers = rawLayers(input, shape, factor); } catch (error) { issue = error.message; continue; }
    const lines = layers.flatMap((layer, k) => layer.filter(pts => pts.length >= 2).map(pts => ({ layer: k, pts: thinPolyline(pts, tolerance) })));
    const packed = packLines(lines);
    if (packed.vertices > maxVertices) { issue = `The texture needs ${packed.vertices.toLocaleString('en')} points to draw at this size.`; continue; }
    return { ...shape, packed, lines: lines.length, vertices: packed.vertices, factor, strandWidth, shapeOnly: false, issue: factor > 1 ? issue : null };
  }
  return { ...shape, packed: packLines([]), lines: 0, vertices: 0, factor: null, strandWidth, shapeOnly: true, issue };
}
