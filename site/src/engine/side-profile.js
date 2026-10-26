// A side profile is a measured slice through the final printed strands.

/**
 * Samples strand segments within a narrow slab around a section line.
 * @param {Array} strands Final print strands.
 * @param {{ from: {x:number,y:number}, to: {x:number,y:number}, band?: number }} section Section line and half-width in mm.
 * @returns {{s:number,z:number,family:string,role:string}[]} Samples sorted along the section.
 */
export function sideProfile(strands, { from, to, band = 1 }) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  if (!(length > 0) || !(band >= 0)) return [];
  const samples = [];
  for (const strand of strands ?? []) {
    const pts = strand.pts ?? [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const da = ((a.x - from.x) * dy - (a.y - from.y) * dx) / length;
      const db = ((b.x - from.x) * dy - (b.y - from.y) * dx) / length;
      const lo = Math.max(0, Math.min(1, da === db ? 0 : (-band - da) / (db - da)));
      const hi = Math.max(0, Math.min(1, da === db ? 1 : (band - da) / (db - da)));
      if (Math.abs(da) > band && Math.abs(db) > band && da * db > 0) continue;
      const t0 = Math.min(lo, hi), t1 = Math.max(lo, hi);
      for (const t of t0 === t1 ? [t0] : [t0, (t0 + t1) / 2, t1]) {
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        const s = ((x - from.x) * dx + (y - from.y) * dy) / length;
        if (s < 0 || s > length) continue;
        samples.push({ s, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t, family: strand.family ?? '', role: strand.role ?? 'native' });
      }
    }
  }
  return samples.sort((a, b) => a.s - b.s || a.z - b.z);
}

/**
 * Chooses a 20 mm section through the centre, across the longest native strand's mean direction.
 * @param {{strands?:Array}} result Generated preview result.
 * @returns {{from:{x:number,y:number},to:{x:number,y:number},band:number}|null} Section or null if no native geometry exists.
 */
export function defaultSection(result) {
  const strands = (result?.strands ?? []).filter((s) => s.role === 'native' || s.role === 'motif');
  const points = strands.flatMap((s) => s.pts ?? []);
  if (!points.length) return null;
  const centre = { x: (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2,
    y: (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2 };
  let best = null;
  for (const strand of strands) for (let i = 1; i < (strand.pts ?? []).length; i++) {
    const a = strand.pts[i - 1], b = strand.pts[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || length > best.length) best = { dx: (b.x - a.x) / length, dy: (b.y - a.y) / length, length };
  }
  if (!best) return null;
  const dx = -best.dy, dy = best.dx;
  return { from: { x: centre.x - dx * 10, y: centre.y - dy * 10 }, to: { x: centre.x + dx * 10, y: centre.y + dy * 10 }, band: 1 };
}
