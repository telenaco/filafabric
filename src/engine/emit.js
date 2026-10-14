/**
 * Turns ordered strands into printable moves. Every strand-based design shares this: a lift and travel between
 * strands, an optional filament-change pause, and each point printed as its strand's class unless it carries its own.
 *
 * A strand is { id, kind: 'base' | 'supported', name, pts: [{ x, y, z, cls? }], pauseBefore? }.
 */
export function emitStrands(strands, { startLift = 5, travelLift = 3 } = {}) {
  const moves = [];
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
      moves.push(travel(cur.x, cur.y, safeZ));
      if (strand.pauseBefore) {
        moves.push(travel(cur.x, cur.y, safeZ, 'M600 ; Pause for filament color change', `Filament change pause before ${strand.name}`));
      }
      moves.push(travel(first.x, first.y, safeZ));
      moves.push(travel(first.x, first.y, first.z));
    }
    const kindClass = strand.kind === 'base' ? 'base' : 'supported';
    for (let i = 1; i < strand.pts.length; i++) {
      const p = strand.pts[i];
      moves.push({ x: p.x, y: p.y, z: p.z, cls: p.cls ?? kindClass, extrude: true, tag: strand.id });
    }
    cur = strand.pts[strand.pts.length - 1];
  }
  return moves;
}
