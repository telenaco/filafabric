import { findCrossings } from './crossings.js';
import { contactGraph, segmentContact, constructionGeometry } from './fabric.js';
import { PolygonBoundary } from './boundary.js';
import { boundaryArea } from './layers.js';

const isNative = (family) => ['native', 'motif'].includes(family.role);

/** Normalize only report-local metadata; older postprocessors need no geometry mutation. */
function reportStrand(strand) {
  if (strand.family && strand.role) return strand;
  const imported = /^svg-|^solid-/.test(strand.id);
  const family = strand.family ?? (strand.brim ? 'brim'
    : /^solid-/.test(strand.id) ? 'svg-solid'
      : imported ? 'svg-lines' : 'unclassified');
  const role = strand.role ?? (strand.connection ? 'tie'
    : strand.brim ? 'brim' : imported ? 'motif' : 'unclassified');
  return { ...strand, family, role };
}

/** Interpolate the crossing's deposition height along the original XY arc. */
function crossingPoint(strand, arcs, arc) {
  let lo = 1, hi = arcs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arcs[mid] < arc) lo = mid + 1;
    else hi = mid;
  }
  const p = strand.pts[lo - 1], q = strand.pts[lo];
  const t = (arc - arcs[lo - 1]) / Math.max(1e-12, arcs[lo] - arcs[lo - 1]);
  return {
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    z: (p.z ?? 0) + ((q.z ?? 0) - (p.z ?? 0)) * t,
    lifted: p.cls === 'lifted' || q.cls === 'lifted',
  };
}

/** Fine XY segment index shared by endpoint and valence queries. */
function contactIndex(strands, cell) {
  const grid = new Map();
  strands.forEach((strand, si) => {
    for (let i = 1; i < strand.pts.length; i++) {
      const a = strand.pts[i - 1], b = strand.pts[i];
      const segment = { a, b, si };
      const x0 = Math.floor(Math.min(a.x, b.x) / cell);
      const x1 = Math.floor(Math.max(a.x, b.x) / cell);
      const y0 = Math.floor(Math.min(a.y, b.y) / cell);
      const y1 = Math.floor(Math.max(a.y, b.y) / cell);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(segment);
      }
    }
  });
  return (point, radius, exclude = -1) => {
    const hit = new Set();
    const x0 = Math.floor((point.x - radius) / cell);
    const x1 = Math.floor((point.x + radius) / cell);
    const y0 = Math.floor((point.y - radius) / cell);
    const y1 = Math.floor((point.y + radius) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      for (const segment of grid.get(`${x},${y}`) ?? []) {
        if (segment.si === exclude || hit.has(segment.si)) continue;
        // A point query needs one projection, rather than the four candidate
        // projections used by general segmentContact. The XY distance is identical.
        const { a, b } = segment;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(1e-20, dx * dx + dy * dy)));
        const distance = Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
        if (distance <= radius + 1e-9) hit.add(segment.si);
      }
    }
    return hit;
  };
}

function boundaryDistance(point, boundary) {
  let distance = Infinity;
  for (const ring of boundary?.rings ?? []) {
    ring.forEach((a, i) => {
      distance = Math.min(distance, segmentContact(point, point, a, ring[(i + 1) % ring.length]).distance);
    });
  }
  return Number.isFinite(distance) ? distance : 0;
}

function areaMm2(boundary, result) {
  return boundary ? boundaryArea(boundary) : result.cfg?.t.sample_width * result.cfg?.t.sample_height || 0;
}

/**
 * Read final strand topology and deposition heights. XY components deliberately
 * include separated crossings; stack classifications retain their physical Z gap.
 * Optional timings are diagnostics only and never become serialized report data.
 */
export function buildConstructionReport(result, {
  boundary, strandWidth = 0.45, layerHeight = 0.2, timings = null,
  intendedFamilies = result.intendedFamilies ?? result.extra?.families ?? result.families
    ?? Array.from({ length: result.layerCount ?? 0 }, (_, i) => `L${i + 1}`),
} = {}) {
  let tick = performance.now();
  const phase = (name) => {
    if (timings) timings[name] = performance.now() - tick;
    tick = performance.now();
  };
  const strands = (result.strands ?? []).filter((s) => s.pts?.length > 1).map(reportStrand);
  const families = [], groups = new Map();
  let min = Infinity, max = -Infinity;
  for (const s of strands) {
    const family = s.family ?? 'unclassified', role = s.role ?? 'native', key = `${family}\0${role}`;
    if (!groups.has(key)) {
      const group = { family, role, strands: 0, lengthMm: 0 };
      groups.set(key, group);
      families.push(group);
    }
    const group = groups.get(key);
    group.strands++;
    s.pts.forEach((p, i) => {
      min = Math.min(min, p.z ?? 0);
      max = Math.max(max, p.z ?? 0);
      if (i) {
        const q = s.pts[i - 1];
        group.lengthMm += Math.hypot(p.x - q.x, p.y - q.y, (p.z ?? 0) - (q.z ?? 0));
      }
    });
  }
  const native = new Set(families.filter(isNative).map((g) => g.family));
  const lostFamilies = [...new Set(intendedFamilies)].filter((f) => !native.has(f));
  phase('families');
  // Filtering an empty strand changes indices, so only reuse a matching analysis.
  const geometry = strands.length === result.strands?.length
    ? constructionGeometry(result.strands, strandWidth, layerHeight) : null;
  const { found, arcs } = geometry ?? findCrossings(strands, { strandWidth, cell: 1 });
  phase('crossings');
  const at = (si, arc) => crossingPoint(strands[si], arcs[si], arc);
  const touching = contactIndex(strands, strandWidth);
  const valenceAt = new Map();
  phase('grid');
  const pairs = new Map(), stacks = new Map(), pairCache = new Map();
  let maxValence = 0;
  for (const c of found) {
    const a = at(c.sa, c.arcA), b = at(c.sb, c.arcB);
    const upper = strands[a.z > b.z ? c.sa : c.sb];
    const type = a.lifted || b.lifted ? 'lifted' : upper.role === 'channel' ? 'channel'
      : Math.abs(a.z - b.z) <= layerHeight * 1.5 + 1e-9 ? 'fused' : 'separated';
    const fa = strands[c.sa].family, fb = strands[c.sb].family;
    const directed = `${fa}\0${fb}`;
    if (!pairCache.has(directed)) {
      const [first, second] = fa < fb ? [fa, fb] : [fb, fa];
      const key = `${first}\0${second}`;
      if (!pairs.has(key)) pairs.set(key, { a: first, b: second, count: 0 });
      pairCache.set(directed, pairs.get(key));
    }
    pairCache.get(directed).count++;
    if (!stacks.has(type)) stacks.set(type, { type, count: 0, maxHeightMm: 0 });
    const stack = stacks.get(type);
    stack.count++;
    stack.maxHeightMm = Math.max(stack.maxHeightMm, a.z, b.z);
    const position = `${c.x},${c.y}`;
    if (!valenceAt.has(position)) valenceAt.set(position, touching(c, strandWidth / 2).size);
    maxValence = Math.max(maxValence, valenceAt.get(position));
  }
  const tieIndices = strands.map((s, i) => s.role === 'tie' ? i : -1).filter((i) => i >= 0);
  const carrierFamilies = [...new Set(families.filter((g) => g.role === 'carrier').map((g) => g.family))];
  phase('stackAndValence');
  let danglingEnds = 0;
  strands.forEach((strand, si) => {
    const first = strand.pts[0], last = strand.pts.at(-1);
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-8) return;
    for (const point of [first, last]) {
      if (boundaryDistance(point, boundary) > strandWidth && !touching(point, strandWidth, si).size) danglingEnds++;
    }
  });
  phase('ends');
  const components = geometry?.graph.components === 1 ? 1 : contactGraph(strands, { strandWidth, planar: true }).components;
  const componentsWithoutTies = tieIndices.length
    ? contactGraph(strands.filter((s) => s.role !== 'tie'), { strandWidth, planar: true }).components : components;
  const bundleGroups=new Map();
  strands.filter(s=>Number.isInteger(s.bundle)).forEach(strand=>{const key=`${strand.family}\0${strand.bundle}`;if(!bundleGroups.has(key))bundleGroups.set(key,{family:strand.family,index:strand.bundle,bonded:true,strands:0});const group=bundleGroups.get(key);group.bonded=group.bonded&&Boolean(strand.bonded);group.strands++;});
  const liftedPoints=strands.flatMap(strand=>strand.pts.filter(point=>point.lifted));
  const channelStrands=strands.filter(strand=>strand.role==='channel');
  const raisedFeatures=strands.some(strand=>strand.role==='channel'||strand.pts.some(point=>point.lifted||['rising','falling','unsupported'].includes(point.cls)));
  const zLevels=strands.flatMap(strand=>strand.pts.map(point=>Math.max(0,Number.isFinite(point.level)?point.level:Math.round((point.z??0)/layerHeight))));
  const levelHistogram=zLevels.reduce((hist,level)=>{hist[level]=(hist[level]??0)+1;return hist;},{});
  phase('graphs');
  const area = areaMm2(boundary, result);
  const warnings = [];
  if (componentsWithoutTies > 1) warnings.push(tieIndices.length
    ? `Held together by ${tieIndices.length} added ties.`
    : `${componentsWithoutTies} separate pieces remain without added ties.`);
  if (danglingEnds) warnings.push(`${danglingEnds} loose ends inside the piece.`);
  return {
    families, lostFamilies,
    ...(bundleGroups.size?{bonding:{bundles:bundleGroups.size,bonded:[...bundleGroups.values()].filter(group=>group.bonded).length,gapped:[...bundleGroups.values()].filter(group=>!group.bonded).length,groups:[...bundleGroups.values()]}}:{}),
    ...(liftedPoints.length?{lifted:{points:liftedPoints.length,crossings:liftedPoints.length,total:found.length}}:{}),
    ...(channelStrands.length?{channels:{count:channelStrands.length,along:{x:channelStrands.filter(s=>Math.abs(s.pts.at(-1).x-s.pts[0].x)>=Math.abs(s.pts.at(-1).y-s.pts[0].y)).length,y:channelStrands.filter(s=>Math.abs(s.pts.at(-1).x-s.pts[0].x)<Math.abs(s.pts.at(-1).y-s.pts[0].y)).length},fused:stacks.get('fused')?.count??0}}:{}),
    ...(raisedFeatures&&max>2*layerHeight+1e-6?{levels:{max:zLevels.reduce((highest,level)=>Math.max(highest,level),0),histogram:levelHistogram}}:{}),
    crossings: {
      total: found.length, perCm2: area ? found.length * 100 / area : 0,
      byPair: [...pairs.values()], byStack: [...stacks.values()],
    },
    ties: {
      count: tieIndices.length,
      at: tieIndices.map((si) => {
        const point = crossingPoint(strands[si], arcs[si], arcs[si].at(-1) / 2);
        return { x: point.x, y: point.y };
      }),
    },
    carrier: { passes: carrierFamilies.length, roles: carrierFamilies },
    z: { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 },
    components, componentsWithoutTies, danglingEnds, maxValence,
    errors: lostFamilies.map((family) => {
      const label = /^L\d+$/.test(family) ? `Layer ${family.slice(1)} (${family})` : family;
      return `${label} was lost when the pattern was cut to the shape.`;
    }),
    warnings,
  };
}

export function refreshConstruction(result) {
  const t = result.cfg.t;
  const rectangle = [{ x: 0, y: 0 }, { x: t.sample_width, y: 0 },
    { x: t.sample_width, y: t.sample_height }, { x: 0, y: t.sample_height }];
  const boundary = new PolygonBoundary(result.pieceOutline ?? result.outline ?? [rectangle]);
  result.construction = buildConstructionReport(result, {
    boundary, strandWidth: t.extrusion_width, layerHeight: t.layer_height,
  });
  return result;
}

export function assertConstructionExportable(result) {
  if (result.construction?.errors.length) throw new Error(result.construction.errors.join(' '));
  return result;
}

export function shelfFromConstruction(report, { layerHeight = 0.2 } = {}) {
  const native = new Set(report.families.filter(isNative).map((g) => g.family));
  const cross = report.crossings.byPair
    .filter((p) => p.a !== p.b && native.has(p.a) && native.has(p.b))
    .reduce((n, p) => n + p.count, 0);
  const density = report.crossings.total ? cross / report.crossings.total * report.crossings.perCm2 : 0;
  if (!report.carrier.passes && (native.size === 1 || density < 1)
    && report.z.max <= 2 * layerHeight + 0.05) return 'flat';
  // a carrier pass is a layer of its own, so it raises the height a layered result may reach
  if ((native.size >= 2 && cross > 0 || report.carrier.passes)
    && report.z.max <= (native.size + report.carrier.passes + 1) * layerHeight + 0.05) return 'layered';
  return 'raised';
}

// Provisional measured discrepancies at default 100 × 100 mm, pending human batch review.
// Carrier cards (Spiral, Bouclé, Turing, Your drawing) are not listed: carrier passes count toward the layered height allowance.
export const SHELF_EXCEPTIONS = Object.freeze({
  auxetic: 'Declared flat as a planar lattice, but two native families cross at 0.400 mm and the measured rule selects layered.',
  'honeycomb-flat': 'Declared flat as a planar cell lattice, but the inherited Auxetic generator uses two native families at 0.400 mm and the measured rule selects layered; physical validation pending.',
  dipweave: 'Declared raised for the dipping technique, but its default warp and weft families measure only 0.400 mm and satisfy layered.',
  harmonograph: 'Declared flat as drawn curves, but its two crossing native families at 0.400 mm satisfy layered.',
  voronoi: 'Declared layered as a cellular mesh, but the measured 0.800 mm envelope exceeds the two-native-family 0.650 mm layered ceiling.',
  spirograph: 'Declared layered as overlapping curves, but its measured 0.656 mm envelope exceeds the two-native-family 0.650 mm layered ceiling.',
  starlattice: 'Declared flat as a planar lattice, but its two crossing native families at 0.400 mm satisfy layered.',
  kirigami: 'Declared flat as a solid sheet: its orthogonal infill passes are intentionally fused at the same Z, not separate textile layers.',
  'looped-net': 'Declared raised for its over-under self-crossing strand, but its current measured default envelope is only 0.400 mm and the general rule classifies it as layered; geometry estimates are not physical qualification.',
  'squiggle-rings': 'Declared layered as a ring net, but the ring generator settles self-crossings to a measured 0.773 mm envelope and the general rule classifies it as raised; geometry estimates are not physical qualification.',
});
