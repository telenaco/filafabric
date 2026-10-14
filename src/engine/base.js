function arc(cx, cy, r, a0, a1, resolution) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / resolution));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** One continuous serpentine over the bbox: lines along X, `spacing` apart. */
export function buildBase({ bbox, spacing, cornerRadius, z, resolution }) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const lines = Math.floor(height / spacing + 1e-9) + 1;
  const r = Math.max(0, Math.min(cornerRadius, spacing / 2, width / 2));
  const points = [];
  const push = (x, y) => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 1e-9) points.push({ x, y, z });
  };

  for (let k = 0; k < lines; k++) {
    const y0 = bbox.minY + k * spacing;
    const dir = k % 2 === 0 ? 1 : -1;
    const xa = dir === 1 ? bbox.minX : bbox.maxX;
    const xb = dir === 1 ? bbox.maxX : bbox.minX;
    if (k === 0) push(xa, y0);
    if (k === lines - 1) {
      push(xb, y0);
      break;
    }
    const y1 = y0 + spacing;
    if (r > 0) {
      push(xb - dir * r, y0);
      const a1 = dir === 1 ? 0 : -Math.PI;
      for (const p of arc(xb - dir * r, y0 + r, r, -Math.PI / 2, a1, resolution)) push(p.x, p.y);
      push(xb, y1 - r);
      const b0 = dir === 1 ? 0 : Math.PI;
      for (const p of arc(xb - dir * r, y1 - r, r, b0, Math.PI / 2, resolution)) push(p.x, p.y);
    } else {
      push(xb, y0);
      push(xb, y1);
    }
  }

  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return { points, length };
}
