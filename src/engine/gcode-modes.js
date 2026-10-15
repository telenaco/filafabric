/** Establish the writer's absolute XYZ / relative E modes before its prime macro and before the body. */
export function normalizeStartModes(lines) {
  const out = [];
  let absolute = false, relativeE = false;
  const ensure = () => {
    if (!absolute) { out.push('G90 ; absolute coordinates'); absolute = true; relativeE = false; }
    if (!relativeE) { out.push('M83 ; relative E'); relativeE = true; }
  };
  for (const line of lines.flatMap((line) => line.split(/\r?\n/))) {
    if (line.includes('{prime_line}')) ensure();
    out.push(line);
    const mode = /^\s*(G90|G91|M82|M83)\b/i.exec(line)?.[1].toUpperCase();
    if (mode === 'G90' || mode === 'G91') { absolute = mode === 'G90'; relativeE = false; }
    else if (mode === 'M82' || mode === 'M83') relativeE = mode === 'M83';
  }
  ensure();
  return out;
}
