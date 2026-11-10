import { clipPolyline } from './layers.js';
import { shapeAt } from './shapes.js';
import { ConfigError } from './params.js';

/** Slack is placed between fixed grid junctions, not at the junctions. */
export function strainCellLayers(boundary, { cell = 8, depth = 1, waves = 2, direction = 'both' } = {}) {
  const box = boundary.bbox(), layers = [[], []];
  if (Math.max(box.maxX - box.minX, box.maxY - box.minY) / cell > 180) throw new ConfigError(['Too many wave cells. Increase cell size.']);
  for (let axis = 0; axis < 2; axis++) {
    const lo = axis ? box.minY : box.minX, hi = axis ? box.maxY : box.maxX;
    const acrossLo = axis ? box.minX : box.minY, acrossHi = axis ? box.maxX : box.maxY;
    for (let c = acrossLo; c <= acrossHi + 1e-8; c += cell) {
      const pts = [], steps = Math.ceil((hi - lo) / 0.2);
      for (let i = 0; i <= steps; i++) {
        const u = lo + (hi - lo) * i / steps;
        const v = direction === 'both' || (axis === 0 ? direction === 'x' : direction === 'y') ? shapeAt('trapezoid', u - lo, { pitch: cell / waves, size: Math.min(depth, cell * 0.25) }).v : 0;
        pts.push(axis ? { x: c + v, y: u } : { x: u, y: c + v });
      }
      layers[axis].push(...clipPolyline(pts, boundary));
    }
  }
  layers.families = ['wave-x', 'wave-y'];
  return layers;
}

/** Fig. 1/4 topology reconstruction. Floral curvature is proposed, not source CAD. */
export function reentrantStarLayers(boundary, { cell = 10.8, angle = 30, floral = false } = {}) {
  const box = boundary.bbox(), h = cell / 2, lines = [];
  if ((box.maxX - box.minX) * (box.maxY - box.minY) / cell ** 2 > 1600) throw new ConfigError(['Too many auxetic cells; increase cell size.']);
  const notch = floral ? h * 0.18 : h * (1 - Math.tan(angle * Math.PI / 180));
  for (let y = box.minY; y < box.maxY; y += cell) for (let x = box.minX; x < box.maxX; x += cell) {
    const cx = x + h, cy = y + h, pts = [];
    const vertices = [[-h,-h],[0,-notch],[h,-h],[notch,0],[h,h],[0,notch],[-h,h],[-notch,0],[-h,-h]];
    for (let k = 0; k < vertices.length - 1; k++) {
      const a = vertices[k], b = vertices[k + 1];
      if (!floral) { pts.push({ x: cx + a[0], y: cy + a[1] }); continue; }
      const bend = Math.tan((angle - 45) * Math.PI / 180) * h * 0.7;
      for (let j = 0; j < 12; j++) {
        const t = j / 12, bulge = Math.sin(Math.PI * t) * bend, dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), sign = k % 2 ? -1 : 1;
        pts.push({ x: cx + a[0] + dx * t - sign * dy / length * bulge, y: cy + a[1] + dy * t + sign * dx / length * bulge });
      }
    }
    pts.push({ x: cx + vertices[0][0], y: cy + vertices[0][1] });
    lines.push(...clipPolyline(pts, boundary));
  }
  return [lines];
}
