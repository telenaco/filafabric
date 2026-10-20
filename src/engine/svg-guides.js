import { interpretDrawing } from './drawing.js';
import { conformalGuideRegion, repelGuideStrands } from './conformal.js';
import { boundaryFor } from './layers.js';
import { clipStrands, connectStrands, orderStrands, analyzeFabric, travelDistance, simplifyStrands, segmentInside } from './fabric.js';
import { joinStrokes } from './travel.js';
import { resolveCrossings } from './crossings.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode } from './gcode.js';
import { MAX_MOVES } from './tiler.js';
import { ConfigError } from './params.js';

export function vectorGuides(vector, width = vector.width, height = vector.height) {
  return interpretDrawing(vector, { scaleX: width / vector.width, scaleY: height / vector.height }).guides;
}

export const hasNativeHeight = (result) => !!(result.placements?.length || result.spacer || result.pillarWeave);

/** Yellow changes generated texture; the original drawing is composed afterwards, without deformation. */
export function applySvgGuides(result, vector, { fullWidth = vector.width, fullHeight = vector.height, outline = null } = {}) {
  const guides = vectorGuides(vector, fullWidth, fullHeight);
  if ((!guides.length && !outline) || result.guideCount) return result;
  const { cfg } = result, h = cfg.t.layer_height, bead = cfg.t.extrusion_width;
  const boundary = boundaryFor(cfg.t.sample_width, cfg.t.sample_height, outline ?? result.outline);
  const region = conformalGuideRegion(boundary, guides);
  const native = hasNativeHeight(result);
  const input = native ? result.strands : result.strands.map((s) => ({ ...s, pts: s.pts.map(({ cls, ...p }) => ({ ...p, z: h })) }));
  let strands = clipStrands(simplifyStrands(repelGuideStrands(input, guides, { boundary, strandWidth: bead }), 0.01), region, 0);
  const beforeMm = travelDistance(strands);
  if (!native) {
    const repaired = connectStrands(strands, region, { strandWidth: bead });
    const lastLayer = Math.max(0, ...strands.map((s) => s.layer ?? 0)) + 1;
    strands = orderStrands(joinStrokes(repaired.strands.map((s) => ({ ...s, layer: s.layer === -1 ? lastLayer : s.layer })), { within: bead * 1.1, allow: (p, q) => segmentInside(p, q, region) }), { improve: true });
  }
  strands = resolveCrossings(strands, { follow: true, preserve: native, lift: native ? 0 : h, strandWidth: bead }).strands;
  if (strands.reduce((n, s) => n + s.pts.length + 3, 0) > MAX_MOVES) throw new ConfigError(['Guide repulsion exceeds the move limit. Use wider spacing or a smaller sample.']);
  const moves = emitStrands(strands, { retraction: cfg.derived.retraction });
  const stats = { ...result.stats, ...computeStats(moves, cfg, []) };
  stats.loops = result.stats.loops;
  const fabric = analyzeFabric(strands, { strandWidth: bead, layerHeight: h, boundary: region });
  return {
    ...result, strands, moves, stats, fabric, outline: region.rings,
    guideCount: guides.length, guideRepulsion: true,
    report: result.report ? { ...result.report, components: fabric.components } : result.report,
    routing: { beforeMm, afterMm: travelDistance(strands) },
    warnings: [...(result.warnings ?? []).filter((issue) => !result.fabric?.issues.includes(issue)), ...fabric.issues],
    gcode: writeGcode(moves, cfg, { stats, comments: ['Texture repelled by yellow SVG contours'] }),
  };
}
