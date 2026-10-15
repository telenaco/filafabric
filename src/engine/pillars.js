import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { emitStrands } from './emit.js';
import { MAX_MOVES } from './tiler.js';
import { finishFabric } from './fabric-result.js';
import { PolygonBoundary } from './boundary.js';
import { boundaryArea, crossingReport, densify } from './layers.js';
import { resolveCrossings } from './crossings.js';
import { serpentineChains } from './fill.js';

/**
 * Two structures that stand on pillars, from the 3D-printed-textile literature:
 *
 *  - Spacer net (Kim & Lee, continuous textile structures): a net on the bed, a pillar on every node (or every second
 *    or third), and a second net on the pillars' tops, like a spacer fabric.
 *  - Pillar weave (Takahashi & Kim, UIST '19): short pillars on a grid and a fibre that runs between them, passing a
 *    pillar on one side on one layer and on the other side on the next, so the fibre layers lock round the pillars.
 *
 * A pillar is a stack of small rings, one per layer, and everything prints layer by layer (the rings of a layer, then
 * the fibre or the net of that layer), so the nozzle is never below something it has to pass beside.
 */

export const MAX_RINGS = 9000;
const STEP = 0.5;
const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** A closed ring of radius r at height z, points about STEP apart; first point repeated at the end. */
function ringPoints(cx, cy, r, z) {
  const n = Math.max(8, Math.ceil((2 * Math.PI * r) / STEP));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z });
  }
  return pts;
}

/** Coordinates `pitch` apart, centred in [lo + margin, hi - margin]. */
function centred(lo, hi, pitch, margin) {
  const span = hi - lo - 2 * margin;
  if (span < 0) return [];
  const n = Math.floor(span / pitch + 1e-9) + 1;
  const start = lo + margin + (span - (n - 1) * pitch) / 2;
  return Array.from({ length: n }, (_, i) => start + i * pitch);
}

/** Pillar rings nearest-neighbour ordered, starting from `at`. */
function nearestOrder(list, at) {
  const left = list.slice();
  const out = [];
  let cur = at;
  while (left.length) {
    let pick = 0, best = Infinity;
    left.forEach((p, i) => {
      const d = Math.hypot(p.x - cur.x, p.y - cur.y);
      if (d < best) { best = d; pick = i; }
    });
    const p = left.splice(pick, 1)[0];
    out.push(p);
    cur = p;
  }
  return out;
}

/** True when a ring at (x, y) of radius r (plus a bead) lies wholly inside the boundary. */
function ringFits(boundary, x, y, r, margin) {
  const reach = r + margin;
  if (!boundary.contains(x, y)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (!boundary.contains(x + reach * Math.cos(a), y + reach * Math.sin(a))) return false;
  }
  return true;
}

/** One straight line of a net, as dense points at height z. */
const netLine = (axis, c, a, b, z) => {
  const pts = axis === 'x' ? [{ x: c, y: a, z }, { x: c, y: b, z }] : [{ x: a, y: c, z }, { x: b, y: c, z }];
  return densify(pts, STEP).map((p) => ({ ...p, z }));
};

/**
 * @returns { strands, nodes, pillars, rings } strands in print order for a spacer net
 */
export function spacerStrands(boundary, { pitch = 5, layers = 8, radius = 1, every = 1, layerHeight = 0.2, strandWidth = 0.45 } = {}) {
  const box = boundary.bbox();
  const inset = strandWidth / 2 + 0.1;
  const xs = centred(box.minX, box.maxX, pitch, inset + 0.5);
  const ys = centred(box.minY, box.maxY, pitch, inset + 0.5);
  // the bottom net is on the bed, so it runs wherever the shape does; the top net is held up by pillars alone, so it
  // only runs along lines of pillars and only between the first and the last pillar of each line
  const nodes = [];
  xs.forEach((x, i) => ys.forEach((y, j) => {
    if (i % every === 0 && j % every === 0 && ringFits(boundary, x, y, radius, strandWidth)) nodes.push({ x, y, i, j });
  }));
  const lines = (z, onBed) => {
    const out = [];
    if (onBed) {
      for (const x of xs) for (const [a, b] of boundary.intervals('x', x)) if (b - a - 2 * inset >= 1) out.push({ axis: 'x', c: x, pts: netLine('x', x, a + inset, b - inset, z) });
      for (const y of ys) for (const [a, b] of boundary.intervals('y', y)) if (b - a - 2 * inset >= 1) out.push({ axis: 'y', c: y, pts: netLine('y', y, a + inset, b - inset, z) });
      return out;
    }
    for (const x of xs) {
      const on = nodes.filter((n) => n.x === x);
      if (on.length >= 2) out.push({ axis: 'x', c: x, pts: netLine('x', x, Math.min(...on.map((n) => n.y)), Math.max(...on.map((n) => n.y)), z) });
    }
    for (const y of ys) {
      const on = nodes.filter((n) => n.y === y);
      if (on.length >= 2) out.push({ axis: 'y', c: y, pts: netLine('y', y, Math.min(...on.map((n) => n.x)), Math.max(...on.map((n) => n.x)), z) });
    }
    return out;
  };
  const netStrands = (z, base) => {
    const onBed = z <= layerHeight + 1e-9;
    const all = lines(z, onBed);
    // the second direction rides over the first at every crossing, as a plain net does
    const order = [...all.filter((l) => l.axis === 'x'), ...all.filter((l) => l.axis === 'y')]
      .map((l, i) => ({ id: `${base}-${i}`, kind: onBed ? 'base' : 'supported', name: onBed ? 'Bottom net' : 'Top net', pts: l.pts }));
    return resolveCrossings(order, { follow: true, lift: layerHeight, strandWidth }).strands;
  };

  const bottom = netStrands(layerHeight, 'bottom');
  const rings = nodes.length * layers;
  if (rings > MAX_RINGS) {
    throw new ConfigError([`This spacer net would need ${rings.toLocaleString('en')} separate rings; the limit is ${MAX_RINGS.toLocaleString('en')}. Use a wider net, fewer layers or pillars on every second node.`]);
  }

  const strands = [...bottom];
  let at = bottom.length ? bottom[bottom.length - 1].pts.at(-1) : { x: box.minX, y: box.minY };
  for (let k = 0; k < layers; k++) {
    const z = (k + 2) * layerHeight;
    for (const p of nearestOrder(nodes, at)) {
      strands.push({ id: `pillar-${k}-${strands.length}`, kind: 'supported', name: 'Pillars', layer: k + 1, pts: ringPoints(p.x, p.y, radius, z) });
      at = p;
    }
  }
  const top = netStrands((layers + 2) * layerHeight, 'top');
  strands.push(...top.map((s) => ({ ...s, kind: 'supported' })));
  return { strands, nodes: nodes.length, pillars: nodes.length, rings, bottom: bottom.length, top: top.length };
}

/**
 * @returns { strands, pillars, rings, chains } strands in print order for a pillar weave
 */
export function pillarWeaveStrands(boundary, { pitch = 4.8, layers = 6, radius = 0.8, layerHeight = 0.2, strandWidth = 0.45 } = {}) {
  const box = boundary.bbox();
  const inset = strandWidth / 2 + 0.1;
  const reach = radius + 0.8 * strandWidth; // a fibre passes a pillar with its bead pressed a little into the pillar's bead
  const xs = centred(box.minX, box.maxX, pitch, reach + inset + 0.3);
  const ys = centred(box.minY, box.maxY, pitch, reach + inset + 0.3);
  if (!xs.length || !ys.length) return { strands: [], pillars: 0, rings: 0, chains: 0 };

  // the fibre of every row: serpentine chains over the rows, so one fibre per layer wherever the shape allows
  const chains = serpentineChains(boundary, 'y', ys, { inset: inset + 0.3, minLength: 1, maxJog: 3 * pitch });
  const pillars = [];
  const seen = new Set();
  for (const chain of chains) {
    for (const seg of chain) {
      const lo = Math.min(seg.from, seg.to), hi = Math.max(seg.from, seg.to);
      xs.forEach((x, i) => {
        if (x > lo + 0.2 && x < hi - 0.2 && ringFits(boundary, x, seg.c, radius, strandWidth)) {
          const key = `${i},${seg.lane}`;
          if (!seen.has(key)) { seen.add(key); pillars.push({ x, y: seg.c, i, j: seg.lane }); }
        }
      });
    }
  }
  const rings = pillars.length * layers;
  if (rings > MAX_RINGS) {
    throw new ConfigError([`This weave would need ${rings.toLocaleString('en')} separate rings; the limit is ${MAX_RINGS.toLocaleString('en')}. Use a wider pillar spacing, fewer layers or a smaller swatch.`]);
  }
  const pillarAt = new Map(pillars.map((p) => [`${p.i},${p.j}`, p]));

  /** The fibre of layer k along one segment: pillar side alternates along the row, row to row and layer to layer. */
  const weave = (seg, k, z) => {
    const dir = seg.to >= seg.from ? 1 : -1;
    const cols = xs.map((x, i) => ({ x, i })).filter((c) => pillarAt.has(`${c.i},${seg.lane}`) && c.x > Math.min(seg.from, seg.to) && c.x < Math.max(seg.from, seg.to));
    if (dir < 0) cols.reverse();
    const control = [{ u: seg.from, off: 0 }];
    for (const c of cols) control.push({ u: c.x, off: ((c.i + seg.lane + k) % 2 === 0 ? 1 : -1) * reach });
    control.push({ u: seg.to, off: 0 });
    const pts = [];
    const total = Math.abs(seg.to - seg.from);
    const n = Math.max(1, Math.ceil(total / STEP));
    let ci = 0;
    for (let s = 0; s <= n; s++) {
      const u = seg.from + (dir * total * s) / n;
      while (ci + 2 < control.length && (u - control[ci + 1].u) * dir > 0) ci++;
      const a = control[ci], b = control[ci + 1];
      const t = Math.abs(b.u - a.u) < 1e-9 ? 1 : (u - a.u) / (b.u - a.u);
      pts.push({ x: u, y: seg.c + a.off + (b.off - a.off) * smooth(t), z });
    }
    return pts;
  };

  const strands = [];
  let at = { x: box.minX, y: box.minY };
  for (let k = 0; k < layers; k++) {
    const z = (k + 1) * layerHeight;
    for (const p of nearestOrder(pillars, at)) {
      strands.push({ id: `pillar-${k}-${strands.length}`, kind: k === 0 ? 'base' : 'supported', name: 'Pillars', layer: 2 * k, pts: ringPoints(p.x, p.y, radius, z) });
      at = p;
    }
    chains.forEach((chain, ci) => {
      const pts = [];
      for (const seg of chain) {
        const run = weave(seg, k, z);
        if (pts.length) pts.push(...densify([pts[pts.length - 1], run[0]], STEP).slice(1).map((p) => ({ ...p, z })));
        pts.push(...(pts.length ? run.slice(1) : run));
      }
      if (pts.length >= 2) strands.push({ id: `fibre-${k}-${ci}`, kind: k === 0 ? 'base' : 'supported', name: 'Fibre', layer: 2 * k + 1, pts });
      at = pts.at(-1) ?? at;
    });
  }
  return { strands, pillars: pillars.length, rings, chains: chains.length };
}

function finish(machine, material, params, build, extraKey) {
  const width = params.width ?? 100, height = params.height ?? 100;
  const cfg = resolveConfig(machine, material, { sample_width: width, sample_height: height });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);
  const outline = params.outline ?? null;
  const boundary = new PolygonBoundary(outline ?? [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]]);
  const built = build(boundary, cfg);
  const points = built.strands.reduce((n, s) => n + s.pts.length, 0);
  if (points > MAX_MOVES) {
    throw new ConfigError([`This structure would need about ${points.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use a wider pitch, fewer layers or a smaller swatch.`]);
  }
  const moves = emitStrands(built.strands, { retraction: cfg.derived.retraction });
  const stats = computeStats(moves, cfg, []);
  stats.loops = built.pillars;
  const items = built.strands.filter((s) => s.name !== 'Pillars').map((s) => ({ pts: s.pts, layer: s.layer ?? (s.kind === 'base' ? 0 : 1) }));
  const area = outline ? boundaryArea(boundary) : width * height;
  const report = crossingReport(items, area, cfg.t.extrusion_width);
  stats.crossings = report.crossings;
  const warnings = [];
  if (built.pillars === 0) warnings.push('No pillar fits: the swatch is smaller than one pitch');
  const gcode = writeGcode(moves, cfg, { stats });
  return finishFabric({ cfg, strands: built.strands, moves, stats, warnings, gcode, outline, report, layerCount: Math.round(params.layers ?? 1) + 2, [extraKey]: { pillars: built.pillars, rings: built.rings, layers: Math.max(1, Math.round(params.layers ?? 1)) } }, { boundary });
}

/** End to end: machine, material and spacer-net settings in, moves, stats, G-code and report out. */
export function generateSpacer(machine, material, params = {}) {
  return finish(machine, material, params, (boundary, cfg) => spacerStrands(boundary, {
    pitch: params.pitch ?? 5,
    layers: Math.max(1, Math.round(params.layers ?? 8)),
    radius: params.radius ?? 1,
    every: Math.max(1, Math.round(params.every ?? 1)),
    layerHeight: cfg.t.layer_height,
    strandWidth: cfg.t.extrusion_width,
  }), 'spacer');
}

/** End to end: machine, material and pillar-weave settings in, moves, stats, G-code and report out. */
export function generatePillarWeave(machine, material, params = {}) {
  return finish(machine, material, params, (boundary, cfg) => pillarWeaveStrands(boundary, {
    pitch: params.pitch ?? 4.8,
    layers: Math.max(1, Math.round(params.layers ?? 6)),
    radius: params.radius ?? 0.8,
    layerHeight: cfg.t.layer_height,
    strandWidth: cfg.t.extrusion_width,
  }), 'pillarWeave');
}
