/** Pattern effects shared by designs that sample a 0..1 tone field (1 means dark). */
export const PATTERN_EFFECTS = Object.freeze({
  depth: { label: 'Wave depth', hint: 'Deeper waves where the pattern is dark' },
  thickness: { label: 'Line thickness (halftone)', hint: 'Thicker lines where the pattern is dark' },
  spacing: { label: 'Spacing', hint: 'Closer lines where the pattern is dark' },
  size: { label: 'Cell size', hint: 'Smaller cells where the pattern is dark' },
  height: { label: 'Height', hint: 'Higher where the pattern is dark' },
  bonding: { label: 'Bonding', hint: 'Strands touch where dark and keep a gap where light' },
  direction: { label: 'Direction', hint: 'The lines turn one way where dark and the other where light' },
});

export const THICKNESS_RANGES = Object.freeze({
  thin: { min: 0.3, max: 1.5, step: 0.05 },
  thick: { min: 0.8, max: 2.5, step: 0.05 },
});

/** Attach a tone-driven extrusion flow to a line, limiting changes along the path to `maxChangePerMm`. */
export function thicknessAlong(polyline, field, { thin = 0.6, thick = 1.8, overNet = 0.85, layer = 0, maxChangePerMm = 0.25, bead = 0.45, quantise = 0.05 } = {}) {
  if (!Array.isArray(polyline)) return [];
  let previous = null;
  return polyline.map((point) => {
    const tone = field ? Math.max(0, Math.min(1, field(point.x, point.y))) : 0.5;
    let flow = thin + (thick - thin) * tone;
    if (quantise > 0) flow = Math.round(flow / quantise) * quantise;
    if (previous) {
      const distance = Math.hypot(point.x - previous.point.x, point.y - previous.point.y);
      const limit = Number.isFinite(maxChangePerMm) ? Math.max(0, maxChangePerMm) * distance : Infinity;
      flow = Math.max(previous.flow - limit, Math.min(previous.flow + limit, flow));
    }
    previous = { point, flow };
    return { ...point, flow: layer > 0 ? flow * overNet : flow };
  });
}
