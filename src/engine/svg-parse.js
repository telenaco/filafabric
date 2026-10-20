// Reads an SVG file into a drawing: its paths as polylines in millimetres (y up, as the printer sees them), and for each
// path the colour it is drawn in (red, blue or other) and how wide its stroke is. No browser is involved, so the same
// reader runs in the page, in a worker and in the tests.
//
// What is read: path (all commands, arcs and curves), rect (rounded too), circle, ellipse, line, polyline, polygon;
// nested groups and transforms; fill, stroke and stroke-width from presentation attributes, a style attribute and a
// <style> sheet with simple selectors (tag, .class, #id). What is not: <use>, text, images, filters, gradients. Anything
// that is hidden (display:none) or that lies in <defs>, a clip path or a mask is left out.
import { sanitizeSvgLines } from './drawing.js';

const MM = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, pt: 25.4 / 72, pc: 25.4 / 6, q: 0.25, '': 25.4 / 96 };
const STEP_MM = 0.35; // curves are sampled about this finely
const MAX_POINTS = 100000;
const MAX_ELEMENTS = 20000;

export function svgDimensions({ width, height, viewBox } = {}) {
  const length = (s) => { const m = /^\s*([+\d.eE-]+)\s*(mm|cm|in|px|pt|pc|q)?\s*$/.exec(s ?? ''); return m && Number(m[1]) > 0 ? Number(m[1]) * MM[m[2] ?? ''] : null; };
  const box = String(viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const aspect = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : null;
  let w = length(width), h = length(height);
  if (w && !h && aspect) h = w / aspect;
  if (h && !w && aspect) w = h * aspect;
  if (!w && !h && aspect) { w = box[2] * MM.px; h = box[3] * MM.px; }
  if (!(w > 0 && h > 0) || w > 1000 || h > 1000) throw new Error('SVG width and height must resolve to 0–1000 mm. Export with millimetre dimensions or a viewBox.');
  return { width: Number(w.toFixed(8)), height: Number(h.toFixed(8)) };
}

/* ---------- XML ---------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '';
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const local = (name) => name.slice(name.indexOf(':') + 1);

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^>[]|\[[\s\S]*?\])*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gi;
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** A tolerant reader for the XML of an SVG: elements, attributes and text. Custom entities are not expanded. */
export function parseXml(text) {
  const root = { name: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(text))) {
    if (m[1] !== undefined) stack[stack.length - 1].text += m[1];
    else if (m[2] !== undefined) {
      const name = local(m[2]);
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].name === name) { stack.length = i; break; }
    } else if (m[3] !== undefined) {
      const attrs = {};
      ATTR.lastIndex = 0;
      let a;
      while ((a = ATTR.exec(m[4]))) attrs[a[1]] = decode(a[2] ?? a[3]);
      const node = { name: local(m[3]), attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!m[5]) {
        stack.push(node);
        if (stack.length > 200) throw new Error('This SVG is nested too deeply.');
      }
    } else if (m[6] !== undefined) stack[stack.length - 1].text += decode(m[6]);
  }
  return root;
}

/* ---------- CSS ---------- */

const declarations = (text) => {
  const out = {};
  for (const part of text.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).replace(/!important/i, '').trim();
    if (key) out[key] = value;
  }
  return out;
};

/** The simple rules of a style sheet: tag, .class, #id and a tag with classes. Anything fancier is ignored. */
function styleRules(sheets) {
  const rules = [];
  let order = 0;
  for (const sheet of sheets) {
    const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(clean))) {
      const decls = declarations(m[2]);
      for (const raw of m[1].split(',')) {
        const sel = /^\s*(\*|[a-z][\w-]*)?((?:[.#][\w-]+)*)\s*$/i.exec(raw);
        if (!sel) continue;
        const classes = [], ids = [];
        for (const part of sel[2].match(/[.#][\w-]+/g) ?? []) (part[0] === '.' ? classes : ids).push(part.slice(1));
        const tag = sel[1] && sel[1] !== '*' ? sel[1].toLowerCase() : null;
        rules.push({ tag, classes, ids, decls, specificity: ids.length * 100 + classes.length * 10 + (tag ? 1 : 0), order: order++ });
      }
    }
  }
  return rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
}

const PROPS = ['fill', 'stroke', 'stroke-width', 'display', 'color'];

function stylesOf(node, rules) {
  const out = {};
  for (const key of PROPS) if (node.attrs[key] !== undefined) out[key] = node.attrs[key].trim();
  const classes = (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
  for (const r of rules) {
    if (r.tag && r.tag !== node.name.toLowerCase()) continue;
    if (!r.classes.every((c) => classes.includes(c))) continue;
    if (!r.ids.every((i) => node.attrs.id === i)) continue;
    Object.assign(out, r.decls);
  }
  if (node.attrs.style) Object.assign(out, declarations(node.attrs.style));
  return out;
}

/* ---------- colour ---------- */

const NAMED = { red: [255, 0, 0], blue: [0, 0, 255], black: [0, 0, 0], white: [255, 255, 255], green: [0, 128, 0], lime: [0, 255, 0], yellow: [255, 255, 0], gray: [128, 128, 128], grey: [128, 128, 128] };

function rgbOf(value) {
  const v = value.toLowerCase();
  if (v in NAMED) return NAMED[v];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
    if (h.length === 6 || h.length === 8) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return null;
  }
  m = /^rgba?\(([^)]*)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length < 3) return null;
    const rgb = parts.map((p) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p)));
    return rgb.every(Number.isFinite) ? rgb.map((n) => Math.max(0, Math.min(255, Math.round(n)))) : null;
  }
  return null;
}

/** Semantic red/blue contours and CSS green/lime solids, with a little room for export rounding. */
function paintClass(value, current) {
  let v = String(value).trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return 'none';
  if (v === 'currentcolor') v = String(current ?? 'black').trim().toLowerCase();
  const rgb = rgbOf(v);
  if (!rgb) return 'other';
  const [r, g, b] = rgb;
  if (r >= 250 && g <= 5 && b <= 5) return 'red';
  if (b >= 250 && r <= 5 && g <= 5) return 'blue';
  if (g >= 120 && r <= 5 && b <= 5) return 'green';
  return 'other';
}

/* ---------- transforms ---------- */

const IDENTITY = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

export function parseTransform(text) {
  let m = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(text ?? ''))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (!a.every(Number.isFinite)) continue;
    let n = null;
    switch (t[1]) {
      case 'matrix': if (a.length === 6) n = a; break;
      case 'translate': n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
        n = [c, s, -s, c, 0, 0];
        if (a.length >= 3) n = mul(mul([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case 'skewX': n = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
      default: break;
    }
    if (n) m = mul(m, n);
  }
  return m;
}

/* ---------- path data ---------- */

const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;

class PathScanner {
  constructor(d) { this.d = d; this.i = 0; }
  skip() { while (this.i < this.d.length && /[\s,]/.test(this.d[this.i])) this.i++; }
  done() { this.skip(); return this.i >= this.d.length; }
  command() {
    this.skip();
    const c = this.d[this.i];
    if (c !== undefined && /[a-zA-Z]/.test(c)) { this.i++; return c; }
    return null;
  }
  number() {
    this.skip();
    NUMBER.lastIndex = this.i;
    const m = NUMBER.exec(this.d);
    if (!m) throw new Error('Incomplete SVG path');
    this.i = NUMBER.lastIndex;
    return Number(m[0]);
  }
  flag() {
    this.skip();
    const c = this.d[this.i];
    if (c !== '0' && c !== '1') throw new Error('Incomplete SVG path');
    this.i++;
    return Number(c);
  }
}

const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.ceil(n)));

function arcPoints(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2, mmPerUnit) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (phiDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const k = Math.sqrt(lambda); rx *= k; ry *= k; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const t1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const t2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let dt = t2 - t1;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = clampInt((Math.abs(dt) * Math.max(rx, ry) * mmPerUnit) / STEP_MM, 4, 400);
  const out = [];
  for (let k = 1; k < n; k++) {
    const t = t1 + (dt * k) / n;
    out.push([cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx, sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy]);
  }
  out.push([x2, y2]);
  return out;
}

/** Path data as subpaths of points in the path's own units: [{ pts: [[x, y], …], closed }]. `mmPerUnit` sets the sampling. */
export function pathSubpaths(d, mmPerUnit = 1) {
  const sc = new PathScanner(String(d ?? ''));
  const subs = [];
  let cur = null, cmd = null, x = 0, y = 0, sx = 0, sy = 0, cpx = 0, cpy = 0, prev = '';
  const begin = (px, py) => { cur = { pts: [[px, py]], closed: false }; subs.push(cur); };
  const ensure = () => { if (!cur) begin(x, y); };
  const line = (px, py) => { ensure(); cur.pts.push([px, py]); x = px; y = py; };
  while (!sc.done()) {
    const c = sc.command();
    if (c) {
      if (!'MmLlHhVvCcSsQqTtAaZz'.includes(c)) throw new Error('Unsupported SVG path command');
      cmd = c;
    } else if (!cmd || cmd === 'Z' || cmd === 'z') throw new Error('Incomplete SVG path');
    const rel = cmd === cmd.toLowerCase(), up = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (up) {
      case 'Z':
        if (cur) {
          const last = cur.pts[cur.pts.length - 1];
          if (Math.hypot(last[0] - sx, last[1] - sy) > 1e-9) cur.pts.push([sx, sy]);
          cur.closed = true;
        }
        x = sx; y = sy; cur = null;
        break;
      case 'M': {
        const px = sc.number() + ox, py = sc.number() + oy;
        x = px; y = py; sx = px; sy = py;
        begin(px, py);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': line(sc.number() + ox, sc.number() + oy); break;
      case 'H': line(sc.number() + ox, y); break;
      case 'V': line(x, sc.number() + oy); break;
      case 'C': case 'S': {
        let x1, y1;
        if (up === 'C') { x1 = sc.number() + ox; y1 = sc.number() + oy; } else if ('CcSs'.includes(prev)) { x1 = 2 * x - cpx; y1 = 2 * y - cpy; } else { x1 = x; y1 = y; }
        const x2 = sc.number() + ox, y2 = sc.number() + oy, px = sc.number() + ox, py = sc.number() + oy;
        ensure();
        const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(px - x2, py - y2);
        const n = clampInt((len * mmPerUnit) / STEP_MM, 4, 300);
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t;
          cur.pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * px, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * py]);
        }
        cpx = x2; cpy = y2; x = px; y = py;
        break;
      }
      case 'Q': case 'T': {
        let x1, y1;
        if (up === 'Q') { x1 = sc.number() + ox; y1 = sc.number() + oy; } else if ('QqTt'.includes(prev)) { x1 = 2 * x - cpx; y1 = 2 * y - cpy; } else { x1 = x; y1 = y; }
        const px = sc.number() + ox, py = sc.number() + oy;
        ensure();
        const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(px - x1, py - y1);
        const n = clampInt((len * mmPerUnit) / STEP_MM, 3, 300);
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t;
          cur.pts.push([u * u * x + 2 * u * t * x1 + t * t * px, u * u * y + 2 * u * t * y1 + t * t * py]);
        }
        cpx = x1; cpy = y1; x = px; y = py;
        break;
      }
      case 'A': {
        const rx = sc.number(), ry = sc.number(), rot = sc.number(), large = sc.flag(), sweep = sc.flag();
        const px = sc.number() + ox, py = sc.number() + oy;
        ensure();
        for (const p of arcPoints(x, y, rx, ry, rot, large, sweep, px, py, mmPerUnit)) cur.pts.push(p);
        x = px; y = py;
        break;
      }
      default: break;
    }
    prev = cmd;
  }
  return subs.filter((s) => s.pts.length >= 2);
}

/* ---------- the document ---------- */

const SKIP = new Set(['defs', 'clippath', 'mask', 'symbol', 'marker', 'pattern', 'style', 'script', 'foreignobject', 'metadata', 'title', 'desc', 'text', 'image', 'use', 'filter', 'lineargradient', 'radialgradient', 'namedview']);
const GROUPS = new Set(['svg', 'g', 'a', 'switch']);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

const findAll = (node, name, out = []) => {
  if (node.name === name) out.push(node);
  for (const c of node.children) findAll(c, name, out);
  return out;
};

/**
 * @param text  the file's text
 * @param name  the file's name, kept with the drawing
 * @returns { name, width, height, paths, styles } with paths in mm, y up; throws an Error with a plain message
 */
export function parseSvg(text, name = 'SVG lines') {
  const doc = parseXml(String(text));
  const svg = findAll(doc, 'svg')[0];
  if (!svg) throw new Error('That file is not readable SVG.');
  const size = svgDimensions({ width: svg.attrs.width, height: svg.attrs.height, viewBox: svg.attrs.viewBox });
  // user units to millimetres, and where the viewBox sits on the page (xMidYMid meet, the default)
  const box = String(svg.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const hasBox = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0;
  const view = hasBox ? box : [0, 0, size.width / MM.px, size.height / MM.px];
  const unit = hasBox ? Math.min(size.width / view[2], size.height / view[3]) : MM.px;
  const originX = (size.width - view[2] * unit) / 2, originY = (size.height - view[3] * unit) / 2;
  const round = (n) => Math.round(n * 1e4) / 1e4;

  const rules = styleRules(findAll(svg, 'style').map((s) => s.text));
  const paths = [], styles = [];
  let points = 0, elements = 0;

  const lengthOf = (value, fallback = 0) => {
    const m = /^\s*([+-]?[\d.]+(?:[eE][+-]?\d+)?)\s*(mm|cm|in|px|pt|pc|q)?\s*$/.exec(value ?? '');
    if (!m) return fallback;
    return Number(m[1]) * (m[2] ? MM[m[2]] / unit : 1);
  };

  const visit = (node, ctm, inherited) => {
    const lname = node.name.toLowerCase();
    if (SKIP.has(lname)) return;
    const own = stylesOf(node, rules);
    if (own.display === 'none') return;
    const style = {
      fill: own.fill !== undefined && own.fill !== 'inherit' ? paintClass(own.fill, own.color ?? inherited.color) : inherited.fill,
      stroke: own.stroke !== undefined && own.stroke !== 'inherit' ? paintClass(own.stroke, own.color ?? inherited.color) : inherited.stroke,
      strokeWidth: own['stroke-width'] !== undefined && own['stroke-width'] !== 'inherit' && /\d/.test(own['stroke-width']) ? lengthOf(own['stroke-width'], inherited.strokeWidth) : inherited.strokeWidth,
      color: own.color ?? inherited.color,
    };
    const here = node.attrs.transform ? mul(ctm, parseTransform(node.attrs.transform)) : ctm;
    if (GROUPS.has(lname)) {
      for (const child of node.children) visit(child, here, style);
      return;
    }
    if (!SHAPES.has(lname)) return;
    if (++elements > MAX_ELEMENTS) throw new Error('This SVG has too many shapes. Simplify the drawing before importing it.');

    const semantic = (color) => ['red', 'blue', 'green'].includes(color);
    const color = semantic(style.stroke) && !semantic(style.fill) ? style.stroke : style.fill !== 'none' ? style.fill : style.stroke;
    if (color === 'none') return; // neither filled nor stroked: not drawn
    const det = Math.abs(here[0] * here[3] - here[1] * here[2]);
    const scale = Math.sqrt(det) || 1;
    const mmPerUnit = unit * scale;
    const num = (key) => lengthOf(node.attrs[key], 0);
    let subs = [];
    const a = node.attrs;
    switch (lname) {
      case 'path': subs = pathSubpaths(a.d, mmPerUnit); break;
      case 'rect': {
        const x = num('x'), y = num('y'), w = num('width'), h = num('height');
        if (!(w > 0 && h > 0)) return;
        let rx = a.rx !== undefined ? num('rx') : a.ry !== undefined ? num('ry') : 0, ry = a.ry !== undefined ? num('ry') : rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        subs = pathSubpaths(rx > 0 && ry > 0
          ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
          : `M${x} ${y}H${x + w}V${y + h}H${x}Z`, mmPerUnit);
        break;
      }
      case 'circle': case 'ellipse': {
        const cx = num('cx'), cy = num('cy');
        const rx = lname === 'circle' ? num('r') : num('rx'), ry = lname === 'circle' ? rx : num('ry');
        if (!(rx > 0 && ry > 0)) return;
        subs = pathSubpaths(`M${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}Z`, mmPerUnit);
        break;
      }
      case 'line': subs = [{ pts: [[num('x1'), num('y1')], [num('x2'), num('y2')]], closed: false }]; break;
      default: { // polyline, polygon
        const n = (a.points ?? '').match(/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g)?.map(Number) ?? [];
        const pts = [];
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
        if (lname === 'polygon' && pts.length > 2) pts.push([...pts[0]]);
        if (pts.length >= 2) subs = [{ pts, closed: lname === 'polygon' }];
        break;
      }
    }
    const widthMm = style.stroke === 'none' ? 0 : round(style.strokeWidth * scale * unit);
    for (const sub of subs) {
      points += sub.pts.length;
      if (points > MAX_POINTS) throw new Error('This SVG needs more than 100,000 sampled points. Simplify the drawing before importing it.');
      paths.push(sub.pts.map(([px, py]) => {
        const X = here[0] * px + here[2] * py + here[4], Y = here[1] * px + here[3] * py + here[5];
        return { x: round(originX + (X - view[0]) * unit), y: round(size.height - (originY + (Y - view[1]) * unit)) };
      }));
      styles.push({ color, width: widthMm });
    }
  };

  visit(svg, IDENTITY, { fill: 'other', stroke: 'none', strokeWidth: 1, color: 'black' });
  if (!paths.length) throw new Error('No printable paths were found. Convert text to paths and export vector strokes.');
  const result = sanitizeSvgLines({ name, ...size, paths, styles });
  if (!result) throw new Error('The SVG contains invalid geometry.');
  return result;
}
