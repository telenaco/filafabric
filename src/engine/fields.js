/**
 * Pattern fields: a value 0..1 over the surface, used to drive pile height, wave depth, loop size or relief.
 *
 * The ten decorative patterns are an exact port of the Blender ceramics add-on's `modifiers/patterns.py`, with the
 * vase unrolled into a flat sheet: the vase's angle becomes the position across (`angle = 2π·x / circumference`)
 * and its height becomes the position along (`zn = y / circumference`). The circumference is a fixed 100 mm times
 * `scale`, so a pattern keeps its physical size whatever the swatch size. `freqX` and `freqY` are Blender's
 * `pattern_frequency` and `pattern_z_frequency` (default 6 each).
 *
 * Blender returns a displacement in mm; each formula here is divided by its analytic range to give 0..1. Three
 * patterns are hard thresholds there (an instant jump is a vertical Z move in print); here the step is a short
 * smooth ramp whose width is controlled by `smooth`.
 *
 * A sampler is `(x, y, w, h) → 0..1` in mm, the same signature as the squiggle design's tone samplers.
 */

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** 0 below `threshold - w`, 1 above `threshold + w`, a smooth ramp between (and always reaches 1 at s = 1). */
function gate(s, threshold, w) {
  const half = Math.min(w, 1 - threshold);
  return smoothstep((s - threshold + half) / (2 * half));
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const u = smoothstep(x - ix), v = smoothstep(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Each entry builds `(angle, zn) → 0..1` from the frequencies and the smoothing width. */
const PATTERNS = {
  deepSpiral: ({ fx, fz }) => (a, zn) => (2 * Math.sin(a * fx + zn * fz * Math.PI) + 2) / 4,

  brick: ({ fx, fz, w }) => {
    const rowValue = (row, a) => gate(Math.abs(Math.sin((a + (((row % 2) + 2) % 2) * (Math.PI / 8)) * fx)), 0.7, w);
    const edge = Math.min(0.4, 0.1 * (w / 0.12));
    return (a, zn) => {
      const pos = zn * fz;
      const row = Math.floor(pos);
      const fr = pos - row;
      const cur = rowValue(row, a);
      // the brick offset flips at every row seam: cross-fade across it so the seam is not a jump
      if (fr < edge) {
        const k = smoothstep(0.5 + 0.5 * (fr / edge));
        return cur * k + rowValue(row - 1, a) * (1 - k);
      }
      if (fr > 1 - edge) {
        const k = smoothstep(0.5 + 0.5 * ((1 - fr) / edge));
        return cur * k + rowValue(row + 1, a) * (1 - k);
      }
      return cur;
    };
  },

  diamondGrid: ({ fx, fz }) => (a, zn) => Math.abs(Math.sin(a * fx) * Math.sin(zn * fz * Math.PI)),

  tribalFeathers: ({ fx, fz }) => (a, zn) => {
    let sum = 0;
    for (let j = 0; j < 3; j++) {
      sum += (1 / (j + 1)) * Math.abs(Math.sin(a * (fx + j * 2) + zn * (fz + j * 4) * Math.PI)) ** (2 + j);
    }
    return sum / 1.8333;
  },

  circuitBoard: ({ fx, fz, w }) => (a, zn) => Math.max(
    gate(Math.abs(Math.sin(zn * fz * Math.PI)), 0.8, w),
    gate(Math.abs(Math.sin(a * fx)), 0.9, w),
  ),

  oceanWaves: ({ fx, fz }) => (a, zn) => {
    const wave1 = Math.sin(a * (fx / 3) + zn * fz * Math.PI);
    const wave2 = 0.5 * Math.sin(a * ((fx * 5) / 6) - zn * fz * 2 * Math.PI);
    const foam = 0.3 * Math.abs(Math.sin(a * (fx * 2.5) + zn * fz * 5 * Math.PI));
    return (1.5 * (wave1 + wave2 + foam) + 2.25) / 4.95;
  },

  hexagonCells: ({ fx, fz }) => (a, zn) => {
    const cells = Math.min(Math.abs(Math.cos(a * fx)), Math.abs(Math.cos(a * fx + Math.PI / 3)));
    return (2 * cells * (1 + 0.3 * Math.sin(zn * fz * Math.PI))) / 2.6;
  },

  mountainPeaks: ({ fx, fz }) => (a, zn) => {
    const peak1 = Math.abs(Math.sin(a * fx)) ** 3;
    const peak2 = Math.sin(a * 7 + Math.PI / 4) ** 2;
    const altitude = 1 + 0.5 * Math.sin(zn * fz * Math.PI);
    return (2 * (peak1 + 0.6 * peak2) * altitude) / 4.8;
  },

  lotusPetals: ({ fx, fz }) => (a, zn) => {
    // |sin|^0.5 has an infinite slope at its zeros; a small offset keeps the petal tips printable
    const petals = (Math.sin(a * fx) ** 2 + 0.02) ** 0.25;
    const inner = 0.5 * Math.sin(a * 16 + Math.PI / 8) ** 2;
    const bloom = 1 + 0.4 * Math.sin(zn * fz * Math.PI);
    return (1.8 * (petals + inner) * bloom) / 3.78;
  },

  lightningBolts: ({ fx, fz, w }) => (a, zn) => (
    gate(Math.abs(Math.sin(a * fx + zn * fz * Math.PI)), 0.85, w) * Math.abs(Math.sin(a * 24))
  ),
};

/** Fields that work in mm rather than in angle: they need the sampler's own x and y. */
const SPATIAL = {
  noise: ({ cell, seed }) => (x, y) => {
    const n = 0.65 * valueNoise(x / cell, y / cell, seed) + 0.35 * valueNoise((2 * x) / cell + 17.3, (2 * y) / cell + 4.1, seed + 7);
    return clamp01(n);
  },

  /** Parallel ridges across the fabric: a soft sine in x only, for pleats and ribs. */
  stripes: ({ cell }) => (x) => 0.5 + 0.5 * Math.sin((2 * Math.PI * x) / cell),

  /** Staggered round bumps, the sum of the nearest few so there is no seam between cells. */
  bumps: ({ cell }) => {
    const sigma = 0.3 * cell;
    const k = 1 / (2 * sigma * sigma);
    return (x, y) => {
      const row = Math.floor(y / cell);
      let sum = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const j = row + dj;
        const shift = (((j % 2) + 2) % 2) * (cell / 2);
        const cy = (j + 0.5) * cell;
        const col = Math.floor((x - shift) / cell);
        for (let di = -1; di <= 1; di++) {
          const cx = (col + di + 0.5) * cell + shift;
          sum += Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * k);
        }
      }
      return clamp01(sum);
    };
  },
};

export const FIELDS = Object.freeze({
  deepSpiral: { id: 'deepSpiral', label: 'Deep spiral', hint: 'Diagonal bands that sweep across' },
  brick: { id: 'brick', label: 'Brick', hint: 'Offset rows of blocks' },
  diamondGrid: { id: 'diamondGrid', label: 'Diamond grid', hint: 'A lattice of diamonds' },
  tribalFeathers: { id: 'tribalFeathers', label: 'Tribal feathers', hint: 'Layered feather strokes' },
  circuitBoard: { id: 'circuitBoard', label: 'Circuit board', hint: 'Straight traces in a grid' },
  oceanWaves: { id: 'oceanWaves', label: 'Ocean waves', hint: 'Rolling waves with foam' },
  hexagonCells: { id: 'hexagonCells', label: 'Hexagon cells', hint: 'Honeycomb cells' },
  mountainPeaks: { id: 'mountainPeaks', label: 'Mountain peaks', hint: 'Sharp ridges and valleys' },
  lotusPetals: { id: 'lotusPetals', label: 'Lotus petals', hint: 'Rounded petals in rings' },
  lightningBolts: { id: 'lightningBolts', label: 'Lightning bolts', hint: 'Sparse jagged streaks' },
  noise: { id: 'noise', label: 'Soft noise', hint: 'Organic, uneven patches' },
  bumps: { id: 'bumps', label: 'Bumps', hint: 'Staggered round bobbles' },
  stripes: { id: 'stripes', label: 'Stripes', hint: 'Parallel ridges, for pleats and ribs' },
});

export const FIELD_IDS = Object.freeze(Object.keys(FIELDS));

/**
 * @param id    a key of FIELDS
 * @param opts  scale (pattern size, 1 = the Blender default), freqX / freqY (repeats), seed (noise), smooth (ramp width)
 * @returns     a sampler (x, y, w, h) → 0..1
 */
export function createField(id, { scale = 1, freqX = 6, freqY = 6, seed = 1, smooth = 1 } = {}) {
  if (!FIELDS[id]) throw new Error(`Unknown field: ${id}`);
  const circumference = 100 * scale;
  if (SPATIAL[id]) {
    const f = SPATIAL[id]({ cell: circumference / Math.max(1, freqX), seed });
    return (x, y) => clamp01(f(x, y));
  }
  const f = PATTERNS[id]({ fx: freqX, fz: freqY, w: 0.12 * smooth });
  return (x, y) => {
    const v = f((TAU * x) / circumference, y / circumference);
    return Number.isFinite(v) ? clamp01(v) : 0;
  };
}

/** The steepest change of a sampler over a w x h area, in field units per mm (finite differences). */
export function fieldSlope(sampler, w, h, step = 0.5) {
  let worst = 0;
  for (let y = 0; y <= h; y += step) {
    for (let x = 0; x <= w; x += step) {
      const v = sampler(x, y, w, h);
      const gx = (sampler(x + step, y, w, h) - v) / step;
      const gy = (sampler(x, y + step, w, h) - v) / step;
      worst = Math.max(worst, Math.hypot(gx, gy));
    }
  }
  return worst;
}
