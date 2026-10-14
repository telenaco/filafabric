/**
 * Turns ordered strands into printable moves. Every strand-based design shares this: a lift and travel between
 * strands, an optional filament-change pause, and each point printed as its strand's class unless it carries its own.
 *
 * A strand is { id, kind: 'base' | 'supported', name, pts: [{ x, y, z, cls? }], pauseBefore? }.
 * `retraction` ({ length, minTravel } from cfg.derived.retraction) switches on retract and prime around long travels.
 */
export function emitStrands(strands, { startLift = 5, travelLift = 3, retraction = null } = {}) {
  const moves = [];
  let pendingUnretract = false;
  const travel = (x, y, z, customGcode, comment) => ({ x, y, z, cls: 'travel', extrude: false, customGcode, comment });
  let cur = null;
  for (const strand of strands) {
    if (strand.pts.length < 2) continue;
    const first = strand.pts[0];
    if (cur === null) {
      moves.push(travel(first.x, first.y, first.z + startLift));
      moves.push(travel(first.x, first.y, first.z));
    } else {
      const safeZ = Math.max(cur.z, first.z) + travelLift;
      const lift = travel(cur.x, cur.y, safeZ);
      // a long enough travel retracts first and primes again at the start of the next strand (as the loop pile does)
      if (retraction && retraction.length > 0 && Math.hypot(first.x - cur.x, first.y - cur.y) >= retraction.minTravel) {
        lift.retract = 'retract';
        pendingUnretract = true;
      }
      moves.push(lift);
      if (strand.pauseBefore) {
        moves.push(travel(cur.x, cur.y, safeZ, 'M600 ; Pause for filament color change', `Filament change pause before ${strand.name}`));
      }
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    }
    const kindClass = strand.kind === 'base' ? 'base' : 'supported';
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      const move = { x: p.x, y: p.y, z: p.z, cls: p.cls ?? kindClass, extrude: true, tag: strand.id };
      if (i === 1 && pendingUnretract) {
        move.retract = 'unretract';
        pendingUnretract = false;
      }
      moves.push(move);
    }
    cur = strand.pts[strand.pts.length - 1];
  }
  return moves;
}
