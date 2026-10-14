/**
 * Lines of equal value in a field sampled on a grid (marching squares), open or closed. Cells with a missing corner
 * (NaN) or with corners further apart than `maxJump` are skipped, so a hole or a branch cut ends a line instead of
 * drawing a false one along it.
 */

/** Samples fn(x, y) on a grid one cell beyond the box on every side. */
export function sampleGrid(box, cell, fn) {
  const minX = box.minX - cell, minY = box.minY - cell;
  const nx = Math.ceil((box.maxX - box.minX) / cell) + 3;
  const ny = Math.ceil((box.maxY - box.minY) / cell) + 3;
  const data = new Float64Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) data[iy * nx + ix] = fn(minX + ix * cell, minY + iy * cell);
  }
  return { minX, minY, nx, ny, cell, data };
}

/**
 * @param field  { minX, minY, nx, ny, cell, data }
 * @returns polylines of { x, y }; a closed line repeats its first point at the end
 */
export function isoLines(field, level, { maxJump = Infinity } = {}) {
  const { nx, ny, data, minX, minY, cell } = field;
  const at = (ix, iy) => data[iy * nx + ix];
  const points = new Map();
  const edgeId = (ix, iy, horizontal) => (iy * nx + ix) * 2 + (horizontal ? 0 : 1);
  const crossing = (ax, ay, bx, by, horizontal) => {
    const id = edgeId(Math.min(ax, bx), Math.min(ay, by), horizontal);
    if (!points.has(id)) {
      const va = at(ax, ay), vb = at(bx, by);
      const t = (level - va) / (vb - va);
      points.set(id, { x: minX + (ax + (bx - ax) * t) * cell, y: minY + (ay + (by - ay) * t) * cell });
    }
    return id;
  };
  const next = new Map();
  const link = (a, b) => {
    if (!next.has(a)) next.set(a, []);
    if (!next.has(b)) next.set(b, []);
    next.get(a).push(b);
    next.get(b).push(a);
  };
  for (let iy = 0; iy + 1 < ny; iy++) {
    for (let ix = 0; ix + 1 < nx; ix++) {
      const v00 = at(ix, iy), v10 = at(ix + 1, iy), v11 = at(ix + 1, iy + 1), v01 = at(ix, iy + 1);
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v11) && Number.isFinite(v01))) continue;
      if (Math.max(v00, v10, v11, v01) - Math.min(v00, v10, v11, v01) > maxJump) continue;
      const code = (v00 >= level ? 1 : 0) | (v10 >= level ? 2 : 0) | (v11 >= level ? 4 : 0) | (v01 >= level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const bottom = () => crossing(ix, iy, ix + 1, iy, true);
      const top = () => crossing(ix, iy + 1, ix + 1, iy + 1, true);
      const left = () => crossing(ix, iy, ix, iy + 1, false);
      const right = () => crossing(ix + 1, iy, ix + 1, iy + 1, false);
      switch (code) {
        case 1: case 14: link(left(), bottom()); break;
        case 2: case 13: link(bottom(), right()); break;
        case 3: case 12: link(left(), right()); break;
        case 4: case 11: link(right(), top()); break;
        case 6: case 9: link(bottom(), top()); break;
        case 7: case 8: link(left(), top()); break;
        case 5: case 10: {
          const centre = (v00 + v10 + v11 + v01) / 4 >= level;
          if ((code === 5) === centre) { link(left(), top()); link(bottom(), right()); } else { link(left(), bottom()); link(right(), top()); }
          break;
        }
        default: break;
      }
    }
  }
  const lines = [];
  const seen = new Set();
  const walk = (start) => {
    const ids = [start];
    seen.add(start);
    let prev = null, cur = start;
    for (;;) {
      const around = next.get(cur) ?? [];
      const forward = around.find((id) => id !== prev && !seen.has(id));
      if (forward === undefined) {
        // closed if we are back next to the start
        if (ids.length > 2 && around.includes(start)) ids.push(start);
        break;
      }
      ids.push(forward);
      seen.add(forward);
      prev = cur;
      cur = forward;
    }
    if (ids.length >= 2) lines.push(ids.map((id) => ({ ...points.get(id) })));
  };
  // open lines first, from one of their ends, so they are walked whole; then the closed ones
  for (const [id, around] of next) if (around.length === 1 && !seen.has(id)) walk(id);
  for (const id of next.keys()) if (!seen.has(id)) walk(id);
  return lines;
}
