import { validatePerimeters } from './solid-perimeters.js';
import { refreshConstruction, assertConstructionExportable } from './construction-report.js';
import { designById } from '../ui/designs.js';
import { generate } from './generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler } from './squiggle.js';
import { createField } from './fields.js';
import { patternField, pictureDarkness } from './picture.js';
import { resolveConfig, ConfigError } from './params.js';
import { bedFitErrors, PreflightError } from './gcode.js';
import { applySvgGuides } from './svg-guides.js';
import { applySvgSolids, solidOnly, withoutPattern } from './svg-solids.js';
import { composeSvgLines, vectorPatternRings } from './svg-lines.js';
import { stackLayers, addExtraLayers, nativeLayerInfo } from './stack.js';
import { applyBrim } from './brim.js';
import { rotateDesignInput } from './rotate-design.js';
import { prepareAdaptiveSolids } from './adaptive-solids.js';
import { colourResult } from './colour-plan.js';
import { buildRegions, regionsFromDrawing } from './regions.js';
import { fingerprint } from '../ui/swatch.js';
import { clipStrands } from './fabric.js';
import { PolygonBoundary } from './boundary.js';
import { finishFabric } from './fabric-result.js';
import { addBackingMesh } from './backing.js';

/**
 * Extra backing: one layer of the Zigzag mesh · flat (its own card, at the spacing, depth and wavelength chosen; 4 mm,
 * 4 mm and 12 mm by default) across the piece, printed last, one layer above the design: the back of the fabric.
 */
function withExtraBacking(result, input) {
  const backing = input.backing;
  if (!backing) return result;
  // the global backing of older links (dropped 28 October 2026) is not this one: it is left out, and said so
  if (backing.extra !== true) return { ...result, warnings: [...(result.warnings ?? []), designById(input.design).support === 'self'
    ? 'This design no longer takes an extra backing; your link is shown without it.'
    : 'This design uses its own Support carrier; an additional global backing is left out.'] };
  if (input.design === 'zigzag-flat') return { ...result, warnings: [...(result.warnings ?? []), 'This is the backing mesh itself: no extra backing is added under it.'] };
  const mod = designById('zigzag-flat');
  const settings = mod.sanitize({ ...mod.defaults(), spacing: backing.spacing, depth: backing.depth, wavelength: backing.wavelength });
  const mesh = generateDesignBase({ ...input, design: 'zigzag-flat', settings, vector: null, image: null, regions: null, backing: null,
    outline: result.pieceOutline ?? result.outline ?? input.outline ?? null });
  return addBackingMesh(result, backing, { mesh: mesh.strands, layers: 1, name: 'Extra backing', last: true });
}

/**
 * Patterns run past the edge and are cut by it, instead of stopping at the last repeat that fits inside the piece. These
 * cards are generated on a larger piece (a margin on every side, set by the piece size) and cut back to the piece or its
 * outline. Checked card by card at 100 x 100 mm (28 October 2026): the other Flat and Layered cards already run to the
 * edge (Rings · layered by its own lattice cut at the edge; Rotating squares stays whole, as cutting it needs ties on a
 * second layer), and those with their own border wall or cells (Voronoi, Truchet, Meander, Turing...) fall apart when cut, so they
 * keep their own edges. Raised cards keep theirs too: a cut loop would hang in the air.
 */
const OVERSCAN_CARDS = new Set(['rings-flat', 'rotating-triangles', 'zigzag-flat', 'coil-flat', 'figure8-rows-flat']);
export const overscanFor = (mod, width, height) => OVERSCAN_CARDS.has(mod.id) ? Math.min(20, Math.max(6, Math.max(width, height) * .1)) : 0;

function generateOverscanned(mod, input, { width, height, outline, margin, options }) {
  const { machine, material, settings = {} } = input;
  const bigMachine = { ...machine, bed: { ...machine.bed, width: (machine.bed?.width ?? width) + 2 * margin, depth: (machine.bed?.depth ?? height) + 2 * margin } };
  const picture = options.picture && { ...options.picture, offset: [options.picture.offset[0] - margin, options.picture.offset[1] - margin] };
  const big = mod.generate(bigMachine, material, mod.sanitize({ ...settings, width: width + 2 * margin, height: height + 2 * margin }), { ...options, outline: null, picture });
  const cfg = resolveConfig(machine, material, { ...big.cfg.t, sample_width: width, sample_height: height });
  const rings = outline?.length ? outline : [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]];
  const boundary = new PolygonBoundary(rings);
  const moved = big.strands.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, x: p.x - margin, y: p.y - margin })) }));
  const strands = clipStrands(moved, boundary, cfg.t.extrusion_width / 2);
  const { strands: _s, moves: _m, gcode: _g, fabric: _f, construction: _c, ...rest } = big;
  return finishFabric({ ...rest, cfg, strands, moves: [], stats: big.stats, warnings: [], outline: outline?.length ? outline : null },
    { boundary, flat: !!mod.flat, transform: mod.flat ? null : () => null });
}

/** Generate the selected design once at its complete size, independently of the preview window. */
export function generateDesignBase(input) {
  const { machine, material, design, settings = {}, width, height, outline = null, vector = null } = input;
  if (input.perimeters !== undefined) validatePerimeters(input.perimeters);
  if (input.meshPerimeters !== undefined) validatePerimeters(input.meshPerimeters);
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
    result = mod.generate(machine, material, mod.sanitize({...settings,width,height}), {outline,picture});
  } else {
    const options = {
      outline: mod.outline === false ? null : outline,
      vector: mod.usesVector || mod.vectorGuides ? vector : null,
      vectorSize: input.vectorSize ?? [width, height],
      vectorOffset: input.vectorOffset ?? [0, 0],
      includeLines: !vector,
      picture,
      perimeters: input.meshPerimeters ?? input.perimeters ?? 0,
      printedBoundary: !!input.vector && !!input.shapeOutline,
    };
    const margin = options.vector ? 0 : overscanFor(mod, width, height);
    result = margin ? generateOverscanned(mod, input, { width, height, outline: options.outline, margin, options })
      : mod.generate(machine, material, mod.sanitize({ ...settings, width, height }), options);
  }
  // a drawing that is all green (and blue) has no red to fill: no pattern, only its solids
  if (vector && solidOnly(vector)) result = withoutPattern(result);
  if (vector) {
    const [fullWidth, fullHeight] = input.vectorSize ?? [width, height], [offsetX, offsetY] = input.vectorOffset ?? [0, 0];
    const guideVector = offsetX || offsetY ? { ...vector, paths: vector.paths.map((path) => path.map((p) => ({ ...p, x: p.x - offsetX * vector.width / fullWidth, y: p.y - offsetY * vector.height / fullHeight }))) } : vector;
    result = applySvgGuides(result, guideVector, { fullWidth, fullHeight, outline: mod.outline === false ? outline : null });
    result = composeSvgLines(result, vector, { fullWidth, fullHeight, offsetX, offsetY, clipLines: !input.shapeOutline && !result.guideCount, perimeters: input.perimeters ?? 0, meshPerimeters: input.meshPerimeters });
    result.documentSize = [vector.width, vector.height];
  }
  return colourResult(result, settings);
}

/** The drawing's green shapes, printed solid on top of everything the design and its extra layers have laid down. */
function withSolids(result, input) {
  if (!input.vector) return result;
  const [fullWidth, fullHeight] = input.vectorSize ?? [input.width, input.height], [offsetX, offsetY] = input.vectorOffset ?? [0, 0];
  return applySvgSolids(result, input.vector, { fullWidth, fullHeight, offsetX, offsetY, layers: input.solidLayers, perimeters: input.perimeters ?? null, generator: input.solidGenerator ?? 'classic' });
}

/** Browser and async callers initialize WASM explicitly before entering the synchronous geometry pipeline. */
export async function generateDesignExportAsync(input, { progress = () => {} } = {}) {
  if (input.solidGenerator === 'arachne' && input.vector && input.perimeters > 0) await prepareAdaptiveSolids();
  return generateDesignExport(input, { progress });
}

export function generateDesignExport(input, { progress = () => {} } = {}) {
  if (input.vector && input.regions?.length && !input.regionBuild) {
    const defaults=regionsFromDrawing(input.vector,{currentCard:input.design,currentSettings:input.studySettings??input.settings});
    const patterns=input.regions.filter(r=>r.role==='pattern');
    const unchanged=patterns.length===1&&patterns[0].card===input.design&&fingerprint(patterns[0].settings)===fingerprint(input.studySettings??input.settings)
      && defaults.length===input.regions.length&&defaults.every((r,i)=>r.key===input.regions[i].key&&r.role===input.regions[i].role&&input.regions[i].enabled!==false&&(input.regions[i].lineAlign??'centre')==='centre');
    if(unchanged){
      const outline=input.shapeOutline?vectorPatternRings(input.vector,{scaleX:input.width/input.vector.width,scaleY:input.height/input.vector.height}):input.outline;
      const result=generateDesignExport({...input,regions:null,outline:outline?.length?outline:null});
      result.regions=input.regions.map(r=>({id:r.id,hex:r.hex,role:r.role,card:r.card,settingsHash:fingerprint(r.settings??{})}));
      result.gcode=result.gcode.replace('; BODY START',result.regions.map(r=>`; region ${r.hex??r.id}: ${r.role} ${r.card??''} settings ${r.settingsHash}`).join('\n')+'\n; BODY START');
      return result;
    }
    // Whole-piece patterns already made for these exact settings come in with the job (patternCache) and are cut again
    // instead of generated again; the ones made now go back out with the result, for the next job.
    const cache = input.patternCache ?? {}, fresh = {};
    const built = buildRegions(input.machine, input.material, input.vector, input.regions, {
      seam: input.seam, width: input.width, height: input.height, solidCount: input.solidLayers ?? 1, extraLayers:input.extraLayers??0, progress,
      generate: (design, settings, outline, [width, height] = [input.width, input.height]) => {
        const mod = designById(design);
        const own = mod.sanitize({ ...settings, width, height });
        const key = fingerprint({ design, own, outline, machine:input.machine, material:input.material });
        if (cache[key]) return cache[key];
        const regionInput = { ...input, width, height, patternCache:null, design, settings: design === 'loop-pile' ? { ...input.settings, ...own } : own,
          pilePattern: own.pattern, pilePatternScale: own.patternScale, outline, vector: mod.usesVector ? {
            name: input.vector.name, width, height, paths:outline.map(ring=>[...ring,ring[0]]),
            styles:outline.map(()=>({color:'red',hex:'#ff0000',width:input.material?.extrusion_width??.45})),
          } : null, regions:null, regionBuild:true, shapeOutline:false, meshPerimeters:0, perimeters:0, brim:0 };
        const made = generateDesignExport(regionInput);
        return fresh[key] = { strands:made.strands, intendedFamilies:made.intendedFamilies, warnings:made.warnings };
      },
    });
    built.patternCache = fresh;
    return built;
  }
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
  result = withSolids(result, input);
  result = withExtraBacking(result, input);
  // a solid already prints its own edge pass: an all-solid piece takes no brim over it
  result = applyBrim(result, { shift: input.meshShift ?? 0, count: solidOnly(input.vector) ? 0 : input.meshPerimeters ?? input.perimeters ?? input.brim ?? 2, label: input.perimeters !== undefined ? 'Perimeters' : 'Brim', requestedCount: input.perimeters });
  if (input.regionBuild && input.outline) result.strands = clipStrands(result.strands, new PolygonBoundary(input.outline), 0);
  result = refreshConstruction(colourResult(result, input.settings, { record: true }));
  return input.regionBuild ? result : assertConstructionExportable(result);
}

/** The UI only needs printable output and summary data; geometry remains inside the worker. */
export function compactDesignExport(result) {
  const { moveStartSec, ...stats } = result.stats;
  return { gcode: result.gcode, cfg: result.cfg, stats, moveCount: result.moves.length, fabric: result.fabric, construction: result.construction, warnings: result.warnings ?? [], layerPlan: result.layerPlan };
}
