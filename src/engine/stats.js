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
  const moveStartSec = new Float64Array(moves.length);
  let moveIndex = 0;

  for (const m of moves) {
    moveStartSec[moveIndex++] = timeSec;
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
    // a move may carry its own retraction (gcode.js)
    const mr = m.retraction ?? r;
    if (m.retract === 'retract') timeSec += mr.length / mr.speed;
    if (m.retract === 'unretract') {
      // the extra push after a travel is filament laid down, as much as any extrusion
      timeSec += (mr.length + (mr.restartExtra ?? 0)) / mr.deretractSpeed;
      filamentMm += mr.restartExtra ?? 0;
    }
    if (m.violation) violations++;
    if (ds < 1e-9) continue;
    timeSec += ds / moveSpeed(m.cls, dx, dy, dz, cfg, m.flow ?? 1);
    lengthByClass[m.cls] += ds;
    if (m.extrude) filamentMm += segmentE(ds, m.cls, cfg, m.flow ?? 1);
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
    moveStartSec,
  };
}
