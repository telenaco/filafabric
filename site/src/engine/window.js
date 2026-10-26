/** Crop polygon rings to a rectangular window, preserving their even-odd hole interpretation. */
export function windowRings(rings, width, height, offsetX = 0, offsetY = 0) {
  const edges = [['x', 0, 1], ['x', width, -1], ['y', 0, 1], ['y', height, -1]];
  return rings.map((ring) => {
    let pts = ring.map((p) => ({ x: p.x - offsetX, y: p.y - offsetY }));
    for (const [axis, edge, sign] of edges) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const insideA = sign * (a[axis] - edge) >= -1e-9, insideB = sign * (b[axis] - edge) >= -1e-9;
        if (insideA) out.push(a);
        if (insideA !== insideB) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      pts = out;
    }
    return pts;
  }).filter((ring) => ring.length >= 3 && Math.abs(ring.reduce((area, p, i) => { const q = ring[(i + 1) % ring.length]; return area + p.x * q.y - q.x * p.y; }, 0)) > 1e-8);
}
