import { segmentE, filamentArea } from './extrusion.js';
import { startPosition } from './params.js';
import { moveSpeedOf, GcodeWriter } from './gcode.js';

/** timeSec/moveStartSec retain the commanded-body playback clock. estimatedTimeSec
 * additionally models acceleration on the actual rounded start/body/end G-code. */
export function computeStats(moves, cfg, placements) {
  let pos = startPosition(cfg);
  let timeSec = 0;
  const timeByKind = { extrusion: 0, travel: 0, retraction: 0, unretraction: 0 };
  let retractions = 0, travelMoves = 0, pulling = false, minPrintZ = Infinity, maxPrintZ = -Infinity;
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
  const timingWriter = new GcodeWriter(cfg);
  timingWriter.header();
  let moveIndex = 0;

  for (const m of moves) {
    timingWriter.move(m);
    moveStartSec[moveIndex++] = timeSec;
    const dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    const ds = Math.hypot(dx, dy, dz);
    const fromZ = pos.z;
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
    if (m.retract === 'retract') { const seconds = mr.length / mr.speed; timeSec += seconds; timeByKind.retraction += seconds; retractions++; }
    if (m.pull > 0 && !pulling) retractions++;
    pulling = m.pull > 0;
    if (m.retract === 'unretract') {
      // the extra push after a travel is filament laid down, as much as any extrusion
      const seconds = (mr.length + (mr.restartExtra ?? 0)) / mr.deretractSpeed;
      timeSec += seconds; timeByKind.unretraction += seconds;
      filamentMm += mr.restartExtra ?? 0;
    }
    if (m.violation) violations++;
    if (ds < 1e-9) continue;
    const seconds = ds / moveSpeedOf(m, dx, dy, dz, ds, cfg, mr);
    timeSec += seconds; timeByKind[m.extrude ? 'extrusion' : 'travel'] += seconds;
    if (m.extrude) { minPrintZ = Math.min(minPrintZ, fromZ, m.z); maxPrintZ = Math.max(maxPrintZ, fromZ, m.z); } else travelMoves++;
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
  timingWriter.footer();
  const motionEstimate = timingWriter.motionEstimate;
  return {
    timeSec, timeByKind, retractions, travelMoves,
    estimatedTimeSec: motionEstimate.estimatedTimeSec,
    motionEstimate,
    extrusionRangeZ: { min: Number.isFinite(minPrintZ) ? minPrintZ : null, max: Number.isFinite(maxPrintZ) ? maxPrintZ : null },
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
