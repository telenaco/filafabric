// Draws the Filafabric mark (the three arches over a line, the same drawing as favicon.svg) into the raster icons a
// browser or a phone asks for: favicon.ico (16, 32 and 48 px, PNG inside) and apple-touch-icon.png (180 px).
// No image library: the mark is a few strokes, rasterised here with 4 x 4 supersampling and written as plain PNG.
//
//   node tools/make-favicon.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BG = [0x17, 0x1c, 0x26];
const COLOURS = { blue: [0x8f, 0xa6, 0xf5], teal: [0x4f, 0xc3, 0xb8] };
const SHIFT = { x: 1, y: -2.75 }; // the same translate as favicon.svg, in its 32-unit box
const STROKE = 2.8;

const cubic = (p0, p1, p2, p3, n = 48) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [
    u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
  ];
});

// [polyline in the mark's own 30-unit drawing, colour, opacity]
const STROKES = [
  [cubic([3, 22], [3, 8], [12, 8], [12, 22]), COLOURS.blue, 1],
  [cubic([10, 22], [10, 8], [19, 8], [19, 22]), COLOURS.teal, 1],
  [cubic([17, 22], [17, 8], [26, 8], [26, 22]), COLOURS.blue, 1],
  [[[2, 26], [28, 26]], COLOURS.blue, 0.7],
].map(([pts, colour, alpha]) => ({ pts: pts.map(([x, y]) => [x + SHIFT.x, y + SHIFT.y]), colour, alpha }));

function distanceToPolyline(x, y, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Inside a 32-unit rounded square of corner radius r (a full square when r is 0)? */
function insideTile(x, y, r) {
  if (r <= 0) return x >= 0 && x <= 32 && y >= 0 && y <= 32;
  const cx = Math.min(Math.max(x, r), 32 - r), cy = Math.min(Math.max(y, r), 32 - r);
  return x >= 0 && x <= 32 && y >= 0 && y <= 32 && Math.hypot(x - cx, y - cy) <= r;
}

/** RGBA pixels of the mark at `size` px. `corner` is the tile's corner radius in 32-unit space (0: bleed to the edge). */
function raster(size, { corner = 7 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const k = 32 / size, sub = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < sub; sj++) {
        for (let si = 0; si < sub; si++) {
          const x = (i + (si + 0.5) / sub) * k, y = (j + (sj + 0.5) / sub) * k;
          if (!insideTile(x, y, corner)) continue;
          let c = BG;
          for (const s of STROKES) {
            if (distanceToPolyline(x, y, s.pts) <= STROKE / 2) c = c.map((v, n) => v + (s.colour[n] - v) * s.alpha);
          }
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const o = (j * size + i) * 4, n = sub * sub;
      if (a > 0) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(b / a); }
      px[o + 3] = Math.round((255 * a) / n);
    }
  }
  return px;
}

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(CRC(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(size, options) {
  const px = raster(size, options);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) px.copy(rows, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = 6; // 8 bits, RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function ico(sizes) {
  const images = sizes.map((s) => png(s));
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    head[e] = sizes[i] % 256; head[e + 1] = sizes[i] % 256; head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(img.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([head, ...images]);
}

export const faviconFiles = () => ({
  'favicon.ico': ico([16, 32, 48]),
  // a phone rounds the corners itself, so this one bleeds to the edge
  'apple-touch-icon.png': png(180, { corner: 0 }),
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [name, data] of Object.entries(faviconFiles())) {
    fs.writeFileSync(path.join(root, name), data);
    console.log(`wrote ${name} (${data.length} bytes)`);
  }
}
