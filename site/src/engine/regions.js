import { closedRing, linePassesDetailed } from './drawing.js';
import { polygonRegion } from './polygon-region.js';
import { PolygonBoundary } from './boundary.js';
import { clipStrands, segmentInside, segmentContact, analyzeFabric } from './fabric.js';
import { clipPolyline } from './layers.js';
import { applyColourPlan, colourMode } from './colour-plan.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { writeGcode, bedFitErrors, PreflightError } from './gcode.js';
import { resolveConfig } from './params.js';
import { buildConstructionReport, refreshConstruction, assertConstructionExportable } from './construction-report.js';
import { solidLayer } from './solid-fill.js';
import { fingerprint } from '../ui/swatch.js';

/**
 * The seven colours a drawing is made in, pure RGB. A colour in the drawing is recognised and named exactly; one a hair off
 * (export rounding) is read as its palette colour. Roles stay as they were: red is the pattern, blue a hole, green and yellow
 * solids, and black, magenta and cyan are lines, as is any other colour.
 */
export const REGION_PALETTE = Object.freeze([
  { name: 'Black', hex: '#000000' }, { name: 'Red', hex: '#ff0000' }, { name: 'Green', hex: '#00ff00' }, { name: 'Blue', hex: '#0000ff' },
  { name: 'Yellow', hex: '#ffff00' }, { name: 'Magenta', hex: '#ff00ff' }, { name: 'Cyan', hex: '#00ffff' },
].map((colour) => Object.freeze(colour)));
const channelsOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The palette colour within `tolerance` on every channel of `hex`, or null. Shades further away stay their own colours. */
export function paletteColour(hex, tolerance = 8) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = channelsOf(hex.toLowerCase());
  return REGION_PALETTE.find((colour) => channelsOf(colour.hex).every((value, i) => Math.abs(value - rgb[i]) <= tolerance)) ?? null;
}
export const paletteName = (hex) => paletteColour(hex)?.name ?? null;
const NAMED = [...REGION_PALETTE, { name: 'White', hex: '#ffffff' }, { name: 'Grey', hex: '#808080' }, { name: 'Dark red', hex: '#a00000' },
  { name: 'Orange', hex: '#ff8000' }, { name: 'Brown', hex: '#8b4513' }, { name: 'Pink', hex: '#ff99cc' }, { name: 'Purple', hex: '#800080' },
  { name: 'Dark green', hex: '#006400' }, { name: 'Navy', hex: '#000080' }, { name: 'Light blue', hex: '#87ceeb' }, { name: 'Olive', hex: '#808000' }];
/** A name for any drawing colour: its palette name, or the nearest common colour name for an off-palette shade. */
export function colourName(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = channelsOf(hex.toLowerCase());
  const distance = (colour) => channelsOf(colour.hex).reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0);
  return paletteName(hex) ?? NAMED.reduce((best, colour) => distance(colour) < distance(best) ? colour : best).name;
}

const ROLES = Object.freeze({ red: 'pattern', blue: 'hole', green: 'solid', yellow: 'solid', other: 'line' });
const clone = (value) => value == null ? value : structuredClone(value);
const area = (ring) => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
const inside = (p, ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

/**
 * Split a drawing into colour regions without mutating it. Exact imported hex paints remain distinct; old class-only
 * and unstyled drawings still receive deterministic region identities and the settings they currently use.
 */
export function regionsFromDrawing(vector, { currentCard = null, currentSettings = {} } = {}) {
  if (!vector || !Array.isArray(vector.paths)) return [];
  const hasStyles = Array.isArray(vector.styles) && vector.styles.length === vector.paths.length;
  const paths = vector.paths.map((path, index) => {
    const style = hasStyles ? vector.styles[index] : null;
    const exact = typeof style?.hex === 'string' && /^#[0-9a-f]{6}$/i.test(style.hex) ? style.hex.toLowerCase() : null;
    const hex = exact ? paletteColour(exact)?.hex ?? exact : null;
    const color = ROLES[style?.color] ? style.color : 'other';
    const ring = closedRing(path);
    // Old unstyled drawings used even/odd nesting: classify the rings after their nesting depth is known below.
    const key = hex ? `hex:${hex}` : style ? `class:${color}` : ring ? 'legacy-pattern' : 'legacy-line';
    return { index, style, hex, color, ring, key };
  });
  const legacyRings = paths.filter((path) => path.ring && path.key === 'legacy-pattern');
  for (const path of legacyRings) {
    const parent = legacyRings.filter((other) => other !== path && area(other.ring) > area(path.ring) && inside(path.ring[0], other.ring))
      .sort((a, b) => area(a.ring) - area(b.ring))[0];
    let depth = 0;
    for (let p = parent; p; ) {
      depth++;
      p = legacyRings.filter((other) => other !== p && area(other.ring) > area(p.ring) && inside(p.ring[0], other.ring))
        .sort((a, b) => area(a.ring) - area(b.ring))[0];
    }
    path.color = depth % 2 ? 'blue' : 'red';
    path.key = `legacy-${path.color}`;
  }

  const groups = new Map();
  for (const path of paths) {
    const key = path.key;
    if (!groups.has(key)) {
      const color = path.color;
      const region = {
        id: `region-${groups.size + 1}`,
        key,
        color,
        hex: path.hex,
        role: ROLES[color] ?? 'line',
        enabled: true,
        pathIndices: [],
        ...(color === 'red' || key.startsWith('hex:') && color === 'red'
          ? { card: currentCard, settings: clone(currentSettings) } : {}),
      };
      groups.set(key, region);
    }
    groups.get(key).pathIndices.push(path.index);
  }
  return [...groups.values()];
}

/**
 * Build one disjoint polygon set per enabled pattern region. Innermost coloured contours decide ownership: blue removes
 * material, while a nested, differently-coloured red shape is removed from its parent region and belongs to its own.
 * The result for each region is an ordered list of closed rings suitable for PolygonBoundary/even-odd consumers.
 */
export function regionPolygons(vector, regions) {
  if (!vector || !Array.isArray(vector.paths) || !Array.isArray(regions)) return [];
  const pathRegions = new Map();
  for (const region of regions) for (const index of region.pathIndices ?? []) pathRegions.set(index, region);
  const contours = [];
  vector.paths.forEach((path, index) => {
    const region = pathRegions.get(index), ring = closedRing(path);
    if (region && region.enabled !== false && ring && ['pattern', 'solid', 'hole'].includes(region.role)) contours.push({ index, ring, region, area: area(ring) });
  });
  const candidates = contours.map((contour) => contour.ring);
  const output = [];
  for (const region of regions) {
    if (!['pattern', 'solid'].includes(region.role) || region.enabled === false) continue;
    const owned = polygonRegion(candidates, (x, y) => {
      let deepest = null;
      for (const contour of contours) {
        if (!inside({ x, y }, contour.ring)) continue;
        if (!deepest || contour.area < deepest.area) deepest = contour;
      }
      return deepest?.region.id === region.id;
    });
    output.push({ regionId: region.id, color: region.color, hex: region.hex, rings: owned });
  }
  return output;
}

/** Ticked colours join the current piece, and applied colours stay in it when unticked. */
export const regionInPiece = (region) => region.enabled !== false || !!region.applied;

/** Accessible, deterministic view model for the region toolbar, suitable for rendering without knowing its DOM. */
export function colourBarModel(regions, selection = null) {
  const names = { red:'Red', blue:'Blue', green:'Green', yellow:'Yellow', other:'Other' };
  const roles = { pattern:'pattern', hole:'hole', solid:'solid', line:'line' };
  return (regions ?? []).map((region) => {
    const colour = paletteName(region.hex) ?? names[region.color] ?? 'Other';
    const role = roles[region.role] ?? 'line';
    const included = regionInPiece(region);
    const applied = !!region.applied;
    const label = `${colour}${region.hex ? ` ${region.hex}` : ''}, ${role}${role === 'pattern' && region.cardName ? `: ${region.cardName}` : ''}, ${included ? 'included' : 'excluded'}${applied ? ', applied' : ''}`;
    return { id:region.id, hex:region.hex, color:region.color, role, card:region.card ?? null, enabled:region.enabled !== false, included, applied, selected:region.id === selection, label };
  });
}

export const REGION_LIMIT = 16;
export const LINE_LAYERS_MAX = 20;
/** How many layers tall a line region prints: a whole number from 1 to LINE_LAYERS_MAX. */
export const lineLayersOf = (region) => Math.max(1, Math.min(LINE_LAYERS_MAX, Math.round(Number(region?.lineLayers)) || 1));
/** A line region's own thickness in mm, or null to print each line as wide as it is drawn. */
export const lineWidthOf = (region) => Number(region?.lineWidth) > 0 ? Math.max(.2, Math.min(20, Number(region.lineWidth))) : null;
export const SEAM_ALIGNS = Object.freeze(['inside', 'centre', 'outside']);
/** The contour printed round each pattern region: its width in mm (passes of the bead side by side) and which side of the edge it sits. */
export const sanitizeSeam = (raw) => ({ enabled: raw?.enabled !== false, width: Number.isFinite(Number(raw?.width)) ? Math.max(.4, Math.min(10, Number(raw.width))) : 1,
  align: SEAM_ALIGNS.includes(raw?.align) ? raw.align : 'inside' });

/** Derive identity and path membership from the drawing, never from untrusted saved indices. */
export function sanitizeRegions(raw, vector, { cards, currentCard, currentSettings, notes = [] } = {}) {
  if (!vector || !Array.isArray(raw)) return null;
  const defaults = regionsFromDrawing(vector, { currentCard, currentSettings });
  if (defaults.length > REGION_LIMIT) throw new Error(`This drawing has ${defaults.length} colours. Colour regions support up to ${REGION_LIMIT}; reduce the drawing's colours before importing.`);
  if(raw.length>REGION_LIMIT)notes.push(`Only the first ${REGION_LIMIT} saved region entries were accepted.`);
  raw=raw.slice(0,REGION_LIMIT);
  return defaults.map((base) => {
    const saved = raw.find(item => item && typeof item === 'object' && (item.key === base.key || typeof item.hex === 'string' && item.hex.toLowerCase() === base.hex || item.id === base.id));
    if (!saved) return base;
    const role = ['pattern', 'solid', 'hole', 'line'].includes(saved.role) ? saved.role : base.role;
    const region = { ...base, role, enabled: saved.enabled !== false, lineAlign: ['centre','inside','outside','left','right'].includes(saved.lineAlign) ? saved.lineAlign : 'centre', passSpacing: Number.isFinite(Number(saved.passSpacing)) ? Math.max(.6, Math.min(1, Number(saved.passSpacing))) : .8, lineLayers: lineLayersOf(saved), ...(lineWidthOf(saved) ? { lineWidth: lineWidthOf(saved) } : {}), ...(Number.isInteger(saved.order) && saved.order > 0 ? { order: saved.order } : {}), ...(saved.applied === true ? { applied: true } : {}) };
    if (role === 'pattern') {
      const card = cards.find(card => card.id === (saved.card ?? base.card) && card.status === 'ready');
      if (!card) {
        notes.push(`Unknown region card ${String(saved.card).slice(0, 60)} was dropped; that region is excluded.`);
        region.enabled = false;
        delete region.applied;
        region.card = currentCard;
        region.settings = clone(currentSettings);
      }
      else { region.card = card.id; region.settings = card.sanitize(saved.settings ?? base.settings); }
    } else { delete region.card; delete region.settings; }
    return region;
  });
}

export const regionsFingerprint = (vector, regions, seam, print = {}) => fingerprint({ vector, regions, seam: sanitizeSeam(seam), print });

/** Positive-length collinear overlap; supports borders split into different segment counts. */
function overlap(a, b, c, d) {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (length < 1e-8) return null;
  const ux = dx / length, uy = dy / length;
  if ([c,d].some(p => Math.abs((p.x-a.x)*uy-(p.y-a.y)*ux) > .01)) return null;
  const values = [c,d].map(p => (p.x-a.x)*ux+(p.y-a.y)*uy);
  const lo = Math.max(0, Math.min(...values)), hi = Math.min(length, Math.max(...values));
  return hi-lo > .01 ? [{x:a.x+ux*lo,y:a.y+uy*lo},{x:a.x+ux*hi,y:a.y+uy*hi}] : null;
}

export function sharedRegionBorders(polygons) {
  const edges = rings => rings.flatMap(ring => ring.map((a,i) => [a,ring[(i+1)%ring.length]]));
  const out = [], seen = new Set();
  for (let i=0;i<polygons.length;i++) for (let j=i+1;j<polygons.length;j++) {
    for (const [a,b] of edges(polygons[i].rings)) for (const [c,d] of edges(polygons[j].rings)) {
      const pts = overlap(a,b,c,d);
      if (!pts) continue;
      const key = pts.map(p=>`${p.x.toFixed(4)},${p.y.toFixed(4)}`).sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key); out.push({ a:polygons[i].regionId, b:polygons[j].regionId, pts });
    }
  }
  return out;
}

/** Whole-piece build. Each card keeps its generator; only final strands are merged and clearance-ordered here. */
export function buildRegions(machine, material, vector, regions, { seam = {}, generate, width = vector.width, height = vector.height, solidCount = 1, extraLayers=0, progress = () => {} } = {}) {
  if (typeof generate !== 'function') throw new TypeError('A region card generator is required.');
  if (regions.length > REGION_LIMIT) throw new Error(`At most ${REGION_LIMIT} colour regions are supported.`);
  const cfg = resolveConfig(machine, material, { sample_width: width, sample_height: height });
  const fit = bedFitErrors(cfg); if (fit.length) throw new PreflightError(fit);
  const bead = cfg.t.extrusion_width, h = cfg.t.layer_height, seamSettings = sanitizeSeam(seam);
  const scaled = { ...vector, width, height, paths: vector.paths.map(path => path.map(p => ({ ...p, x:p.x*width/vector.width, y:p.y*height/vector.height }))) };
  const polygons = regionPolygons(scaled, regions), polygonById = new Map(polygons.map(p=>[p.regionId,p]));
  const rectangle = [{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
  const contours = enabledContours(scaled, regions);
  const allowed = polygonRegion([rectangle,...contours.map(contour=>contour.ring)], (x,y)=>{
    if(x<0||x>width||y<0||y>height)return false;
    // A positive island inside a hole restores material, just like region ownership does.
    const owner=contours.find(contour=>inside({x,y},contour.ring));
    return owner?.role!=='hole';
  });
  if (!allowed.length) throw new Error('Nothing to print: the holes cover the whole piece.');
  const boundary = new PolygonBoundary(allowed.length ? allowed : [rectangle]);
  // Lines are printed as drawn, trimmed only to the page: a line across a hole is what ties an island to the rest.
  const page = new PolygonBoundary([rectangle]);
  let strands = [], warnings = [], serial = 0;
  const metadata = [], intendedByRegion=new Map(), enabled = regions.filter(r=>r.enabled!==false).map((r,i)=>[r,i]).sort((a,b)=>(a[0].order??Infinity)-(b[0].order??Infinity)||a[1]-b[1]).map(([r])=>r); // printed in the order they were applied
  for (const [index,region] of enabled.entries()) {
    progress({ done:index, total:enabled.length, message:`Building ${region.hex??region.color}: ${region.card??region.role}…` });
    const polygon = polygonById.get(region.id);
    let generated = [];
    if (region.role==='pattern' && polygon?.rings.length) {
      // The pattern is made over this region's own box plus a margin, edge to edge, and the region is cut out of it: it
      // runs right to the region's edge without being made for the whole piece (slow, and past some designs' limits).
      const pts = polygon.rings.flat(), margin = Math.min(10, Math.max(3, .1 * Math.max(width, height)));
      const x0 = Math.max(0, Math.min(...pts.map(p=>p.x)) - margin), y0 = Math.max(0, Math.min(...pts.map(p=>p.y)) - margin);
      const x1 = Math.min(width, Math.max(...pts.map(p=>p.x)) + margin), y1 = Math.min(height, Math.max(...pts.map(p=>p.y)) + margin);
      const boxW = x1 - x0, boxH = y1 - y0;
      const made = generate(region.card, region.settings, [[{x:0,y:0},{x:boxW,y:0},{x:boxW,y:boxH},{x:0,y:boxH}]], [boxW, boxH]);
      const result = { ...made, strands: made.strands.map(s=>({ ...s, pts:s.pts.map(p=>({ ...p, x:p.x+x0, y:p.y+y0 })) })) };
      intendedByRegion.set(region.id,result.intendedFamilies??[]);
      // with a contour, the pattern stops where the contour's inner pass is, overlapping it by half a bead, instead of crossing it
      const contour = seamSettings.enabled ? { inside:seamSettings.width, centre:seamSettings.width/2, outside:0 }[seamSettings.align] - bead/2 : 0;
      generated = clipStrands(result.strands, new PolygonBoundary(polygon.rings), Math.max(0, contour));
      warnings.push(...(result.warnings??[]));
    } else if (region.role==='solid' && polygon?.rings.length) {
      // The shared solid implementation owns offsets, holes and perimeter coverage.
      const roots = polygon.rings.filter(ring=>!polygon.rings.some(other=>other!==ring && area(other)>area(ring) && inside(ring[0],other)));
      for (const root of roots) {
        const inner = polygon.rings.filter(ring=>ring!==root&&inside(ring[0],root));
        const layers = Array.from({length:solidCount},(_,layer)=>solidLayer(root,{bead,layer,holes:inner}));
        layers.forEach((paths,layer)=>paths.forEach(pts=>generated.push({id:`solid-${serial++}`,family:`solid-${layer+1}`,role:'native',kind:layer?'supported':'base',layer,pts:pts.map(p=>({...p,z:(layer+1)*h}))})));
      }
    }
    // All open paths print as lines, even if their colour also owns closed pattern shapes.
    if (region.role!=='hole') for (const pathIndex of region.pathIndices) {
      const pts = scaled.paths[pathIndex], ring = closedRing(pts);
      if (ring && region.role!=='line') continue;
      const style = vector.styles?.[pathIndex] ?? {};
      const detail = linePassesDetailed({pts, width:lineWidthOf(region)??(style.width??bead)*width/vector.width, closed:!!ring},bead,{align:region.lineAlign??'centre',spacing:region.passSpacing??.8});
      if (detail.dropped) warnings.push(`${detail.dropped} passes did not fit inside small shapes.`);
      // A line's width sets its passes side by side; Layers stacks them (folds and stiffening ribs for origami).
      for (let layer=0;layer<lineLayersOf(region);layer++) for (const points of detail.passes) generated.push({id:`line-${serial++}`,family:'lines',role:'native',kind:layer?'supported':'base',layer,pts:points.map(p=>({...p,z:(layer+1)*h}))});
    }
    generated = clipStrands(generated,region.role==='line'?page:boundary,0).map(s=>({...s,id:`${region.id}-${s.id}`,source:`${region.card??region.role}@${region.hex??region.key}`,regionId:region.id,regionOrder:index}));
    const plan = applyColourPlan(generated,{mode:colourMode(region.settings),layerColours:region.settings?.layerColours});
    strands.push(...plan);
    metadata.push({ id:region.id, hex:region.hex, role:region.role, card:region.card??null, settingsHash:fingerprint(region.settings??{}), colourMode:colourMode(region.settings) });
  }
  // The seam is a contour round each pattern region, as wide as set (passes of the bead side by side), inside, centred on or
  // outside its edge, printed on every layer the region prints. The pattern's ends run into it, which is what joins them.
  const seamStrands = [];
  if (seamSettings.enabled) for (const region of enabled.filter(r=>r.role==='pattern')) {
    const polygon = polygonById.get(region.id);
    const layers = [...new Set(strands.filter(s=>s.regionId===region.id).map(s=>s.layer??0))];
    if (!polygon?.rings.length || !layers.length) continue;
    for (const ring of polygon.rings) {
      const closedPts = ring.length && (ring[0].x!==ring.at(-1).x||ring[0].y!==ring.at(-1).y) ? [...ring,ring[0]] : ring;
      // a hole's edge faces the other way: "inside" the region is outside the hole's ring
      const hole = polygon.rings.some(other=>other!==ring&&area(other)>area(ring)&&inside(ring[0],other));
      const align = hole ? { inside:'outside', outside:'inside' }[seamSettings.align] ?? 'centre' : seamSettings.align;
      const detail = linePassesDetailed({ pts:closedPts, width:seamSettings.width, closed:true }, bead, { align, spacing:.8 });
      for (const layer of layers) for (const pts of detail.passes) seamStrands.push({ id:`seam-${serial++}`, name:'Region seam', family:`seam-${region.id}`, role:'seam',
        kind:layer?'supported':'base', layer, regionId:region.id, regionOrder:-1, source:`seam@${region.hex??region.key}`, pts:pts.map(p=>({ x:p.x, y:p.y, z:(layer+1)*h })) });
    }
  }
  // The piece prints layer by layer; within a layer, colour by colour in the order they were applied, each in its own
  // design's order (already nozzle-safe) with its contour first. Re-ordering every strand of the piece together for nozzle
  // clearance was slow (a minute or more for a drawing) and failed outright once one colour stood taller than the rest.
  const rank=new Map(enabled.map((region,i)=>[region.id,i])), lineRegions=new Set(enabled.filter(r=>r.role==='line').map(r=>r.id));
  const isLine=s=>lineRegions.has(s.regionId);
  strands=[...clipStrands([...seamStrands,...strands.filter(s=>!isLine(s))],boundary,bead/2),...clipStrands(strands.filter(isLine),page,0)].map((s,i)=>({s,i}))
    .sort((a,b)=>(a.s.layer??0)-(b.s.layer??0)||(rank.get(a.s.regionId)??0)-(rank.get(b.s.regionId)??0)||(a.s.role==='seam'?0:1)-(b.s.role==='seam'?0:1)||a.i-b.i).map(({s})=>s);
  if(!strands.length)throw new Error('Nothing to print: enable a region with printable shapes or lines.');
  const modes = new Set(metadata.filter(r=>r.role==='pattern').map(r=>JSON.stringify([r.colourMode,regions.find(region=>region.id===r.id)?.settings?.layerColours??[]])));
  if(modes.size>1) warnings.push("Regions ask for different filament changes; using the first region's plan.");
  const first = regions.find(r=>r.enabled!==false&&r.role==='pattern');
  const pauses = applyColourPlan(strands,{mode:colourMode(first?.settings),layerColours:first?.settings?.layerColours});
  strands=strands.map((s,i)=>({...s,pauseBefore:pauses[i].pauseBefore}));
  const moves=emitStrands(strands,{retraction:cfg.derived.retraction}),stats=computeStats(moves,cfg,[]);
  const excludedPaths=regions.filter(r=>r.enabled===false).flatMap(r=>r.pathIndices.map(i=>scaled.paths[i]));
  const result={cfg,strands,moves,stats,outline:allowed.length?allowed:[rectangle],documentSize:[width,height],excludedPaths,warnings:[...new Set(warnings)],regions:metadata,layerCount:0,intendedFamilies:[]};
  result.fabric = analyzeFabric(strands, {
    strandWidth: bead, layerHeight: h, boundary,
    boundaryForStrand: (strand) => isLine(strand) ? page : boundary,
  });
  refreshConstruction(result);
  result.construction.regions=Object.fromEntries(metadata.map(region=>[region.hex??region.id,buildConstructionReport({...result,strands:strands.filter(s=>s.regionId===region.id),intendedFamilies:intendedByRegion.get(region.id)??[]},{strandWidth:bead,layerHeight:h})]));
  for(const [colour,report] of Object.entries(result.construction.regions))result.construction.errors.push(...report.errors.map(message=>`${colour}: ${message}`));
  result.construction.seams={count:seamStrands.length,contacts:result.construction.crossings.byPair.filter(pair=>pair.a.startsWith('seam-')||pair.b.startsWith('seam-'))};
  result.report={crossings:result.construction.crossings.total,perCm2:result.construction.crossings.perCm2,components:result.fabric.components};
  result.stats.loops=0;
  const totalLayers=strands.reduce((count,strand)=>Math.max(count,(strand.layer??0)+1),0);
  result.layerPlan={mode:'regions',nativeLayers:Math.max(1,totalLayers-extraLayers),patternLayers:Math.max(1,totalLayers-extraLayers),totalLayers,extraLayers,repeatable:enabled.some(r=>r.role==='pattern')};
  result.gcode=writeGcode(moves,cfg,{stats,comments:metadata.map(r=>`region ${r.hex??r.id}: ${r.role} ${r.card??''} settings ${r.settingsHash}`)});
  progress({done:enabled.length,total:enabled.length,message:'Piece built.'});
  return assertConstructionExportable(result);
}

function enabledContours(vector, regions) {
  return regions.filter(region=>region.enabled!==false&&['pattern','solid','hole'].includes(region.role))
    .flatMap(region=>region.pathIndices.map(index=>({role:region.role,ring:closedRing(vector.paths[index])})))
    .filter(contour=>contour.ring).sort((a,b)=>area(a.ring)-area(b.ring));
}
