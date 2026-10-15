import { hatch } from './layers.js';
import { infillLines } from './infill.js';

/**
 * The second layer of a design that is a curve or a field held by lines laid across it: either straight lines at an
 * angle (a hatch), or the wavy lines of a gyroid slice, which cross the first layer at every kind of angle and can
 * give a little along their length where a straight line cannot.
 */
export const BACKING_STYLES = Object.freeze(['gyroid', 'straight']);

/**
 * @param style    'gyroid' | 'straight'
 * @param angle    degrees the whole backing is turned
 * @param spacing  mm between lines (area / length, the same for both styles, so they use the same filament)
 */
export function backingLines(boundary, { style = 'straight', angle = 45, spacing = 5 } = {}) {
  if (style === 'gyroid') return infillLines('gyroid', boundary, { spacing, angle, layer: 1 });
  return hatch(boundary, { angle, spacing });
}
