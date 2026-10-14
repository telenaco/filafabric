import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { computeStats } from './stats.js';
import { PolygonBoundary } from './boundary.js';
import { serpentineChains, centredLanes } from './fill.js';
import { emitStrands } from './emit.js';
import { resolveCrossings, findCrossings } from './crossings.js';
import { lanePoints } from './shapes.js';
import { MAX_MOVES } from './tiler.js';
import { contactGraph, clipStrands, connectStrands, orderStrands, travelDistance, simplifyStrands } from './fabric.js';
import { finishFabric } from './fabric-result.js';

/**
 * Helpers shared by every design that is a few layers of plotted lines: ordered layers of polylines in mm in, moves,
 * statistics, G-code and a crossing report out. Each layer lies one layer height above the one before, a strand that
 * crosses itself lifts over its own earlier pass, and the report says how well the layers are held together.
 */

const STEP = 0.5; // mm between points along a polyline

/** The outline as a boundary, or the full width x height rectangle. */
export function boundaryFor(width, height, outline = null) {
  return new PolygonBoundary(outline ?? [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]]);
}

/** The area (mm²) of a boundary, by sampling it on a 2 mm grid. */
export function boundaryArea(boundary, cell = 2) {
  const box = boundary.bbox();
  let n = 0;
  for (let y = box.minY + cell / 2; y < box.maxY; y += cell) for (let x = box.minX + cell / 2; x < box.maxX; x += cell) if (boundary.contains(x, y)) n++;
  return n * cell * cell;
}

/** Points spaced at most `step` apart along the polyline (the original corners are kept). */
export function densify(pts, step = STEP) {
  if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** The parts of a polyline that lie inside the boundary, as separate polylines (anything shorter than 1 mm is dropped). */
export function clipPolyline(pts, boundary, minLength = 1) {
  const dense = densify(pts);
  const out = [];
  let run = [];
  const flush = () => {
    let len = 0;
    for (let i = 1; i < run.length; i++) len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    if (run.length >= 2 && len >= minLength) out.push(run);
    run = [];
  };
  for (const p of dense) {
    if (boundary.contains(p.x, p.y)) run.push(p);
    else flush();
  }
  flush();
  return out;
}

const rotate = (p, c, s) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });

/**
 * Parallel lines at `angle` (degrees) `spacing` apart, clipped to the boundary and joined into as few serpentine
 * strands as its shape allows. `shape` / `size` / `pitch` make each line wavy (see shapes.js); `offset` slides the
 * lines sideways by a fraction of the spacing so two layers can interleave. With an `anchor` point the lines lie on a
 * lattice through it (otherwise they are centred in the outline).
 */
export function hatch(boundary, { angle = 0, spacing = 3, offset = 0, shape = null, size = 0, pitch = 4, inset = 0.3, anchor = null } = {}) {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const turned = new PolygonBoundary(boundary.rings.map((ring) => ring.map((p) => rotate(p, c, -s))));
  const box = turned.bbox();
  // no lane closer to the edge than the other layers' lines reach (they stop `inset` short of it), or the edge lane
  // would run the whole width with nothing crossing it
  const edge = inset + 0.2;
  const lo = box.minY + edge, hi = box.maxY - edge;
  let lanes;
  if (anchor) {
    // lanes on a fixed lattice through `anchor`, so several hatches can be placed exactly against each other
    const y0 = rotate(anchor, c, -s).y + offset * spacing;
    lanes = [];
    for (let k = Math.ceil((lo - y0) / spacing); y0 + k * spacing <= hi; k++) lanes.push(y0 + k * spacing);
  } else if (hi > lo) {
    lanes = centredLanes(lo, hi, spacing).map((y) => y + offset * spacing).filter((y) => y > lo - 1e-9 && y < hi + 1e-9);
  } else {
    lanes = [(box.minY + box.maxY) / 2];
  }
  const chains = serpentineChains(turned, 'y', lanes, { inset, minLength: 1, maxJog: 3 * spacing });
  return chains.map((segments) => {
    const pts = [];
    for (const seg of segments) {
      const dir = seg.to >= seg.from ? 1 : -1;
      const length = Math.abs(seg.to - seg.from);
      let line;
      if (shape && size > 0) {
        line = lanePoints({ shape, length, pitch, size, step: STEP }).map((p) => ({ x: seg.from + dir * p.u, y: seg.c + p.v }));
      } else {
        line = densify([{ x: seg.from, y: seg.c }, { x: seg.to, y: seg.c }]);
      }
      if (pts.length) pts.push(...densify([pts[pts.length - 1], line[0]]).slice(1));
      pts.push(...(pts.length ? line.slice(1) : line));
    }
    return pts.map((p) => rotate(p, c, s));
  });
}

/**
 * Joins polylines (in the order given) into longer strands: a polyline continues the strand before it when its start
 * is within `maxJog` of that strand's end and the connector stays inside the boundary; otherwise it starts a new one.
 */
export function chainPolylines(list, boundary, maxJog = 6) {
  const chains = [];
  let cur = null;
  for (const pts of list) {
    if (pts.length < 2) continue;
    if (cur) {
      const end = cur[cur.length - 1];
      const d = Math.hypot(pts[0].x - end.x, pts[0].y - end.y);
      if (d <= maxJog && boundary.contains((pts[0].x + end.x) / 2, (pts[0].y + end.y) / 2)) {
        cur.push(...densify([end, pts[0]]).slice(1), ...pts.slice(1));
        continue;
      }
      chains.push(cur);
    }
    cur = pts.map((p) => ({ x: p.x, y: p.y }));
  }
  if (cur) chains.push(cur);
  return chains;
}

/**
 * Splits a graph into trails (walks that never reuse an edge), starting at odd-degree vertices first so as few trails
 * as the graph allows are needed. Edges are polylines; two edges meet where their ends are within 0.01 mm.
 */
export function trailsFromEdges(edges) {
  const key = (p) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
  const at = new Map();
  const add = (k, i) => { if (!at.has(k)) at.set(k, []); at.get(k).push(i); };
  edges.forEach((e, i) => { add(key(e[0]), i); add(key(e[e.length - 1]), i); });
  const used = new Array(edges.length).fill(false);
  const unusedAt = (k) => (at.get(k) ?? []).filter((i) => !used[i]);
  const starts = [...at.keys()].sort();
  const trails = [];
  for (const odd of [true, false]) {
    for (const k0 of starts) {
      if (odd && unusedAt(k0).length % 2 === 0) continue;
      let k = k0;
      while (unusedAt(k).length > 0) {
        const trail = [];
        for (;;) {
          const options = unusedAt(k);
          if (options.length === 0) break;
          const i = options[0];
          used[i] = true;
          let e = edges[i];
          if (key(e[0]) !== k) e = e.slice().reverse();
          trail.push(...(trail.length ? e.slice(1) : e));
          k = key(e[e.length - 1]);
        }
        trails.push(trail);
        k = k0;
      }
    }
  }
  return trails;
}

/**
 * How well a set of plotted layers holds together. `items` are { pts, layer }.
 * @returns { crossings, between, perCm2, minAngle, longestUncrossed, strands }: `between` counts crossings of
 *          different layers; `minAngle` is the smallest usual crossing angle (10th percentile, degrees);
 *          `longestUncrossed` is the longest stretch (mm) of any strand without a crossing
 */
export function crossingReport(items, areaMm2, strandWidth = 0.45) {
  const { found, arcs } = findCrossings(items.map((it) => ({ pts: it.pts })), { strandWidth });
  let between = 0;
  const angles = [];
  const marks = items.map(() => []);
  for (const c of found) {
    const across = items[c.sa].layer !== items[c.sb].layer;
    if (across) between++;
    angles.push({ across, angle: c.angle });
    marks[c.sa].push(c.arcA);
    marks[c.sb].push(c.arcB);
  }
  // the 10th percentile of the crossings between layers (all of them for a single layer): the short jogs that join
  // one line to the next cross at odd angles and would otherwise decide the number
  const pool = (angles.some((a) => a.across) ? angles.filter((a) => a.across) : angles).map((a) => a.angle).sort((p, q) => p - q);
  const minAngle = pool.length ? pool[Math.floor(pool.length * 0.1)] : 0;
  let longest = 0;
  items.forEach((it, i) => {
    const total = arcs[i][arcs[i].length - 1] ?? 0;
    const m = marks[i].sort((p, q) => p - q);
    let prev = 0;
    for (const arc of m) { longest = Math.max(longest, arc - prev); prev = arc; }
    longest = Math.max(longest, total - prev);
  });
  return {
    ...contactGraph(items.map((it) => ({ pts: it.pts.map((p) => ({ ...p, z: p.z ?? 0.2 * (it.layer + 1) })) })), { strandWidth }),
    crossings: found.length,
    between,
    perCm2: areaMm2 > 0 ? (found.length / areaMm2) * 100 : 0,
    minAngle,
    longestUncrossed: longest,
    strands: items.length,
  };
}

/**
 * Layers of polylines to strands: layer k at (k + 1) layer heights, a self-crossing strand lifts over its own earlier
 * pass, and the first strand of every layer after the first can pause for a filament change.
 */
export function layersToStrands(layers, { layerHeight = 0.2, strandWidth = 0.45, colorChange = false, ramp = 1.6, boundary = null, coherent = false } = {}) {
  if (coherent) {
    let flat = layers.flatMap((list, k) => list.filter((p) => p.length >= 2).map((p, i) => ({ id: `l${k + 1}-${i + 1}`, layer: k, kind: k ? 'supported' : 'base', name: `Layer ${k + 1}`, pauseBefore: colorChange && k > 0 && i === 0, pts: p.map((q) => ({ x: q.x, y: q.y, z: layerHeight })) })));
    flat = simplifyStrands(flat);
    if (boundary) flat = clipStrands(flat, boundary, strandWidth / 2);
    if (boundary) flat = connectStrands(flat, boundary, { strandWidth }).strands;
    const beforeMm = travelDistance(flat);
    flat = orderStrands(flat.map((s) => ({ ...s, layer: s.layer === -1 ? layers.length : s.layer })));
    const out = resolveCrossings(flat, { follow: true, lift: layerHeight, strandWidth, ramp }).strands;
    out.routing = { beforeMm, afterMm: travelDistance(out) };
    return out;
  }
  const strands = [];
  layers.forEach((polylines, k) => {
    const flat = polylines
      .filter((p) => p.length >= 2)
      .map((p, i) => ({ id: `l${k + 1}-${i + 1}`, layer: k, kind: k === 0 ? 'base' : 'supported', name: `Layer ${k + 1}`, pts: p.map((q) => ({ x: q.x, y: q.y, z: layerHeight * (k + 1) })) }));
    // a strand crosses its own earlier pass in the layer: lift over it by a little more than a layer
    const settled = resolveCrossings(flat, { lift: layerHeight * 1.25, strandWidth, ramp }).strands;
    settled.forEach((s, i) => {
      s.pts = s.pts.map(({ cls, ...p }) => p); // the layer keeps its own colour role
      if (colorChange && k > 0 && i === 0) s.pauseBefore = true;
    });
    strands.push(...settled);
  });
  return strands;
}

/**
 * End to end for a layered design: machine, material and layers of polylines in, moves, stats, G-code and report out.
 * @param layers  array of layers, each an array of polylines of { x, y } in mm
 */
export function layeredResult(machine, material, { width, height, layers, colorChange = false, outline = null, extra = {}, ramp = 1.6 }) {
  const cfg = resolveConfig(machine, material, { sample_width: width, sample_height: height });
  const fit = bedFitErrors(cfg);
  if (fit.length > 0) throw new PreflightError(fit);
  const points = layers.reduce((n, layer) => n + layer.reduce((m, p) => m + p.length, 0), 0);
  if (points > MAX_MOVES) {
    throw new ConfigError([`This layout would need about ${points.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use wider spacing, larger cells or a smaller swatch.`]);
  }
  const strands = layersToStrands(layers, { layerHeight: cfg.t.layer_height, strandWidth: cfg.t.extrusion_width, colorChange, ramp, boundary: boundaryFor(width, height, outline), coherent: true });
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = computeStats(moves, cfg, []);
  stats.loops = 0;
  const items = [];
  strands.forEach((s) => items.push({ pts: s.pts, layer: s.kind === 'base' ? 0 : 1 }));
  const area = outline ? boundaryArea(new PolygonBoundary(outline)) : width * height;
  const report = crossingReport(items, area, cfg.t.extrusion_width);
  stats.crossings = report.crossings;
  const gcode = writeGcode(moves, cfg, { stats });
  const warnings = [];
  if (moves.length === 0) warnings.push('Nothing to print: the outline is too small for these settings');
  return finishFabric({ cfg, strands, moves, stats, warnings, gcode, outline, report, routing: strands.routing, ...extra });
}
