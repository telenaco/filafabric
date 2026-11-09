// "Your picture" as a pattern, the same way in every design that has one. A design reads a pattern as a field over the
// piece, 0 to 1, high where it puts more (fuller loops, thicker lines, smaller and denser cells): a built-in pattern is
// one of fields.js, the picture is the uploaded image laid over the whole piece. Plain geometry: no DOM.
import { createField } from './fields.js';

/** The pattern id of the uploaded picture, in every pattern picker that offers it. */
export const PICTURE = 'image';

/** A design's pattern list with the picture added at the end. */
export const withPicture = (ids) => (ids.includes(PICTURE) ? [...ids] : [...ids, PICTURE]);

const levels = new WeakMap();

/**
 * The picture's own darkest and lightest tones (the 2nd and 98th percentile of its darkness), so a flat or washed-out
 * photo still spans the design's whole range. Measured once per picture.
 */
export function pictureLevels(image) {
  if (levels.has(image)) return levels.get(image);
  const { data } = image, count = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    count[Math.round((1 - lum) * 255)]++;
    n++;
  }
  const at = (q) => {
    let seen = 0;
    for (let k = 0; k < 256; k++) { seen += count[k]; if (seen >= q * n) return k / 255; }
    return 1;
  };
  let lo = at(0.02), hi = at(0.98);
  if (hi - lo < 0.04) { lo = 0; hi = 1; } // a picture of one tone: read it as it is
  const out = { lo, hi };
  levels.set(image, out);
  return out;
}

/**
 * How dark the picture is at (x, y) mm, 0 (white) to 1 (black), stretched to its own range. The picture covers the whole
 * piece, `width` x `height` mm, with y up; `offsetX`, `offsetY` place a window of it (a preview corner or a section).
 */
export function pictureDarkness(image, width, height, { offsetX = 0, offsetY = 0 } = {}) {
  const { data, width: w, height: h } = image, { lo, hi } = pictureLevels(image), span = Math.max(1e-6, hi - lo);
  return (x, y) => {
    const u = Math.max(0, Math.min(1, (x + offsetX) / width));
    const v = Math.max(0, Math.min(1, (height - (y + offsetY)) / height));
    const k = (Math.min(h - 1, Math.floor(v * h)) * w + Math.min(w - 1, Math.floor(u * w))) * 4;
    const dark = 1 - (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255;
    return Math.max(0, Math.min(1, (dark - lo) / span));
  };
}

/** The picture-contrast slider's range: 1 leaves the picture as it is. */
export const PICTURE_CONTRAST = Object.freeze({ min: 1, max: 5, step: 0.1 });

/**
 * The picture with its contrast raised: its tones are first stretched to its own range (as every design reads it), then
 * pulled apart around the middle grey, so close greys become clearly lighter or darker. A grey picture of the same size
 * comes back ({ data, width, height }, like ImageData); `contrast` 1 returns the picture itself.
 */
export function withContrast(image, contrast = 1) {
  if (!image || !(contrast > 1)) return image;
  const { data, width, height } = image, { lo, hi } = pictureLevels(image), span = Math.max(1e-6, hi - lo);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const dark = Math.max(0, Math.min(1, (1 - (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 - lo) / span));
    const grey = Math.round((1 - Math.max(0, Math.min(1, 0.5 + (dark - 0.5) * contrast))) * 255);
    out[i] = out[i + 1] = out[i + 2] = grey;
    out[i + 3] = 255;
  }
  return { data: out, width, height };
}

/**
 * A design's pattern as a field (x, y) -> 0..1, or null for no pattern. `picture` is { image, size: [w, h], offset } when
 * one is loaded; `polarity` says which way the design reads it: 'positive', the dark parts of the picture get more,
 * 'negative', the light parts do. Without a picture loaded, choosing it is the same as no pattern.
 */
export function patternField(pattern, { scale = 1, picture = null, polarity = 'positive' } = {}) {
  if (!pattern || pattern === 'none') return null;
  if (pattern === PICTURE) {
    if (!picture?.image || !picture.size) return null;
    const [w, h] = picture.size, [offsetX, offsetY] = picture.offset ?? [0, 0];
    const dark = pictureDarkness(picture.image, w, h, { offsetX, offsetY });
    return polarity === 'negative' ? (x, y) => 1 - dark(x, y) : dark;
  }
  return createField(pattern, { scale });
}
