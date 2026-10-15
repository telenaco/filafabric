import { PolygonBoundary } from './boundary.js';
import { clipPolyline, chainPolylines } from './layers.js';
import { centredLanes } from './fill.js';

/**
 * Lines that wave: parallel lanes, each a sine, triangle (zigzag) or square wave about its own centre line.
 *
 * Two things set how the lines meet. `phase` is where along its wave a lane starts (in whole waves, so 0.5 is a
 * half-wave: the line is the mirror of one with phase 0), and `laneShift` is how much further along each next lane
 * starts than the lane before it. With a lane shift of a half wave, every other line is half a wave along, so where
 * one line swings towards its neighbour the neighbour swings away from it, and they meet when the swing is half
 * the spacing, and cross when it is more: a single layer that holds itself together.
 */

export const WAVE_SHAPES = Object.freeze(['sine', 'triangle', 'square']);

/** The wave at `t` whole waves along: -1..1, with a 'square' wave taken just after t. */
export function waveValue(shape, t) {
  const u = t - Math.floor(t);
  if (shape === 'sine') return Math.sin(2 * Math.PI * u);
  if (shape === 'triangle') return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
  if (shape === 'square') return u < 0.5 ? 1 : -1;
  throw new Error(`Unknown wave shape: ${shape}`);
}

/** Points of one wave along a lane, from x0 to x1 at lane height c; `start` is its position in waves at x0. */
function lanePoints(shape, x0, x1, c, amplitude, wavelength, start) {
  const t1 = start + (x1 - x0) / wavelength;
  const at = (t) => x0 + (t - start) * wavelength;
  const pts = [];
  if (shape === 'sine') {
    const dt = Math.min(1 / 16, 0.4 / wavelength);
    const n = Math.max(1, Math.ceil((t1 - start) / dt));
    for (let i = 0; i <= n; i++) {
      const t = start + ((t1 - start) * i) / n;
      pts.push({ x: at(t), y: c + amplitude * Math.sin(2 * Math.PI * t) });
    }
    return pts;
  }
  // straight runs between corners: the corners of a triangle are every quarter wave, a square wave's jumps every half
  const step = shape === 'triangle' ? 0.25 : 0.5;
  const eps = 1e-7;
  pts.push({ x: x0, y: c + amplitude * waveValue(shape, start + eps) });
  for (let k = Math.floor(start / step) + 1; k * step < t1 - eps; k++) {
    const t = k * step;
    if (shape === 'square') {
      pts.push({ x: at(t), y: c + amplitude * waveValue(shape, t - eps) });
      pts.push({ x: at(t), y: c + amplitude * waveValue(shape, t + eps) });
    } else {
      pts.push({ x: at(t), y: c + amplitude * waveValue(shape, t) });
    }
  }
  pts.push({ x: x1, y: c + amplitude * waveValue(shape, t1 - eps) });
  return pts;
}

const rotate = (p, c, s) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });

/**
 * @param angle      degrees the lanes are turned from running along x
 * @param spacing    mm between lane centre lines
 * @param amplitude  mm each line swings to either side of its centre line
 * @param wavelength mm per full wave
 * @param phase      where the first lane starts, in waves
 * @param laneShift  how many waves further along each next lane starts than the one before (0.5: every other line half a wave on)
 * @param offset     slides all the lanes sideways by this fraction of the spacing
 * @returns lines (arrays of { x, y }) clipped to the boundary and joined end to end, lane after lane, wherever the
 *          boundary allows it
 */
export function waveLines(boundary, { angle = 0, spacing = 3, amplitude = 1, wavelength = 6, shape = 'sine', phase = 0, laneShift = 0, offset = 0, inset = 0.3 } = {}) {
  if (!WAVE_SHAPES.includes(shape)) throw new Error(`Unknown wave shape: ${shape}`);
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const rings = boundary.rings ?? [[
    { x: boundary.bbox().minX, y: boundary.bbox().minY }, { x: boundary.bbox().maxX, y: boundary.bbox().minY },
    { x: boundary.bbox().maxX, y: boundary.bbox().maxY }, { x: boundary.bbox().minX, y: boundary.bbox().maxY },
  ]];
  const turned = new PolygonBoundary(rings.map((ring) => ring.map((p) => rotate(p, c, -s))));
  const box = turned.bbox();
  const lo = box.minY + inset, hi = box.maxY - inset;
  const lanes = hi > lo
    ? centredLanes(lo, hi, spacing).map((y) => y + offset * spacing).filter((y) => y > lo - 1e-9 && y < hi + 1e-9)
    : [(box.minY + box.maxY) / 2];

  const list = [];
  lanes.forEach((y, k) => {
    const pieces = [];
    for (const [from, to] of turned.intervals('y', y)) {
      if (to - from < 1) continue;
      // the wave is measured from a fixed x, so lanes that start together stay together whatever the outline does
      const start = phase + k * laneShift + (from - box.minX) / wavelength;
      for (const run of clipPolyline(lanePoints(shape, from, to, y, amplitude, wavelength, start), turned, 1)) pieces.push(run);
    }
    // alternate lanes run the other way so the end of one is beside the start of the next
    if (k % 2 === 1) pieces.reverse().forEach((p) => p.reverse());
    list.push(...pieces);
  });
  const chains = chainPolylines(list, turned, spacing + 2 * amplitude + 2);
  return chains.map((pts) => pts.map((p) => rotate(p, c, s)));
}
