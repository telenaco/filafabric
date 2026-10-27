import { hatch } from './layers.js';
import { findCrossings } from './crossings.js';

export const MOIRE_SHAPES = Object.freeze(['none', 'wave', 'zigzag']);

/** Count real geometric A/B intersections in each 10 mm tile covered by the swatch. */
export function moireCrossingTiles(boundary, familyA, familyB, tileSize = 10) {
  const strands = [...familyA, ...familyB].map((pts, i) => ({
    id: `moire-${i}`, family: i < familyA.length ? 'A' : 'B',
    pts: pts.map(p => ({ x: p.x, y: p.y, z: 0 })),
  }));
  const { found } = findCrossings(strands, { strandWidth: 0, cell: 1, mergeDistance: 0.05 });
  const box = boundary.bbox(), cols = Math.ceil((box.maxX - box.minX) / tileSize), rows = Math.ceil((box.maxY - box.minY) / tileSize);
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => ({
    x0: box.minX + col * tileSize, y0: box.minY + row * tileSize,
    x1: Math.min(box.maxX, box.minX + (col + 1) * tileSize),
    y1: Math.min(box.maxY, box.minY + (row + 1) * tileSize), count: 0,
  }))).flat();
  for (const crossing of found) {
    if (strands[crossing.sa]?.family === strands[crossing.sb]?.family) continue;
    const col = Math.floor((crossing.x - box.minX) / tileSize), row = Math.floor((crossing.y - box.minY) / tileSize);
    const tile = tiles[row * cols + col];
    if (tile && crossing.x < box.maxX && crossing.y < box.maxY) tile.count++;
  }
  const active = tiles.filter(t => boundary.contains((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2));
  return { tiles: active, sparse: active.some(t => t.count < 1), minimum: active.length ? Math.min(...active.map(t => t.count)) : 0 };
}

/** Two close-pitched line families make interference bands; optional phase shifts family B by a sampled picture. */
export function moireLayers(boundary, {
  pitchA = 2, pitchB = 2.1, angleA = 0, angleB = 3,
  shape = null, size = 0, wavelength = 6, phaseField = null,
} = {}) {
  const familyA = hatch(boundary, { angle: angleA, spacing: pitchA, whole: true, shape, size, pitch: wavelength });
  const baseB = hatch(boundary, { angle: angleB, spacing: pitchB, whole: true, shape, size, pitch: wavelength });
  const normalAngle = (angleB + 90) * Math.PI / 180;
  const familyB = baseB.map(line => {
    if (!phaseField) return line;
    const shifted = line.map(point => {
      const phase = Math.max(0, Math.min(1, Number(phaseField(point.x, point.y)) || 0));
      const distance = phase * pitchB;
      return { x: point.x - Math.sin(normalAngle) * distance, y: point.y + Math.cos(normalAngle) * distance };
    });
    if (line.rowOrder !== undefined) Object.defineProperty(shifted, 'rowOrder', { value: line.rowOrder, enumerable: true });
    return shifted;
  });
  const result = [familyA, familyB];
  result.families = ['A', 'B'];
  result.extra = { families: result.families };
  result.crossingTiles = moireCrossingTiles(boundary, familyA, familyB);
  if (result.crossingTiles.sparse) result.warnings = ['The bands are too sparse to hold together; reduce the difference.'];
  return result;
}
