import { slidingChannels } from './channels.js';
import { splitChannel, minChannelSpacing } from './grid-raised.js';
import { ConfigError } from './params.js';

/** Bipartite closed-loop lattice: neighbours intersect twice; diagonal neighbours do not intersect. */
export function slidingLoopLayers(boundary, { shape = 'circle', pitch = 14, overlap = 0.12 } = {}) {
  const box = boundary.bbox(), groups = [[], []];
  // Small preview windows retain one complete loop; multiple-loop trials need the full pitch footprint.
  pitch = Math.min(pitch, (Math.min(box.maxX - box.minX, box.maxY - box.minY) - 1) / ((shape === 'square' ? 1.2 : 1) * (1 + overlap)));
  const radius = pitch * (shape === 'square' ? 0.6 : 0.5) * (1 + overlap);
  const nx = Math.max(1, Math.floor((box.maxX - box.minX - 2 * radius) / pitch) + 1);
  const ny = Math.max(1, Math.floor((box.maxY - box.minY - 2 * radius) / pitch) + 1);
  if (nx * ny > 1800) throw new ConfigError(['Too many sliding loops; increase loop pitch or reduce the sheet size.']);
  const x0 = (box.minX + box.maxX - (nx - 1) * pitch) / 2, y0 = (box.minY + box.maxY - (ny - 1) * pitch) / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + i * pitch, cy = y0 + j * pitch, points = [];
    const n = shape === 'square' ? 4 * Math.max(4, Math.ceil(radius / 0.4)) : Math.max(48, 4 * Math.ceil(2 * Math.PI * radius / 1.6));
    for (let k = 0; k <= n; k++) {
      const t = 4 * k / n, corner = Math.floor(t) % 4, f = t % 1;
      const vertices = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const a = vertices[corner], b = vertices[(corner + 1) % 4];
      points.push(shape === 'square' ? { x: cx + radius * (a[0] + (b[0] - a[0]) * f), y: cy + radius * (a[1] + (b[1] - a[1]) * f) }
        : { x: cx + radius * Math.cos(2 * Math.PI * k / n), y: cy + radius * Math.sin(2 * Math.PI * k / n) });
    }
    // Only complete loops retain the intended captive topology; discard edge fragments.
    if (points.every(p => boundary.contains(p.x, p.y))) groups[(i + j) % 2].push(points);
  }
  groups.forEach((group, i) => { group.family = `loops-${i ? 'b' : 'a'}`; });
  const layers = groups.filter(group => group.length);
  layers.families = layers.map(group => group.family);
  return layers;
}

/** Li-inspired local tangent channels on closed loops; geometry/material translation, not a replica of the source files. */
export function captureLoops(strands, { arrangement = 'b', pitch = 14, spanLift = 1, channelLift = 2, legBefore = 1.2, layerHeight = 0.2, bead = 0.45 } = {}) {
  if (pitch < 2 * minChannelSpacing(legBefore, bead)) throw new ConfigError(['Loop pitch is too small for these channels. Increase pitch or shorten the channel legs.']);
  const groups = [strands.filter(s => s.layer === 0), strands.filter(s => s.layer === 1)];
  let crossingIndex = 0;
  const mask = c => {
    if (c.familyA === c.familyB || c.angle < 25 || arrangement === 'fused') return 'fused';
    const ix = Math.floor(c.x / (pitch / 2)), iy = Math.floor(c.y / (pitch / 2));
    if (arrangement === 'mixed' && crossingIndex++ % 4 === 0) return 'fused';
    return arrangement === 'a' ? 'a' : ['alternate', 'mixed'].includes(arrangement) ? ((ix + iy) % 2 ? 'a' : 'b') : 'b';
  };
  const result = slidingChannels(groups, { mask, spanLift, channelLift, legBefore, layerHeight, bead, constrainFused: true });
  const channels = result.strands.filter(s => s.role === 'channel').map(s => splitChannel(s, { raisedZ: layerHeight + spanLift, layerHeight }));
  const native = result.strands.filter(s => s.role !== 'channel');
  return { ...result, strands: [...native.filter(s => !s.id.includes('-raised-')), ...channels.flatMap(c => c.feet), ...native.filter(s => s.id.includes('-raised-')), ...channels.map(c => c.arch)] };
}
