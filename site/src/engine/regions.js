import { closedRing } from './drawing.js';
import { polygonRegion } from './polygon-region.js';

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
    const hex = typeof style?.hex === 'string' && /^#[0-9a-f]{6}$/i.test(style.hex) ? style.hex.toLowerCase() : null;
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
    if (region?.enabled !== false && ring && ['pattern', 'hole'].includes(region.role)) contours.push({ index, ring, region, area: area(ring) });
  });
  const candidates = contours.map((contour) => contour.ring);
  const output = [];
  for (const region of regions) {
    if (region.role !== 'pattern' || !region.enabled) continue;
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

/** Accessible, deterministic view model for the region toolbar, suitable for rendering without knowing its DOM. */
export function colourBarModel(regions, selection = null) {
  const names = { red:'Red', blue:'Blue', green:'Green', yellow:'Yellow', other:'Other' };
  const roles = { pattern:'pattern', hole:'hole', solid:'solid', line:'line' };
  return (regions ?? []).map((region) => {
    const colour = names[region.color] ?? 'Other';
    const role = roles[region.role] ?? 'line';
    const label = `${colour}${region.hex ? ` ${region.hex}` : ''}, ${role}${role === 'pattern' && region.cardName ? `: ${region.cardName}` : ''}, ${region.enabled === false ? 'excluded' : 'included'}`;
    return { id:region.id, hex:region.hex, color:region.color, role, card:region.card ?? null, enabled:region.enabled !== false, selected:region.id === selection, label };
  });
}
