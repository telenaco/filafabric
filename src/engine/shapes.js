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
 *   ring    a straight line with a round ring (diameter `size`) tangent to it once per period, alternately above
 *           and below. The ring is walked in a short window of progress, so the line carries on right after it.
 */

// listed from the plainest to the most involved: a picker shows them in this order
export const SHAPES = Object.freeze({
  wave: { id: 'wave', label: 'Wave', hint: 'A smooth sine wave' },
  zigzag: { id: 'zigzag', label: 'Zigzag', hint: 'Straight diagonals, soft corners' },
  square: { id: 'square', label: 'Square', hint: 'Steps with rounded corners' },
  honeycomb: { id: 'honeycomb', label: 'Honeycomb', hint: 'Flat tops and bottoms, so neighbouring layers stack' },
  figure8: { id: 'figure8', label: 'Figure-8', hint: 'Crossing S-curves in a chain' },
  ring: { id: 'ring', label: 'Rings', hint: 'A straight line with a round ring on it' },
  looped: { id: 'looped', label: 'Looped', hint: 'One line that circles over itself' },
});

export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES));

const ZIGZAG_ROUND = 0.9; // 1 would be a sharp triangle, 0 a sine
const SQUARE_SOFT = 2.5; // larger is squarer
const HONEYCOMB_PUSH = 3.5; // larger is flatter on top
const RING_WINDOW = 0.4; // mm of progress along the lane spent walking round a ring

/** Lateral offset `v` and along-lane shift `du` at distance `s` from the start of the lane. */
export function shapeAt(shape, s, { pitch, size }) {
  const theta = (s * 2 * Math.PI) / pitch;
  switch (shape) {
    case 'wave':
      return { v: size * Math.sin(theta), du: 0 };
    case 'zigzag':
      return { v: (size * Math.asin(ZIGZAG_ROUND * Math.sin(theta))) / Math.asin(ZIGZAG_ROUND), du: 0 };
    case 'honeycomb': {
      // a trapezoid wave: a triangle wave pushed against a soft ceiling and floor, so each peak and trough has a flat
      const tri = (2 / Math.PI) * Math.asin(Math.sin(theta));
      return { v: (size * Math.tanh(HONEYCOMB_PUSH * tri)) / Math.tanh(HONEYCOMB_PUSH), du: 0 };
    }
    case 'square':
      return { v: (size * Math.tanh(SQUARE_SOFT * Math.sin(theta))) / Math.tanh(SQUARE_SOFT), du: 0 };
    case 'looped': {
      const t = theta + Math.PI / 2;
      return { v: -size * Math.cos(t), du: size * (1 - Math.sin(t)) };
    }
    case 'figure8':
      return { v: size * Math.sin(theta), du: 0.6 * size * Math.sin(2 * theta) };
    case 'ring': {
      const r = Math.min(size / 2, pitch / 4); // never bigger than a quarter of the spacing
      // a sample exactly on a period boundary closes the ring before it, so the ring's end is always sampled
      const index = Math.max(0, Math.ceil(s / pitch - 1e-12) - 1);
      const local = s - index * pitch;
      const start = pitch - RING_WINDOW;
      if (local <= start) return { v: 0, du: 0 };
      const phi = (2 * Math.PI * (local - start)) / RING_WINDOW;
      const side = index % 2 === 0 ? 1 : -1;
      return { v: side * r * (1 - Math.cos(phi)), du: start + r * Math.sin(phi) - local };
    }
    default:
      throw new Error(`Unknown strand shape: ${shape}`);
  }
}

/** Whole periods that fit along a lane. */
export const loopCount = (length, pitch) => Math.max(0, Math.floor(length / pitch + 1e-9));

/**
 * How far along the lane one period of the shape reaches, measured from the start of the period: the furthest
 * forward (`uMax`, never less than one pitch) and the furthest back (`uMin`, never more than 0).
 */
function periodExtent(shape, pitch, size) {
  let uMin = 0, uMax = pitch;
  for (let k = 0; k <= 240; k++) {
    const s = (k * pitch) / 240;
    const u = s + shapeAt(shape, s, { pitch, size }).du;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
  }
  return { uMin, uMax };
}

/**
 * Whole periods that fit along a lane of `length` mm with the strand kept inside it: the last loop of a looped
 * line bulges forward past the end of its period, and that room is kept free.
 */
export function lanePeriods({ shape, length, pitch, size }) {
  const { uMin, uMax } = periodExtent(shape, pitch, size);
  if (length < uMax - uMin) return 0;
  return Math.max(0, Math.floor((length - uMax + uMin) / pitch + 1e-9) + 1);
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

/** Progress step (mm along the lane) that keeps consecutive points at most `base` mm apart along the strand. */
export function shapeStep(shape, pitch, size, base = 0.4) {
  return base / arcRate(shape, pitch, size);
}

/**
 * The pitch nearest `pitch` whose whole periods fill a lane of `length` mm exactly, what a period reaches past its own
 * length (the forward bulge of a loop) included: a lane that ends with a whole period at the edge, not a straight
 * lead-out (repeats.js).
 */
export function fillPitch(shape, length, pitch, size) {
  let p = pitch;
  for (let i = 0; i < 5; i++) {
    const { uMin, uMax } = periodExtent(shape, p, size);
    const room = length - (uMax - uMin - p);
    if (!(room > 0)) return pitch;
    p = room / Math.max(1, Math.round(room / p));
  }
  return p;
}

/**
 * Points along one lane as { u, v }: u within 0..`length`, v the offset from the centre line. Whole periods are
 * centred with a straight lead-in and lead-out, so the strand starts and ends on the centre line and never leaves
 * the lane; with `fill` the pitch is first made the nearest whose periods fill the lane, so there is no lead at all.
 * `sizeAt(u)` gives a 0..1 factor on the size along the lane (a pattern field). Consecutive points are at most `step`
 * mm apart.
 */
export function lanePoints({ shape, length, pitch, size, sizeAt = null, step = 0.4, fill = false }) {
  if (fill) pitch = fillPitch(shape, length, pitch, size);
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
  const { uMin, uMax } = periodExtent(shape, pitch, size);
  const lead = -uMin + (length - ((periods - 1) * pitch + uMax - uMin)) / 2;
  if (lead > 1e-9) straight(0, lead);
  const ds = step / arcRate(shape, pitch, size);
  // a whole number of samples per period, so a sample always lands on a period boundary
  const samples = [];
  const straightRun = pitch - RING_WINDOW;
  if (shape === 'ring' && straightRun > 0) {
    // a ring is walked in a short window at the end of each period: sample that window finely and the straight run
    // before it at `step` (sampling the whole period finely would put dozens of points on every straight millimetre)
    const nStraight = Math.max(1, Math.ceil(straightRun / step));
    const nRing = Math.max(1, Math.ceil(RING_WINDOW / ds));
    for (let p = 0; p < periods; p++) {
      // a ring ends back where it began, a window short of the period's end: pick the line up at the boundary
      if (p > 0) samples.push(p * pitch + 1e-9);
      for (let i = 1; i <= nStraight; i++) samples.push(p * pitch + (straightRun * i) / nStraight);
      for (let i = 1; i <= nRing; i++) samples.push(p * pitch + straightRun + (RING_WINDOW * i) / nRing);
    }
  } else {
    const n = periods * Math.max(1, Math.ceil(pitch / ds));
    for (let i = 1; i <= n; i++) samples.push((span * i) / n);
  }
  for (const s of samples) {
    const factor = sizeAt ? sizeAt(lead + s) : 1;
    const { v, du } = shapeAt(shape, s, { pitch, size: size * factor });
    pts.push({ u: lead + s + du, v });
  }
  // land on the centre line at the end of the last period before leading out (a ring ends a little short of it)
  const end = pts[pts.length - 1];
  if (Math.abs(end.v) > 1e-9 || Math.abs(end.u - (lead + span)) > 1e-9) pts.push({ u: lead + span, v: 0 });
  if (length - (lead + span) > 1e-9) straight(lead + span, length);
  return pts;
}
