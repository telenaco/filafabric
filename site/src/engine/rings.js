import { clipPolyline, densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';

export const RING_LATTICES = Object.freeze({
  hex: { label: 'Staggered', hint: 'Offset rows make a close-packed lattice.' },
  square: { label: 'Square', hint: 'Even rows and columns.' },
});
export const RING_LATTICE_IDS = Object.freeze(Object.keys(RING_LATTICES));

const circle = (cx, cy, diameter, segments) => {
  const points = Array.from({ length: segments }, (_, i) => {
    const angle = 2 * Math.PI * i / segments;
    return { x: cx + diameter / 2 * Math.cos(angle), y: cy + diameter / 2 * Math.sin(angle) };
  });
  points.push({ ...points[0] });
  return points;
};

/** One-pass overlapping loops on a square or staggered hexagonal lattice. */
export function ringsLayers(boundary, {
  lattice = 'hex', ringSize = 8, overlap = .9, segments = 48, order = 'rows',
  sizeField = null, bead = .45, centred = false,
} = {}) {
  const box = boundary.bbox();
  const diameter = Math.max(3, Number(ringSize) || 8);
  const contact = Math.max(bead, Number(overlap) || bead);
  const pitch = Math.max(.1, diameter - contact);
  const estimate = Math.ceil((box.maxX - box.minX) / pitch + 2) * Math.ceil((box.maxY - box.minY) / (lattice === 'hex' ? pitch * Math.sqrt(3) / 2 : pitch) + 2) * Math.ceil(diameter * Math.PI / .5);
  if (estimate > MAX_MOVES) throw new ConfigError([`This ring layout would need about ${estimate.toLocaleString('en')} moves; the limit is ${MAX_MOVES.toLocaleString('en')}. Use larger rings, more overlap or a smaller swatch.`]);
  const rowStep = lattice === 'hex' ? pitch * Math.sqrt(3) / 2 : pitch;
  const step = Math.max(12, Math.min(128, Math.round(segments) || 48));
  const rows = Math.ceil((box.maxY - box.minY) / rowStep) + 2;
  const cols = Math.ceil((box.maxX - box.minX) / pitch) + 2;
  const rings = [], centres = [];
  for (let row = -1; row <= rows; row++) {
    const y = centred ? (box.minY + box.maxY) / 2 + (row - (rows - 1) / 2) * rowStep : box.minY + row * rowStep;
    const rowOffset = lattice === 'hex' && Math.abs(row % 2) === 1 ? pitch / 2 : 0;
    for (let col = -1; col <= cols; col++) {
      const x = centred ? (box.minX + box.maxX) / 2 + (col - (cols - 1) / 2) * pitch + rowOffset : box.minX + col * pitch + rowOffset;
      const tone = sizeField ? Math.max(0, Math.min(1, Number(sizeField(x, y)) || 0)) : .5;
      // Fixed centres keep the lattice regular; each locally graded ring retains at least one bead of contact.
      const localDiameter = sizeField
        ? Math.max(pitch + bead, Math.min(diameter * 1.5, diameter + (tone - .5) * Math.min(4, diameter * .35)))
        : diameter;
      let raw = densify(circle(x, y, localDiameter, step));
      const whollyInside = raw.every(p => boundary.contains(p.x, p.y));
      const whollyOutside = !raw.some(p => boundary.contains(p.x, p.y));
      if (whollyOutside) continue;
      if (!whollyInside) {
        // Start the closed path outside the polygon so clipping does not leave an artificial seam inside the swatch.
        const open = raw.slice(0, -1), start = open.findIndex(p => !boundary.contains(p.x, p.y));
        if (start >= 0) raw = [...open.slice(start), ...open.slice(0, start), open[start]];
      }
      const pieces = whollyInside ? [raw] : clipPolyline(raw, boundary, localDiameter * Math.PI / 2);
      for (const points of pieces) if (points.length > 2) {
        const isClosed = Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 1e-6;
        if (isClosed || points.reduce((n, p, i) => i ? n + Math.hypot(p.x - points[i-1].x, p.y - points[i-1].y) : n, 0) >= localDiameter * Math.PI / 2) {
          points.rowOrder = rings.length;
          points.centre = { x, y };
          points.diameter = localDiameter;
          rings.push(points);
          centres.push({ x, y, diameter: localDiameter });
        }
      }
    }
  }
  if(order==='checker')rings.sort((a,b)=>((Math.round(a.centre.y/rowStep)+Math.round(a.centre.x/pitch))%2)-((Math.round(b.centre.y/rowStep)+Math.round(b.centre.x/pitch))%2)||a.rowOrder-b.rowOrder);
  else if(order==='spiral')rings.sort((a,b)=>{const da=Math.hypot(a.centre.x-(box.minX+box.maxX)/2,a.centre.y-(box.minY+box.maxY)/2),db=Math.hypot(b.centre.x-(box.minX+box.maxX)/2,b.centre.y-(box.minY+box.maxY)/2);return da-db||Math.atan2(a.centre.y-(box.minY+box.maxY)/2,a.centre.x-(box.minX+box.maxX)/2)-Math.atan2(b.centre.y-(box.minY+box.maxY)/2,b.centre.x-(box.minX+box.maxX)/2);});
  else rings.sort((a, b) => a.rowOrder - b.rowOrder);
  const layers = [rings];
  layers.families = ['rings'];
  layers.centres = centres;
  layers.extra = { families: ['rings'], lattice, order };
  return layers;
}
