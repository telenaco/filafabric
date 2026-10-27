import { hatch } from './layers.js';

export const STACK_TURNS = Object.freeze([30, 45, 60, 90]);

/** Individually printed planes of parallel strands, rotated by a fixed turn at each layer. */
export function rotatedStackLayers(boundary, { layers = 3, turn = 90, strand = 0.45, gapFactor = 1 } = {}, { bead = 0.45 } = {}) {
  const count = Math.max(2, Math.min(8, Math.round(Number(layers) || 3)));
  const width = Math.max(0.4, Math.min(0.9, Number(strand) || 0.45));
  const gap = Math.max(0.5, Math.min(2, Number(gapFactor) || 1));
  const angle = STACK_TURNS.includes(Number(turn)) ? Number(turn) : 90;
  const box = boundary.bbox(), anchor = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const familyNames = Array.from({ length: count }, (_, i) => `S${i + 1}`);
  const result = familyNames.map((family, k) => {
    const lines = hatch(boundary, { angle: k * angle, spacing: width * (1 + gap), anchor, whole: true });
    return Object.assign(lines.map(line => line.map(point => ({ ...point, flow: width / Math.max(.01, bead) }))), { family });
  });
  result.families = familyNames;
  result.extra = { planes: true, families: familyNames };
  return result;
}
