import { plan } from './planner.js';
import { clipStrands, connectStrands, gridStrands, analyzeFabric, orderStrands, travelDistance, simplifyStrands, segmentContact } from './fabric.js';
import { resolveCrossings } from './crossings.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';
import { PolygonBoundary } from './boundary.js';

/** Shared final pass for every design. Only planar motifs are resettled; pile/relief keep their intended heights. */
export function finishFabric(result, { boundary = null, flat = false, reinforce = false } = {}) {
  const { cfg } = result, { layer_height: layerHeight, extrusion_width: strandWidth } = cfg.t;
  boundary ??= new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const classes = new Map();
  for (const m of result.moves) if (m.extrude) { if (!classes.has(m.tag)) classes.set(m.tag, []); classes.get(m.tag).push(m.cls); }
  let strands = result.strands ?? [
    ...(result.base ? (result.base.strands ?? [result.base.points]).map((pts, i) => ({ id: `base-${i}`, kind: 'base', pts })) : []),
    ...(result.placements ?? []).map((p) => ({ id: p.id, kind: 'supported', pts: p.points.map((q, i) => ({ ...q, z: cfg.derived.loopBaseZ + q.z, cls: classes.get(p.id)?.[Math.max(0, i - 1)] ?? 'supported' })) })),
  ];
  let ties = 0, backing = 0;
  if (flat) {
    strands = clipStrands(simplifyStrands(strands.map((s) => ({ ...s, pts: s.pts.map(({ cls, ...p }) => ({ ...p, z: layerHeight })) }))), boundary, strandWidth / 2);
    if (reinforce) { const grid = gridStrands(boundary, { layerHeight, inset: strandWidth / 2 }); backing = grid.length; strands = [...grid.map((s) => ({ ...s, layer: s.layer - 2, pts: s.pts.map((p) => ({ ...p, z: layerHeight })) })), ...strands]; }
    const repaired = connectStrands(strands, boundary, { strandWidth }); strands = repaired.strands; ties = repaired.ties;
    const lastLayer = Math.max(0, ...strands.map((s) => s.layer ?? 0)) + 1;
    const beforeMm = travelDistance(strands);
    strands = orderStrands(strands.map((s) => ({ ...s, layer: s.name === 'Structural tie' ? lastLayer : s.layer })));
    result.routing = { beforeMm, afterMm: travelDistance(strands) };
    strands = resolveCrossings(strands, { follow: true, lift: layerHeight, strandWidth }).strands;
    result.moves = emitStrands(strands, { retraction: cfg.derived.retraction });
    result.stats = { ...result.stats, ...computeStats(result.moves, cfg, result.placements ?? []) };
    if (result.coil) result.stats.loops = result.coil.loops;
    if (result.spiral) result.stats.loops = result.spiral.rings;
  }
  const baseSegments = (result.base?.strands ?? []).flatMap((pts) => pts.slice(1).map((p, i) => [pts[i], p]));
  const supportedAt = baseSegments.length ? (p) => baseSegments.some(([a, b]) => {
    const gap = p.z - a.z;
    return gap > layerHeight / 2 && gap <= layerHeight + 0.04 && segmentContact(p, p, a, b).distance <= strandWidth / 2;
  }) : null;
  let fabric = analyzeFabric(strands, { strandWidth, layerHeight, boundary, supportedAt });
  if (!flat && result.placements?.length && fabric.reversedCrossings) {
    strands = resolveCrossings(strands, { follow: true, preserve: true, lift: 0, strandWidth }).strands;
    const loops = strands.slice(result.base?.strands?.length ?? (result.base ? 1 : 0));
    result.placements = result.placements.map((p, i) => ({ ...p, points: loops[i].pts.map((q) => ({ ...q, z: q.z - cfg.derived.loopBaseZ })) }));
    const planned = plan(cfg, result.base, result.placements, boundary);
    result.moves = planned.moves;
    result.stats = computeStats(result.moves, cfg, result.placements);
    result.warnings.push(...planned.warnings);
    const updated = new Map();
    for (const m of planned.moves) if (m.extrude) { if (!updated.has(m.tag)) updated.set(m.tag, []); updated.get(m.tag).push(m.cls); }
    strands = strands.map((s) => ({ ...s, pts: s.pts.map((p, i) => ({ ...p, cls: s.kind === 'base' ? 'base' : updated.get(s.id)?.[Math.max(0, i - 1)] ?? p.cls })) }));
    fabric = analyzeFabric(strands, { strandWidth, layerHeight, boundary, supportedAt });
  }
  result.strands = strands;
  result.fabric = fabric;
  result.repairs = { ties, backing };
  result.warnings = [...(result.warnings ?? []), ...fabric.issues];
  if (result.report) result.report = { ...result.report, components: fabric.components };
  result.gcode = writeGcode(result.moves, cfg, { stats: result.stats });
  return result;
}
