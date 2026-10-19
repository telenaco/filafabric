import { ConfigError } from './params.js';
import { resolveCrossings } from './crossings.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode, GcodeWriter } from './gcode.js';
import { analyzeFabric } from './fabric.js';
import { PolygonBoundary } from './boundary.js';
import { MAX_MOVES } from './tiler.js';
import { plan } from './planner.js';
import { segmentContact } from './fabric.js';

const minimumZ = (s) => s.pts.reduce((z, p) => Math.min(z, p.z), Infinity);
const maximumZ = (s) => s.pts.reduce((z, p) => Math.max(z, p.z), -Infinity);
const raisedDesign = (r) => !!(r.placements?.length || r.fringe || r.relief || r.spacer || r.pillarWeave);

/** Backing passes only: exclude the actual raised loops, pillar rings and upper net. */
function backingGroups(result) {
  const groups = new Map();
  for (const s of result.strands ?? []) {
    if (s.fixed || s.brim || s.kind !== 'base' || s.name === 'Pillars') continue;
    if (result.pillarWeave && s.name !== 'Fibre') continue;
    let key = Math.round(minimumZ(s) * 1e6);
    if (result.spacer) {
      if (s.name !== 'Bottom net') continue;
      const a = s.pts[0], b = s.pts.at(-1);
      key = Math.abs(b.x - a.x) < Math.abs(b.y - a.y) ? 'x' : 'y';
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()];
}

/** Logical pattern passes, independent of local crossing lifts and auxiliary structural ties. */
function nativeGroups(result) {
  const body = (result.strands ?? []).filter((s) => !s.brim && !s.fixed);
  const groups = new Map(), ties = [];
  for (const s of body) {
    if (s.name === 'Structural tie') { ties.push(s); continue; }
    const key = s.layer ?? s.name ?? (s.kind === 'base' ? `base-${Math.round(minimumZ(s) * 1e6)}` : 'pattern');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const ordered = [...groups.values()];
  if (ordered.length) ordered.at(-1).push(...ties);
  return ordered;
}

export function nativeLayerInfo(result) {
  const fixedLayers = (result.strands ?? []).some((s) => s.fixed && !s.brim) ? 1 : 0;
  const raised = raisedDesign(result);
  const patternLayers = raised ? backingGroups(result).length : nativeGroups(result).length;
  const repeatable = patternLayers > 0;
  return {
    nativeLayers: raised ? null : patternLayers + fixedLayers,
    patternLayers, fixedLayers, repeatable,
    ...(raised ? { raised: true, mode: 'backing', backingLayers: patternLayers } : {}),
    ...(!repeatable ? { reason: raised ? 'This raised design has no backing to reinforce. Enable its base before adding extra layers.' : 'There is no generated fabric layer to repeat; the SVG paths print once as drawn.' } : {}),
  };
}

function originalNotes(result) {
  const standard = new Set(new GcodeWriter(result.cfg).header({ stats: result.stats }));
  return (result.gcode ?? '').split('; BODY START')[0].split(/\r?\n/)
    .filter((line) => line.startsWith('; ') && !standard.has(line) && !/^; (?:estimated time|filament:|param )/.test(line)).map((line) => line.slice(2));
}

/** Insert flat backing passes below the original structure, preserving the texture's anchor geometry. */
function reinforceBacking(result, count, info) {
  const groups = backingGroups(result), { cfg: originalCfg } = result;
  const h = originalCfg.t.layer_height, bead = originalCfg.t.extrusion_width, rise = count * h;
  const original = result.strands.filter((s) => !s.brim), fixed = original.filter((s) => s.fixed);
  let floor = Infinity;
  for (const g of groups) for (const s of g) { const z = minimumZ(s); if (z < floor) floor = z; }
  const body = original.filter((s) => !s.fixed);
  // Start with the original bottom pass: it also preserves contact with interior SVG strokes below it.
  const phase = 0;
  let budget = original.reduce((n,s)=>n+s.pts.length+4,0);
  for (let k=0;k<count;k++) budget += groups[(phase+k)%groups.length].reduce((n,s)=>n+s.pts.length+4,0);
  if (budget > MAX_MOVES) throw new ConfigError(['These extra backing layers exceed the move limit. Use fewer extra layers or wider spacing.']);
  const extras = [], sequence = [];
  for (let k=0;k<count;k++) {
    const index = (phase+k)%groups.length;
    for (const s of groups[index]) extras.push({ ...s, id: `${s.id}~backing-${k+1}`, extraLayer: k+1,
      sourceLayer: index, name: `Extra backing ${k+1}`, kind: 'base', pauseBefore: false,
      pts: s.pts.map((p)=>({...p,z:floor+k*h,cls:'base'})) });
    sequence.push(index);
  }
  const strands = [...fixed, ...extras, ...body.map((s)=>({...s,pts:s.pts.map((p)=>({...p,z:p.z+rise}))}))];
  const cfg = { ...originalCfg, derived: { ...originalCfg.derived, loopBaseZ: originalCfg.derived.loopBaseZ + rise } };
  const boundary = new PolygonBoundary(result.outline ?? [[{x:0,y:0},{x:cfg.t.sample_width,y:0},{x:cfg.t.sample_width,y:cfg.t.sample_height},{x:0,y:cfg.t.sample_height}]]);
  // Feed the current composed geometry to the clearance planner, retaining SVG edits, extrusion classes and flow.
  const planned = plan(cfg, null, [], boundary, { strands });
  const moves = planned.moves;
  if (moves.length > MAX_MOVES) throw new ConfigError(['The reinforced backing exceeds the move limit. Use fewer extra layers or wider spacing.']);
  const placements = result.placements?.length ? strands.filter((s)=>!s.fixed && s.kind!=='base').map((s)=>({
    id:s.id, points:s.pts.map((p)=>({...p,z:p.z-cfg.derived.loopBaseZ})),
    lift:maximumZ(s)-cfg.derived.loopBaseZ,
  })) : result.placements;
  const baseStrands = strands.filter((s)=>!s.fixed && s.kind==='base');
  const base = result.base ? { ...result.base, points:baseStrands[0]?.pts??[], strands:baseStrands.map((s)=>s.pts),
    length:baseStrands.reduce((n,s)=>n+s.pts.slice(1).reduce((v,p,i)=>v+Math.hypot(p.x-s.pts[i].x,p.y-s.pts[i].y),0),0) } : result.base;
  const segments = baseStrands.flatMap((s)=>s.pts.slice(1).map((p,i)=>[s.pts[i],p]));
  const supportedAt = segments.length ? (p)=>segments.some(([a,b])=>{
    const gap=p.z-a.z;
    return gap>h/2 && gap<=h+.04 && segmentContact(p,p,a,b).distance<=bead/2;
  }) : null;
  const fabric = analyzeFabric(strands,{strandWidth:bead,layerHeight:h,boundary,supportedAt});
  const stats = { ...result.stats, ...computeStats(moves,cfg,placements??[]), loops:result.stats.loops };
  const warnings = [...(result.warnings??[]).filter((w)=>!(result.fabric?.issues??[]).includes(w) && !/move\(s\) come closer/.test(w)),...planned.warnings,...fabric.issues];
  const layerPlan = { ...info, extraLayers:count,totalLayers:null,totalBackingLayers:info.backingLayers+count,
    sequence:[...sequence,...groups.map((_,i)=>i)],rotations:Array(info.backingLayers+count).fill(0),textureCopies:1 };
  return { ...result,cfg,base,placements,strands,moves,stats,fabric,warnings,layerPlan,
    ...(result.report?{report:{...result.report,components:fabric.components}}:{}),
    gcode:writeGcode(moves,cfg,{stats,comments:[...originalNotes(result),`Backing: ${info.backingLayers} original + ${count} extra = ${layerPlan.totalBackingLayers}; raised texture prints once; SVG base prints once`]}) };
}

/** Add individual pattern passes: a one-pass pattern alternates 0/90 degrees; multiple passes cycle A/B/... . */
export function addExtraLayers(result, count = 0, { rotatedResult = null, colorChange = false } = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 250) throw new ConfigError(['Extra layers must be an integer from 0 to 250.']);
  const info = nativeLayerInfo(result), groups = nativeGroups(result);
  const layerPlan = { ...info, extraLayers: count, totalLayers: info.nativeLayers === null ? null : info.nativeLayers + count,
    sequence: (info.raised ? backingGroups(result) : groups).map((_, i) => i), rotations: (info.raised ? backingGroups(result) : groups).map(() => 0),
    ...(info.raised ? { totalBackingLayers: info.backingLayers + count,textureCopies:1 } : {}) };
  if (!count) return { ...result, layerPlan };
  if (!info.repeatable) throw new ConfigError([info.reason]);
  if (info.raised) return reinforceBacking(result,count,info);
  const { cfg } = result, h = cfg.t.layer_height, bead = cfg.t.extrusion_width;
  const width = cfg.t.sample_width, height = cfg.t.sample_height;
  const original = (result.strands ?? []).filter((s) => !s.brim);
  const pointCount = original.reduce((n, s) => n + s.pts.length + 4, 0);
  let turned = null;
  if (groups.length === 1) {
    if (rotatedResult) {
      const r = typeof rotatedResult === 'function' ? rotatedResult() : rotatedResult;
      turned = nativeGroups(r)[0];
      if (!turned?.length) throw new ConfigError(['No rotated pattern fits this outline. Use wider spacing or a larger outline.']);
      // The alternate is generated on H × W with an inversely rotated boundary, then turned back to W × H.
      turned = turned.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, x: width - p.y, y: p.x })) }));
    } else {
      if (Math.abs(width - height) > 1e-7) throw new ConfigError(['A rectangular single-layer pattern needs a regenerated 90-degree pass to cover its full outline.']);
      turned = groups[0].map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, x: width - p.y, y: p.x })) }));
    }
  }
  let projectedPoints = pointCount;
  for (let k = 0; k < count; k++) {
    const source = groups.length === 1 && k % 2 === 0 ? turned : groups[k % groups.length];
    projectedPoints += source.reduce((n, s) => n + s.pts.length + 4, 0);
  }
  if (projectedPoints > MAX_MOVES) throw new ConfigError(['These extra layers would exceed the move limit. Use fewer extra layers, wider spacing or a smaller sample.']);
  const all = [...original], pause = colorChange || original.some((s) => s.pauseBefore);
  for (let k = 0; k < count; k++) {
    const index = k % groups.length, rotation = groups.length === 1 && k % 2 === 0 ? 90 : 0;
    const source = rotation ? turned : groups[index];
    // Native passes follow local supports rather than occupying uniform Z planes.
    // Start each cycle one bead above its source; crossing resolution lifts it over intervening passes.
    const rise = (Math.floor(k / groups.length) + 1) * h;
    for (let i = 0; i < source.length; i++) {
      const s = source[i];
      all.push({ ...s, id: `${s.id}~extra-${k + 1}`, extraLayer: k + 1, sourceLayer: index, rotation,
        layer: info.nativeLayers + k, kind: 'supported', name: `Extra layer ${k + 1}`, pauseBefore: pause && i === 0,
        pts: s.pts.map((p) => ({ ...p, z: p.z + rise, cls: 'supported' })) });
    }
    layerPlan.sequence.push(index); layerPlan.rotations.push(rotation);
  }
  if (all.reduce((n, s) => n + s.pts.length + 4, 0) > MAX_MOVES) throw new ConfigError(['These extra layers exceed the move limit. Use fewer extra layers or wider spacing.']);
  const settled = resolveCrossings(all, { follow: true, preserve: true, lift: h, strandWidth: bead });
  const strands = settled.strands, moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  if (moves.length > MAX_MOVES) throw new ConfigError(['The extra-layer crossing paths exceed the move limit. Use fewer extra layers or wider spacing.']);
  const stats = { ...result.stats, ...computeStats(moves, cfg, []), loops: result.stats.loops, crossings: settled.crossings };
  const boundary = new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]]);
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary });
  const warnings = [...(result.warnings ?? []).filter((w) => !(result.fabric?.issues ?? []).includes(w)), ...fabric.issues];
  const comments = [...originalNotes(result), `Layers: ${info.nativeLayers} original + ${count} extra = ${layerPlan.totalLayers}; ${groups.length === 1 ? 'single-layer pattern alternates 0/90 degrees' : 'original pattern passes repeat in order'}; SVG base prints once`];
  return { ...result, strands, moves, stats, fabric, warnings, layerPlan, stack: { extraLayers: count, nativeLayers: info.nativeLayers },
    ...(result.report ? { report: { ...result.report, components: fabric.components } } : {}), gcode: writeGcode(moves, cfg, { stats, comments }) };
}

/**
 * Number of layers: a structure printed on top of itself, for a thicker fabric.
 *
 * Copy k lies one layer height above copy k - 1, point for point, and wherever it crosses an earlier strand it lifts
 * over it by a layer, so at a crossing the strands pile up one layer at a time instead of passing through each other.
 */

/**
 * @param strands  ordered strands { id, pts: [{ x, y, z }] } of one copy
 * @param count    how many copies in all (1 returns the strands as they are)
 * @returns strands of every copy, in print order, copy by copy
 */
export function stackStrands(strands, count, { layerHeight = 0.2, strandWidth = 0.45 } = {}) {
  if (!Number.isFinite(count)) throw new ConfigError(['The number of layers must be finite.']);
  if (!strands.length) return strands;
  const copies = Math.max(1, Math.round(count));
  const points = strands.reduce((n, s) => n + s.pts.length + 4, 0);
  if (points * copies > MAX_MOVES) throw new ConfigError([`${copies} layers would need about ${(points * copies).toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use fewer layers or a smaller section.`]);
  if (copies <= 1) return strands;
  const all = [];
  for (let k = 0; k < copies; k++) {
    for (const s of strands) {
      all.push({ ...s, id: `${s.id}~${k + 1}`, copy: k, pts: s.pts.map((p) => ({ ...p, z: p.z + k * layerHeight })) });
    }
  }
  const settled = resolveCrossings(all, { follow: true, preserve: true, lift: layerHeight, strandWidth }).strands;
  if (settled.reduce((n, s) => n + s.pts.length + 4, 0) > MAX_MOVES) throw new ConfigError(['The stacked crossing paths exceed the move limit. Use fewer layers or a smaller section.']);
  return settled;
}

/**
 * A finished result printed `count` times on top of itself: the moves, the statistics, the fabric check and the G-code
 * are made again from the stacked strands. Results made of raised loops (`placements`) keep their own height and come
 * back unchanged.
 */
export function stackLayers(result, count) {
  const copies = Math.max(1, Math.round(count));
  if (copies <= 1 || !result?.strands?.length || result.placements?.length || !result.cfg) return result;
  const { cfg } = result;
  const layerHeight = cfg.t.layer_height, strandWidth = cfg.t.extrusion_width;
  const points = result.strands.reduce((n, s) => n + s.pts.length, 0);
  if (points * copies > MAX_MOVES) {
    throw new ConfigError([`${copies} layers of this pattern would need about ${(points * copies).toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use fewer layers, a wider spacing or a smaller swatch.`]);
  }
  const strands = stackStrands(result.strands, copies, { layerHeight, strandWidth });
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, []) };
  stats.loops = result.stats.loops;
  stats.crossings = result.stats.crossings;
  const boundary = new PolygonBoundary(result.outline ?? [[{ x: 0, y: 0 }, { x: cfg.t.sample_width, y: 0 }, { x: cfg.t.sample_width, y: cfg.t.sample_height }, { x: 0, y: cfg.t.sample_height }]]);
  const fabric = analyzeFabric(strands, { strandWidth, layerHeight, boundary });
  const gcode = writeGcode(moves, cfg, { stats, comments: [`The pattern printed ${copies} times on top of itself, each ${layerHeight} mm above the one before`] });
  return { ...result, strands, moves, stats, fabric, gcode, stack: { copies }, warnings: [...(result.warnings ?? []).filter((w) => !fabric.issues.includes(w)), ...fabric.issues] };
}
