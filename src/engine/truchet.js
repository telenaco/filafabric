import { createRng } from './rng.js';
import { clipPolyline, trailsFromEdges, densify } from './layers.js';
import { fitCount } from './repeats.js';

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

/** A quarter of an ellipse round (cx, cy) with half-axes rx, ry: a quarter circle when the tile is square. */
function quarter(cx, cy, rx, ry, from, to) {
  return arc(0, 0, 1, from, to).map((p) => ({ x: cx + rx * p.x, y: cy + ry * p.y }));
}

/** The edges of one layer of arc tiles over a grid starting at (ox, oy), tiles sx wide and sy high. */
function arcEdges(ox, oy, cols, rows, sx, sy, rng) {
  const edges = [];
  const hx = sx / 2, hy = sy / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = ox + i * sx, y0 = oy + j * sy, x1 = x0 + sx, y1 = y0 + sy;
      if (rng.next() < 0.5) {
        // centred on the top-left and bottom-right corners
        edges.push(quarter(x0, y1, hx, hy, -Math.PI / 2, 0)); // top edge midpoint to left edge midpoint
        edges.push(quarter(x1, y0, hx, hy, Math.PI / 2, Math.PI)); // bottom edge midpoint to right edge midpoint
      } else {
        // centred on the top-right and bottom-left corners
        edges.push(quarter(x1, y1, hx, hy, Math.PI, 1.5 * Math.PI)); // top edge midpoint to right edge midpoint
        edges.push(quarter(x0, y0, hx, hy, 0, Math.PI / 2)); // bottom edge midpoint to left edge midpoint
      }
    }
  }
  return edges;
}

/**
 * @param tile   'diagonals' | 'arcs'
 * @param size   tile size in mm
 * @param seed   random seed (the same seed gives the same pattern)
 * @param whole  whole tiles (repeats.js): the tiles fill the box exactly, each a little wider or taller than `size` so
 *               a whole number fits each way, and the second layer of arcs (half a tile over) keeps to the tiles that
 *               lie wholly inside; otherwise square tiles centred in the box and a second layer cut at the edge
 */
export function truchetLayers(boundary, { tile = 'diagonals', size = 5, seed = 1, whole = true } = {}) {
  if (!TILES[tile]) throw new Error(`Unknown Truchet tile: ${tile}`);
  const box = boundary.bbox();
  const w = box.maxX - box.minX, h = box.maxY - box.minY;
  const cols = whole ? fitCount(w, size) : Math.max(1, Math.floor(w / size));
  const rows = whole ? fitCount(h, size) : Math.max(1, Math.floor(h / size));
  const sx = whole ? w / cols : size, sy = whole ? h / rows : size;
  const ox = box.minX + (w - cols * sx) / 2, oy = box.minY + (h - rows * sy) / 2;
  const rng = createRng(seed);

  const toLayer = (edges) => trailsFromEdges(edges).flatMap((t) => clipPolyline(densify(t), boundary));

  if (tile === 'diagonals') {
    const one = [], other = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x0 = ox + i * sx, y0 = oy + j * sy, x1 = x0 + sx, y1 = y0 + sy;
        const up = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
        const down = [{ x: x0, y: y1 }, { x: x1, y: y0 }];
        if (rng.next() < 0.5) { one.push(up); other.push(down); } else { one.push(down); other.push(up); }
      }
    }
    return { layers: [toLayer(one), toLayer(other)], extra: { cols, rows } };
  }

  // arcs: the second layer is a grid half a tile over: only its whole tiles, or a tile beyond each edge, cut there
  const first = arcEdges(ox, oy, cols, rows, sx, sy, rng);
  const second = whole
    ? arcEdges(ox + sx / 2, oy + sy / 2, cols - 1, rows - 1, sx, sy, rng)
    : arcEdges(ox - sx / 2, oy - sy / 2, cols + 1, rows + 1, sx, sy, rng);
  return { layers: [toLayer(first), toLayer(second)], extra: { cols, rows } };
}
