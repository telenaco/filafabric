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
  let top = 0;
  for (const m of [...before, ...after]) if (m.z > top) top = m.z;
  const last = before.at(-1);
  return [...before, { x: last.x, y: last.y, z: top + 3, cls: 'travel', extrude: false, retract: 'retract', retraction },
    ...after.map((m, i) => (i === k ? { ...m, retract: 'unretract', retraction } : m))];
}

/**
 * @param parts [{ moves, retraction, at: [x, y], tag }]: moves in the part's own coordinates, its retraction (the
 *              derived form, as cfg.derived.retraction), where its origin goes and a tag that keeps its strands apart
 * @returns the moves of the plate. The move into a part retracts with the settings of the part it leaves and primes
 *          the same back, so every retraction is primed back by what it pulled (and that part's extra).
 */
export function plateMoves(parts) {
  let moves = [], previous = null;
  for (const part of parts) {
    const [ox, oy] = part.at;
    const placed = part.moves.map((m) => ({ ...m, x: m.x + ox, y: m.y + oy, retraction: part.retraction, ...(m.tag ? { tag: `${part.tag}-${m.tag}` } : {}) }));
    moves = join(moves, placed, previous ?? part.retraction);
    previous = part.retraction;
  }
  const retracts = moves.filter((m) => m.retract === 'retract').length, primes = moves.filter((m) => m.retract === 'unretract').length;
  if (retracts !== primes) throw new Error(`the plate has ${retracts} retractions and ${primes} primes`);
  return moves;
}
