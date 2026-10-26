import { clipPolyline, chainPolylines, densify } from './layers.js';
import { orderLines } from './flowlines.js';
import { ConfigError } from './params.js';
import { fitCount, fitPeriod } from './repeats.js';

/**
 * Parquet: the floor is cut into blocks or planks, and in every block the first layer runs one way and the second
 * the other way, at 90°. Neighbouring blocks are turned a quarter turn, so the fabric shows the pattern of a parquet
 * floor (a basket weave of squares, a herringbone of planks, or chevron bands) while every point of it is a plain
 * right-angle mesh. Within a block each layer is one serpentine strand.
 */

const SQRT2 = Math.SQRT2;
export const MAX_TILES = 4000;

export const TILINGS = Object.freeze({
  basket: { label: 'Basket weave', hint: 'Square blocks, each turned a quarter turn from its neighbours', turn: 0 },
  herringbone: { label: 'Herringbone', hint: 'Planks laid in a zigzag, each against the side of the next', turn: 45 },
  chevron: { label: 'Chevron', hint: 'Bands of slanted lines meeting in a point, the next layer slanting the other way', turn: 0 },
});
export const TILING_IDS = Object.freeze(Object.keys(TILINGS));

/**
 * The tiles of a tiling that touch a box, in its own frame: { x, y, w, h, along } with `along` the direction of the
 * block's first layer ('x' or 'y').
 * Herringbone, in plank widths, for planks n wide: H_k = [k, k+n] x [k, k+1] lying, V_k = [k+n, k+n+1] x [k+1-n, k+1]
 * standing, a staircase that repeats every (-n, n).
 */
export function tiles(tiling, box, { block = 8, ratio = 2, whole = false } = {}) {
  const out = [];
  const touches = (t) => t.x < box.maxX && t.x + t.w > box.minX && t.y < box.maxY && t.y + t.h > box.minY;
  if (tiling === 'basket' && whole) {
    // whole blocks (repeats.js): from the box's corner, each a little wider or taller than `block` so they fill it
    const cols = fitCount(box.maxX - box.minX, block), rows = fitCount(box.maxY - box.minY, block);
    const bx = (box.maxX - box.minX) / cols, by = (box.maxY - box.minY) / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) out.push({ x: box.minX + i * bx, y: box.minY + j * by, w: bx, h: by, along: (i + j) % 2 === 0 ? 'x' : 'y' });
    }
  } else if (tiling === 'basket') {
    for (let j = Math.floor(box.minY / block); j * block < box.maxY; j++) {
      for (let i = Math.floor(box.minX / block); i * block < box.maxX; i++) {
        out.push({ x: i * block, y: j * block, w: block, h: block, along: (i + j) % 2 === 0 ? 'x' : 'y' });
      }
    }
  } else if (tiling === 'herringbone') {
    const n = Math.max(2, Math.round(ratio)), b = block;
    // k runs along the staircase (+1, +1), m across it (-n, n); both ranges cover the box with room to spare
    const span = (Math.max(box.maxX - box.minX, box.maxY - box.minY) + 2 * (n + 1) * b) / b;
    const cx = (box.minX + box.maxX) / 2 / b, cy = (box.minY + box.maxY) / 2 / b;
    // the staircase through (cx, cy): k0 = (cx + cy) / 2 along, m0 = (cy - cx) / 2n across
    const k0 = Math.round((cx + cy) / 2), m0 = Math.round((cy - cx) / (2 * n));
    for (let m = m0 - Math.ceil(span / n) - 1; m <= m0 + Math.ceil(span / n) + 1; m++) {
      for (let k = k0 - Math.ceil(span) - n; k <= k0 + Math.ceil(span) + n; k++) {
        const ox = (k - m * n) * b, oy = (k + m * n) * b;
        const lying = { x: ox, y: oy, w: n * b, h: b, along: 'x' };
        const standing = { x: ox + n * b, y: oy + (1 - n) * b, w: b, h: n * b, along: 'y' };
        if (touches(lying)) out.push(lying);
        if (touches(standing)) out.push(standing);
        if (out.length > MAX_TILES) throw new ConfigError([`This would need more than ${MAX_TILES} planks; use wider planks or a smaller swatch.`]);
      }
    }
  }
  if (out.length > MAX_TILES) throw new ConfigError([`This would need more than ${MAX_TILES} blocks; use larger blocks or a smaller swatch.`]);
  return out;
}

/** A serpentine across a rectangle: lanes `spacing` apart (as near as fits) along `dir`, joined at alternate ends. */
function serpentine(t, dir, spacing) {
  const len = dir === 'x' ? t.w : t.h, wide = dir === 'x' ? t.h : t.w;
  const n = Math.max(1, Math.round(wide / spacing));
  const gap = wide / n, inset = Math.min(0.25 * gap, 0.5);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const across = (k + 0.5) * gap;
    const ends = k % 2 === 0 ? [inset, len - inset] : [len - inset, inset];
    for (const u of ends) pts.push(dir === 'x' ? { x: t.x + u, y: t.y + across } : { x: t.x + across, y: t.y + u });
  }
  return densify(pts);
}

/**
 * @param tiling   a key of TILINGS
 * @param block    mm: the side of a block, or the width of a plank or band
 * @param ratio    herringbone: plank length in plank widths (2, 3 or 4)
 * @param spacing  mm between neighbouring lines of one layer
 * @param turn     degrees the whole floor is turned
 * @param whole    whole repeats (repeats.js) where the floor runs square to the swatch: whole basket blocks, and
 *                 chevron points that meet the side edges. A herringbone meets any straight edge at a slant, so its
 *                 planks are cut there whatever their size.
 */
export function parquetLayers(boundary, { tiling = 'herringbone', block = 8, ratio = 2, spacing = 2, turn = null, whole = true } = {}) {
  const t = TILINGS[tiling];
  if (!t) throw new Error(`Unknown tiling: ${tiling}`);
  const a = ((turn ?? t.turn) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const square = whole && Math.abs(Math.sin(2 * a)) < 1e-9;
  const toFloor = (p) => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c });
  const fromFloor = (p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const corners = boundary.rings.flat().map(toFloor);
  const box = {
    minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)),
    minY: Math.min(...corners.map((p) => p.y)), maxY: Math.max(...corners.map((p) => p.y)),
  };

  let families;
  if (tiling === 'chevron') {
    // zigzags whose runs slant at 45° and turn at every band edge; the second layer is the same zigzag upside down,
    // so in every band the two slant opposite ways
    const step = spacing * SQRT2;
    // whole points: the band width made the nearest that puts a whole number of points across, from the left edge
    if (square) block = fitPeriod(box.maxX - box.minX, 2 * block) / 2;
    const origin = square ? box.minX : 0;
    const tri = (x) => block - Math.abs(((((x - origin) % (2 * block)) + 2 * block) % (2 * block)) - block);
    const zig = (y0, sign) => {
      const pts = [];
      const x0 = origin + Math.floor((box.minX - origin) / block) * block - block, x1 = box.maxX + block;
      for (let x = x0; x <= x1; x += block) pts.push({ x, y: y0 + sign * tri(x) });
      return densify(pts);
    };
    families = [[], []];
    for (let y = Math.floor((box.minY - block) / step) * step - step; y <= box.maxY + block + step; y += step) {
      families[0].push(zig(y, 1));
      families[1].push(zig(y + block + step / 2, -1));
    }
  } else {
    const list = tiles(tiling, box, { block, ratio, whole: square });
    families = [list.map((q) => serpentine(q, q.along, spacing)), list.map((q) => serpentine(q, q.along === 'x' ? 'y' : 'x', spacing))];
  }
  const layers = families.map((family) => {
    const pieces = family.flatMap((pts) => clipPolyline(pts.map(fromFloor), boundary));
    return chainPolylines(orderLines(pieces), boundary, 1.6 * spacing);
  });
  return { layers, extra: { tiling } };
}
