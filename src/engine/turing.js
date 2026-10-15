import { createRng } from './rng.js';
import { contourLoops } from './spiral.js';
import { clipPolyline, densify } from './layers.js';
import { backingStack } from './backing.js';

/**
 * Turing stripes: the iso-lines of a Gray-Scott reaction-diffusion field, the same chemistry that makes animal
 * stripes and coral. The field is grown on a grid from a few seeded specks until it settles into worms and
 * stripes about one wavelength apart, then its mid-level contour is traced as closed loops (layer 1). An independent
 * hatch across them (layer 2) crosses every stripe. The same seed always grows the same pattern.
 */

// feed and kill rates in the labyrinth regime: long winding stripes rather than spots
const DU = 0.16, DV = 0.08, FEED = 0.037, KILL = 0.06;

/** Grows the field: returns { data, nx, ny, cell } with v in about 0..0.5, over a grid with a border of bare cells. */
export function growField(box, { wavelength = 7, seed = 1, steps = 3500 } = {}) {
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  // about nine cells per wavelength; never more than 150 cells on a side
  const cell = Math.max(wavelength / 9, Math.max(w, h) / 150);
  const nx = Math.ceil(w / cell) + 4, ny = Math.ceil(h / cell) + 4;
  const rng = createRng(seed);
  let u = new Float32Array(nx * ny).fill(1);
  let v = new Float32Array(nx * ny);
  const specks = Math.max(6, Math.round((nx * ny) / 200));
  for (let k = 0; k < specks; k++) {
    const cx = 4 + Math.floor(rng.next() * (nx - 8)), cy = 4 + Math.floor(rng.next() * (ny - 8));
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        u[(cy + dy) * nx + cx + dx] = 0.5;
        v[(cy + dy) * nx + cx + dx] = 0.25 + 0.05 * rng.next();
      }
    }
  }
  let u2 = new Float32Array(nx * ny);
  let v2 = new Float32Array(nx * ny);
  for (let s = 0; s < steps; s++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = y * nx + x;
        const lu = u[i - 1] + u[i + 1] + u[i - nx] + u[i + nx] - 4 * u[i];
        const lv = v[i - 1] + v[i + 1] + v[i - nx] + v[i + nx] - 4 * v[i];
        const uvv = u[i] * v[i] * v[i];
        u2[i] = u[i] + DU * lu - uvv + FEED * (1 - u[i]);
        v2[i] = v[i] + DV * lv + uvv - (FEED + KILL) * v[i];
      }
    }
    [u, u2] = [u2, u];
    [v, v2] = [v2, v];
  }
  // the border ring stays bare so every contour closes inside the grid
  for (let x = 0; x < nx; x++) { v[x] = 0; v[(ny - 1) * nx + x] = 0; }
  for (let y = 0; y < ny; y++) { v[y * nx] = 0; v[y * nx + nx - 1] = 0; }
  return { data: v, nx, ny, cell, minX: box.minX - 2 * cell, minY: box.minY - 2 * cell };
}

/** Joins closed loops into strands: each strand carries on into the nearest loop whose start is within `jog`. */
function chainLoops(loops, boundary, jog) {
  const left = loops.map((l) => l.slice(0, -1));
  const strands = [];
  let cur = null;
  while (left.length) {
    let pick = 0, at = 0, best = Infinity;
    const ref = cur ? cur[cur.length - 1] : left[0][0];
    left.forEach((loop, li) => {
      for (let i = 0; i < loop.length; i++) {
        const d = Math.hypot(loop[i].x - ref.x, loop[i].y - ref.y);
        if (d < best) { best = d; pick = li; at = i; }
      }
    });
    const loop = left.splice(pick, 1)[0];
    const rotated = [...loop.slice(at), ...loop.slice(0, at)];
    rotated.push({ ...rotated[0] });
    if (cur && best <= jog && boundary.contains((rotated[0].x + ref.x) / 2, (rotated[0].y + ref.y) / 2)) {
      cur.push(...densify([ref, rotated[0]]).slice(1), ...rotated.slice(1));
    } else {
      if (cur) strands.push(cur);
      cur = rotated;
    }
  }
  if (cur) strands.push(cur);
  return strands;
}

/**
 * @param wavelength  distance between neighbouring stripes (mm)
 * @param seed        which pattern grows
 * @param angle       angle of the hatch laid across it, degrees
 * @param spacing     spacing of the hatch, mm
 */
export function turingLayers(boundary, { wavelength = 7, seed = 1, angle = 45, spacing = 5, backing = 'straight', backingDepth = 2, backingLength = 10, backingLayers = 'one' } = {}) {
  const box = boundary.bbox();
  const field = growField(box, { wavelength, seed });
  let max = 0;
  for (const value of field.data) if (value > max) max = value;
  const loops = max > 0.05 ? contourLoops({ ...field, max }, max / 2).filter((l) => l.length > 8) : [];
  const strands = chainLoops(loops, boundary, wavelength * 1.2);
  const layer1 = strands.flatMap((s) => clipPolyline(s, boundary));
  const stack = backingStack(boundary, { style: backing, angle, spacing, depth: backingDepth, wavelength: backingLength }, backingLayers);
  return { layers: [layer1, ...stack], extra: { loops: loops.length } };
}
