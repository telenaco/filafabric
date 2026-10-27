import { findCrossings } from './crossings.js';
import { liftCrossings } from './lift.js';
import { slidingChannels } from './channels.js';

/** The direction sets with exactly two strands at every crossing; Li's channels cannot hold three. */
export const TWO_DIRECTION_SETS = Object.freeze(['0-90', '45-135', '60-120']);
export const LIFT_WHERE = Object.freeze(['all', 'alternate', 'pattern']);
export const SLIDE_MASKS = Object.freeze(['b', 'a', 'alternate', 'pattern']);

/** Spacing at which the channels of neighbouring crossings stay apart: legBefore x (1 + legAfterFactor) + one bead. */
export const LEG_AFTER_FACTOR = 1.4;
export const minChannelSpacing = (legBefore, bead = 0.45) => legBefore * (1 + LEG_AFTER_FACTOR) + bead;

/**
 * Which of two checkerboard colours a crossing has. The lines of a layer sit on a lattice, so a crossing is named by which line
 * of each layer it is on: the lines' positions across their own direction are grouped (the lanes are fitted to the swatch, so
 * their spacing is not exactly the setting) and counted off in order. An even sum is one colour, an odd sum the other.
 * @param {Array} strands  the strands the crossings are found on, in the same order the caller will use
 * @param {{bead?:number, angles:number[], spacing:number}} options  `angles` are the layers' line directions in degrees
 */
export function checkerboard(strands, { bead = 0.45, angles, spacing }) {
  const { found } = findCrossings(strands, { strandWidth: bead, cell: 1 });
  const across = (layer, x, y) => { const a = (angles[layer] ?? 0) * Math.PI / 180; return -Math.sin(a) * x + Math.cos(a) * y; };
  const positions = new Map(); // layer -> every position across its lines
  for (const c of found) for (const index of [c.sa, c.sb]) {
    const layer = strands[index].layer ?? 0;
    if (!positions.has(layer)) positions.set(layer, []);
    positions.get(layer).push(across(layer, c.x, c.y));
  }
  const tolerance = Math.max(bead, spacing * 0.35), lanes = new Map(); // layer -> cluster centres, ascending
  for (const [layer, values] of positions) {
    const sorted = values.sort((a, b) => a - b), centres = [];
    let start = 0;
    for (let i = 1; i <= sorted.length; i++) if (i === sorted.length || sorted[i] - sorted[i - 1] > tolerance) {
      centres.push((sorted[start] + sorted[i - 1]) / 2);
      start = i;
    }
    lanes.set(layer, centres);
  }
  const rank = (layer, value) => {
    const centres = lanes.get(layer) ?? [];
    let best = 0;
    for (let i = 1; i < centres.length; i++) if (Math.abs(centres[i] - value) < Math.abs(centres[best] - value)) best = i;
    return best;
  };
  return (c) => {
    const la = strands[c.sa].layer ?? 0, lb = strands[c.sb].layer ?? 0;
    return (rank(la, across(la, c.x, c.y)) + rank(lb, across(lb, c.x, c.y))) % 2;
  };
}

/**
 * Grid · lifted crossings: the later strand rises over the earlier one at the crossings picked by `where`.
 * @param where  'all', 'alternate' (checkerboard) or 'pattern' (light parts of the picture lift, dark parts stay bonded)
 * @param field  tone field, 1 = dark
 */
export function liftGrid(strands, { where = 'all', lift = 1, length = 3, layerHeight = 0.2, bead = 0.45, angles = [0, 90], spacing = 3.5, field = null } = {}) {
  let mask = null;
  const notes = [];
  if (where === 'alternate') { const colour = checkerboard(strands, { bead, angles, spacing }); mask = (x, y, c) => colour(c) === 0; }
  else if (where === 'pattern') {
    if (field) mask = (x, y) => field(x, y) < 0.5;
    else notes.push('Choose a pattern to lift by: with none chosen, every crossing lifts.');
  }
  const result = liftCrossings(strands, { lift, length, mask, layerHeight, bead });
  return { ...result, notes: [...notes, ...result.notes] };
}

/**
 * Grid · sliding channels: split the strands into the first and second direction and let `slidingChannels` print the captive
 * strands over small channels. Returns the new strand list, base pieces first, then raised pieces, then channels.
 * @param where  'b' (second direction slides), 'a' (first), 'alternate' (checkerboard) or 'pattern' (dark fused, mid first, light second)
 */
export function slideGrid(strands, { where = 'b', spanLift = 1, channelLift = 2, legBefore = 1.2, layerHeight = 0.2, bead = 0.45, angles = [0, 90], spacing = 4, field = null } = {}) {
  const first = strands.filter((strand) => (strand.layer ?? 0) === 0), second = strands.filter((strand) => strand.layer === 1), rest = strands.filter((strand) => strand.layer > 1);
  const flat = [...first, ...second], notes = [];
  let mask = () => 'b';
  if (where === 'a') mask = () => 'a';
  else if (where === 'alternate') { const colour = checkerboard(flat, { bead, angles, spacing }); mask = (c) => (colour(c) === 0 ? 'a' : 'b'); }
  else if (where === 'pattern') {
    if (field) mask = (c) => { const tone = field(c.x, c.y); return tone >= 0.66 ? 'fused' : tone >= 0.33 ? 'a' : 'b'; };
    else notes.push('Choose a pattern to slide by: with none chosen, the second direction slides everywhere.');
  }
  // a channel needs a straight run along the strand it sits on; where that strand ends or turns (at the swatch edge) the crossing is fused
  const arcs = flat.map((strand) => strand.pts.reduce((table, point, i) => { table.push(i ? table[i - 1] + Math.hypot(point.x - strand.pts[i - 1].x, point.y - strand.pts[i - 1].y) : 0); return table; }, []));
  const lengths = arcs.map((table) => table.at(-1) ?? 0);
  const straight = (index, from, to) => {
    const pts = flat[index].pts, table = arcs[index];
    for (let i = 1; i + 1 < pts.length; i++) {
      if (table[i] <= from || table[i] >= to) continue;
      const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x), b = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      if (Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) > 0.17) return false;
    }
    return true;
  };
  const chosen = mask;
  mask = (c) => {
    const pick = chosen(c);
    if (pick === 'fused') return pick;
    const captive = c.familyA === pick ? c.sa : c.sb, base = captive === c.sa ? c.sb : c.sa, along = base === c.sa ? c.arcA : c.arcB;
    const before = legBefore + bead, after = legBefore * LEG_AFTER_FACTOR + bead;
    return along >= before && lengths[base] - along >= after && straight(base, along - before, along + after) ? pick : 'fused';
  };
  const result = slidingChannels([first, second], { mask, spanLift, channelLift, legBefore, legAfterFactor: LEG_AFTER_FACTOR, layerHeight, bead });
  return { ...result, strands: [...printOrder(result.strands, { raisedZ: layerHeight + spanLift, layerHeight }), ...rest], notes };
}

/**
 * Cut a channel where it reaches the height of the strand it holds, on the way up and on the way down: the parts below must be
 * printed before that strand and the part above after it, or the nozzle would have to be on both sides of it at once.
 * @returns {{feet: object[], arch: object}}
 */
export function splitChannel(channel, { raisedZ, layerHeight = 0.2 }) {
  const low = raisedZ - 1e-6, pts = channel.pts, z = (point) => point.z ?? 0;
  const first = pts.findIndex((point) => z(point) >= low);
  let last = -1;
  pts.forEach((point, i) => { if (z(point) >= low) last = i; });
  if (first < 1) return { feet: [], arch: channel };
  const cutAt = (a, b) => { const t = (low - z(a)) / Math.max(1e-9, z(b) - z(a)); return { ...a, ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: low }; };
  const rise = cutAt(pts[first - 1], pts[first]), feet = [{ ...channel, id: `${channel.id}-foot`, channelId: channel.id, part: 'foot', pts: [...pts.slice(0, first), rise] }];
  const body = [rise, ...pts.slice(first, last + 1)];
  if (last < pts.length - 1) {
    const fall = cutAt(pts[last + 1], pts[last]);
    body.push(fall);
    feet.push({ ...channel, id: `${channel.id}-foot-out`, channelId: channel.id, part: 'foot', pts: [fall, ...pts.slice(last + 1)] });
  }
  return { feet, arch: { ...channel, id: `${channel.id}-arch`, channelId: channel.id, part: 'arch', pts: body } };
}

/** Base pieces, the feet of the channels, the raised strands, then the arches of the channels: every strand after what it rests on. */
function printOrder(strands, { raisedZ, layerHeight }) {
  const channels = strands.filter((strand) => strand.role === 'channel'), others = strands.filter((strand) => strand.role !== 'channel');
  const raised = others.filter((strand) => /-raised-/.test(strand.id)), base = others.filter((strand) => !/-raised-/.test(strand.id));
  const pieces = channels.map((channel) => splitChannel(channel, { raisedZ, layerHeight }));
  return [...base, ...pieces.flatMap((piece) => piece.feet), ...raised, ...pieces.map((piece) => piece.arch)];
}
