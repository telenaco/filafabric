import { buildBrimStrands, insetRings } from './brim.js';
import { ConfigError } from './params.js';
import { PolygonBoundary } from './boundary.js';
import { serpentineChains } from './fill.js';
import { segmentInside, segmentContact, clipStrands, simplifyStrands } from './fabric.js';
import { offsetPolyline } from './drawing.js';

export function validatePerimeters(count) {
  if (!Number.isInteger(count) || count < 0 || count > 50) throw new ConfigError(['Perimeters must be an integer from 0 to 50.']);
  return count;
}

const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

/** Explicit inside walls, followed by a dense core. All coordinates are bead centrelines, in mm. */
export function perimeterFill(ring, { bead, overlap, perimeters, holes, edged, angle, coil, legacy }) {
  validatePerimeters(perimeters);
  const pitch = bead * (1 - overlap);
  // An SVG hole edge already printed as a stroke counts toward the rim. Keep the old overlap with that stroke.
  const adjustedHoles = holes.map((h, i) => {
    if (!edged[i]) return h;
    const area = h.reduce((n, p, k) => { const q = h[(k + 1) % h.length]; return n + p.x * q.y - q.x * p.y; }, 0);
    const cw = area > 0 ? h.toReversed() : h;
    return offsetPolyline([...cw, cw[0]], pitch - bead / 2).slice(0, -1);
  });
  const source = [ring, ...adjustedHoles];
  const walls = buildBrimStrands(source, { count: perimeters, strandWidth: bead }).map((s) => s.pts.map(({ x, y }) => ({ x, y })));
  const out = [...walls];
  const core = insetRings(source, bead / 2 + perimeters * pitch);
  if (core.length) {
    if (coil && !holes.length && core.length === 1) {
      // The coil's own bead inset supplies the half-bead clearance.
      const inner = insetRings(source, perimeters * pitch);
      if (inner.length === 1) out.push(coil(inner[0]));
    } else {
      const turned = new PolygonBoundary(core.map((r) => r.map((p) => rotate(p, -angle))));
      const safeRings = insetRings(source, bead / 2);
      const safe = new PolygonBoundary(safeRings.map((r) => r.map((p) => rotate(p, -angle))));
      const box = turned.bbox(), span = box.maxY - box.minY;
      const count = Math.max(1, Math.ceil(span / pitch - 1e-9) + 1);
      const lanes = count === 1 ? [(box.minY + box.maxY) / 2] : Array.from({ length: count }, (_, k) => box.minY + span * k / (count - 1));
      const chains = serpentineChains(turned, 'y', lanes.map((y, k) => y + (k === 0 ? 1e-4 : k === count - 1 ? -1e-4 : 0)), {
        inset: 1e-4, minLength: 1e-4, maxJog: 4 * pitch, gap: 0,
        allowConnector: (a, b) => segmentInside(a, b, safe),
      });
      for (const chain of chains) out.push(chain.flatMap((s) => [{ x: s.from, y: s.c }, { x: s.to, y: s.c }]).map((p) => rotate(p, angle)));
    }
  }
  // Offset walls can close a narrow neck before its centre is filled. Retain the portions of the old fill
  // not covered by either the new walls or core, instead of dropping that existing detail.
  if (perimeters > 0) {
    const material = new PolygonBoundary(source);
    const safeLegacy = clipStrands(legacy().map((pts) => ({ pts: pts.map((p) => ({ ...p, z: 0 })) })), material, bead / 2 + 1e-6);
    out.push(...uncoveredDetail(safeLegacy.map((s) => s.pts), out, bead));
  }
  const material = new PolygonBoundary(source);
  return simplifyStrands(out.map((pts) => ({ pts: pts.map((p) => ({ ...p, z: 0 })) })), 0.005, {
    allowSegment: (a, b) => segmentInside(a, b, material, bead / 2),
  }).map((s) => s.pts.map(({ x, y }) => ({ x, y })));
}

function uncoveredDetail(paths, printed, bead) {
  const cell = bead * 2, grid = new Map(), radius = bead * 0.49;
  for (const pts of printed) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let x = Math.floor((Math.min(a.x, b.x) - radius) / cell); x <= Math.floor((Math.max(a.x, b.x) + radius) / cell); x++) {
      for (let y = Math.floor((Math.min(a.y, b.y) - radius) / cell); y <= Math.floor((Math.max(a.y, b.y) + radius) / cell); y++) {
        const key = `${x},${y}`, entries = grid.get(key) ?? []; entries.push([a, b]); grid.set(key, entries);
      }
    }
  }
  const covered = (p) => (grid.get(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`) ?? []).some(([a, b]) => segmentContact(p, p, a, b).distance <= radius);
  const out = [];
  for (const pts of paths) {
    let run = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (bead / 5)));
      for (let k = 0; k < n; k++) {
        const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        if (covered(at((k + 0.5) / n))) { run = null; continue; }
        const start = at(k / n), end = at((k + 1) / n);
        if (!run) { run = [start]; out.push(run); }
        run.push(end);
      }
    }
  }
  return out;
}
