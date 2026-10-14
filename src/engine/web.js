import { chainPolylines, clipPolyline, densify } from './layers.js';

/**
 * Spiderweb: one continuous Archimedean spiral (layer 1) crossed by a radial zigzag (layer 2) that goes out along
 * one spoke, round, and back in along the next. Every spoke crosses every turn at about a right angle, so the
 * layers hold each other: soft along the radius, firm around. A hub hole is left so the spokes do not crowd.
 * The centre is the middle of the bounding box; the web runs out past the corners and is clipped to the boundary.
 */
const TAU = Math.PI * 2;
const tri = (u) => (2 / Math.PI) * Math.asin(Math.sin(TAU * u)); // -1..1, period 1

export function webLayers(boundary, { spacing = 4, spokes = 24, hub = 3, tooth = 0 } = {}) {
  const box = boundary.bbox();
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const R = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + spacing;
  const turns = Math.max(1, (R - hub) / spacing);

  // layer 1: r grows by `spacing` per turn; a sawtooth of `tooth` mm lines up with the spokes
  const spiral = [];
  for (let theta = 0; theta <= turns * TAU; ) {
    const r = hub + (spacing * theta) / TAU;
    const radius = r + tooth * tri((theta * spokes) / TAU);
    spiral.push({ x: cx + radius * Math.cos(theta), y: cy + radius * Math.sin(theta) });
    // half a millimetre of arc, and never fewer than eight points per tooth
    theta += Math.min(0.5 / Math.max(r, 1), TAU / (Math.max(spokes, 1) * 8));
  }
  const layer1 = clipPolyline(spiral, boundary);

  // layer 2: spoke j out, spoke j+1 in, an arc at each end (outside the web the arcs are clipped away and the
  // pieces are chained back together along the boundary)
  const spokesPts = [];
  for (let j = 0; j < spokes; j++) {
    const a = (TAU * j) / spokes;
    const from = j % 2 === 0 ? hub : R;
    const to = j % 2 === 0 ? R : hub;
    const line = densify([{ x: cx + from * Math.cos(a), y: cy + from * Math.sin(a) }, { x: cx + to * Math.cos(a), y: cy + to * Math.sin(a) }]);
    for (const piece of clipPolyline(line, boundary)) spokesPts.push(piece);
  }
  const layer2 = chainPolylines(spokesPts, boundary, (TAU * R) / spokes * 3);
  return { layers: [layer1, layer2], extra: { turns, spokes } };
}
