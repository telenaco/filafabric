// Pictures for the options a design's own geometry cannot show at the size of a button: how a backing is laid, how many
// backing layers, whether a centre is filled, how two layers lie, what part of a drawing is printed. Each is a 48 x 32
// SVG string in the preview's role colours (layer 1 in the base colour, later layers in the second), so it follows the
// light and dark themes. Static markup, no user input. Keyed by "design:setting", then by option id.

const B = 'var(--role-base)', A = 'var(--role-anchored)', L = 'var(--role-lifting)', INK = 'var(--ink-2)';
const f = (n) => Number(n.toFixed(1));
const icon = (body) => `<svg class="shape-thumb option-thumb" width="48" height="32" viewBox="0 0 48 32" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const path = (d, stroke, width = null) => `<path d="${d}" stroke="${stroke}"${width ? ` stroke-width="${width}"` : ''}/>`;
const line = (x0, y0, x1, y1, stroke, width = null) => path(`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`, stroke, width);

/** A sine wave across the picture at height y (or down it at x, when vertical). */
function wave(at, { amp = 2.5, length = 10, phase = 0, vertical = false, from = 3, to = vertical ? 29 : 45 } = {}) {
  const pts = [];
  for (let t = from; t <= to + 1e-9; t += 1) {
    const off = at + amp * Math.sin((2 * Math.PI * (t - from)) / length + phase);
    pts.push(vertical ? [off, t] : [t, off]);
  }
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
}

/** A zigzag across the picture at height y (or down it at x). */
function zigzag(at, { amp = 2.5, step = 4, vertical = false, from = 3, to = vertical ? 29 : 45 } = {}) {
  const pts = [];
  for (let t = from, k = 0; t <= to + 1e-9; t += step, k++) {
    const off = at + (k % 2 ? amp : -amp);
    pts.push(vertical ? [off, t] : [t, off]);
  }
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
}

/** Horizontal hatch lines inside a circle (the stand-in for an imported drawing's closed shape). */
function circleHatch(cx, cy, r, gap, stroke) {
  let d = '';
  for (let y = cy - r + gap / 2; y < cy + r; y += gap) {
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
    if (half > 0.8) d += `M${f(cx - half)} ${f(y)}L${f(cx + half)} ${f(y)}`;
  }
  return path(d, stroke, 1.4);
}
const circle = (cx, cy, r, stroke, width = 1.8) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${stroke}" stroke-width="${width}"/>`;

/** Lines of the given spacing across a box. */
function boxHatch(x0, y0, x1, y1, gap, stroke) {
  let d = '';
  for (let y = y0 + gap / 2; y < y1; y += gap) d += `M${x0} ${f(y)}L${x1} ${f(y)}`;
  return path(d, stroke, 1.4);
}

/** Spokes from radius r0 to r1 round a centre, as a web or a rosette has them. */
function spokes(cx, cy, r0, r1, n, stroke) {
  let d = '';
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n + Math.PI / n;
    d += `M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))}L${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}`;
  }
  return path(d, stroke, 1.5);
}

/** A flat spiral filling a disc: the solid centre. */
function discSpiral(cx, cy, r, turns, stroke) {
  const pts = [];
  for (let t = 0; t <= turns * 2 * Math.PI; t += 0.25) pts.push([cx + (r * t) / (turns * 2 * Math.PI) * Math.cos(t), cy + (r * t) / (turns * 2 * Math.PI) * Math.sin(t)]);
  return path(pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(''), stroke, 1.4);
}

/** A line whose thickness changes along it: thin, thick, thin (or the other way round), as a halftone net prints. */
function swelling(horizontal, at, widths, stroke) {
  const cuts = horizontal ? [3, 17, 31, 45] : [3, 12, 21, 29];
  return widths.map((w, i) => (horizontal ? line(cuts[i], at, cuts[i + 1], at, stroke, w) : line(at, cuts[i], at, cuts[i + 1], stroke, w))).join('');
}

const BACKING_STYLE = {
  wave: icon(path(wave(8), A) + path(wave(16), A) + path(wave(24), A)),
  gyroid: icon(path(wave(6, { amp: 4, phase: Math.PI }), A) + path(wave(16, { amp: 4 }), A) + path(wave(26, { amp: 4, phase: Math.PI }), A)),
  straight: icon(line(3, 8, 45, 8, A) + line(3, 16, 45, 16, A) + line(3, 24, 45, 24, A)),
};

const BACKING_COUNT = {
  one: icon(path(wave(10), A) + path(wave(22), A)),
  two: icon(path(wave(10), A) + path(wave(22), A) + path(wave(16, { vertical: true }), L) + path(wave(32, { vertical: true }), L)),
};

const HUB = {
  solid: icon(circle(24, 16, 13, B, 1.4) + spokes(24, 16, 6, 13, 8, B) + discSpiral(24, 16, 6, 3, A)),
  open: icon(circle(24, 16, 13, B, 1.4) + spokes(24, 16, 6, 13, 8, B) + circle(24, 16, 6, B, 1.4)),
};

export const OPTION_ICONS = {
  // Zigzag mesh: how the two layers lie
  'zigzag:mode': {
    parallel: icon(path(zigzag(7), B) + path(zigzag(16), A) + path(zigzag(25), B)),
    cross: icon(path(zigzag(9), B) + path(zigzag(23), B) + path(zigzag(16, { vertical: true }), A) + path(zigzag(32, { vertical: true }), A)),
  },
  // Drawing & infill (svgdesign): what the drawing becomes
  'svgdesign:mode': {
    outline: icon(circle(24, 16, 11, INK, 2)),
    fill: icon(circleHatch(24, 16, 11, 3, B)),
    both: icon(circleHatch(24, 16, 11, 3, B) + circle(24, 16, 11, INK, 2)),
  },
  'svgdesign:backing': {
    none: icon(circleHatch(24, 16, 9, 3, B) + circle(24, 16, 9, INK)),
    one: icon(path(wave(6), A, 1.2) + path(wave(16), A, 1.2) + path(wave(26), A, 1.2) + circle(24, 16, 9, INK)),
    two: icon(path(wave(6), A, 1.2) + path(wave(16), A, 1.2) + path(wave(26), A, 1.2) + path(wave(12, { vertical: true }), L, 1.2) + path(wave(36, { vertical: true }), L, 1.2) + circle(24, 16, 9, INK)),
  },
  'svgdesign:backingArea': {
    swatch: icon(boxHatch(3, 2, 45, 30, 4, A) + circle(24, 16, 9, INK)),
    shape: icon(circleHatch(24, 16, 9, 4, A) + circle(24, 16, 9, INK)),
    box: icon(boxHatch(15, 7, 33, 25, 4, A) + circle(24, 16, 9, INK)),
  },
  // the backing under a meander or Turing pattern
  'meander:backing': BACKING_STYLE,
  'turing:backing': BACKING_STYLE,
  'meander:backingLayers': BACKING_COUNT,
  'turing:backingLayers': BACKING_COUNT,
  // a filled or an open centre
  'web:hubStyle': HUB,
  'rosette:hubStyle': HUB,
  'sunflower:hubStyle': HUB,
  'spirograph:hubStyle': HUB,
  // halftone net: the second layer repeats the picture or takes its opposite
  'halftone:second': {
    same: icon(swelling(true, 9, [1, 3.2, 1], B) + swelling(true, 23, [1, 3.2, 1], B) + swelling(false, 17, [1, 3.2, 1], A) + swelling(false, 31, [1, 3.2, 1], A)),
    complement: icon(swelling(true, 9, [1, 3.2, 1], B) + swelling(true, 23, [1, 3.2, 1], B) + swelling(false, 17, [3.2, 1, 3.2], A) + swelling(false, 31, [3.2, 1, 3.2], A)),
  },
  // spiral rings: alone, or crossed by lines across them
  'spiral:second': {
    none: icon(`<rect x="5" y="3" width="38" height="26" rx="5" stroke="${B}"/><rect x="11" y="8" width="26" height="16" rx="3" stroke="${B}"/><rect x="17" y="13" width="14" height="6" rx="2" stroke="${B}"/>`),
    normals: icon(`<rect x="5" y="3" width="38" height="26" rx="5" stroke="${B}"/><rect x="11" y="8" width="26" height="16" rx="3" stroke="${B}"/><rect x="17" y="13" width="14" height="6" rx="2" stroke="${B}"/>${line(24, 1, 24, 13, A, 1.5)}${line(24, 19, 24, 31, A, 1.5)}${line(2, 16, 17, 16, A, 1.5)}${line(31, 16, 46, 16, A, 1.5)}`),
  },
};
