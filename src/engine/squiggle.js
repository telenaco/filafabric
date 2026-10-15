import { resolveConfig, ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { PolygonBoundary } from './boundary.js';
import { serpentineChains } from './fill.js';
import { emitStrands } from './emit.js';
import { createField, FIELD_IDS } from './fields.js';
import { shapeAt, shapeStep } from './shapes.js';
import { resolveCrossings } from './crossings.js';
import { finishFabric } from './fabric-result.js';

/**
 * Squiggle Textile Generator
 *
 * Implements two multi-layer flexible textile structures:
 * 1. 'cross': Vertical Squiggle (Layer 1) + Horizontal Gyroid-wave (Layer 2)
 * 2. 'parallel': Dual Parallel Squiggle with Anti-Phase / Zigzag Overlap (both horizontal,
 *    overlapping at crossing nodes to form an auxetic / mesh lattice).
 *
 * Each layer is generated as one continuous serpentine toolpath (no hops or retractions),
 * with smooth turnaround arcs at row/column ends.
 */

/** Built-in procedural tone samplers */
export const SAMPLERS = {
  centerSpot: (x, y, w, h) => {
    const cx = w / 2, cy = h / 2;
    const r = Math.hypot(x - cx, y - cy);
    const maxR = Math.hypot(cx, cy);
    return Math.max(0, Math.min(1, 1 - r / maxR));
  },
  gradientX: (x, _y, w, _h) => Math.max(0, Math.min(1, x / w)),
  gradientY: (_x, y, _w, h) => Math.max(0, Math.min(1, y / h)),
  waves: (x, y, w, h) => {
    const v = Math.sin((x / w) * Math.PI * 4) * Math.cos((y / h) * Math.PI * 4);
    return 0.5 + 0.5 * v;
  },
  uniform: () => 0.6,
};

// every pattern field of the library is also a tone sampler
for (const id of FIELD_IDS) SAMPLERS[id] = createField(id);

/**
 * Creates an image-based tone sampler from Canvas ImageData (grayscale darkness 0..1). The picture spans the whole
 * `widthMm` x `heightMm`, whatever its own size in pixels: it adapts to the swatch, the swatch does not adapt to it.
 *
 * @param offsetX, offsetY  where the sampled window starts inside the swatch (mm), for a section of a larger panel
 * @param yUp  true when y grows upward (the printer's way): the picture's top row is at y = heightMm. Without it
 *             y counts down from the top of the picture, as pixels do.
 */
export function createImageSampler(imageData, widthMm, heightMm, { offsetX = 0, offsetY = 0, yUp = false } = {}) {
  const { data, width: imgW, height: imgH } = imageData;
  return (xMm, yMm) => {
    const y = yUp ? heightMm - (yMm + offsetY) : yMm + offsetY;
    const u = Math.max(0, Math.min(1, (xMm + offsetX) / widthMm));
    const v = Math.max(0, Math.min(1, y / heightMm));
    const px = Math.min(imgW - 1, Math.floor(u * imgW));
    const py = Math.min(imgH - 1, Math.floor(v * imgH));
    const idx = (py * imgW + px) * 4;
    // Standard luminance weights: 0.2126 R + 0.7152 G + 0.0722 B
    const lum = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
    // Darkness: 1 = dark (more ink / higher amplitude), 0 = white/light
    return Math.max(0, Math.min(1, 1 - lum));
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Builds continuous serpentine squiggle lines along one direction.
 * For horizontal: progresses along Y, undulates along Y (or X).
 * For vertical: progresses along X, undulates along X (or Y).
 */
function buildSerpentine({
  axis, // 'horizontal' (lines along X) | 'vertical' (lines along Y)
  spanLength, // length of each stroke (width if horizontal, height if vertical)
  laneCount,  // number of lines
  lanePitch,  // distance between lines
  minCoord,   // origin offset for lane
  minSpan,    // origin offset along stroke
  stepSize = 0.5,
  waveFn,     // (laneIdx, s, sNorm, isReverse) => { coordOffset, spanOffset }
  z,
}) {
  const pts = [];
  const push = (x, y) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 1e-6) {
      pts.push({ x, y, z });
    }
  };

  for (let k = 0; k < laneCount; k++) {
    const laneBase = minCoord + k * lanePitch;
    const isReverse = k % 2 === 1;
    const sStart = isReverse ? spanLength : 0;
    const sEnd = isReverse ? 0 : spanLength;
    const sSteps = Math.max(2, Math.ceil(spanLength / stepSize));

    for (let i = 0; i <= sSteps; i++) {
      const t = i / sSteps;
      const s = sStart + (sEnd - sStart) * t;
      const sNorm = s / spanLength;
      const { coordOffset = 0, spanOffset = 0 } = waveFn(k, s, sNorm, isReverse);

      const spanActual = minSpan + s + spanOffset;
      const laneActual = laneBase + coordOffset;

      if (axis === 'horizontal') {
        push(spanActual, laneActual);
      } else {
        push(laneActual, spanActual);
      }
    }

    // Connect to next lane if not the last lane (smooth turnaround curve)
    if (k < laneCount - 1) {
      const nextLaneBase = minCoord + (k + 1) * lanePitch;
      const edgeS = sEnd;
      const arcSteps = 4;
      for (let a = 1; a <= arcSteps; a++) {
        const at = a / arcSteps;
        const laneInterp = laneBase + (nextLaneBase - laneBase) * at;
        // slight outward bulge for rounded turnaround
        const bulge = Math.sin(at * Math.PI) * (lanePitch * 0.25);
        const spanInterp = minSpan + edgeS + (isReverse ? -bulge : bulge);

        if (axis === 'horizontal') {
          push(spanInterp, laneInterp);
        } else {
          push(laneInterp, spanInterp);
        }
      }
    }
  }

  return pts;
}

/**
 * In parallel mode the second layer runs halfway between the first layer's lines, so each wave must swing at
 * least a quarter of the line spacing to reach a neighbour, plus half a strand so the two overlap by a full
 * strand width where they cross. Without that, two layers of parallel lines have nothing holding them together.
 */
export function minCrossingAmplitude(spacing, strandWidth = 0.45) {
  return spacing / 4 + strandWidth / 2;
}

/**
 * One layer as printable strands. A rectangle (no outline) is one continuous serpentine; an outline is clipped
 * lane by lane and joined into as few strands as its shape allows.
 * Lanes are `lanePitch` apart starting at `firstLane`; `waveFn(laneIdx, s, sNorm, isReverse)` gives the offset.
 */
function layerStrands({ boundary, axis, firstLane, laneCount, lanePitch, spanLength, stepSize, waveFn, z }) {
  if (!boundary || boundary.isRectangle) {
    return [buildSerpentine({
      axis: axis === 'y' ? 'horizontal' : 'vertical',
      spanLength, laneCount, lanePitch, minCoord: firstLane, minSpan: 0, stepSize, waveFn, z,
    })];
  }
  const lanes = Array.from({ length: laneCount }, (_, k) => firstLane + k * lanePitch);
  const chains = serpentineChains(boundary, axis, lanes, { inset: 0.3, minLength: 1, maxJog: 3 * lanePitch });
  return chains.map((segments) => {
    const pts = [];
    const push = (x, y) => {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 1e-6) pts.push({ x, y, z });
    };
    for (const seg of segments) {
      const steps = Math.max(2, Math.ceil(Math.abs(seg.to - seg.from) / stepSize));
      for (let i = 0; i <= steps; i++) {
        const sPos = seg.from + ((seg.to - seg.from) * i) / steps;
        const { coordOffset = 0, spanOffset = 0 } = waveFn(seg.lane, sPos, sPos / spanLength, seg.to < seg.from);
        if (axis === 'y') push(sPos + spanOffset, seg.c + coordOffset);
        else push(seg.c + coordOffset, sPos + spanOffset);
      }
    }
    return pts;
  });
}

/**
 * Generate 2-layer Squiggle textile toolpath.
 *
 * @param {Object} options
 * @param {number} options.width - swatch width in mm
 * @param {number} options.height - swatch height in mm
 * @param {string} options.mode - 'cross' | 'parallel'
 * @param {string} [options.shape] - strand shape (see shapes.js); 'wave' is the original sine wave
 * @param {number} options.spacing - line spacing in mm (e.g. 2.5)
 * @param {number} options.amplitude - max wave amplitude in mm (e.g. 1.2)
 * @param {number} options.wavelength - base wave cycle length in mm (e.g. 4.0)
 * @param {number} options.layerHeight - layer height in mm (e.g. 0.2)
 * @param {number} [options.strandWidth] - printed strand width in mm, for the parallel crossing depth
 * @param {Function} [options.sampler] - (x, y, w, h) => darkness [0..1]
 * @param {boolean} [options.colorChange] - whether M600 filament pause is requested
 * @param {Object} [options.boundary] - an outline (PolygonBoundary) to fill instead of the full rectangle
 * @returns {{ layer1: Array, layer2: Array, strands: Array }}
 */
export function generateSquiggleTextile({
  width = 100,
  height = 100,
  mode = 'cross',
  shape = 'wave',
  spacing = 2.5,
  amplitude = 1.2,
  wavelength = 4.0,
  layerHeight = 0.2,
  strandWidth = 0.45,
  sampler = SAMPLERS.centerSpot,
  colorChange = false,
  boundary = null,
}) {
  const z1 = layerHeight;
  const z2 = layerHeight * 2;
  const minAmp = 0.15 * amplitude;
  const ampRange = 0.85 * amplitude;
  const baseFreq = 1 / Math.max(0.5, wavelength);
  const tone = (x, y) => clamp(sampler(x, y, width, height), 0, 1);

  // Shapes other than the sine wave come from the strand-shape library. A looped line also swings back along the
  // lane, so the lane is sampled more finely, and a strand that crosses itself lifts over its earlier pass.
  const shaped = shape !== 'wave';
  const step = shaped ? shapeStep(shape, Math.max(0.5, wavelength), amplitude, 0.6) : 0.4;
  const offsets = (travelled, size, isReverse, flip = 1) => {
    const { v, du } = shapeAt(shape, travelled, { pitch: Math.max(0.5, wavelength), size });
    return { coordOffset: flip * v, spanOffset: isReverse ? -du : du };
  };

  let layer1 = [];
  let layer2 = [];

  if (mode === 'cross') {
    // -------------------------------------------------------------------------
    // Mode A: Cross Interlock
    // Layer 1: Vertical squiggles (columns along Y, undulating along X)
    // Layer 2: Horizontal gyroid / undulating wave (rows along X, undulating along Y)
    // -------------------------------------------------------------------------
    const cols = Math.max(2, Math.floor(width / spacing));
    const pitchX = width / cols;
    const minX = pitchX / 2;

    layer1 = layerStrands({
      boundary, axis: 'x', firstLane: minX, laneCount: cols, lanePitch: pitchX, spanLength: height, stepSize: step, z: z1,
      waveFn: (colIdx, y, _n, isReverse) => {
        const xNominal = minX + colIdx * pitchX;
        const t = tone(xNominal, y);
        const amp = minAmp + ampRange * t;
        if (shaped) return offsets(isReverse ? height - y : y, amp, isReverse);
        // Frequency increases in darker areas
        const freq = baseFreq * (1 + 1.2 * t);
        const phase = 2 * Math.PI * freq * y + colIdx * 0.5;
        return { coordOffset: amp * Math.sin(phase), spanOffset: 0 };
      },
    });

    const rows = Math.max(2, Math.floor(height / spacing));
    const pitchY = height / rows;
    const minY = pitchY / 2;
    const gyroidWavelength = Math.max(1.0, wavelength * 1.25);
    const gyroidFreq = 1 / gyroidWavelength;
    const gyroidAmp = Math.min(pitchY * 0.45, amplitude * 0.8);

    layer2 = layerStrands({
      boundary, axis: 'y', firstLane: minY, laneCount: rows, lanePitch: pitchY, spanLength: width, stepSize: step, z: z2,
      waveFn: (rowIdx, x, _n, isReverse) => {
        // Gyroid-like alternating phase per row
        const rowPhase = (rowIdx % 2) * Math.PI;
        const yNominal = minY + rowIdx * pitchY;
        const localAmp = gyroidAmp * (0.6 + 0.4 * tone(x, yNominal));
        if (shaped) return offsets((isReverse ? width - x : x) + (rowIdx % 2) * (wavelength / 2), localAmp, isReverse);
        const phase = 2 * Math.PI * gyroidFreq * x + rowPhase;
        return { coordOffset: localAmp * Math.sin(phase), spanOffset: 0 };
      },
    });
  } else {
    // -------------------------------------------------------------------------
    // Mode B: Parallel, offset by half a line
    // Both layers run along X. Layer 2's lines sit halfway between layer 1's, in opposite phase, and every wave
    // is at least deep enough to cross the lines on both sides: each layer-2 line crosses the layer-1 line below
    // near its peaks and the one above near its troughs, so the two layers form one connected net.
    // The pattern deepens the waves; their length stays constant so every crossing stays in step.
    // -------------------------------------------------------------------------
    const rows = Math.max(2, Math.floor(height / spacing));
    const pitchY = height / rows;
    const minY = pitchY / 2;
    const floor = minCrossingAmplitude(pitchY, strandWidth);
    const k = 2 * Math.PI * baseFreq;
    const ampAt = (x, y) => Math.max(floor, minAmp + ampRange * tone(x, y));

    layer1 = layerStrands({
      boundary, axis: 'y', firstLane: minY, laneCount: rows, lanePitch: pitchY, spanLength: width, stepSize: step, z: z1,
      waveFn: (rowIdx, x, _n, isReverse) => {
        const yNominal = minY + rowIdx * pitchY;
        if (shaped) return offsets(isReverse ? width - x : x, ampAt(x, yNominal), isReverse);
        return { coordOffset: ampAt(x, yNominal) * Math.sin(k * x), spanOffset: 0 };
      },
    });
    layer2 = layerStrands({
      boundary, axis: 'y', firstLane: minY + pitchY / 2, laneCount: rows - 1, lanePitch: pitchY, spanLength: width, stepSize: step, z: z2,
      waveFn: (rowIdx, x, _n, isReverse) => {
        const yNominal = minY + (rowIdx + 0.5) * pitchY;
        if (shaped) return offsets(isReverse ? width - x : x, ampAt(x, yNominal), isReverse, -1);
        return { coordOffset: -ampAt(x, yNominal) * Math.sin(k * x), spanOffset: 0 };
      },
    });
  }

  // loops need fine sampling, so a big swatch of tight loops can run to millions of points: refuse it plainly
  const points = layer1.reduce((n, p) => n + p.length, 0) + layer2.reduce((n, p) => n + p.length, 0);
  if (points > MAX_MOVES) {
    throw new ConfigError([
      `This layout would need about ${points.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use wider line spacing, longer or shallower waves, a plainer strand shape or a smaller swatch.`,
    ]);
  }

  if (shaped) {
    const lift = layerHeight * 1.25;
    const settle = (layer, prefix) => resolveCrossings(
      layer.map((pts, i) => ({ id: `${prefix}${i}`, kind: 'base', pts })),
      { lift, strandWidth },
    ).strands.map((s) => s.pts.map(({ cls, ...p }) => p)); // layers keep their own colour role
    layer1 = settle(layer1, 'l1-');
    layer2 = settle(layer2, 'l2-');
  }

  const strands = [
    ...layer1.map((pts, i) => ({ kind: 'base', layer: 0, id: i === 0 ? 'squiggle-l1' : `squiggle-l1-${i + 1}`, pts, lift: 0, name: 'Layer 1 (Base Squiggle)' })),
    ...layer2.map((pts, i) => ({
      kind: 'supported',
      layer: 1,
      id: i === 0 ? 'squiggle-l2' : `squiggle-l2-${i + 1}`,
      pts,
      lift: layerHeight,
      name: 'Layer 2 (Interlock / Gyroid)',
      pauseBefore: colorChange && i === 0,
    })),
  ];

  return { layer1: layer1.flat(), layer2: layer2.flat(), strands };
}

/**
 * End-to-end generator for Squiggle Textile:
 * converts machine, material and squiggle parameters into moves, stats, and G-code.
 */
export function generateSquiggle(machine, material, squiggleParams = {}) {
  const width = squiggleParams.width ?? 100;
  const height = squiggleParams.height ?? 100;
  const cfg = resolveConfig(machine, material, {
    sample_width: width,
    sample_height: height,
    // only when asked for, so the layer thickness the studio chose (on the material) is not overridden
    ...(squiggleParams.layerHeight !== undefined ? { layer_height: squiggleParams.layerHeight } : {}),
  });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);

  const outline = squiggleParams.outline ?? null;
  const res = generateSquiggleTextile({
    width,
    height,
    boundary: outline ? new PolygonBoundary(outline) : null,
    strandWidth: cfg.t.extrusion_width,
    mode: squiggleParams.mode ?? 'cross',
    shape: squiggleParams.shape ?? 'wave',
    spacing: squiggleParams.spacing ?? 2.5,
    amplitude: squiggleParams.amplitude ?? 1.2,
    wavelength: squiggleParams.wavelength ?? 4.0,
    layerHeight: cfg.t.layer_height,
    sampler: squiggleParams.sampler ?? SAMPLERS.centerSpot,
    colorChange: squiggleParams.colorChange ?? false,
  });

  const moves = emitStrands(res.strands);

  const stats = computeStats(moves, cfg, []);
  stats.loops = 0;
  const gcode = writeGcode(moves, cfg, { stats });

  const warnings = moves.length === 0 ? ['The outline is too small for these lines: nothing to print'] : [];
  return finishFabric({ cfg, strands: res.strands, moves, stats, warnings, gcode, outline }, { flat: true });
}

