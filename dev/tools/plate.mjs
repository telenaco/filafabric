// Several test prints with their own settings on one bed (used by the test-print scripts in this folder): each part's
// moves are shifted to its place and printed one part after the other, every move carrying the part's own retraction
// (the G-code writer reads a move's own before the filament's).

/**
 * `before` then `after`, joined by a lift that retracts with `retraction`, and the prime that balances it on the first
 * print of `after`. `after` must start the way emitStrands starts: travels, then a print with no retraction of its own.
 */
export function join(before, after, retraction) {
  if (!before.length) return after;
  const k = after.findIndex((m) => m.extrude);
  if (after.slice(0, k + 1).some((m) => m.retract)) throw new Error('a part starts with a retraction of its own');
  // 3 mm over the highest thing printed (not over the travels: they would raise every next lift by 3 mm)
  let top = 0;
  for (const m of [...before, ...after]) if (m.extrude && m.z > top) top = m.z;
  const last = before.at(-1);
  return [...before, { x: last.x, y: last.y, z: top + 3, cls: 'travel', extrude: false, retract: 'retract', retraction },
    ...after.map((m, i) => (i === k ? { ...m, retract: 'unretract', retraction } : m))];
}

/**
 * @param parts [{ moves, retraction, at: [x, y], tag, startGcode? }]: moves in the part's own coordinates, its retraction
 *              (the derived form, as cfg.derived.retraction), where its origin goes, a tag that keeps its strands apart,
 *              and G-code to send before it (a temperature to wait for), sent once the nozzle is lifted clear
 * @returns the moves of the plate. The move into a part retracts with the settings of the part it leaves and primes
 *          the same back, so every retraction is primed back by what it pulled (and that part's extra).
 */
export function plateMoves(parts) {
  let moves = [], previous = null;
  for (const part of parts) {
    const [ox, oy] = part.at;
    const placed = part.moves.map((m) => ({ ...m, x: m.x + ox, y: m.y + oy, retraction: part.retraction, ...(m.tag ? { tag: `${part.tag}-${m.tag}` } : {}) }));
    if (part.startGcode) placed[0] = { ...placed[0], customGcode: part.startGcode };
    moves = join(moves, placed, previous ?? part.retraction);
    previous = part.retraction;
  }
  // every millimetre pulled in (by a retraction, or by a wipe as it moves) is pushed back, besides the extras
  let pulled = 0, pushed = 0;
  for (const m of moves) {
    if (m.retract === 'retract') pulled += m.retraction.length;
    if (m.pull > 0) pulled += m.pull;
    if (m.retract === 'unretract') pushed += m.retraction.length;
  }
  if (Math.abs(pulled - pushed) > 1e-6) throw new Error(`the plate pulls in ${pulled.toFixed(3)} mm and pushes back ${pushed.toFixed(3)} mm`);
  return moves;
}
