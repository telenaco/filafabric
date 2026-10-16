import { designById } from '../ui/designs.js';
import { generate } from './generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler } from './squiggle.js';
import { createField } from './fields.js';
import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError } from './gcode.js';
import { applySvgGuides } from './svg-guides.js';
import { composeSvgLines } from './svg-lines.js';
import { stackLayers } from './stack.js';
import { applyBrim } from './brim.js';

/** Generate the selected design once at its complete size, independently of the preview window. */
export function generateDesignExport(input) {
  const { machine, material, design, settings = {}, width, height, outline = null, vector = null } = input;
  const mod = designById(design);
  if (!mod || mod.status !== 'ready') throw new ConfigError(['Choose a supported fabric design.']);
  if (![width, height].every((n) => Number.isFinite(n) && n >= 1 && n <= 5000)) throw new ConfigError(['Design dimensions must be 1–5000 mm.']);
  const fit = bedFitErrors(resolveConfig(machine, material, { sample_width: width, sample_height: height }));
  if (fit.length) throw new PreflightError(fit);
  let result;
  if (design === 'loop-pile') {
    const field = input.pilePattern && input.pilePattern !== 'none'
      ? createField(input.pilePattern, { scale: input.pilePatternScale ?? 1 }) : null;
    result = generate(machine, material, { ...settings, sample_width: width, sample_height: height }, {
      outline, liftAt: field ? (x, y) => 0.3 + 0.7 * field(x, y) : null,
    });
  } else if (design === 'squiggle') {
    const sampler = settings.pattern === 'image' && input.image
      ? createImageSampler(input.image, width, height, { yUp: true })
      : SAMPLERS[settings.pattern] ?? SAMPLERS.centerSpot;
    result = generateSquiggle(machine, material, { ...settings, width, height, sampler, outline });
  } else {
    result = mod.generate(machine, material, { ...mod.defaults(), ...settings, width, height }, {
      outline: mod.outline === false ? null : outline,
      vector: mod.usesVector || mod.vectorGuides ? vector : null,
      vectorSize: [width, height],
      includeLines: !vector,
    });
  }
  if (vector) {
    result = applySvgGuides(result, vector, { fullWidth: width, fullHeight: height, outline: mod.outline === false ? outline : null });
    result = composeSvgLines(result, vector, { fullWidth: width, fullHeight: height, clipLines: !input.shapeOutline && !result.guideCount });
    result.documentSize = [vector.width, vector.height];
  }
  return applyBrim(stackLayers(result, input.layers ?? 1), { count: input.brim ?? 2 });
}

/** The UI only needs printable output and summary data; geometry remains inside the worker. */
export function compactDesignExport(result) {
  const { moveStartSec, ...stats } = result.stats;
  return { gcode: result.gcode, cfg: result.cfg, stats, moveCount: result.moves.length, fabric: result.fabric, warnings: result.warnings ?? [] };
}
