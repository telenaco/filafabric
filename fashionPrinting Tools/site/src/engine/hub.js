/** A flat, non-crossing spiral fills a hub with 20% overlap between neighbouring beads. */
export function solidHub(c, radius, strandWidth = 0.45, endAngle = 0) {
  if (!(radius > 0)) return [];
  const pitch = Math.max(0.01, strandWidth * 0.8);
  const turns = radius / pitch;
  const total = 2 * Math.PI * turns;
  const steps = Math.max(16, Math.ceil(total * Math.max(radius, pitch) / 0.15));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const r = radius * i / steps, a = total * (i / steps - 1) + endAngle;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
}
