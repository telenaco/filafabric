import { parseSvg } from '../engine/svg-parse.js';

/**
 * Reads an SVG file into a drawing: paths in physical mm, each with the colour it is drawn in and its stroke width.
 * The file is parsed as text, so nothing in it is ever run or loaded.
 */
export async function readSvgLines(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('Use an SVG smaller than 12 MB.');
  return parseSvg(await file.text(), file.name);
}
