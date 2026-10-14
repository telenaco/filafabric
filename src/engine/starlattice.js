import { clipPolyline, chainPolylines, densify } from './layers.js';
import { orderLines } from './flowlines.js';
import { ConfigError } from './params.js';
import { findCrossings } from './crossings.js';

/**
 * Star lattice: Islamic geometric patterns (girih) by Hankin's polygons-in-contact method. A tiling is laid under
 * the fabric; from the middle of every edge two rays leave at the contact angle, one leaning towards each end of the
 * edge, and each ray stops where it meets the ray from the next edge round the same corner. The rays carry straight on
 * through the edge into the next tile, so they join into long zigzag straps that cross at every edge midpoint. The
 * straps fall into families that never cross each other (two on a square tiling, three on a hexagonal one); each
 * family is one layer, so every crossing is a crossing between layers and stars and rosettes appear between them.
 */

const TAU = Math.PI * 2;
export const MAX_FACES = 3000;

export const STAR_TILINGS = Object.freeze({
  square: { label: 'Squares', hint: 'Four- and eight-pointed stars in a square grid', angle: 67.5 },
  hexagon: { label: 'Hexagons', hint: 'Six-pointed stars and rosettes, in three layers', angle: 70 },
  octagon: { label: 'Octagons and squares', hint: 'Eight-pointed stars, the classic girih, in four layers', angle: 67.5 },
});
export const STAR_TILING_IDS = Object.freeze(Object.keys(STAR_TILINGS));

const regular = (cx, cy, r, n, start) => Array.from({ length: n }, (_, k) => ({ x: cx + r * Math.cos(start + (TAU * k) / n), y: cy + r * Math.sin(start + (TAU * k) / n) }));

/** The faces (anticlockwise polygons) of a tiling with edges `side` mm long, covering the box. */
export function tilingFaces(tiling, box, side) {
  const faces = [];
  const pad = 2 * side;
  const minX = box.minX - pad, maxX = box.maxX + pad, minY = box.minY - pad, maxY = box.maxY + pad;
  const push = (f) => {
    faces.push(f);
    if (faces.length > MAX_FACES) throw new ConfigError([`This would need more than ${MAX_FACES} tiles; use larger tiles or a smaller swatch.`]);
  };
  if (tiling === 'square') {
    for (let y = Math.floor(minY / side) * side; y < maxY; y += side) {
      for (let x = Math.floor(minX / side) * side; x < maxX; x += side) push([{ x, y }, { x: x + side, y }, { x: x + side, y: y + side }, { x, y: y + side }]);
    }
  } else if (tiling === 'hexagon') {
    const dx = side * Math.sqrt(3), dy = 1.5 * side;
    for (let j = Math.floor(minY / dy) - 1; j * dy < maxY + dy; j++) {
      for (let i = Math.floor(minX / dx) - 1; i * dx < maxX + dx; i++) push(regular((i + (j % 2 ? 0.5 : 0)) * dx, j * dy, side, 6, Math.PI / 6));
    }
  } else if (tiling === 'octagon') {
    // octagons on a square lattice, the gaps between four of them small squares standing on a corner
    const step = side * (1 + Math.SQRT2);
    const R8 = side / (2 * Math.sin(Math.PI / 8));
    for (let j = Math.floor(minY / step) - 1; j * step < maxY + step; j++) {
      for (let i = Math.floor(minX / step) - 1; i * step < maxX + step; i++) {
        push(regular(i * step, j * step, R8, 8, Math.PI / 8));
        push(regular((i + 0.5) * step, (j + 0.5) * step, side / Math.SQRT2, 4, 0));
      }
    }
  } else {
    throw new Error(`Unknown tiling: ${tiling}`);
  }
  return faces;
}

/** Where the lines p + s·u and q + t·v meet, or null when they are parallel. */
function meet(p, u, q, v) {
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-12) return null;
  const s = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / det;
  return { x: p.x + s * u.x, y: p.y + s * u.y, s };
}

/**
 * The straps of the pattern, as polylines. Each face contributes, at each corner, two rays: from the middle of the
 * edge before the corner and the edge after it, meeting near the corner. A strap is followed across faces: a ray
 * that reaches an edge midpoint carries straight on into the neighbouring face.
 */
export function hankinStraps(faces, angleDeg) {
  const th = (angleDeg * Math.PI) / 180;
  const key = (p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
  // half-segments: for face f and edge i, 'a' runs from the edge midpoint to the corner point after it, 'b' from the
  // midpoint to the corner point before it
  const mids = new Map(); // midpoint key -> [{ f, i }]
  const corner = faces.map((poly) => {
    const n = poly.length;
    const mid = poly.map((v, i) => ({ x: (v.x + poly[(i + 1) % n].x) / 2, y: (v.y + poly[(i + 1) % n].y) / 2 }));
    const dir = poly.map((v, i) => {
      const w = poly[(i + 1) % n];
      const len = Math.hypot(w.x - v.x, w.y - v.y);
      return { x: (w.x - v.x) / len, y: (w.y - v.y) / len };
    });
    // the rays that meet at corner i + 1: 'a' of edge i (the edge turned in by the contact angle) and 'b' of edge
    // i + 1 (the edge reversed and turned in the other way); the inside of an anticlockwise polygon is to the left
    return poly.map((_, i) => {
      const j = (i + 1) % n;
      const d = dir[i], e = dir[j];
      const a = { x: Math.cos(th) * d.x - Math.sin(th) * d.y, y: Math.sin(th) * d.x + Math.cos(th) * d.y };
      const b = { x: -Math.cos(th) * e.x - Math.sin(th) * e.y, y: -Math.cos(th) * e.y + Math.sin(th) * e.x };
      const p = meet(mid[i], a, mid[j], b);
      return p && p.s > 0 ? { x: p.x, y: p.y } : null;
    }).map((p, i) => ({ p, mid: mid[i], nextMid: mid[(i + 1) % n] }));
  });
  faces.forEach((poly, f) => poly.forEach((_, i) => {
    const k = key(corner[f][i].mid);
    if (!mids.has(k)) mids.set(k, []);
    mids.get(k).push({ f, i });
  }));

  // walk: a strap alternates corner turns (inside a face) and straight crossings (through an edge midpoint)
  const used = new Set();
  const straps = [];
  const id = (f, i, kind) => `${f}:${i}:${kind}`;
  const step = (f, i, kind) => {
    // from half-segment (f, i, kind) at its midpoint, through the corner point, to the next midpoint
    const n = faces[f].length;
    if (kind === 'a') return { f, i: (i + 1) % n, kind: 'b', via: corner[f][i].p };
    const prev = (i - 1 + n) % n;
    return { f, i: prev, kind: 'a', via: corner[f][prev].p };
  };
  const across = (f, i, kind) => {
    const list = mids.get(key(corner[f][i].mid)) ?? [];
    const other = list.find((o) => o.f !== f);
    return other ? { f: other.f, i: other.i, kind } : null;
  };
  for (let f0 = 0; f0 < faces.length; f0++) {
    for (let i0 = 0; i0 < faces[f0].length; i0++) {
      for (const kind0 of ['a', 'b']) {
        if (used.has(id(f0, i0, kind0))) continue;
        // go backwards first to find one end (or come round a closed strap), then forwards collecting points
        let cur = { f: f0, i: i0, kind: kind0 };
        for (let guard = 0; guard < 100000; guard++) {
          const back = across(cur.f, cur.i, cur.kind);
          if (!back) break;
          const prev = step(back.f, back.i, back.kind);
          if (!prev.via) break;
          if (prev.f === f0 && prev.i === i0 && prev.kind === kind0) break;
          cur = { f: prev.f, i: prev.i, kind: prev.kind };
          if (cur.f === f0 && cur.i === i0 && cur.kind === kind0) break;
        }
        const pts = [];
        for (let guard = 0; guard < 100000; guard++) {
          if (used.has(id(cur.f, cur.i, cur.kind))) break;
          const next = step(cur.f, cur.i, cur.kind);
          if (!next.via) break;
          used.add(id(cur.f, cur.i, cur.kind));
          used.add(id(next.f, next.i, next.kind));
          if (!pts.length) pts.push(corner[cur.f][cur.i].mid);
          pts.push(next.via, corner[next.f][next.i].mid);
          const over = across(next.f, next.i, next.kind);
          if (!over) break;
          cur = over;
        }
        if (pts.length >= 3) straps.push(pts);
      }
    }
  }
  return straps;
}

/**
 * Shares the straps out between as few layers as keep crossing straps apart (greedy, most constrained first): the
 * straps of one family never cross each other, so this finds the families.
 */
export function colourStraps(straps, maxLayers = 4) {
  const { found } = findCrossings(straps.map((pts) => ({ pts })), { strandWidth: 0.1 });
  const adj = straps.map(() => new Set());
  for (const c of found) if (c.sa !== c.sb) { adj[c.sa].add(c.sb); adj[c.sb].add(c.sa); }
  const colour = new Array(straps.length).fill(-1);
  for (let done = 0; done < straps.length; done++) {
    // the uncoloured strap with the most differently coloured neighbours, then the most neighbours
    let pick = -1, bestSat = -1, bestDeg = -1;
    for (let i = 0; i < straps.length; i++) {
      if (colour[i] >= 0) continue;
      const sat = new Set([...adj[i]].map((j) => colour[j]).filter((c) => c >= 0)).size;
      if (sat > bestSat || (sat === bestSat && adj[i].size > bestDeg)) { pick = i; bestSat = sat; bestDeg = adj[i].size; }
    }
    const taken = new Map();
    for (const j of adj[pick]) if (colour[j] >= 0) taken.set(colour[j], (taken.get(colour[j]) ?? 0) + 1);
    let c = 0;
    while (taken.has(c) && c < maxLayers - 1) c++;
    if (taken.has(c)) {
      // no free layer: the one it crosses least (those few crossings lift, like any strand crossing itself)
      c = 0;
      for (let k = 1; k < maxLayers; k++) if ((taken.get(k) ?? 0) < (taken.get(c) ?? 0)) c = k;
    }
    colour[pick] = c;
  }
  return colour;
}

/**
 * @param tiling  a key of STAR_TILINGS
 * @param size    mm: the edge length of the tiles
 * @param angle   contact angle in degrees (how far the rays lean from the edge): 45 gives plain crossing lines,
 *                larger angles sharper stars
 */
export function starLayers(boundary, { tiling = 'square', size = 8, angle = null } = {}) {
  const t = STAR_TILINGS[tiling];
  if (!t) throw new Error(`Unknown tiling: ${tiling}`);
  const box = boundary.bbox();
  const faces = tilingFaces(tiling, box, size);
  const straps = hankinStraps(faces, angle ?? t.angle);
  // only the straps that reach the swatch
  const inside = straps.filter((pts) => pts.some((p) => p.x > box.minX - size && p.x < box.maxX + size && p.y > box.minY - size && p.y < box.maxY + size));
  const colour = colourStraps(inside, 4);
  const count = Math.max(...colour) + 1;
  const layers = Array.from({ length: count }, (_, k) => {
    const pieces = inside.filter((_, i) => colour[i] === k).flatMap((pts) => clipPolyline(densify(pts), boundary));
    return chainPolylines(orderLines(pieces), boundary, 0.6 * size);
  });
  return { layers, extra: { tiling, straps: inside.length, families: count } };
}
