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

/**
 * The Squiggle & Gyroid design prints two continuous layers with one lift between them, so there is
 * no neighbour for the nozzle to brush: the verdict says what will happen instead.
 * @param stats  engine stats ({ hops })
 * @param opts   { colorChange } whether the printer pauses for a filament swap between layers
 */
export function buildSquiggleVerdict(stats, { colorChange }) {
  const lifts = stats.hops === 1 ? 'one lift' : `${stats.hops} lifts`;
  return {
    level: 'ok',
    title: 'Ready to print',
    body: colorChange
      ? `Two continuous layers with ${lifts} between them. The printer pauses after the first layer so you can load the second colour.`
      : `Two continuous layers with ${lifts} between them, so there is nothing for the nozzle to brush.`,
    action: null,
    actionLabel: '',
    share: 0,
  };
}

/**
 * The Coil design is one continuous strand per outline piece that lifts over itself at crossings, so the verdict
 * says how many crossings there are and how steep the lifts are, or that the loops cannot form.
 * @param stats  engine stats ({ crossings, maxLift, maxSlopeDeg, hops })
 * @param opts   { loopsClose } the size is too small for the spacing, so the line only waves
 */
export function buildCoilVerdict(stats, { loopsClose = false } = {}) {
  const none = { action: null, actionLabel: '', share: 0 };
  if (loopsClose) {
    return {
      ...none,
      level: 'heads-up',
      title: 'The loops close up',
      body: 'At this size and spacing the line only waves. Make the loops larger or the spacing smaller so it circles over itself.',
    };
  }
  const lifts = stats.hops === 0 ? 'one unbroken strand with no lifts' : stats.hops === 1 ? 'one lift between strands' : `${stats.hops} lifts between strands`;
  if (!stats.crossings) {
    return { ...none, level: 'ok', title: 'Ready to print', body: `A single flat layer: nothing crosses, so loops and rows only touch. It prints as ${lifts}.` };
  }
  return {
    ...none,
    level: 'ok',
    title: 'Ready to print',
    body: `${stats.crossings.toLocaleString('en')} crossings, one layer thick: where strands cross, the later one lifts by up to ${stats.maxLift.toFixed(2)} mm (steepest rise ${Math.round(stats.maxSlopeDeg)}°). It prints as ${lifts}.`,
  };
}

const NONE = { action: null, actionLabel: '', share: 0 };

/**
 * Relief: one strand that rises and falls with a pattern. Says how high, how long a stretch hangs unsupported and
 * how steep it climbs, and warns when either is more than the strand is likely to hold.
 * @param relief  { peak, longestSpan, maxSlopeDeg } from the engine
 */
export function buildReliefVerdict(relief) {
  if (relief.peak < 0.05) {
    return { ...NONE, level: 'info', title: 'Nothing rises', body: 'With this pattern and relief no part of the strand leaves the bed, so it prints as flat rows. Raise the relief or choose a pattern with taller parts.' };
  }
  if (relief.maxSlopeDeg > 30) {
    return { ...NONE, level: 'heads-up', title: 'Steep in places', body: `The strand climbs as steeply as ${Math.round(relief.maxSlopeDeg)}°, more than it can follow cleanly. Lower the relief or make the pattern broader.` };
  }
  if (relief.longestSpan > 20) {
    return { ...NONE, level: 'heads-up', title: 'Long raised stretches', body: `One raised stretch is ${Math.round(relief.longestSpan)} mm long with nothing under it, and a flexible strand sags over that. Make the pattern finer or lower the relief.` };
  }
  return {
    ...NONE,
    level: 'ok',
    title: 'Ready to print',
    body: `The rows rise up to ${relief.peak.toFixed(1)} mm over stretches up to ${Math.round(relief.longestSpan)} mm, steepest ${Math.round(relief.maxSlopeDeg)}°. It prints as one strand with no lifts.`,
  };
}

/** Fringe: hairs anchored on a base, hanging free. Close hairs are the one thing to watch. */
export function buildFringeVerdict(stats, fringe) {
  if (fringe.hairs === 0) {
    return { ...NONE, level: 'info', title: 'No hairs', body: 'The swatch is shorter than one hair, so only the base will print.' };
  }
  const share = stats.violations / Math.max(1, stats.extrudingMoves);
  if (share < 0.02) {
    return { ...NONE, level: 'ok', title: 'Looks good', body: `${fringe.hairs} hairs on ${fringe.rows} rows, almost none passing close to a neighbour. Each hair is a lift, so the nozzle moves ${stats.hops} times.`, share };
  }
  return {
    ...NONE,
    level: 'heads-up',
    title: 'Hairs are close in places',
    body: `${shareLabel(share).replace(/^about /, '')} of the moves pass close to a neighbouring hair, so the nozzle may brush one. Space the hairs wider or the rows further apart for a first try.`,
    share,
  };
}

/** Spiral panel: rings joined by short jogs. */
export function buildSpiralVerdict(stats, spiral) {
  if (spiral.rings === 0) {
    return { ...NONE, level: 'info', title: 'Nothing to print', body: 'The panel is too narrow for a ring at this spacing. Use a closer spacing or a larger panel.' };
  }
  const lifts = stats.hops === 0 ? 'one unbroken strand with no lifts' : stats.hops === 1 ? 'one lift' : `${stats.hops} lifts`;
  return { ...NONE, level: 'ok', title: 'Ready to print', body: `${spiral.rings} rings following the edge, printed as ${lifts}.` };
}

/** Bouclé: rings standing on a line, alternately each side. */
export function buildBoucleVerdict(stats, { rings }) {
  if (!rings) {
    return { ...NONE, level: 'info', title: 'No rings', body: 'The swatch is narrower than one ring spacing, so each row is a plain line.' };
  }
  return {
    ...NONE,
    level: 'ok',
    title: 'Ready to print',
    body: `${rings} rings on the rows, one layer thick${stats.crossings ? `, ${stats.crossings} places where strands lie over each other` : ''}. It prints as ${stats.hops === 0 ? 'one unbroken strand with no lifts' : `${stats.hops} lifts between strands`}.`,
  };
}

/**
 * Weave: warp and weft in two levels. Honest about the cost: a lift for every piece, and the strands fuse where they
 * cross.
 */
export function buildWeaveVerdict(stats) {
  if (!stats.pieces) {
    return { ...NONE, level: 'info', title: 'Nothing to weave', body: 'The swatch is smaller than one line pitch.' };
  }
  return {
    ...NONE,
    level: 'info',
    title: 'Experimental: two passes',
    body: `${stats.crossings} crossings in ${stats.pieces} pieces: the lower strands print first, then the upper ones, with ${stats.hops} lifts between pieces. The nozzle cannot go under a printed strand, so this is a two-level weave, and strands fuse where they cross.`,
  };
}

/**
 * Any design made of a few layers of plotted lines. Says how well the layers hold together (crossings between them,
 * per cm², the longest strand with nothing crossing it) and warns about the one failure that matters: layers that
 * never cross.
 * @param result  { report, layerCount, stats }
 */
export function buildLayeredVerdict(result) {
  const r = result.report;
  if (!r || r.strands === 0) {
    return { ...NONE, level: 'info', title: 'Nothing to print', body: 'These settings leave nothing inside the swatch or outline. Use a larger swatch or finer settings.' };
  }
  if (r.components > 1) {
    return { ...NONE, level: 'heads-up', title: 'Separate pieces remain', body: `${r.components} disconnected regions remain after the geometric checks. Change the spacing or outline before exporting freestanding fabric.` };
  }
  if (result.layerCount > 1 && r.between === 0) {
    return { ...NONE, level: 'heads-up', title: 'The layers never cross', body: 'Lines that never cross anything can simply be peeled apart. Change an angle or an offset so the layers cross each other.' };
  }
  if (r.longestUncrossed > 60) {
    return { ...NONE, level: 'heads-up', title: 'Long free strands', body: `One strand runs ${Math.round(r.longestUncrossed)} mm without crossing anything, so it can sag or pull away. Use closer lines or add a direction.` };
  }
  const lifts = result.stats.hops === 0 ? 'one unbroken strand with no lifts' : result.stats.hops === 1 ? 'one lift' : `${result.stats.hops} lifts`;
  const between = result.layerCount > 1 ? `, ${r.between.toLocaleString('en')} between layers` : '';
  return {
    ...NONE,
    level: 'ok',
    title: 'Ready to print',
    body: `${r.crossings.toLocaleString('en')} crossings (${r.perCm2.toFixed(1)} per cm²${between}); the longest stretch with nothing crossing it is ${Math.round(r.longestUncrossed)} mm. It prints as ${lifts}.`,
  };
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
