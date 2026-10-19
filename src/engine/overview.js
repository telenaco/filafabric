// Display-only full-piece XY geometry. These results never enter an exporter or a printable result cache.
import { designById } from '../ui/designs.js';
import { boundaryFor, hatch } from './layers.js';
import { interpretDrawing } from './drawing.js';
import { conformalGuideRegion } from './conformal.js';
import { simplifyStrands } from './fabric.js';
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

function rawLayers(input, shape, factor) {
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

/** Budget both texture density and transferred vertices. Simplification is visible and never changes print settings. */
export function buildOverview(input, { fine = false } = {}) {
  const shape = overviewShape(input);
  const budget = fine ? 100000 : 35000;
  let factor = Math.max(1, Math.sqrt(shape.width * shape.height / (fine ? 160000 : 40000)));
  let layers, issue = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { layers = rawLayers(input, shape, factor); break; }
    catch (error) { issue = error.message; factor *= 2; }
  }
  if (!layers) return { ...shape, layers: [], simplified: true, shapeOnly: true, issue };
  let lines = layers.flatMap((layer, k) => layer.filter(pts => pts.length >= 2).map(pts => ({ layer: k, pts: pts.map(({ x, y }) => ({ x, y })) })));
  const tolerance = Math.max(shape.width, shape.height) / (fine ? 2400 : 1200);
  lines = simplifyStrands(lines, tolerance);
  if (lines.length * 2 > budget) {
    const every = Math.ceil(lines.length / Math.floor(budget / 2));
    lines = lines.filter((_, i) => i % every === 0);
  }
  const count = lines.reduce((n, s) => n + s.pts.length, 0);
  // Sample each polyline over its whole length, retaining both ends; never crop to the first N points.
  if (count > budget) {
    const interior = count - 2 * lines.length, available = budget - 2 * lines.length;
    lines = lines.map(s => {
      const keep = 2 + Math.floor((s.pts.length - 2) * available / interior);
      return { layer: s.layer, pts: Array.from({ length: keep }, (_, i) => s.pts[Math.round(i * (s.pts.length - 1) / (keep - 1))]) };
    });
  }
  return { ...shape, layers: lines, simplified: true, shapeOnly: false, spacingFactor: factor, vertices: lines.reduce((n, s) => n + s.pts.length, 0) };
}
