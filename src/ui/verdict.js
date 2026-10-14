// Turns engine numbers into a short, honest, plain-language verdict. Pure, tested in Node.

export function proportionPhrase(share) {
  if (!(share > 0)) return 'very few';
  if (share >= 0.15) return `${Math.max(1, Math.round(share * 10))} in 10`;
  if (share >= 0.02) return `1 in ${Math.round(1 / share)}`;
  return 'very few';
}

export function shareLabel(share) {
  const p = proportionPhrase(share);
  return p === 'very few' ? 'very few' : `about ${p}`;
}

export function formatMinutes(min) {
  return min >= 10 ? String(Math.round(min)) : min.toFixed(1);
}

/**
 * @param stats  engine stats ({ loops, violations, extrudingMoves })
 * @param opts   { roomy } whether the extra-room option is on
 * @returns {{ level: 'info'|'ok'|'heads-up', title, body, action: null|'roomy-on'|'roomy-off', actionLabel, share }}
 */
export function buildVerdict(stats, { roomy }) {
  const share = stats.violations / Math.max(1, stats.extrudingMoves);
  const phrase = shareLabel(share);

  if (stats.loops === 0) {
    return {
      level: 'info',
      title: 'No loops in this swatch',
      body: 'The swatch is smaller than one loop, or loops are switched off, so only the base will print.',
      action: null,
      actionLabel: '',
      share,
    };
  }
  if (share < 0.02) {
    return {
      level: 'ok',
      title: 'Looks good',
      body: 'Almost no moves pass close to a neighbouring loop.',
      action: roomy ? 'roomy-off' : null,
      actionLabel: roomy ? 'Undo extra room' : '',
      share,
    };
  }
  if (!roomy) {
    return {
      level: 'heads-up',
      title: 'Loops are tight in places',
      body: `${capitalise(phrase)} moves pass close to a neighbouring loop, so the nozzle may brush it. It will still print, and more room is safer for a first try.`,
      action: 'roomy-on',
      actionLabel: 'Give loops more room',
      share,
    };
  }
  if (share >= 0.2) {
    return {
      level: 'heads-up',
      title: 'Still tight in places',
      body: `${capitalise(phrase)} moves still pass close to a loop. Try fewer or smaller loops, or a lower pile.`,
      action: 'roomy-off',
      actionLabel: 'Undo extra room',
      share,
    };
  }
  return {
    level: 'ok',
    title: 'Looks workable',
    body: `${capitalise(phrase)} moves still pass close to a loop. That is normal for a first test: watch the first rows as it prints.`,
    action: 'roomy-off',
    actionLabel: 'Undo extra room',
    share,
  };
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
