import { DESIGNS } from '../ui/designs.js';
import { generate } from './generate.js';
import { generateSquiggle, SAMPLERS, createImageSampler } from './squiggle.js';
import { resolveConfig, ConfigError } from './params.js';
import { GcodeWriter, bedFitErrors, PreflightError } from './gcode.js';
import { PolygonBoundary } from './boundary.js';
import { clipStrands, contactGraph, segmentInside, orderStrands, finishAtPrintedBoundary } from './fabric.js';
import { createField } from './fields.js';
import { drawingPolylines, interpretDrawing } from './drawing.js';
import { stackStrands, nativeLayerInfo, addExtraLayers } from './stack.js';
import { rotateDesignInput } from './rotate-design.js';
import { conformalGuideRegion, repelGuideStrands } from './conformal.js';
import { resolveCrossings } from './crossings.js';
import { solidStrands, SOLID_LAYERS } from './svg-solids.js';
import { SOLID_OVERLAP } from './solid-fill.js';
import { joinStrokes } from './travel.js';
import { buildBrimStrands } from './brim.js';

const rectangle = (w, h, x = 0, y = 0) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const bounds = (s) => s.pts.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

function backingLines(boundary, spacing, h, offset, bead = 0.45) {
  const inset = bead / 2;
  const b = boundary.bbox(), out = [];
  for (const [layer, axis] of ['x', 'y'].entries()) {
    const lo = axis === 'x' ? b.minX : b.minY, hi = axis === 'x' ? b.maxX : b.maxY;
    const count = Math.max(1, Math.floor((hi - lo - bead) / spacing) + 1), start = (lo + hi - (count - 1) * spacing) / 2;
    for (let k = 0; k < count; k++) for (const [a, z] of boundary.intervals(axis, start + k * spacing)) {
      if (z - a < bead) continue;
      const p = axis === 'x' ? [{ x: start + k * spacing, y: a + inset }, { x: start + k * spacing, y: z - inset }] : [{ x: a + inset, y: start + k * spacing }, { x: z - inset, y: start + k * spacing }];
      if (k % 2) p.reverse();
      out.push({ id: `backing-${layer}-${out.length}`, layer, kind: layer ? 'supported' : 'base', pts: p.map((q) => ({ ...q, z: offset + (layer + 1) * h })) });
    }
  }
  return out;
}

/** Every texture component gets a real printed tie to the continuous backing, where one is needed. */
function anchorTexture(backing, texture, boundary, h, width, sourcePrinted = false) {
  if (!texture.length) return [];
  if (!backing.length) throw new ConfigError(['No backing reaches this part of the outline. Use finer backing spacing.']);
  const graph = contactGraph([...backing, ...texture], { strandWidth: width, layerHeight: h, joined: [backing.map((_, i) => i)], cellSize: 2 });
  const support = graph.labels[0], ties = [];
  for (const group of graph.groups) {
    if (graph.labels[group[0]] === support) continue;
    let best = null;
    for (const i of group) {
      if (i < backing.length) continue;
      const points = texture[i - backing.length].pts;
      for (let k = 0; k < points.length; k += Math.max(1, Math.floor(points.length / 80))) {
        const q = points[k];
        for (const s of backing) for (let segment = 1; segment < s.pts.length; segment++) {
          const a = s.pts[segment - 1], b = s.pts[segment], dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
          const z = a.z + (b.z - a.z) * t;
          const p = { x: a.x + dx * t, y: a.y + dy * t, z: sourcePrinted ? z : z + h };
          const end = { ...q, z: sourcePrinted ? q.z + h : q.z }, d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 0.05 || (best && d >= best.d) || Math.abs(p.z - end.z) > Math.tan(25 * Math.PI / 180) * d || !segmentInside(p, end, boundary, sourcePrinted ? 0 : width / 2)) continue;
          best = { p, q: end, d };
        }
      }
    }
    if (!best) throw new ConfigError(['A texture island cannot be tied to the backing inside this outline. Use finer spacing or a wider outline.']);
    ties.push({ id: `anchor-${ties.length}`, kind: 'supported', pts: [best.p, best.q] });
  }
  return ties;
}

function textureResult(options, repeat, offsetX = 0, offsetY = 0) {
  const { machine, material, design, settings = {} } = options;
  const tileWidth = options.sectionWidth ?? repeat, tileHeight = options.sectionHeight ?? repeat;
  if (design === 'loop-pile') { const field = options.pilePattern && options.pilePattern !== 'none' ? createField(options.pilePattern, { scale: options.pilePatternScale ?? 1 }) : null; return generate(machine, material, { ...settings, sample_width: tileWidth, sample_height: tileHeight, boundary_policy: 'footprint' }, { liftAt: field ? (x, y) => 0.3 + 0.7 * field(x, y) : null }); }
  if (design === 'squiggle') return generateSquiggle(machine, material, { ...settings, width: tileWidth, height: tileHeight, sampler: settings.pattern === 'image' && options.image ? createImageSampler(options.image, options.width ?? repeat, options.height ?? repeat, { yUp: true }) : SAMPLERS[settings.pattern] ?? SAMPLERS.centerSpot, colorChange: false });
  const d = DESIGNS.find((d) => d.id === design && d.status === 'ready');
  if (!d) throw new ConfigError(['Choose a supported fabric design.']);
  try { return d.generate(machine, material, { ...d.defaults(), ...settings, width: tileWidth, height: tileHeight, colorChange: false }, {
    vector: options.vector,
    vectorSize: options.vectorSize ?? [options.width ?? repeat, options.height ?? repeat],
    vectorOffset: options.vectorOffset ?? [offsetX, offsetY],
    // The full-document strokes print once before the panel backing, rather than once per texture section.
    includeLines: !options.vector,
  }); } catch (error) {
    if (d.vectorGuides && error.errors?.some((message) => /yellow openings fill/i.test(message))) return { cfg: resolveConfig(machine, material, { sample_width: tileWidth, sample_height: tileHeight }), strands: [], moves: [], fabric: { issues: [] } };
    throw error;
  }
}

/** Bounded-memory panel export. Texture repeats per section; full-document SVG strokes never repeat. */
export async function exportPanel(options, { write, progress = () => {}, signal = null } = {}) {
  const { machine, material, width, height, repeat = 50, outline = null, vector = null, backingSpacing = 5, shapeOutline = false } = options;
  // the ranges the dialog suggests are not limits: anything that is a sensible size is used as typed (the bed and the
  // move budget still say no where the print could not happen)
  if (![width, height].every((v) => Number.isFinite(v) && v >= 1 && v <= 5000) || !Number.isFinite(repeat) || repeat < 5 || repeat > 500 || !Number.isFinite(backingSpacing) || backingSpacing < 0.3 || backingSpacing > 50) throw new ConfigError(['Panel dimensions must be 1–5000 mm, the repeat 5–500 mm and the backing spacing 0.3–50 mm.']);
  if (options.extraLayers !== undefined && (!Number.isInteger(options.extraLayers) || options.extraLayers < 0 || options.extraLayers > 250)) throw new ConfigError(['Extra layers must be an integer from 0 to 250.']);
  if (typeof write !== 'function') throw new Error('A writable output is required');
  // Sections bound memory, not the physical print: backing, brim and texture share one full-panel coordinate system.
  // Validate other settings with the swatch resolver, then restore the separately validated (up to 5000 mm) panel size.
  const panelConfig = (settings = {}) => {
    const cfg = resolveConfig(machine, material, { ...settings, sample_width: Math.min(width, 1000), sample_height: Math.min(height, 1000) });
    cfg.t = { ...cfg.t, sample_width: width, sample_height: height };
    cfg.derived.origin = { x: (machine.bed.width - width) / 2, y: (machine.bed.depth - height - cfg.derived.overhang) / 2 };
    return cfg;
  };
  const initialCfg = panelConfig(), fit = bedFitErrors(initialCfg);
  if (fit.length) throw new PreflightError(fit);
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  let texture = textureResult(options, repeat);
  const cfg = panelConfig(texture.cfg.t);
  const h = cfg.t.layer_height, bead = cfg.t.extrusion_width;
  const model = vector ? interpretDrawing(vector, { scaleX: width / vector.width, scaleY: height / vector.height }) : null;
  const guides = model?.guides ?? [], outerBoundary = new PolygonBoundary(outline ?? (shapeOutline && model?.rings.length ? model.rings : [rectangle(width, height)]));
  const boundary = guides.length ? conformalGuideRegion(outerBoundary, guides) : outerBoundary;
  // green shapes print solid once everything else is down, a layer above the highest strand printed under each one
  const solids = (model?.solids ?? []).map((g) => {
    const box = g.ring.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    return { ...g, box, area: new PolygonBoundary([g.ring]), top: 0 };
  });
  const brim = options.brim ?? 2;
  const brimStrands = buildBrimStrands(boundary.rings, { count: brim, strandWidth: bead, layerHeight: h });
  // Older callers may still request whole copies; explicit extraLayers takes precedence.
  const legacyMode = options.extraLayers === undefined && options.layers !== undefined;
  const layers = legacyMode ? Math.max(1, Math.round(options.layers ?? 1)) : 1;
  const rotatedTexture = (x = 0, y = 0, w = repeat, ht = repeat) => {
    const rotated = rotateDesignInput({ ...options, width: w, height: ht, outline: null,
      vectorSize: [width, height], vectorOffset: [x, y] });
    return textureResult({ ...rotated, sectionWidth: rotated.width, sectionHeight: rotated.height }, repeat);
  };
  const withTextureLayers = (result, rotatedResult) => {
    const info = nativeLayerInfo(result);
    if (legacyMode) {
      const copies = layers > 1 && !result.placements?.length ? layers : 1;
      const extra = info.patternLayers === null ? 0 : info.patternLayers * (copies - 1);
      return { ...result, strands: copies > 1 ? stackStrands(result.strands, copies, { layerHeight: h, strandWidth: bead }) : result.strands,
        layerPlan: { ...info, extraLayers: extra, totalLayers: info.nativeLayers === null ? null : info.nativeLayers + extra,
          sequence: info.patternLayers === null ? [] : Array.from({ length: info.patternLayers * copies }, (_, k) => k % info.patternLayers),
          rotations: info.patternLayers === null ? [] : Array(info.patternLayers * copies).fill(0) } };
    }
    const requested = options.extraLayers === 0 && options.legacyCopies > 1
      ? (info.repeatable && !info.raised ? info.patternLayers * (Math.round(options.legacyCopies) - 1) : 0) : options.extraLayers ?? 0;
    if (!info.repeatable) return { ...addExtraLayers(result, 0), layerPlan: { ...info, extraLayers: 0, requestedExtraLayers: requested, totalLayers: info.nativeLayers, sequence: [], rotations: [] } };
    return addExtraLayers(result, requested, { rotatedResult, colorChange: false });
  };
  texture = withTextureLayers(texture, () => rotatedTexture());
  const globalLayers = vector ? 3 : 2;
  const print = { layerHeight: h, layers, brim, nozzleDiameter: cfg.t.nozzle_diameter, extrusionWidth: bead };
  const recordPlan = (result) => {
    const plan = result.layerPlan;
    if (!plan || (print.patternLayers !== undefined && (plan.patternLayers ?? -1) < (print.patternLayers ?? -1))) return;
    delete print.reason; delete print.requestedExtraLayers;
    Object.assign(print, plan, { fixedLayers: globalLayers + plan.fixedLayers,
      nativeLayers: plan.nativeLayers === null ? null : globalLayers + plan.nativeLayers,
      totalLayers: plan.totalLayers === null ? null : globalLayers + plan.totalLayers,
      ...(plan.mode === 'backing' ? { backingLayers: 2 + plan.backingLayers, totalBackingLayers: 2 + plan.totalBackingLayers } : {}) });
  };
  recordPlan(texture);
  const warnings = [...(texture.fabric?.issues ?? [])];
  const writer = new GcodeWriter(cfg), cols = Math.ceil(width / repeat), rows = Math.ceil(height / repeat), total = cols * rows;
  let buffer = '', bytes = 0, peakSectionMoves = 0, sections = 0, last = null, maxPrintedZ = 0;
  const check = () => { if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError'); };
  const flush = async () => { check(); if (buffer) { const text = buffer; buffer = ''; bytes += text.length; await write(text); } };
  const add = async (lines) => { if (!lines.length) return; buffer += lines.join('\n') + '\n'; if (buffer.length >= 65536) await flush(); };
  const emit = async (strands) => {
    for (const s of strands) {
      check(); if (s.pts.length < 2) continue;
      if (s.brim) await add([`; brim run ${s.id}`]);
      const first = s.pts[0], safe = Math.max(maxPrintedZ, first.z, last?.z ?? 0) + 3;
      if (last) await add(writer.move({ x: last.x, y: last.y, z: safe, cls: 'travel', extrude: false, retract: cfg.derived.retraction.length ? 'retract' : undefined }));
      await add(writer.move({ x: first.x, y: first.y, z: safe, cls: 'travel', extrude: false }));
      await add(writer.move({ x: first.x, y: first.y, z: first.z, cls: 'travel', extrude: false }));
      for (let i = 1; i < s.pts.length; i++) {
        const p = s.pts[i], a = s.pts[i - 1];
        const cls = p.cls ?? (s.kind === 'base' ? 'base' : p.z > first.z + 0.4 ? (p.z >= a.z ? 'rising' : 'falling') : 'supported');
        await add(writer.move({ ...p, cls, tag: s.id, extrude: true, retract: last && i === 1 && cfg.derived.retraction.length ? 'unretract' : undefined }));
        maxPrintedZ = Math.max(maxPrintedZ, p.z);
        for (const g of solids) if (p.z > g.top && p.x >= g.box.minX && p.x <= g.box.maxX && p.y >= g.box.minY && p.y <= g.box.maxY && g.area.contains(p.x, p.y)) g.top = p.z;
      }
      last = s.pts.at(-1);
    }
  };
  check();
  const exportedSettings = { ...(options.settings ?? {}), colorChange: false };
  await add(writer.header({ comments: [`Garment panel ${width} x ${height} mm; ${options.design}; repeat ${repeat} mm`, 'Continuous crossed backing; texture repeats in sections; physical swatch qualification required', `settings ${JSON.stringify(exportedSettings)}`, `studio settings ${JSON.stringify({ design: options.design, settings: { ...(options.studySettings ?? exportedSettings), colorChange: false }, width, height, repeat, backingSpacing, print, material: material.id })}`] }));
  await emit(brimStrands);
  let basis = backingLines(boundary, backingSpacing, h, vector ? h : 0, shapeOutline ? 0 : bead);
  if (guides.length) basis = resolveCrossings(repelGuideStrands(basis, guides, { boundary, strandWidth: bead }), { follow: true, preserve: true, lift: h, strandWidth: bead }).strands;
  if (!basis.length) throw new ConfigError(['No backing fits this outline. Use finer backing spacing or a larger panel.']);
  if (contactGraph(basis, { strandWidth: bead, layerHeight: h, cellSize: Math.max(5, backingSpacing) }).components !== 1) warnings.push('The backing is in separate pieces in this outline: use finer spacing or export separate garment pieces.');
  if (warnings.length) await add(warnings.map((w) => `; WARNING ${w}`));
  if (vector) {
    // a drawing that is also the outline keeps the edges of its filled shapes whole: they lie on the boundary they define
    const { clipped, whole } = drawingPolylines(vector, { scaleX: width / vector.width, scaleY: height / vector.height, bead, edges: shapeOutline ? 'kept' : 'all' });
    let serial = 0;
    const strand = (poly) => ({ id: `svg-${serial++}`, layer: 0, kind: 'base', shape: poly.shape && shapeOutline, pts: poly.pts.map((p) => ({ x: p.x, y: p.y, z: h })) });
    // as drawn: the lines of a drawing that is the outline are trimmed to the panel, not to the shapes they cross
    // Original SVG strokes, including every yellow wall pass, stay as drawn. The yellow openings constrain fabric.
    const lineBoundary = shapeOutline ? new PolygonBoundary([rectangle(width, height)]) : outerBoundary;
    const source = [...whole.map(strand), ...clipStrands(clipped.map(strand), lineBoundary, bead / 2)];
    progress({ phase: 'svg', done: 0, total }); await emit(orderStrands(joinStrokes(source, { within: bead * 1.1, allow: (p, q) => segmentInside(p, q, boundary) }), { improve: true }));
    const vertical = basis.filter((s) => s.layer === 0);
    await emit(vertical); await emit(anchorTexture(vertical, source, boundary, h, bead, true));
    await emit(basis.filter((s) => s.layer === 1));
  } else { progress({ phase: 'backing', done: 0, total }); await emit(basis); }
  peakSectionMoves = texture.moves.length;
  // a picture is one picture across the whole panel, so every section is made from its own window onto it
  const pictured = options.design === 'squiggle' && options.settings?.pattern === 'image' && !!options.image;
  const designModule = DESIGNS.find((d) => d.id === options.design);
  const drawn = !!vector && (designModule?.usesVector || designModule?.vectorGuides);
  const sectionStrands = (x, y, w, ht) => {
    if (!drawn && !pictured) return texture.strands;
    const local = drawn ? textureResult({ ...options, ...(legacyMode ? {} : { sectionWidth: w, sectionHeight: ht }) }, repeat, x, y)
      : generateSquiggle(machine, material, { ...options.settings, width: w, height: ht,
        sampler: createImageSampler(options.image, width, height, { offsetX: x, offsetY: y, yUp: true }), colorChange: false });
    const layered = withTextureLayers(local, () => rotatedTexture(x, y, legacyMode ? repeat : w, legacyMode ? repeat : ht));
    recordPlan(layered);
    return layered.strands;
  };
  const cache = new Map(), zOffset = (vector ? 3 : 2) * h;
  // Flat patterns start at the lower-left. Raised textures retain far-to-near shingle order.
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) for (let j = 0; j < cols; j++) {
    const row = texture.placements?.length ? rows - 1 - rowIndex : rowIndex;
    check(); const col = rowIndex % 2 ? cols - 1 - j : j, x = col * repeat, y = row * repeat;
    const w = Math.min(repeat, width - x), ht = Math.min(repeat, height - y);
    const cellBoundary = new PolygonBoundary([rectangle(w, ht)]), phaseX = ((x - basis[0].pts[0].x) % backingSpacing + backingSpacing) % backingSpacing, phaseY = y % backingSpacing;
    const key = `${w}:${ht}:${phaseX.toFixed(5)}:${phaseY.toFixed(5)}`;
    let local = !outline && !pictured && !drawn && !guides.length ? cache.get(key) : null;
    if (!local) {
      local = clipStrands(sectionStrands(x, y, w, ht).map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, z: p.z + zOffset })) })), cellBoundary, drawn ? 0 : bead / 2);
      if (!outline && !shapeOutline && !guides.length) {
        const localBasis = basis.filter((s) => { const b = bounds(s); return b.maxX >= x && b.minX <= x + w && b.maxY >= y && b.minY <= y + ht; }).map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, x: Math.max(0, Math.min(w, p.x - x)), y: Math.max(0, Math.min(ht, p.y - y)) })) })).filter((s) => Math.hypot(s.pts[1].x - s.pts[0].x, s.pts[1].y - s.pts[0].y) > 0.1);
        local = [...anchorTexture(localBasis, local, cellBoundary, h, bead), ...local];
      }
      if (!outline && !pictured && !drawn && !guides.length) { if (cache.size >= 4) cache.delete(cache.keys().next().value); cache.set(key, local); }
    }
    let placed = local.map((s) => ({ ...s, id: `section-${sections}-${s.id}`, pts: s.pts.map((p) => ({ ...p, x: p.x + x, y: p.y + y })) }));
    if (outline || shapeOutline || guides.length) {
      if (guides.length && !designModule?.vectorGuides) placed = repelGuideStrands(placed, guides, { boundary, strandWidth: bead });
      placed = clipStrands(placed.filter((s) => !s.id.includes('anchor-')), boundary, bead / 2);
      if (shapeOutline) placed = finishAtPrintedBoundary(placed, boundary, bead);
      if (guides.length) placed = resolveCrossings(placed, { follow: true, preserve: true, lift: h, strandWidth: bead }).strands;
      let support;
      if (guides.length) {
        const extent = bounds({ pts: placed.flatMap((s) => s.pts) }), pad = Math.max(2 * backingSpacing, bead * 4);
        support = basis.filter((s) => { const b = bounds(s); return b.maxX >= extent.minX - pad && b.minX <= extent.maxX + pad && b.maxY >= extent.minY - pad && b.minY <= extent.maxY + pad; });
      } else support = clipStrands(basis, new PolygonBoundary([rectangle(w, ht, x, y)]), 0);
      placed = [...anchorTexture(support, placed, boundary, h, bead), ...placed];
    }
    peakSectionMoves = Math.max(peakSectionMoves, placed.reduce((n, s) => n + s.pts.length + 3, 0));
    progress({ phase: 'texture', done: sections, total }); check();
    await add([`; texture section ${sections + 1}; origin ${x},${y}`]);
    await emit(placed); sections++;
    await flush(); progress({ phase: 'texture', done: sections, total });
  }
  if (solids.length) {
    check();
    const { strands: fill } = solidStrands(solids, [], { bead, layerHeight: h });
    await add([`; solid shapes: ${solids.length} green, ${SOLID_LAYERS} layers on top of the panel, ${Math.round(SOLID_OVERLAP * 100)}% overlap`]);
    await emit(clipStrands(fill, new PolygonBoundary([rectangle(width, height)]), 0));
    await flush();
  }
  await add([`; actual print ${JSON.stringify(print)}`, `; panel estimate (no acceleration): ${(writer.timeSec / 60).toFixed(1)} min; filament ${writer.cumE.toFixed(1)} mm`, ...writer.footer()]); await flush();
  return { sections, peakSectionMoves, bytes, moves: writer.moves, filamentMm: writer.cumE, timeSec: writer.timeSec, guideCount: guides.length, solidCount: solids.length, print, warnings, physicallyVerified: false };
}
