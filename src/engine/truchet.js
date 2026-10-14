import { createRng } from './rng.js';
import { clipPolyline, trailsFromEdges, densify } from './layers.js';

/**
 * Truchet tiles: a square grid where every cell holds one of two orientations of a simple tile, chosen at random
 * (seeded). Diagonals: layer 1 holds one diagonal of each cell and layer 2 the other, so there is an X in every
 * cell. Arcs: two quarter-circle arcs per cell that meet at the edge midpoints, so they flow into long curves;
 * layer 2 is the same tiling shifted half a tile, so its arcs cross the first layer's.
 * Tiles are joined into as few strands as the pattern allows by walking the graph of tile edges.
 */
export const TILES = Object.freeze({
  diagonals: { label: 'Diagonals', hint: 'One diagonal per cell in each layer, an X in every cell' },
  arcs: { label: 'Arcs', hint: 'Quarter arcs that flow into curves, the second layer half a tile over' },
});
export const TILE_IDS = Object.freeze(Object.keys(TILES));

function arc(cx, cy, r, from, to) {
  const n = Math.max(6, Math.ceil((Math.abs(to - from) * r) / 0.5));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** The edges of one layer of arc tiles over a grid starting at (ox, oy). */
function arcEdges(ox, oy, cols, rows, s, rng) {
  const edges = [];
  const h = s / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = ox + i * s, y0 = oy + j * s, x1 = x0 + s, y1 = y0 + s;
      if (rng.next() < 0.5) {
        // centred on the top-left and bottom-right corners
        edges.push(arc(x0, y1, h, -Math.PI / 2, 0)); // top edge midpoint to left edge midpoint
        edges.push(arc(x1, y0, h, Math.PI / 2, Math.PI)); // bottom edge midpoint to right edge midpoint
      } else {
        // centred on the top-right and bottom-left corners
        edges.push(arc(x1, y1, h, Math.PI, 1.5 * Math.PI)); // top edge midpoint to right edge midpoint
        edges.push(arc(x0, y0, h, 0, Math.PI / 2)); // bottom edge midpoint to left edge midpoint
      }
    }
  }
  return edges;
}

/**
 * @param tile  'diagonals' | 'arcs'
 * @param size  tile size in mm
 * @param seed  random seed (the same seed gives the same pattern)
 */
export function truchetLayers(boundary, { tile = 'diagonals', size = 5, seed = 1 } = {}) {
  if (!TILES[tile]) throw new Error(`Unknown Truchet tile: ${tile}`);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const cols = Math.max(1, Math.floor(w / size)), rows = Math.max(1, Math.floor(h / size));
  const ox = box.minX + (w - cols * size) / 2, oy = box.minY + (h - rows * size) / 2;
  const rng = createRng(seed);

  const toLayer = (edges) => trailsFromEdges(edges).flatMap((t) => clipPolyline(densify(t), boundary));

  if (tile === 'diagonals') {
    const one = [], other = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x0 = ox + i * size, y0 = oy + j * size, x1 = x0 + size, y1 = y0 + size;
        const up = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
        const down = [{ x: x0, y: y1 }, { x: x1, y: y0 }];
        if (rng.next() < 0.5) { one.push(up); other.push(down); } else { one.push(down); other.push(up); }
      }
    }
    return { layers: [toLayer(one), toLayer(other)], extra: { cols, rows } };
  }

  // arcs: the second layer is a grid half a tile over, with a tile beyond each edge so it covers the swatch
  const first = arcEdges(ox, oy, cols, rows, size, rng);
  const second = arcEdges(ox - size / 2, oy - size / 2, cols + 1, rows + 1, size, rng);
  return { layers: [toLayer(first), toLayer(second)], extra: { cols, rows } };
}
