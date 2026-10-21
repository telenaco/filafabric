import { designById } from '../ui/designs.js';
import { generate } from './generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler } from './squiggle.js';
import { createField } from './fields.js';
import { patternField, pictureDarkness } from './picture.js';
import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError } from './gcode.js';
import { applySvgGuides } from './svg-guides.js';
import { applySvgSolids, solidOnly, withoutPattern } from './svg-solids.js';
import { composeSvgLines } from './svg-lines.js';
import { stackLayers, addExtraLayers, nativeLayerInfo } from './stack.js';
import { applyBrim } from './brim.js';
import { rotateDesignInput } from './rotate-design.js';

/** Generate the selected design once at its complete size, independently of the preview window. */
export function generateDesignBase(input) {
  const { machine, material, design, settings = {}, width, height, outline = null, vector = null } = input;
  const mod = designById(design);
  if (!mod || mod.status !== 'ready') throw new ConfigError(['Choose a supported fabric design.']);
  if (![width, height].every((n) => Number.isFinite(n) && n >= 1 && n <= 5000)) throw new ConfigError(['Design dimensions must be 1–5000 mm.']);
  const fit = bedFitErrors(resolveConfig(machine, material, { sample_width: width, sample_height: height }));
  if (fit.length) throw new PreflightError(fit);
  // the uploaded picture covers the whole piece; a preview window or a section is placed in it like the drawing is
  const [pieceWidth, pieceHeight] = input.vectorSize ?? [width, height], [offsetX, offsetY] = input.vectorOffset ?? [0, 0];
  const picture = input.image ? { image: input.image, size: [pieceWidth, pieceHeight], offset: [offsetX, offsetY] } : null;
  let result;
  if (design === 'loop-pile') {
    const field = patternField(input.pilePattern, { scale: input.pilePatternScale ?? 1, picture });
    result = generate(machine, material, { ...settings, sample_width: width, sample_height: height }, {
      outline, liftAt: field ? (x, y) => 0.3 + 0.7 * field(x, y) : null,
    });
  } else if (design === 'squiggle') {
    const sampler = settings.pattern === 'image' && input.image
      ? pictureDarkness(input.image, pieceWidth, pieceHeight, { offsetX, offsetY })
      : SAMPLERS[settings.pattern] ?? SAMPLERS.centerSpot;
    result = generateSquiggle(machine, material, { ...settings, width, height, sampler, outline });
  } else {
    result = mod.generate(machine, material, { ...mod.defaults(), ...settings, width, height }, {
      outline: mod.outline === false ? null : outline,
      vector: mod.usesVector || mod.vectorGuides ? vector : null,
      vectorSize: input.vectorSize ?? [width, height],
      vectorOffset: input.vectorOffset ?? [0, 0],
      includeLines: !vector,
      picture,
    });
  }
  // a drawing that is all green (and blue) has no red to fill: no pattern, only its solids
  if (vector && solidOnly(vector)) result = withoutPattern(result);
  if (vector) {
    const [fullWidth, fullHeight] = input.vectorSize ?? [width, height], [offsetX, offsetY] = input.vectorOffset ?? [0, 0];
    const guideVector = offsetX || offsetY ? { ...vector, paths: vector.paths.map((path) => path.map((p) => ({ ...p, x: p.x - offsetX * vector.width / fullWidth, y: p.y - offsetY * vector.height / fullHeight }))) } : vector;
    result = applySvgGuides(result, guideVector, { fullWidth, fullHeight, outline: mod.outline === false ? outline : null });
    result = composeSvgLines(result, vector, { fullWidth, fullHeight, offsetX, offsetY, clipLines: !input.shapeOutline && !result.guideCount });
    result.documentSize = [vector.width, vector.height];
  }
  return result;
}

/** The drawing's green shapes, printed solid on top of everything the design and its extra layers have laid down. */
function withSolids(result, input) {
  if (!input.vector) return result;
  const [fullWidth, fullHeight] = input.vectorSize ?? [input.width, input.height], [offsetX, offsetY] = input.vectorOffset ?? [0, 0];
  return applySvgSolids(result, input.vector, { fullWidth, fullHeight, offsetX, offsetY });
}

export function generateDesignExport(input) {
  let result = generateDesignBase(input);
  if (input.extraLayers === undefined && input.layers !== undefined) {
    // Older programmatic exporters retain their explicitly requested whole-copy behavior.
    result = stackLayers(result, input.layers);
  } else {
    const info = nativeLayerInfo(result);
    const count = input.legacyCopies ? (info.repeatable && !info.raised ? info.patternLayers * (input.legacyCopies - 1) : 0) : input.extraLayers ?? 0;
    result = addExtraLayers(result, count, {
      rotatedResult: () => generateDesignBase(rotateDesignInput(input)), colorChange: !!input.settings?.colorChange,
    });
  }
  // a solid already prints its own edge pass: an all-solid piece takes no brim over it
  return applyBrim(withSolids(result, input), { count: solidOnly(input.vector) ? 0 : input.brim ?? 2 });
}

/** The UI only needs printable output and summary data; geometry remains inside the worker. */
export function compactDesignExport(result) {
  const { moveStartSec, ...stats } = result.stats;
  return { gcode: result.gcode, cfg: result.cfg, stats, moveCount: result.moves.length, fabric: result.fabric, warnings: result.warnings ?? [], layerPlan: result.layerPlan };
}
