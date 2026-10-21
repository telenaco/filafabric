import { hatch, layersToStrands } from './layers.js';
import { infillLines } from './infill.js';
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
  return hatch(boundary, { angle, spacing });
}

/**
 * The backing layers of a design: one, or two with the second turned 90° across the first.
 * @param count  'one' | 'two'
 * @returns an array of layers, each an array of polylines
 */
export function backingStack(boundary, options, count = 'one') {
  const first = backingLines(boundary, { ...options, layer: 1 });
  if (count !== 'two') return [first];
  return [first, backingLines(boundary, { ...options, angle: (options.angle ?? 45) + 90, layer: 2 })];
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
export function addBackingMesh(result, backing) {
  if (!backing || !result?.cfg || !result.strands?.length) return result;
  const { spacing, depth, wavelength, pause } = { ...BACKING_MESH, ...backing };
  if (nativeLayerInfo(result).raised) {
    return { ...result, warnings: [...(result.warnings ?? []), 'This design stands on its own base, so the backing mesh is left out: add extra backing layers in the printer setup instead.'] };
  }
  const { cfg } = result, h = cfg.t.layer_height, bead = cfg.t.extrusion_width, W = cfg.t.sample_width, H = cfg.t.sample_height;
  const boundary = new PolygonBoundary(result.pieceOutline ?? result.outline ?? [[{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]]);
  const wave = { spacing, amplitude: depth, wavelength, shape: 'triangle', angle: 0 };
  const mesh = layersToStrands([waveLines(boundary, wave), waveLines(boundary, { ...wave, phase: 0.5 })], { layerHeight: h, strandWidth: bead })
    .map((s, i) => ({ ...s, id: `backing-${i + 1}`, name: 'Backing mesh', backingMesh: true, pauseBefore: false }));
  if (!mesh.length) throw new ConfigError(['The backing mesh does not fit this outline. Use a smaller line spacing or wave depth.']);
  // the design keeps its own heights, classes and order, two layers up: what lay on the bed now lies on the mesh
  const rise = BACKING_MESH_LAYERS * h;
  const body = result.strands.map((s, i) => ({ ...s, kind: 'supported', ...(pause && i === 0 ? { pauseBefore: true } : {}),
    pts: s.pts.map((p) => ({ ...p, z: p.z + rise, ...(p.cls === 'base' ? { cls: 'supported' } : {}) })) }));
  const strands = [...mesh, ...body];
  if (strands.reduce((n, s) => n + s.pts.length + 4, 0) > MAX_MOVES) throw new ConfigError(['The backing mesh would take the print past the move limit. Use a wider line spacing or a smaller swatch.']);
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, result.placements ?? []), loops: result.stats.loops, crossings: result.stats.crossings };
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const backingMesh = { layers: BACKING_MESH_LAYERS, spacing, depth, wavelength, pause: !!pause };
  const note = `Backing mesh: ${BACKING_MESH_LAYERS} zigzag layers, ${spacing} mm apart, ${depth} mm deep, ${wavelength} mm waves, under the design${pause ? '; a filament change after it' : ''}`;
  return {
    ...result, strands, moves, stats, fabric, warnings, backingMesh,
    ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}),
    gcode: writeGcode(moves, cfg, { stats, comments: [...headerNotes(result), note] }),
  };
}
