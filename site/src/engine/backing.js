import { hatch, layersToStrands } from './layers.js';
import { infillLines, INFILL_IDS } from './infill.js';
import { waveLines } from './wavegrid.js';
import { PolygonBoundary } from './boundary.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { analyzeFabric } from './fabric.js';
import { writeGcode } from './gcode.js';
import { headerNotes } from './brim.js';
import { nativeLayerInfo } from './stack.js';
import { MAX_MOVES } from './tiler.js';
import { ConfigError } from './params.js';

/**
 * The layers laid across a curve or a field to hold it: lines at an angle over the first layer.
 *
 *  - 'wave'     sine-wave lines whose depth and length you set: the wavy backing, close to a gyroid slice
 *  - 'gyroid'   the lines of a gyroid slice itself, fixed in shape
 *  - 'straight' plain parallel lines (a hatch)
 *
 * One backing makes a design two layers; a second backing, turned across the first, makes it three.
 */
export const BACKING_STYLES = Object.freeze(['wave', 'gyroid', 'straight']);
export const BACKING_LAYER_COUNTS = Object.freeze(['one', 'two']);

/**
 * @param style      'wave' | 'gyroid' | 'straight'
 * @param angle      degrees the whole backing is turned
 * @param spacing    mm between lines: for the gyroid and straight backings area / length, for the wave the distance
 *                   between the lines' centres
 * @param depth      wave only: mm each line swings to either side of its centre line
 * @param wavelength wave only: mm per full wave
 * @param layer      which backing layer this is (1, 2): a wave is shifted a quarter wave per layer, a gyroid moves on a slice
 */
export function backingLines(boundary, { style = 'straight', angle = 45, spacing = 5, depth = 2, wavelength = 10, layer = 1 } = {}) {
  if (style === 'gyroid') return infillLines('gyroid', boundary, { spacing, angle, layer });
  if (style === 'wave') return waveLines(boundary, { angle, spacing, amplitude: depth, wavelength, shape: 'sine', phase: 0.25 * (layer - 1) });
  if (style === 'zigzag') return waveLines(boundary, { angle, spacing, amplitude: depth, wavelength, shape: 'triangle', phase: 0.25 * (layer - 1) });
  return hatch(boundary, { angle, spacing });
}

export const SUPPORT_STYLES = Object.freeze([...BACKING_STYLES, 'zigzag']);
const finite = (value, min, max, fallback) => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;

/** Read the native legacy carrier, not an additional global backing. */
export function legacySupport(settings = {}, drawing = false) {
  const style = drawing ? settings.backing1Pattern : settings.backing;
  return sanitizeSupport({
    style: SUPPORT_STYLES.includes(style) ? style : 'straight',
    openness: drawing ? settings.backing1Spacing ?? 4 : settings.spacing ?? 5,
    depth: settings.backingDepth ?? 2, wavelength: settings.backingLength ?? 10,
    layers: settings.backing === 'two' || settings.backingLayers === 'two' ? 2 : 1,
    angle: drawing ? settings.backing1Angle ?? 0 : settings.angle ?? 45,
    order: 'motif-first',
    ...(drawing ? { enabled: settings.backing !== 'none', area: settings.backingArea ?? 'swatch', passes: [1, 2].map(k => ({ pattern: settings[`backing${k}Pattern`] ?? (k === 1 ? 'gyroid' : 'triangles'), spacing: settings[`backing${k}Spacing`] ?? (k === 1 ? 4 : 6), angle: settings[`backing${k}Angle`] ?? (k === 1 ? 0 : 15) })) } : {}),
  });
}

/** Canonical, bounded support state. Legacy custom SVG passes remain data, never arbitrary code. */
export function sanitizeSupport(raw, fallback = {}) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {
    style: SUPPORT_STYLES.includes(s.style) ? s.style : fallback.style ?? 'straight',
    openness: finite(s.openness ?? s.spacing, .5, 50, fallback.openness ?? 5),
    depth: finite(s.depth, 0, 20, fallback.depth ?? 2),
    wavelength: finite(s.wavelength, .5, 100, fallback.wavelength ?? 10),
    layers: s.layers === 1 || s.layers === 2 ? s.layers : fallback.layers ?? 1,
    angle: finite(s.angle, -180, 180, fallback.angle ?? 45),
    // Only the existing order (the motif first, its carrier above it) is built. 'carrier-first' is not offered until the two
    // orders have been compared on printed swatches, so a saved value can never promise an order that does not print.
    order: 'motif-first',
  };
  if ('enabled' in s || 'enabled' in fallback) out.enabled = typeof s.enabled === 'boolean' ? s.enabled : fallback.enabled !== false;
  if ('area' in s || 'area' in fallback) out.area = ['swatch', 'shape', 'box'].includes(s.area) ? s.area : fallback.area ?? 'swatch';
  if (Array.isArray(s.passes)) out.passes = s.passes.slice(0, 2).map(pass => ({ pattern: INFILL_IDS.includes(pass?.pattern) ? pass.pattern : 'rectilinear', spacing: finite(pass?.spacing, .5, 50, out.openness), angle: finite(pass?.angle, -180, 180, out.angle) }));
  return out;
}

/** One carrier source, at most two passes; second pass turns 90 degrees. */
export function carrierLayers(boundary, support) {
  const s = sanitizeSupport(support);
  if (s.enabled === false) return [];
  if (s.passes?.length) return s.passes.slice(0, s.layers).map((pass, k) => Object.assign(infillLines(pass.pattern, boundary, { spacing: pass.spacing, angle: pass.angle, layer: k + 1 }), { family: `carrier-${k + 1}`, role: 'carrier' }));
  return backingStack(boundary, { style: s.style, spacing: s.openness, depth: s.depth, wavelength: s.wavelength, angle: s.angle }, s.layers === 2 ? 'two' : 'one');
}

/**
 * The backing layers of a design: one, or two with the second turned 90° across the first.
 * @param count  'one' | 'two'
 * @returns an array of layers, each an array of polylines
 */
export function backingStack(boundary, options, count = 'one') {
  const tag = (lines, k) => Object.assign(lines, { family: `carrier-${k}`, role: 'carrier' });
  const first = tag(backingLines(boundary, { ...options, layer: 1 }), 1);
  if (count !== 'two') return [first];
  return [first, tag(backingLines(boundary, { ...options, angle: (options.angle ?? 45) + 90, layer: 2 }), 2)];
}

/**
 * The backing mesh any flat design can stand on: the Zigzag mesh with the settings it was tuned with (lines 3.7 mm apart,
 * 2 mm each way, 6 mm waves, the second layer half a wave along so the two cross all along), printed first under the
 * whole piece. `pause` stops for a filament change once it is down, so the design can be another colour.
 */
export const BACKING_MESH = Object.freeze({ spacing: 3.7, depth: 2, wavelength: 6, pause: false });
export const BACKING_MESH_LAYERS = 2;

/**
 * A finished flat result on a backing mesh: two flat zigzag layers across its piece (the drawing's whole piece when it
 * has one, its outline or the swatch otherwise), then the design as it was, every point two layers higher, so a slicer's
 * layer order holds. A raised design (loops, pillars, a spacer) stands on its own base and is returned as it is, with a
 * note. `backing` null or undefined: no backing.
 */
export function addBackingMesh(result, backing, { mesh: given = null, layers = BACKING_MESH_LAYERS, name = 'Backing mesh', last = false } = {}) {
  if (!backing || !result?.cfg || !result.strands?.length) return result;
  const { spacing, depth, wavelength, pause } = { ...BACKING_MESH, ...backing };
  if (nativeLayerInfo(result).raised) {
    return { ...result, warnings: [...(result.warnings ?? []), 'This design stands on its own base, so the backing mesh is left out: add extra backing layers in the printer setup instead.'] };
  }
  const { cfg } = result, h = cfg.t.layer_height, bead = cfg.t.extrusion_width, W = cfg.t.sample_width, H = cfg.t.sample_height;
  const boundary = new PolygonBoundary(result.pieceOutline ?? result.outline ?? [[{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]]);
  const wave = { spacing, amplitude: depth, wavelength, shape: 'triangle', angle: 0 };
  const mesh = (given ?? layersToStrands([waveLines(boundary, wave), waveLines(boundary, { ...wave, phase: 0.5 })], { layerHeight: h, strandWidth: bead }))
    .map((s, i) => ({ ...s, id: `backing-${i + 1}`, family: `carrier-${(s.layer ?? 0) + 1}`, role: 'carrier', name, backingMesh: true, pauseBefore: false }));
  if (!mesh.length) throw new ConfigError(['The backing mesh does not fit this outline. Use a smaller line spacing or wave depth.']);
  let strands;
  if (last) {
    // printed last: the design as it was, then the mesh one layer above its top, laid over it
    const top = Math.max(...result.strands.flatMap((s) => s.pts.map((p) => p.z)));
    const over = mesh.map((s, i) => ({ ...s, kind: 'supported', ...(pause && i === 0 ? { pauseBefore: true } : {}),
      pts: s.pts.map((p) => ({ ...p, z: top + p.z, ...(p.cls === 'base' ? { cls: 'supported' } : {}) })) }));
    strands = [...result.strands, ...over];
  } else {
    // the design keeps its own heights, classes and order, two layers up: what lay on the bed now lies on the mesh
    const rise = layers * h;
    const body = result.strands.map((s, i) => ({ ...s, kind: 'supported', ...(pause && i === 0 ? { pauseBefore: true } : {}),
      pts: s.pts.map((p) => ({ ...p, z: p.z + rise, ...(p.cls === 'base' ? { cls: 'supported' } : {}) })) }));
    strands = [...mesh, ...body];
  }
  if (strands.reduce((n, s) => n + s.pts.length + 4, 0) > MAX_MOVES) throw new ConfigError(['The backing mesh would take the print past the move limit. Use a wider line spacing or a smaller swatch.']);
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []), loops: result.stats.loops, crossings: result.stats.crossings };
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const backingMesh = { layers, spacing, depth, wavelength, pause: !!pause };
  const note = `${name}: ${layers} zigzag ${layers === 1 ? 'layer' : 'layers'}, ${spacing} mm apart, ${depth} mm deep, ${wavelength} mm waves, ${last ? 'over the design, printed last' : 'under the design'}${pause ? '; a filament change after it' : ''}`;
  return {
    ...result, strands, moves, stats, fabric, warnings, backingMesh,
    ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}),
    gcode: writeGcode(moves, cfg, { stats, comments: [...headerNotes(result), note] }),
  };
}
