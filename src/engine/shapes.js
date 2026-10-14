/**
 * Strand shapes: how a single strand wanders about the centre line of its lane.
 *
 * A shape gives, for the distance `s` travelled along the lane, a lateral offset `v` and a shift `du` along the
 * lane. Wave, zigzag and square only move sideways; the looped line and the figure-8 also swing back along the lane,
 * which is what makes the strand cross itself.
 *
 * `pitch` is the length of one period (mm) and `size` the sideways reach (mm). With `a = pitch / 2π`:
 *   looped  u = s − size·(sinθ' − 1), v = −size·cosθ', θ' = s/a + π/2   (a prolate trochoid: loops when size > a)
 *   figure8 u = s + 0.6·size·sin 2θ,  v = size·sinθ,   θ = s/a
 */

export const SHAPES = Object.freeze({
  looped: { id: 'looped', label: 'Looped', hint: 'One line that circles over itself' },
  figure8: { id: 'figure8', label: 'Figure-8', hint: 'Crossing S-curves in a chain' },
  zigzag: { id: 'zigzag', label: 'Zigzag', hint: 'Straight diagonals, soft corners' },
  wave: { id: 'wave', label: 'Wave', hint: 'A smooth sine wave' },
  square: { id: 'square', label: 'Square', hint: 'Steps with rounded corners' },
});

export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES));

const ZIGZAG_ROUND = 0.9; // 1 would be a sharp triangle, 0 a sine
const SQUARE_SOFT = 2.5; // larger is squarer

/** Lateral offset `v` and along-lane shift `du` at distance `s` from the start of the lane. */
export function shapeAt(shape, s, { pitch, size }) {
  const theta = (s * 2 * Math.PI) / pitch;
  switch (shape) {
    case 'wave':
      return { v: size * Math.sin(theta), du: 0 };
    case 'zigzag':
      return { v: (size * Math.asin(ZIGZAG_ROUND * Math.sin(theta))) / Math.asin(ZIGZAG_ROUND), du: 0 };
    case 'square':
      return { v: (size * Math.tanh(SQUARE_SOFT * Math.sin(theta))) / Math.tanh(SQUARE_SOFT), du: 0 };
    case 'looped': {
      const t = theta + Math.PI / 2;
      return { v: -size * Math.cos(t), du: size * (1 - Math.sin(t)) };
    }
    case 'figure8':
      return { v: size * Math.sin(theta), du: 0.6 * size * Math.sin(2 * theta) };
    default:
      throw new Error(`Unknown strand shape: ${shape}`);
  }
}

/** Whole periods that fit along a lane. */
export const loopCount = (length, pitch) => Math.max(0, Math.floor(length / pitch + 1e-9));

/** How far a shape swings back and forward along the lane within one period: { lo <= 0 <= hi }. */
function alongExtent(shape, pitch, size) {
  let lo = 0, hi = 0;
  for (let k = 0; k <= 120; k++) {
    const { du } = shapeAt(shape, (k * pitch) / 120, { pitch, size });
    if (du < lo) lo = du;
    if (du > hi) hi = du;
  }
  return { lo, hi };
}

/**
 * Whole periods that fit along a lane of `length` mm with the strand kept inside it: a looped line swings
 * forward by up to twice its size at the end of the last loop, so that room is kept free.
 */
export function lanePeriods({ shape, length, pitch, size }) {
  const { lo, hi } = alongExtent(shape, pitch, size);
  return Math.max(0, Math.floor((length - hi + lo) / pitch + 1e-9));
}

/** A looped line needs `size > pitch / 2π`; at or below it the strand is only a wavy line. */
export const loopsClose = (pitch, size) => size <= pitch / (2 * Math.PI);

/** The most arc length the shape covers per unit of progress, found by sampling one period. */
function arcRate(shape, pitch, size) {
  const n = 160;
  let worst = 1;
  let prev = shapeAt(shape, 0, { pitch, size });
  for (let k = 1; k <= n; k++) {
    const s = (k * pitch) / n;
    const cur = shapeAt(shape, s, { pitch, size });
    const ds = pitch / n;
    worst = Math.max(worst, Math.hypot(ds + cur.du - prev.du, cur.v - prev.v) / ds);
    prev = cur;
  }
  return worst;
}

/**
 * Points along one lane as { u, v }: u within 0..`length`, v the offset from the centre line. Whole periods are
 * centred with a straight lead-in and lead-out, so the strand starts and ends on the centre line and never leaves
 * the lane. `sizeAt(u)` gives
 * a 0..1 factor on the size along the lane (a pattern field). Consecutive points are at most `step` mm apart.
 */
export function lanePoints({ shape, length, pitch, size, sizeAt = null, step = 0.4 }) {
  const periods = lanePeriods({ shape, length, pitch, size });
  const pts = [{ u: 0, v: 0 }];
  const straight = (from, to) => {
    const n = Math.max(1, Math.ceil((to - from) / step));
    for (let i = 1; i <= n; i++) pts.push({ u: from + ((to - from) * i) / n, v: 0 });
  };
  if (periods === 0) {
    straight(0, length);
    return pts;
  }
  const span = periods * pitch;
  const { lo, hi } = alongExtent(shape, pitch, size);
  const lead = -lo + (length - span - hi + lo) / 2;
  if (lead > 1e-9) straight(0, lead);
  const ds = step / arcRate(shape, pitch, size);
  const n = Math.ceil(span / ds);
  for (let i = 1; i <= n; i++) {
    const s = (span * i) / n;
    const factor = sizeAt ? sizeAt(lead + s) : 1;
    const { v, du } = shapeAt(shape, s, { pitch, size: size * factor });
    pts.push({ u: lead + s + du, v });
  }
  // a modulated size is never exactly 1 at the end of a period: land on the centre line before leading out
  const end = pts[pts.length - 1];
  if (Math.abs(end.v) > 1e-9 || Math.abs(end.u - (lead + span)) > 1e-9) pts[pts.length - 1] = { u: lead + span, v: 0 };
  if (length - (lead + span) > 1e-9) straight(lead + span, length);
  return pts;
}
