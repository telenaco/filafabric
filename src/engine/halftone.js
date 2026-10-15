import { hatch } from './layers.js';

/**
 * Halftone net (Gispan, Ariel & Sterman, "Halftoning for 3D printed textile nets"): a net whose line thickness, not
 * its line spacing, carries a picture. The topology of the net never changes (the same lines, the same crossings),
 * so the fabric holds together everywhere; dark places are printed with more flow, light places with less, and the
 * slicer-free toolpath slows down where the bead is thick so the volume stays within what the nozzle can melt.
 *
 * Two layers cross each other. With `second: 'same'` both layers get thick in the same places (a darker patch);
 * with `second: 'complement'` the second layer is thick where the first is thin, so the net is the same thickness
 * everywhere but the two colours (a pause for a second filament between layers) swap places with the picture.
 */

export const NET_SHAPES = Object.freeze(['straight', 'wave', 'zigzag']);
export const SECOND_LAYERS = Object.freeze(['same', 'complement']);

/** How far (mm) every point of the net stays from the outline: a bead's half width and a little more. */
const CLEARANCE = 0.25;

/** Flow is rounded to this step: fewer distinct values keep the G-code (and every later pass) small. */
const FLOW_STEP = 0.05;
const quantise = (f) => Math.round(f / FLOW_STEP) * FLOW_STEP;

/**
 * @param tone      sampler (x, y, w, h) → 0..1, 1 = dark (thick)
 * @param thin      flow multiplier where the tone is 0
 * @param thick     flow multiplier where the tone is 1
 * @param crossing  angle (degrees) the second layer is turned from the first
 * @returns { layers, extra }: two layers of polylines whose points carry a `flow`
 */
export function halftoneLayers(boundary, { spacing = 3, angle = 0, crossing = 90, shape = 'straight', size = 1.5, pitch = 8, tone = null, thin = 0.6, thick = 1.8, second = 'same' } = {}) {
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const toneAt = (x, y) => (tone ? Math.max(0, Math.min(1, tone(x - box.minX, y - box.minY, w, h))) : 0.5);
  const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const wavy = shape !== 'straight' && size > 0;
  // each layer is one continuous line: it is never cut where a wave or a slanting edge would leave the outline, and
  // however far apart the ends of two neighbouring lines are, they are joined as long as the join stays inside
  const lines = (deg, offset) => hatch(boundary, { angle: deg, spacing, offset, anchor: centre, shape: wavy ? shape : null, size, pitch, maxJog: Infinity, keepInside: CLEARANCE });
  const withFlow = (list, invert) => list.map((pts) => pts.map((p) => {
    const t = toneAt(p.x, p.y);
    return { ...p, flow: quantise(thin + (thick - thin) * (invert ? 1 - t : t)) };
  }));
  const first = withFlow(lines(angle, 0), false);
  const secondLayer = withFlow(lines(angle + crossing, 0.5), second === 'complement');
  // the range of flow actually used (a loop, not a spread: a dense net has more points than a call can take)
  let lo = Infinity, hi = -Infinity;
  for (const list of [first, secondLayer]) for (const pts of list) for (const p of pts) {
    if (p.flow < lo) lo = p.flow;
    if (p.flow > hi) hi = p.flow;
  }
  return {
    layers: [first, secondLayer],
    extra: {
      halftone: {
        lo: Number.isFinite(lo) ? lo : thin,
        hi: Number.isFinite(hi) ? hi : thick,
        second,
      },
    },
  };
}
