/** Printable XY limits, including any deliberate loop reach beyond the selected sample. */
export function bedSizeLimits(machine, extraDepth = 0) {
  return { width: machine.bed.width, height: Math.max(0, machine.bed.depth - extraDepth) };
}

export function printSizeProblem(width, height, machine, extraDepth = 0) {
  const limits = bedSizeLimits(machine, extraDepth);
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return 'Enter positive, finite print dimensions.';
  if (width <= limits.width && height <= limits.height) return '';
  return `${width} × ${height} mm does not fit ${machine.name} (${limits.width} × ${limits.height} mm available${extraDepth ? ', allowing for loop overhang' : ''}). Choose a larger printer or reduce the print size.`;
}
