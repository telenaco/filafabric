import { computeStats } from './stats.js';
import { writeGcode, GcodeWriter } from './gcode.js';
import { travelLiftOf } from './emit.js';

export const COLOUR_MODES = Object.freeze(['one', 'face', 'per-layer', 'halftone2']);
const colour = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : null;
export const colourMode = settings => COLOUR_MODES.includes(settings?.colourMode) ? settings.colourMode : settings?.colorChange === true ? 'face' : 'one';
export const strandLayer = strand => Number.isInteger(strand.layer) && strand.layer >= 0 ? strand.layer : strand.kind === 'base' || strand.brim ? 0 : 1;

/** Copies only metadata; never changes geometry, print order, or the caller's strands. */
export function applyColourPlan(strands, { mode = 'one', layerColours = [], filamentColour = null, secondFamily = 'L2' } = {}) {
  let face = false, second = false, previous = null;
  const seen = new Set();
  return strands.map(strand => {
    const layer = strandLayer(strand), first = !seen.has(layer);
    const colourIndex = mode === 'per-layer' ? layer : mode === 'face' ? (layer >= 1 ? 1 : 0) : mode === 'halftone2' ? (strand.family === secondFamily ? 1 : 0) : 0;
    const selected = colour(layerColours[colourIndex]) ?? colour(filamentColour);
    let pauseBefore = false;
    if (mode === 'face' && layer >= 1 && !face) { pauseBefore = true; face = true; }
    if (mode === 'halftone2' && strand.family === secondFamily && !second) { pauseBefore = true; second = true; }
    if (mode === 'per-layer' && first && previous !== null && selected !== previous) pauseBefore = true;
    if (first) previous = selected;
    seen.add(layer);
    const { previewColour, ...copy } = strand;
    return { ...copy, pauseBefore, ...(selected ? { previewColour: selected } : {}) };
  });
}

/**
 * Apply the plan to an already clearance-planned result without re-emitting its native
 * toolpath (raised generators and composed SVGs carry essential handoff travels).
 * Existing matching pauses retain their exact move index. New pauses lift vertically
 * above all completed extrusion before stopping; no extrusion or travel is rerouted.
 */
export function colourResult(result, settings = {}, { record = false } = {}) {
  const mode = colourMode(settings), layerColours = settings.layerColours ?? [];
  const strands = applyColourPlan(result.strands ?? [], { mode, layerColours });
  const byId = new Map(strands.map(s => [s.id, s]));
  const desired = new Set(strands.filter(s => s.pauseBefore).map(s => s.id));
  const old = new Set((result.strands ?? []).filter(s => s.pauseBefore).map(s => s.id));
  const matching = desired.size === old.size && [...desired].every(id => old.has(id));
  const seen = new Set(), moves = [];
  let top = 0;
  for (const move of result.moves) {
    if (!matching && (move.colourPlanMove || /^M600\b/.test(move.customGcode ?? '') && /filament (?:color change|change)/i.test(`${move.customGcode} ${move.comment ?? ''}`))) continue;
    const strand = byId.get(move.tag);
    if (move.extrude && !seen.has(move.tag)) {
      seen.add(move.tag);
      if (!matching && desired.has(move.tag) && moves.length) {
        const at = moves.at(-1), retraction = result.cfg.derived.retraction;
        const safeZ = Math.max(top, at.z) + Math.max(travelLiftOf(retraction), retraction?.clearance ?? 0.2);
        const travel = { x: at.x, y: at.y, z: safeZ, cls: 'travel', extrude: false, colourPlanMove: true };
        moves.push(travel, { ...travel, customGcode: 'M600 ; Pause for filament color change', comment: `Filament change pause before ${strand?.name ?? move.tag}` }, { ...travel, z: at.z });
      }
    }
    const { previewColour, ...original } = move;
    moves.push(strand?.previewColour ? { ...original, previewColour: strand.previewColour } : previewColour ? original : move);
    if (move.extrude) top = Math.max(top, move.z);
  }
  const stats = moves.length === result.moves.length ? result.stats : { ...result.stats, ...computeStats(moves, result.cfg, result.placements ?? []) };
  const standard = new Set(new GcodeWriter(result.cfg).header({ stats: result.stats }));
  const comments = (result.gcode ?? '').split('; BODY START')[0].split(/\r?\n/)
    .filter(line => line.startsWith('; ') && !standard.has(line) && !/^; (?:colour plan:|estimated time|filament:|param )/.test(line)).map(line => line.slice(2));
  if (record || mode !== 'one' || layerColours.length) comments.push(`colour plan: ${mode}${layerColours.length ? ` (${layerColours.join(' -> ')})` : ''}`);
  return { ...result, strands, moves, stats, colourPlan: { mode, layerColours: [...layerColours] }, gcode: writeGcode(moves, result.cfg, { stats, comments }) };
}
