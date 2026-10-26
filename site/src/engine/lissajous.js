import { clipPolyline } from './layers.js';

/**
 * Harmonograph: a Lissajous curve, x = sin(a t + phase), y = sin(b t), as one closed strand that crosses itself in a
 * diamond lattice (2ab - a - b crossings for coprime a and b). A dense band of lines follows the edge, a natural
 * hem. The optional second layer is the same curve with its phase turned, which crosses the first everywhere.
 * It always fills the bounding box, so an arbitrary outline is clipped rather than followed.
 */
const TAU = Math.PI * 2;

export function lissajousCurve(box, { a = 5, b = 4, phase = 30, margin = 1 } = {}) {
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const rx = Math.max(1, (box.maxX - box.minX) / 2 - margin);
  const ry = Math.max(1, (box.maxY - box.minY) / 2 - margin);
  const d = (phase * Math.PI) / 180;
  // a point every half millimetre or so: the speed is bounded by sqrt((rx a)^2 + (ry b)^2)
  const speed = Math.hypot(rx * a, ry * b);
  const steps = Math.max(64, Math.ceil((TAU * speed) / 0.5));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (TAU * i) / steps;
    pts.push({ x: cx + rx * Math.sin(a * t + d), y: cy + ry * Math.sin(b * t) });
  }
  return pts;
}

export function lissajousLayers(boundary, { a = 5, b = 4, phase = 30, second = true } = {}) {
  const box = boundary.bbox();
  const layers = [clipPolyline(lissajousCurve(box, { a, b, phase }), boundary)];
  if (second) {
    // the second curve is the first with its phase turned a quarter of a lobe, so it crosses the first everywhere
    const shifted = lissajousCurve(box, { a, b, phase: phase + 90 / Math.max(1, a) });
    layers.push(clipPolyline(shifted, boundary));
  }
  return { layers, extra: { a, b } };
}
