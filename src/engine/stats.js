import { moveSpeed, segmentE, filamentArea } from './extrusion.js';
import { startPosition } from './params.js';

/** Summary numbers for the UI and the G-code header. Time ignores acceleration. */
export function computeStats(moves, cfg, placements) {
  let pos = startPosition(cfg);
  let timeSec = 0;
  let filamentMm = 0;
  const lengthByClass = { base: 0, supported: 0, rising: 0, falling: 0, unsupported: 0, travel: 0 };
  const r = cfg.derived.retraction;
  let violations = 0;
  let hops = 0;
  let travelMm = 0;
  let extrudingMoves = 0;
  const strandTags = new Set();
  let previous = null;
  let previousExtruded = false;

  for (const m of moves) {
    const dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    const ds = Math.hypot(dx, dy, dz);
    pos = { x: m.x, y: m.y, z: m.z };
    if (m.extrude) {
      extrudingMoves++;
      strandTags.add(m.tag);
    } else if (previous) {
      // travel between strands only: the approach from the prime line is not a hop
      travelMm += Math.hypot(m.x - previous.x, m.y - previous.y);
      if (previousExtruded) hops++;
    }
    previous = m;
    previousExtruded = m.extrude;
    if (m.retract === 'retract') timeSec += r.length / r.speed;
    if (m.retract === 'unretract') timeSec += r.length / r.deretractSpeed;
    if (m.violation) violations++;
    if (ds < 1e-9) continue;
    timeSec += ds / moveSpeed(m.cls, dx, dy, dz, cfg);
    lengthByClass[m.cls] += ds;
    if (m.extrude) filamentMm += segmentE(ds, m.cls, cfg);
  }

  let maxSlope = 0;
  for (const p of placements) {
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1], b = p.points[i];
      const dxy = Math.hypot(b.x - a.x, b.y - a.y);
      if (dxy > 1e-9) maxSlope = Math.max(maxSlope, Math.abs(b.z - a.z) / dxy);
    }
  }

  const volumeMm3 = filamentMm * filamentArea(cfg.derived.filamentDiameter);
  return {
    timeSec,
    filamentMm,
    filamentGrams: (volumeMm3 / 1000) * cfg.material.density,
    loops: placements.length,
    maxSlopeDeg: (Math.atan(maxSlope) * 180) / Math.PI,
    violations,
    lengthByClass,
    moves: moves.length,
    extrudingMoves,
    strands: strandTags.size,
    hops,
    travelMm,
  };
}
