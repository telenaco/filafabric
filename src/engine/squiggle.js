import { resolveConfig } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';

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

/**
 * Creates an image-based tone sampler from Canvas ImageData (grayscale darkness 0..1).
 */
export function createImageSampler(imageData, widthMm, heightMm) {
  const { data, width: imgW, height: imgH } = imageData;
  return (xMm, yMm) => {
    const u = Math.max(0, Math.min(1, xMm / widthMm));
    const v = Math.max(0, Math.min(1, yMm / heightMm));
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
 * Generate 2-layer Squiggle textile toolpath.
 *
 * @param {Object} options
 * @param {number} options.width - swatch width in mm
 * @param {number} options.height - swatch height in mm
 * @param {string} options.mode - 'cross' | 'parallel'
 * @param {number} options.spacing - line spacing in mm (e.g. 2.5)
 * @param {number} options.amplitude - max wave amplitude in mm (e.g. 1.2)
 * @param {number} options.wavelength - base wave cycle length in mm (e.g. 4.0)
 * @param {number} options.layerHeight - layer height in mm (e.g. 0.2)
 * @param {Function} [options.sampler] - (x, y, w, h) => darkness [0..1]
 * @param {boolean} [options.colorChange] - whether M600 filament pause is requested
 * @returns {{ layer1: Array, layer2: Array, strands: Array }}
 */
export function generateSquiggleTextile({
  width = 50,
  height = 50,
  mode = 'cross',
  spacing = 2.5,
  amplitude = 1.2,
  wavelength = 4.0,
  layerHeight = 0.2,
  sampler = SAMPLERS.centerSpot,
  colorChange = false,
}) {
  const z1 = layerHeight;
  const z2 = layerHeight * 2;
  const minAmp = 0.15 * amplitude;
  const ampRange = 0.85 * amplitude;
  const baseFreq = 1 / Math.max(0.5, wavelength);

  let layer1Pts = [];
  let layer2Pts = [];

  if (mode === 'cross') {
    // -------------------------------------------------------------------------
    // Mode A: Cross Interlock
    // Layer 1: Vertical squiggles (columns along Y, undulating along X)
    // Layer 2: Horizontal gyroid / undulating wave (rows along X, undulating along Y)
    // -------------------------------------------------------------------------
    const cols = Math.max(2, Math.floor(width / spacing));
    const pitchX = width / cols;
    const minX = pitchX / 2;

    // Layer 1: Vertical Squiggles
    layer1Pts = buildSerpentine({
      axis: 'vertical',
      spanLength: height,
      laneCount: cols,
      lanePitch: pitchX,
      minCoord: minX,
      minSpan: 0,
      stepSize: 0.4,
      waveFn: (colIdx, y, _yNorm, _isReverse) => {
        const xNominal = minX + colIdx * pitchX;
        const tone = clamp(sampler(xNominal, y, width, height), 0, 1);
        const amp = minAmp + ampRange * tone;
        // Frequency increases in darker areas
        const freq = baseFreq * (1 + 1.2 * tone);
        const phase = 2 * Math.PI * freq * y + colIdx * 0.5;
        const coordOffset = amp * Math.sin(phase);
        return { coordOffset, spanOffset: 0 };
      },
      z: z1,
    });

    // Layer 2: Horizontal Gyroid / Sinusoidal Wave
    const rows = Math.max(2, Math.floor(height / spacing));
    const pitchY = height / rows;
    const minY = pitchY / 2;
    const gyroidWavelength = Math.max(1.0, wavelength * 1.25);
    const gyroidFreq = 1 / gyroidWavelength;
    const gyroidAmp = Math.min(pitchY * 0.45, amplitude * 0.8);

    layer2Pts = buildSerpentine({
      axis: 'horizontal',
      spanLength: width,
      laneCount: rows,
      lanePitch: pitchY,
      minCoord: minY,
      minSpan: 0,
      stepSize: 0.4,
      waveFn: (rowIdx, x, _xNorm, _isReverse) => {
        // Gyroid-like alternating phase per row
        const rowPhase = (rowIdx % 2) * Math.PI;
        const yNominal = minY + rowIdx * pitchY;
        const tone = clamp(sampler(x, yNominal, width, height), 0, 1);
        const localAmp = gyroidAmp * (0.6 + 0.4 * tone);
        const phase = 2 * Math.PI * gyroidFreq * x + rowPhase;
        const coordOffset = localAmp * Math.sin(phase);
        return { coordOffset, spanOffset: 0 };
      },
      z: z2,
    });
  } else {
    // -------------------------------------------------------------------------
    // Mode B: Dual Parallel Zigzag Overlap
    // Both layers run horizontally along X.
    // Layer 1 and Layer 2 are paired per row, with opposing phase / zigzag offset
    // so they repeatedly cross each other at nodes (sin = 0) and open eyelets.
    // -------------------------------------------------------------------------
    const rows = Math.max(2, Math.floor(height / spacing));
    const pitchY = height / rows;
    const minY = pitchY / 2;

    // Layer 1: Base Squiggle (phase 0)
    layer1Pts = buildSerpentine({
      axis: 'horizontal',
      spanLength: width,
      laneCount: rows,
      lanePitch: pitchY,
      minCoord: minY,
      minSpan: 0,
      stepSize: 0.4,
      waveFn: (rowIdx, x, _xNorm, _isReverse) => {
        const yNominal = minY + rowIdx * pitchY;
        const tone = clamp(sampler(x, yNominal, width, height), 0, 1);
        const amp = minAmp + ampRange * tone;
        const freq = baseFreq * (1 + 1.2 * tone);
        const phase = 2 * Math.PI * freq * x + (rowIdx % 2) * (Math.PI / 2);
        const coordOffset = amp * Math.sin(phase);
        return { coordOffset, spanOffset: 0 };
      },
      z: z1,
    });

    // Layer 2: Opposing Zigzag / Anti-Phase Squiggle (phase + PI)
    // Fuses directly on top of Layer 1 at node crossings where sin(phase) = 0!
    layer2Pts = buildSerpentine({
      axis: 'horizontal',
      spanLength: width,
      laneCount: rows,
      lanePitch: pitchY,
      minCoord: minY,
      minSpan: 0,
      stepSize: 0.4,
      waveFn: (rowIdx, x, _xNorm, _isReverse) => {
        const yNominal = minY + rowIdx * pitchY;
        const tone = clamp(sampler(x, yNominal, width, height), 0, 1);
        const amp = minAmp + ampRange * tone;
        const freq = baseFreq * (1 + 1.2 * tone);
        // Anti-phase (Math.PI shift) causes waves to mirror and cross at node points
        const phase = 2 * Math.PI * freq * x + (rowIdx % 2) * (Math.PI / 2) + Math.PI;
        const coordOffset = amp * Math.sin(phase);
        return { coordOffset, spanOffset: 0 };
      },
      z: z2,
    });
  }

  const strands = [
    { kind: 'base', id: 'squiggle-l1', pts: layer1Pts, lift: 0, name: 'Layer 1 (Base Squiggle)' },
    {
      kind: 'supported',
      id: 'squiggle-l2',
      pts: layer2Pts,
      lift: layerHeight,
      name: 'Layer 2 (Interlock / Gyroid)',
      pauseBefore: colorChange,
    },
  ];

  return { layer1: layer1Pts, layer2: layer2Pts, strands };
}

/**
 * End-to-end generator for Squiggle Textile:
 * converts machine, material and squiggle parameters into moves, stats, and G-code.
 */
export function generateSquiggle(machine, material, squiggleParams = {}) {
  const width = squiggleParams.width ?? 50;
  const height = squiggleParams.height ?? 50;
  const cfg = resolveConfig(machine, material, {
    sample_width: width,
    sample_height: height,
    layer_height: squiggleParams.layerHeight ?? 0.2,
  });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);

  const res = generateSquiggleTextile({
    width,
    height,
    mode: squiggleParams.mode ?? 'cross',
    spacing: squiggleParams.spacing ?? 2.5,
    amplitude: squiggleParams.amplitude ?? 1.2,
    wavelength: squiggleParams.wavelength ?? 4.0,
    layerHeight: cfg.t.layer_height,
    sampler: squiggleParams.sampler ?? SAMPLERS.centerSpot,
    colorChange: squiggleParams.colorChange ?? false,
  });

  const moves = [];
  const travel = (x, y, z, customGcode, comment) => ({
    x, y, z, cls: 'travel', extrude: false, customGcode, comment,
  });

  let cur = null;
  for (let sIdx = 0; sIdx < res.strands.length; sIdx++) {
    const strand = res.strands[sIdx];
    if (strand.pts.length < 2) continue;
    const first = strand.pts[0];

    if (cur === null) {
      moves.push(travel(first.x, first.y, first.z + 5));
      moves.push(travel(first.x, first.y, first.z));
    } else {
      const safeZ = Math.max(cur.z, first.z) + 3;
      moves.push(travel(cur.x, cur.y, safeZ));
      if (strand.pauseBefore) {
        moves.push(travel(cur.x, cur.y, safeZ, 'M600 ; Pause for filament color change', 'Filament change pause before ' + strand.name));
      }
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    }

    const moveCls = sIdx === 0 ? 'base' : 'supported';
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      moves.push({ x: p.x, y: p.y, z: p.z, cls: moveCls, extrude: true, tag: strand.id });
    }
    cur = strand.pts[strand.pts.length - 1];
  }

  const stats = computeStats(moves, cfg, []);
  stats.loops = 0;
  const gcode = writeGcode(moves, cfg, { stats });

  return { cfg, strands: res.strands, moves, stats, warnings: [], gcode };
}

